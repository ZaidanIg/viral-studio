// background.js
// Service Worker for Viral Studio Flow Bridge Extension

const DEFAULT_PROJECT_ID = '101c3bc7-a06a-4dcb-8276-f8ef76202717';  // GEM_PIX_2 Pro
const FALLBACK_PROJECT_ID = '7d6e4671-4922-4330-8407-f02bcb0cca73'; // GEM_PIX regular
const BASE_ENDPOINT = 'https://aisandbox-pa.googleapis.com/v1/projects/{projectId}/flowMedia:batchGenerateImages';
const UPLOAD_ENDPOINT = 'https://aisandbox-pa.googleapis.com/v1:uploadUserImage';

// Helper to wait
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ─────────────────────────────────────────────────────────────
// Token Cache (populated by content-interceptor.js on labs.google)
// ─────────────────────────────────────────────────────────────
let cachedToken = null;
let cachedTokenTs = 0;
const TOKEN_TTL_MS = 90 * 1000; // reCAPTCHA tokens last ~2 min, we use 90s

let cachedBearer = null;
let cachedBearerTs = 0;
const BEARER_TTL_MS = 55 * 60 * 1000; // OAuth2 tokens last 60 min, we use 55min

let cachedProjectId = null;
let cachedProjectIdTs = 0;
const PROJECT_ID_TTL_MS = 24 * 60 * 60 * 1000; // Project IDs are fairly static, cache for 24h

// Relay messages from content-relay.js
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'VS_RECAPTCHA_TOKEN_CAPTURED') {
    console.log('[Background] Received intercepted reCAPTCHA token, length:', message.token?.length);
    cachedToken = message.token;
    cachedTokenTs = Date.now();
  }
  if (message.type === 'VS_BEARER_TOKEN_CAPTURED') {
    console.log('[Background] Received intercepted Bearer token, length:', message.bearer?.length);
    cachedBearer = message.bearer;
    cachedBearerTs = Date.now();
  }
  if (message.type === 'VS_PROJECT_ID_CAPTURED') {
    console.log('[Background] Received intercepted Project ID:', message.projectId);
    cachedProjectId = message.projectId;
    cachedProjectIdTs = Date.now();
  }
  if (message.type === 'VS_PAYLOAD_TEMPLATE_CAPTURED') {
    console.log('[Background] Received intercepted Payload Template');
    cachedPayloadTemplate = message.payloadTemplate;
  }
});

let cachedPayloadTemplate = null;

function getCachedToken() {
  if (cachedToken && (Date.now() - cachedTokenTs) < TOKEN_TTL_MS) {
    console.log('[Background] Using intercepted reCAPTCHA token, age:', Math.round((Date.now() - cachedTokenTs) / 1000), 's');
    return cachedToken;
  }
  return null;
}

function getCachedBearer() {
  if (cachedBearer && (Date.now() - cachedBearerTs) < BEARER_TTL_MS) {
    console.log('[Background] Using intercepted Bearer token, age:', Math.round((Date.now() - cachedBearerTs) / 1000), 's');
    return cachedBearer;
  }
  return null;
}

function getCachedProjectId() {
  if (cachedProjectId && (Date.now() - cachedProjectIdTs) < PROJECT_ID_TTL_MS) {
    console.log('[Background] Using intercepted Project ID:', cachedProjectId);
    return cachedProjectId;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// Execute fetch from inside the labs.google.com tab context
// (required so Origin/cookies are from labs.google.com)
// ─────────────────────────────────────────────────────────────
async function fetchFromLabsTab(tabId, url, headers, bodyPayload) {
  console.log(`[Extension] Executing fetch from inside labs.google.com tab ${tabId}...`);
  const results = await chrome.scripting.executeScript({
    target: { tabId: tabId },
    world: 'MAIN',
    func: async (fetchUrl, fetchHeaders, fetchBody) => {
      try {
        const res = await fetch(fetchUrl, {
          method: 'POST',
          credentials: 'include',
          mode: 'cors',
          headers: fetchHeaders,
          body: fetchBody
        });
        const text = await res.text();
        return { ok: res.ok, status: res.status, text: text };
      } catch (err) {
        return { ok: false, status: 0, text: err.message || 'Fetch failed inside tab' };
      }
    },
    args: [url, headers, bodyPayload]
  });

  const out = results[0].result;
  if (!out.ok) {
    throw new Error(`Flow Media API Error: ${out.status} - ${out.text}\nPayload Sent: ${bodyPayload}`);
  }
  return JSON.parse(out.text);
}

function normalizeBearer(rawBearer) {
  if (!rawBearer) return '';
  let cleaned = String(rawBearer).replace(/[\r\n]+/g, ' ').trim();
  cleaned = cleaned.replace(/^Bearer\s+/i, '').trim();
  return `Bearer ${cleaned}`;
}

// ─────────────────────────────────────────────────────────────
// Get or create labs.google.com tab
// ─────────────────────────────────────────────────────────────
async function getLabsTab() {
  // labs.google (NOT labs.google.com!) is the correct domain
  const tabs = await chrome.tabs.query({ url: '*://labs.google/*' });
  let tab = tabs.length > 0 ? tabs[0] : null;

  if (!tab) {
    // Open in foreground so it's treated as a real user tab
    tab = await chrome.tabs.create({ url: 'https://labs.google/fx', active: true });

    await new Promise((resolve) => {
      chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
        if (tabId === tab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      });
    });
    // Warmup: wait for reCAPTCHA + page scripts to initialize
    await sleep(4000);
  } else {
    console.log(`[Extension] Found existing labs.google tab: ${tab.id} - ${tab.url}`);
  }
  return tab;
}

// ─────────────────────────────────────────────────────────────
// Get reCAPTCHA token
// Strategy 1: Use an intercepted token from the user's real session
// Strategy 2: Generate one from the labs.google.com tab
// ─────────────────────────────────────────────────────────────
async function getRecaptchaToken(tab, action = 'IMAGE_GENERATION') {
  // Strategy 1: Use cached intercepted token (from real user interaction)
  const intercepted = getCachedToken();
  if (intercepted) {
    console.log('[Extension] Using intercepted real reCAPTCHA token.');
    return intercepted;
  }

  // Strategy 2: Generate token from lab tab (may fail without user interaction)
  console.log(`[Extension] No intercepted token found. Generating fresh token (action: ${action})...`);
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: async (recaptchaAction, fallbackSiteKey) => {
        const sleep = (ms) => new Promise(r => setTimeout(r, ms));

        const detectSiteKey = () => {
          try {
            for (const s of document.querySelectorAll('script[src]')) {
              const src = String(s.getAttribute('src') || '');
              if (src.includes('recaptcha') && src.includes('enterprise.js')) {
                try {
                  const u = new URL(src, location.href);
                  const k = u.searchParams.get('render');
                  if (k && k.trim()) return k.trim();
                } catch (_) {}
              }
            }
          } catch (_) {}
          return fallbackSiteKey;
        };

        const siteKey = detectSiteKey();

        // Inject enterprise if not already loaded
        if (!window.grecaptcha?.enterprise) {
          if (!window.__vsRcPromise) {
            window.__vsRcPromise = new Promise((resolve, reject) => {
              let s = document.querySelector('script[data-vs-rc="1"]');
              if (!s) {
                s = document.createElement('script');
                s.src = 'https://www.google.com/recaptcha/enterprise.js?render=' + encodeURIComponent(siteKey);
                s.async = true;
                s.dataset.vsRc = '1';
                (document.head || document.documentElement).appendChild(s);
              }
              if (window.grecaptcha?.enterprise) { resolve(); return; }
              s.addEventListener('load', resolve, { once: true });
              s.addEventListener('error', reject, { once: true });
              const t = setInterval(() => {
                if (window.grecaptcha?.enterprise) { clearInterval(t); resolve(); }
              }, 100);
              setTimeout(() => { clearInterval(t); reject(new Error('reCAPTCHA load timeout')); }, 15000);
            });
          }
          await window.__vsRcPromise;
          // Poll until ready
          const start = Date.now();
          while (!window.grecaptcha?.enterprise) {
            if (Date.now() - start > 10000) throw new Error('reCAPTCHA Enterprise never became ready');
            await sleep(100);
          }
        }

        await new Promise(r => window.grecaptcha.enterprise.ready(r));
        return await window.grecaptcha.enterprise.execute(siteKey, { action: recaptchaAction });
      },
      args: [action, '6LdsFiUsAAAAAIjVDZcuLhaHiDn5nnHVXVRQGeMV']
    });

    const token = results[0].result;
    if (!token || typeof token !== 'string') {
      throw new Error('Got empty reCAPTCHA token. Please open labs.google.com in your browser and use it once to warm up the session.');
    }
    console.log(`[Extension] Generated fresh reCAPTCHA token (length: ${token.length}).`);
    return token;
  } catch (err) {
    console.error('[Extension] Failed to get reCAPTCHA token:', err);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────
// Call Flow Media API
// ─────────────────────────────────────────────────────────────
async function callFlowMediaApi(payload, recaptchaToken, tab) {
  const {
    prompt,
    imageModelName = 'GEM_PIX_2',
    imageAspectRatio = 'IMAGE_ASPECT_RATIO_PORTRAIT',
    bearerToken,
    flowProjectId,
    imageInputs = [],
  } = payload;
  
  // Extract project ID from the active labs tab URL if possible
  const labsUrlMatch = tab.url ? tab.url.match(/project\/([a-f0-9\-]+)/i) : null;
  const tabProjectId = labsUrlMatch ? labsUrlMatch[1] : null;

  const effectiveProjectId = flowProjectId || tabProjectId || DEFAULT_PROJECT_ID;

  console.log(`[Extension] Using Project ID: ${effectiveProjectId}`);
  
  const endpoint = BASE_ENDPOINT.replace('{projectId}', effectiveProjectId);

  const sessionId = `;${Date.now()}`;
  const recaptchaContext = {
    token: recaptchaToken,
    applicationType: 'RECAPTCHA_APPLICATION_TYPE_WEB',
  };

  const requestPayload = {
    clientContext: {
      recaptchaContext,
      sessionId,
      projectId: effectiveProjectId,
      tool: 'PINHOLE',
    },
    requests: [
      {
        clientContext: {
          recaptchaContext,
          sessionId,
          projectId: effectiveProjectId,
          tool: 'PINHOLE',
        },
        seed: Math.floor(Math.random() * 1000000),
        imageModelName,
        imageAspectRatio,
        prompt,
        imageInputs,
      },
    ],
  };

  // Use user-provided bearer token, fall back to auto-captured one from labs.google
  const effectiveBearer = bearerToken || getCachedBearer();
  if (!effectiveBearer) {
    throw new Error('No Bearer token available. Please generate an image on labs.google first, or enter your Bearer token manually.');
  }

  const headers = {
    'Accept': '*/*',
    'Content-Type': 'text/plain;charset=UTF-8',
    'Authorization': normalizeBearer(effectiveBearer),
  };

  console.log(`[Extension] Sending fetch request to Flow Media API via tab...`);
  return await fetchFromLabsTab(tab.id, endpoint, headers, JSON.stringify(requestPayload));
}

// ─────────────────────────────────────────────────────────────
// Upload Image API
// ─────────────────────────────────────────────────────────────
async function uploadFlowImageApi(payload, tab) {
  const { imageBase64, bearerToken, aspectRatio = 'IMAGE_ASPECT_RATIO_PORTRAIT' } = payload;

  // Extract project ID from the active labs tab URL if possible
  const labsUrlMatch = tab.url ? tab.url.match(/project\/([a-f0-9\-]+)/i) : null;
  const tabProjectId = labsUrlMatch ? labsUrlMatch[1] : null;

  // Prioritize payload > tab > default
  const effectiveProjectId = payload.flowProjectId || tabProjectId || DEFAULT_PROJECT_ID;

  const requestPayload = {
    imageInput: {
      rawImageBytes: imageBase64,
      mimeType: 'image/jpeg',
      isUserUploaded: true,
      aspectRatio,
    },
    clientContext: {
      sessionId: `;${Date.now()}`,
      tool: 'ASSET_MANAGER',
    },
  };

  // Use user-provided bearer token, fall back to auto-captured one from labs.google
  const effectiveBearer = bearerToken || getCachedBearer();
  if (!effectiveBearer) {
    throw new Error('No Bearer token available. Please generate an image on labs.google first, or enter your Bearer token manually.');
  }

  const headers = {
    'Accept': '*/*',
    'Content-Type': 'application/json',
    'Authorization': normalizeBearer(effectiveBearer),
  };

  console.log(`[Extension] Sending fetch request to Upload Image API via tab...`);
  return await fetchFromLabsTab(tab.id, UPLOAD_ENDPOINT, headers, JSON.stringify(requestPayload));
}

// ─────────────────────────────────────────────────────────────
// Message Listener
// ─────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'VS_RECAPTCHA_TOKEN_CAPTURED') {
    // Already handled above, just ignore here
    return false;
  }
  
  if (message.type === 'GENERATE_FLOW_MEDIA') {
    console.log(`[Extension] Received GENERATE_FLOW_MEDIA request`);

    (async () => {
      try {
        const tab = await getLabsTab();
        const effectiveProjectId = message.payload.flowProjectId || DEFAULT_PROJECT_ID;
        
        const attemptGenerate = async (modelName) => {
          let token = await getRecaptchaToken(tab, 'PINHOLE_GENERATE_IMAGE');
          let payloadWithModel = { ...message.payload, imageModelName: modelName, flowProjectId: effectiveProjectId };
          try {
            return await callFlowMediaApi(payloadWithModel, token, tab);
          } catch (err) {
            if (String(err.message).includes('403') || String(err.message).includes('reCAPTCHA evaluation failed')) {
              console.warn(`[Extension] 403 on ${modelName} — invalidating token cache and retrying...`);
              cachedToken = null;
              cachedTokenTs = 0;
              await chrome.tabs.reload(tab.id, { bypassCache: true });
              await sleep(4000);
              token = await getRecaptchaToken(tab, 'IMAGE_GENERATION');
              return await callFlowMediaApi(payloadWithModel, token, tab);
            }
            throw err;
          }
        };

        let apiResponse;
        try {
          console.log('[Extension] Trying GEM_PIX_2 Pro...');
          apiResponse = await attemptGenerate('GEM_PIX_2');
        } catch (err) {
          console.warn('[Extension] GEM_PIX_2 failed:', String(err.message));
          
          try {
             apiResponse = await attemptGenerate('NARWHAL');
             console.log('[Extension] NARWHAL fallback SUCCESS!');
          } catch (errNarwhal) {
             console.warn('[Extension] NARWHAL fallback failed:', String(errNarwhal.message));
             console.warn('[Extension] Falling back to R2I...');
             
             try {
               apiResponse = await attemptGenerate('R2I');
               console.log('[Extension] R2I fallback SUCCESS!');
             } catch (errR2I) {
               console.warn('[Extension] ALL MODELS FAILED. R2I error:', String(errR2I.message));
               throw new Error('SEMUA MODEL AI GOOGLE MENGALAMI CRASH (500). Mohon coba ganti gambar referensi Anda atau coba beberapa saat lagi.\nDetail Error Terakhir: ' + String(errR2I.message));
             }
          }
        }

        sendResponse(apiResponse);
      } catch (err) {
        sendResponse({ error: true, message: err.message || 'Unknown error' });
      }
    })();

    return true;
  }

  if (message.type === 'UPLOAD_IMAGE') {
    console.log(`[Extension] Received UPLOAD_IMAGE request`);

    (async () => {
      try {
        const tab = await getLabsTab();
        const apiResponse = await uploadFlowImageApi(message.payload, tab);
        sendResponse(apiResponse);
      } catch (err) {
        sendResponse({ error: true, message: err.message || 'Unknown error' });
      }
    })();

    return true;
  }
});

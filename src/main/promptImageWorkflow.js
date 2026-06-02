// electron/promptImageWorkflow2.js
// Clean Prompt-to-Image workflow using inline credential JSON

const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, session } = require('electron');
const { getUserAgent } = require('./userAgentStore.js');
const os = require('os');

// --- i18n: Image workflow messages ---
const IMAGE_MESSAGES = {
  en: {
    outputFolderMissing: 'Global Output Folder is not configured. Open Settings.',
    bearerTokenMissing: 'Bearer token is missing! Please configure Global Bearer Token in Settings.',
    startingWorkflow: 'Starting workflow Prompt to Image (GEM_PIX)...',
    noPromptsSent: 'No prompts were sent from textarea. Please fill in prompts then click Generate.',
    usingTextareaPrompts: 'Using prompts from textarea...',
    totalPrompts: (count) => `Total prompts to process: ${count}`,
    limitingPrompts: (count) => `Limiting total prompts to ${count} based on selected image count.`,
    noPromptsToProcess: 'No prompts to process.',
    parallelismReduced: (from, to) => `Parallelism reduced from ${from} to ${to} to prevent 403 errors (Flow Ultra best practice)`,
    usingBatchSize: (size) => `Using batch size: ${size}`,
    startingBatch: (count) => `Starting batch with ${count} prompts`,
    processingBatch: (batch, total, count) => `Processing batch ${batch} of ${total} (${count} images)...`,
    promptEmpty: (row) => `Prompt is empty at row ${row}. Skipping...`,
    startingImageGen: 'Starting image generation process...',
    imageSuccess: (model, filename) => `✅ Image successful via ${model}: ${filename}`,
    imageFailed: (prompt, err) => `Failed to process "${prompt}": ${err}`,
    progress: (processed, total) => `Progress: ${processed}/${total} images processed`,
    workflowComplete: (success, fail) => `✅ Workflow complete! ${success} successful, ${fail} failed.`,
    batchComplete: (success, total) => `Batch completed: ${success}/${total} images generated successfully`,
    resultSummary: (total, success, fail) => `Processed ${total} prompts: ${success} successful, ${fail} failed`,
  },
  id: {
    outputFolderMissing: 'Folder Output global belum dikonfigurasi. Buka halaman Pengaturan.',
    bearerTokenMissing: 'Bearer token belum diisi! Silakan konfigurasi Global Bearer Token di halaman Pengaturan.',
    startingWorkflow: 'Memulai workflow Prompt to Image (GEM_PIX)...',
    noPromptsSent: 'Tidak ada prompts yang dikirim dari textarea. Silakan isi prompt lalu klik Generate.',
    usingTextareaPrompts: 'Menggunakan prompt dari textarea...',
    totalPrompts: (count) => `Total prompt yang akan diproses: ${count}`,
    limitingPrompts: (count) => `Membatasi total prompt menjadi ${count} sesuai jumlah gambar yang dipilih.`,
    noPromptsToProcess: 'Tidak ada prompt yang perlu diproses.',
    parallelismReduced: (from, to) => `Parallelism dikurangi dari ${from} ke ${to} untuk mencegah error 403 (Flow Ultra best practice)`,
    usingBatchSize: (size) => `Menggunakan batch size: ${size}`,
    startingBatch: (count) => `Memulai batch dengan ${count} prompt`,
    processingBatch: (batch, total, count) => `Memproses batch ${batch} dari ${total} (${count} gambar)...`,
    promptEmpty: (row) => `Prompt kosong di baris ${row}. Melewati...`,
    startingImageGen: 'Memulai proses pembuatan gambar...',
    imageSuccess: (model, filename) => `✅ Image berhasil via ${model}: ${filename}`,
    imageFailed: (prompt, err) => `Gagal memproses "${prompt}": ${err}`,
    progress: (processed, total) => `Progres: ${processed}/${total} gambar diproses`,
    workflowComplete: (success, fail) => `✅ Workflow selesai! ${success} berhasil, ${fail} gagal.`,
    batchComplete: (success, total) => `Batch selesai: ${success}/${total} gambar berhasil di-generate`,
    resultSummary: (total, success, fail) => `Memproses ${total} prompt: ${success} berhasil, ${fail} gagal`,
  },
  ms: {
    outputFolderMissing: 'Folder Output global belum dikonfigurasi. Buka halaman Tetapan.',
    bearerTokenMissing: 'Bearer token belum diisi! Sila konfigurasi Global Bearer Token di halaman Tetapan.',
    startingWorkflow: 'Memulakan workflow Prompt to Image (GEM_PIX)...',
    noPromptsSent: 'Tiada prompt yang dihantar dari textarea. Sila isi prompt kemudian klik Generate.',
    usingTextareaPrompts: 'Menggunakan prompt dari textarea...',
    totalPrompts: (count) => `Jumlah prompt untuk diproses: ${count}`,
    limitingPrompts: (count) => `Mengehadkan jumlah prompt kepada ${count} mengikut bilangan imej yang dipilih.`,
    noPromptsToProcess: 'Tiada prompt untuk diproses.',
    parallelismReduced: (from, to) => `Parallelism dikurangkan dari ${from} ke ${to} untuk mengelak ralat 403 (Flow Ultra best practice)`,
    usingBatchSize: (size) => `Menggunakan saiz batch: ${size}`,
    startingBatch: (count) => `Memulakan batch dengan ${count} prompt`,
    processingBatch: (batch, total, count) => `Memproses batch ${batch} daripada ${total} (${count} imej)...`,
    promptEmpty: (row) => `Prompt kosong di baris ${row}. Melangkau...`,
    startingImageGen: 'Memulakan proses penjanaan imej...',
    imageSuccess: (model, filename) => `✅ Imej berjaya melalui ${model}: ${filename}`,
    imageFailed: (prompt, err) => `Gagal memproses "${prompt}": ${err}`,
    progress: (processed, total) => `Kemajuan: ${processed}/${total} imej diproses`,
    workflowComplete: (success, fail) => `✅ Workflow selesai! ${success} berjaya, ${fail} gagal.`,
    batchComplete: (success, total) => `Batch selesai: ${success}/${total} imej berjaya dijana`,
    resultSummary: (total, success, fail) => `Memproses ${total} prompt: ${success} berjaya, ${fail} gagal`,
  },
};

function getImageMsg(lang) {
  return IMAGE_MESSAGES[lang] || IMAGE_MESSAGES['en'];
}

// --- API Configuration ---
const API_ENDPOINTS = {
  // GEM_PIX_2 (Nano Banana Pro) text-to-image via Flow Media (new project)
  GENERATE_PRO:
    'https://aisandbox-pa.googleapis.com/v1/projects/101c3bc7-a06a-4dcb-8276-f8ef76202717/flowMedia:batchGenerateImages',
  // GEM_PIX (Nano Banana reguler) text-to-image via Flow Media (fallback project)
  GENERATE_FALLBACK:
    'https://aisandbox-pa.googleapis.com/v1/projects/7d6e4671-4922-4330-8407-f02bcb0cca73/flowMedia:batchGenerateImages',
  // Shared upload endpoint used by Labs for reference images (same as VEO uploadUserImage)
  UPLOAD_IMAGE: 'https://aisandbox-pa.googleapis.com/v1:uploadUserImage',
};

function buildFlowMediaBatchGenerateUrl(flowProjectId) {
  const id = String(flowProjectId || '').trim();
  if (!id) return null;
  return `https://aisandbox-pa.googleapis.com/v1/projects/${id}/flowMedia:batchGenerateImages`;
}

function friendlyModelName(model) {
  const key = String(model || '').toUpperCase();
  if (key === 'GEM_PIX_2') return 'Nano Banana Pro';
  if (key === 'NARWHAL') return 'Nano Banana 2';
  if (key === 'GEM_PIX') return 'Nano Banana';
  if (key === 'R2I' || key === 'IMAGEN_3_5') return 'Imagen 4';
  return model || '';
}

const ASPECT_RATIO_MAP = {
  '1:1': 'IMAGE_ASPECT_RATIO_SQUARE',
  '16:9': 'IMAGE_ASPECT_RATIO_LANDSCAPE',
  '9:16': 'IMAGE_ASPECT_RATIO_PORTRAIT',
  '3:4': 'IMAGE_ASPECT_RATIO_PORTRAIT_THREE_FOUR',
  '4:3': 'IMAGE_ASPECT_RATIO_LANDSCAPE_FOUR_THREE',
};

const RECAPTCHA_SITE_KEY = '6LdsFiUsAAAAAIjVDZcuLhaHiDn5nnHVXVRQGeMV';
const RECAPTCHA_ACTION = 'IMAGE_GENERATION';
// keep legacy action as fallback in case backend still accepts older names
const RECAPTCHA_ACTION_FALLBACK = 'PINHOLE_GENERATE_IMAGE';
const RECAPTCHA_APPLICATION_TYPE = 'RECAPTCHA_APPLICATION_TYPE_WEB';

const getLabsUserAgent = () => getUserAgent();

// Random helpers for fingerprint rotation
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const idx = Math.floor(Math.random() * arr.length);
  return arr[idx];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Fingerprint rotation pools (20 UA × 10 sizes for maximum variance)
const UA_POOL = [
  // Chrome — Windows (4 variants)
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
  // Chrome — macOS (4 variants)
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
  // Chrome — Linux (4 variants)
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
  // Edge — Windows (4 variants)
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
  // Edge — macOS (4 variants)
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
];

const WINDOW_SIZES = [
  { width: 1920, height: 1080 },   // Full HD
  { width: 1536, height: 864 },    // Scaled laptop
  { width: 1366, height: 768 },    // Budget laptop
  { width: 1280, height: 720 },    // HD
  { width: 1440, height: 900 },    // MacBook older
  { width: 1600, height: 900 },    // Wide laptop
  { width: 1680, height: 1050 },   // WSXGA+
  { width: 1280, height: 800 },    // Older MacBook
  { width: 1360, height: 768 },    // Alt laptop
  { width: 1920, height: 1200 },   // WUXGA
];

let recaptchaWindow = null;
let recaptchaWindowReadyPromise = null;
let recaptchaTokenQueue = Promise.resolve();

// Window rotation state
let windowUsageCount = 0;
let windowRotationThreshold = randomInt(2, 5);
let consecutive403Rotations = 0;
let windowSessionCounter = 0;
const MAX_CONSECUTIVE_403_ROTATIONS = 3;
let lastRotationAt = 0;

// Token cache - single-use per prompt (avoid reuse issues)
let tokenCache = {
  token: null,
  action: null,
  usageCount: 0,
  maxUsage: 1, // single-use token
  expiryTime: null,
  tokenLifetimeMs: 5 * 60 * 1000 // 5 minutes
};

function isTokenValid() {
  if (!tokenCache.token) return false;
  if (tokenCache.usageCount >= tokenCache.maxUsage) return false;
  if (Date.now() > tokenCache.expiryTime) return false;
  return true;
}

function getCachedToken(action) {
  if (tokenCache.action !== action) return null; // Different action = new token needed
  if (isTokenValid()) {
    const token = tokenCache.token;
    tokenCache.usageCount++;
    console.log(`[TOKEN BATCH] Reusing token (${tokenCache.usageCount}/${tokenCache.maxUsage})`);
    // Clear cache immediately after single use to force fresh token on next request
    tokenCache = {
      token: null,
      action: null,
      usageCount: 0,
      maxUsage: tokenCache.maxUsage,
      expiryTime: null,
      tokenLifetimeMs: tokenCache.tokenLifetimeMs,
    };
    return token;
  }
  return null;
}

function cacheToken(token, action) {
  tokenCache.token = token;
  tokenCache.action = action;
  tokenCache.usageCount = 1; // First usage
  tokenCache.expiryTime = Date.now() + tokenCache.tokenLifetimeMs;
  console.log('[TOKEN BATCH] Cached new token for reuse (1/1)');
}

// Fetch binary via recaptcha window (keeps cookies/session)
async function fetchBinaryFromRecaptchaWindow(url) {
  const win = await getOrCreateRecaptchaWindow();
  const ua = getLabsUserAgent();
  const script = `(async () => {
    try {
      console.log('[DEBUG] Attempting to fetch URL:', ${JSON.stringify(url)});
      
      const res = await fetch(${JSON.stringify(url)}, { 
        credentials: 'include',
        mode: 'cors',
        headers: {
          'Accept': 'image/*',
          'User-Agent': ${JSON.stringify(ua)}
        }
      });
      
      console.log('[DEBUG] Fetch response status:', res.status);
      console.log('[DEBUG] Fetch response ok:', res.ok);
      console.log('[DEBUG] Fetch response headers:', Object.fromEntries(res.headers.entries()));
      
      if (!res.ok) {
        const text = await res.text();
        console.log('[DEBUG] Fetch error response:', text);
        return { ok: false, status: res.status, error: text };
      }
      
      const buffer = await res.arrayBuffer();
      const bytes = Array.from(new Uint8Array(buffer));
      const base64 = btoa(String.fromCharCode(...bytes));
      
      console.log('[DEBUG] Successfully fetched image, size:', buffer.byteLength, 'bytes');
      
      return {
        ok: res.ok,
        status: res.status,
        contentType: res.headers.get('content-type') || 'image/jpeg',
        base64: base64,
      };
    } catch (err) {
      console.log('[DEBUG] Fetch error:', err.message);
      return { ok: false, status: 0, error: String(err && err.message ? err.message : err) };
    }
  })()`;
  return win.webContents.executeJavaScript(script);
}

// Window rotation functions for 403 handling
function shouldRotateWindow() {
  const should = windowUsageCount >= windowRotationThreshold;
  if (should) {
    console.log(`[ROTATION] Threshold reached: ${windowUsageCount}/${windowRotationThreshold}`);
  }
  return should;
}

function resetConsecutive403() {
  if (consecutive403Rotations > 0) {
    console.log(`[ROTATION] Reset consecutive 403 counter from ${consecutive403Rotations} to 0`);
  }
  consecutive403Rotations = 0;
}

async function handleRecaptcha403() {
  consecutive403Rotations += 1;
  console.warn(`[403 HANDLER] reCAPTCHA evaluation failed (${consecutive403Rotations}/${MAX_CONSECUTIVE_403_ROTATIONS})`);
  
  // Progressive cooldown: longer wait for repeated 403s
  const backoffMs = Math.min(9000, 1400 * consecutive403Rotations + randomInt(1000, 2200));
  console.log(`[403 HANDLER] Cooling down for ${backoffMs}ms before rotating window...`);
  await sleep(backoffMs);
  
  await rotateRecaptchaWindow('403_reactive');
  
  if (consecutive403Rotations >= MAX_CONSECUTIVE_403_ROTATIONS) {
    console.error(`[403 HANDLER] STOP: 3x consecutive 403 failures. Process halted.`);
    throw new Error(
      'reCAPTCHA evaluation failed 3x berturut-turut. Proses dihentikan, coba jeda/ganti IP lalu ulangi.'
    );
  }
  
  console.log(`[403 HANDLER] Window rotated, will retry request`);
}

async function rotateRecaptchaWindow(reason = 'proactive') {
  const now = Date.now();
  
  // Minimal cooldown 2s between rotations to prevent rapid churn
  if (now - lastRotationAt < 2000) {
    const waitMs = 2000 - (now - lastRotationAt);
    console.log(`[ROTATION] Cooldown active, waiting ${waitMs}ms before rotation...`);
    await sleep(waitMs);
  }
  
  console.log(`[ROTATION] Rotating reCAPTCHA window due to: ${reason}`);
  console.log(`[ROTATION] Previous stats - Usage: ${windowUsageCount}/${windowRotationThreshold}, Session: ${windowSessionCounter}`);
  
  try {
    if (recaptchaWindow && !recaptchaWindow.isDestroyed()) {
      try {
        await recaptchaWindow.webContents.session.clearStorageData({
          storages: ['cookies', 'sessionstorage', 'cachestorage', 'indexdb', 'serviceworkers'],
        });
        await recaptchaWindow.webContents.session.clearCache();
        await recaptchaWindow.webContents.session.clearAuthCache();
        console.log(`[ROTATION] Session data cleared successfully`);
      } catch (clearErr) {
        console.warn(`[ROTATION] Failed to clear session data:`, clearErr.message);
      }
      
      try {
        recaptchaWindow.destroy();
        console.log(`[ROTATION] Window destroyed successfully`);
      } catch (destroyErr) {
        console.warn(`[ROTATION] Failed to destroy window:`, destroyErr.message);
      }
    }
  } catch (err) {
    console.error(`[ROTATION] Error during window cleanup:`, err.message);
  }
  
  recaptchaWindow = null;
  recaptchaWindowReadyPromise = null;
  windowUsageCount = 0;
  windowRotationThreshold = randomInt(2, 5);
  // Always reset 403 counter on rotation to avoid cascaded STOP when window is already refreshed
  consecutive403Rotations = 0;
  // Clear token cache to force fresh token on next request
  tokenCache = {
    token: null,
    action: null,
    usageCount: 0,
    maxUsage: tokenCache.maxUsage,
    expiryTime: null,
    tokenLifetimeMs: tokenCache.tokenLifetimeMs,
  };
  
  lastRotationAt = Date.now();
  
  // Random delay before next operation to appear more human-like
  const delayMs = randomInt(1000, 3000);
  console.log(`[ROTATION] Complete. New threshold: ${windowRotationThreshold}. Waiting ${delayMs}ms before next operation...`);
  await sleep(delayMs);
}

/**
 * Cleanup function to destroy recaptchaWindow and clear all session data.
 * Should be called when app is closing to ensure fresh state on next launch.
 */
async function cleanupRecaptchaResources() {
  try {
    // Reset the token queue
    recaptchaTokenQueue = Promise.resolve();
    recaptchaWindowReadyPromise = null;

    if (recaptchaWindow && !recaptchaWindow.isDestroyed()) {
      // Clear storage data but keep localStorage to avoid wiping app settings
      try {
        await recaptchaWindow.webContents.session.clearStorageData({
          storages: ['cookies', 'sessionstorage', 'cachestorage', 'indexdb', 'serviceworkers'],
        });
        await recaptchaWindow.webContents.session.clearCache();
        await recaptchaWindow.webContents.session.clearAuthCache();
      } catch (clearErr) {
        console.warn('Failed to clear recaptcha window session data:', clearErr.message);
      }

      // Destroy the window
      try {
        recaptchaWindow.destroy();
      } catch (destroyErr) {
        console.warn('Failed to destroy recaptcha window:', destroyErr.message);
      }
    }
    recaptchaWindow = null;
    console.log('[CLEANUP] Recaptcha resources cleaned up successfully');
    // Reset rotation state
    windowUsageCount = 0;
    windowRotationThreshold = randomInt(2, 5);
    consecutive403Rotations = 0;
    console.log('[CLEANUP] Rotation state reset');
  } catch (err) {
    console.error('[CLEANUP] Error during recaptcha cleanup:', err.message);
  }
}

function createHttpError(status, data) {
  const err = new Error(`Request failed with status code ${status}`);
  err.response = {
    status,
    data,
  };
  return err;
}

function getProjectIdFromEndpoint(endpointUrl) {
  try {
    const match = String(endpointUrl || '').match(/\/projects\/([^/]+)\//);
    return match ? match[1] : null;
  } catch (_) {
    return null;
  }
}

function isRecaptchaEvaluationFailed(err) {
  try {
    const status = err && err.response && err.response.status;
    if (status !== 403) return false;
    const data = err && err.response && err.response.data;
    const text = String(data || '');
    return text.toLowerCase().includes('recaptcha evaluation failed');
  } catch (_) {
    return false;
  }
}

// Removed manual cookie injection logic - Flow Ultra approach relies on browser's native session only

async function getOrCreateRecaptchaWindow() {
  console.log('[WINDOW] getOrCreateRecaptchaWindow called');
  
  if (recaptchaWindow && !recaptchaWindow.isDestroyed()) {
    // Check if window is still responsive by testing a simple JavaScript execution
    try {
      await recaptchaWindow.webContents.executeJavaScript('document.readyState');
      console.log('[WINDOW] Reusing existing window (session: ' + windowSessionCounter + ')');
      return recaptchaWindow;
    } catch (testErr) {
      console.warn('[WINDOW] Window not responsive, recreating:', testErr.message);
      try {
        recaptchaWindow.destroy();
      } catch (_) {}
      recaptchaWindow = null;
    }
  }

  // Fingerprint randomization for each new window
  windowSessionCounter += 1;
  const ua = pickRandom(UA_POOL) || getLabsUserAgent();
  const size = pickRandom(WINDOW_SIZES) || { width: 1366, height: 768 };
  
  console.log('[WINDOW] Creating new window with fingerprint:');
  console.log(`[WINDOW]   - Session: ${windowSessionCounter}`);
  console.log(`[WINDOW]   - Size: ${size.width}x${size.height}`);
  console.log(`[WINDOW]   - UA: ${ua.substring(0, 80)}...`);

  recaptchaWindow = new BrowserWindow({
    show: false,
    width: size.width,
    height: size.height,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      partition: `recaptcha-session-${windowSessionCounter}`,
    },
  });

  try {
    recaptchaWindow.webContents.setUserAgent(ua);
    console.log('[WINDOW] User agent set successfully');
  } catch (err) {
    console.warn('[WINDOW] Failed to set user agent:', err.message);
  }

  recaptchaWindowReadyPromise = new Promise((resolve, reject) => {
    const cleanup = () => {
      try {
        recaptchaWindow.webContents.removeListener('did-finish-load', onLoad);
        recaptchaWindow.webContents.removeListener('did-fail-load', onFail);
      } catch (_) {
        // ignore
      }
    };

    const onLoad = () => {
      cleanup();
      console.log('[WINDOW] labs.google/fx loaded successfully');
      resolve();
    };

    const onFail = (_event, errorCode, errorDescription) => {
      cleanup();
      console.error(`[WINDOW] Failed to load labs.google/fx: ${errorCode} ${errorDescription}`);
      // Destroy failed window to prevent reuse
      try {
        recaptchaWindow.destroy();
      } catch (_) {}
      recaptchaWindow = null;
      reject(new Error(`Gagal memuat labs.google/fx untuk reCAPTCHA: ${errorCode} ${errorDescription}`));
    };

    recaptchaWindow.webContents.once('did-finish-load', onLoad);
    recaptchaWindow.webContents.once('did-fail-load', onFail);
  });

  console.log('[WINDOW] Loading https://labs.google/fx ...');
  await recaptchaWindow.loadURL('https://labs.google/fx');
  await recaptchaWindowReadyPromise;
  console.log('[WINDOW] Window ready for reCAPTCHA operations');
  return recaptchaWindow;
}

async function getRecaptchaToken(recaptchaAction = RECAPTCHA_ACTION) {
  console.log(`[TOKEN] ========== getRecaptchaToken called ==========`);
  console.log(`[TOKEN] Action: ${recaptchaAction}`);
  
  // Check cache first (Flow Ultra approach: 1 token for 4 prompts)
  const cachedToken = getCachedToken(recaptchaAction);
  if (cachedToken) {
    console.log('[TOKEN] Using cached token, skipping generation');
    return cachedToken;
  }
  
  console.log('[TOKEN] No valid cached token, generating new one...');
  
  const run = async () => {
    const win = await getOrCreateRecaptchaWindow();
    console.log('[TOKEN] reCAPTCHA window obtained, executing token generation script...');

    const script = `(async () => {
      const fallbackSiteKey = ${JSON.stringify(RECAPTCHA_SITE_KEY)};
      const action = ${JSON.stringify(String(recaptchaAction || RECAPTCHA_ACTION))};
      

      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

      const detectSiteKey = () => {
        try {
          const scripts = Array.from(document.querySelectorAll('script[src]'));
          for (const s of scripts) {
            const src = String(s.getAttribute('src') || '');
            if (!src.includes('recaptcha') || !src.includes('enterprise.js')) continue;
            try {
              const url = new URL(src, location.href);
              const renderKey = url.searchParams.get('render');
              if (renderKey && renderKey.trim()) return renderKey.trim();
            } catch (_) {
              // ignore
            }
          }
        } catch (_) {
          // ignore
        }
        return fallbackSiteKey;
      };

      const siteKey = detectSiteKey();
      console.log('[DEBUG] Detected site key:', siteKey);

      const ensureEnterprise = async () => {
        if (window.grecaptcha && window.grecaptcha.enterprise) return;

        if (!window.__zeoRecaptchaEnterprisePromise) {
          window.__zeoRecaptchaEnterprisePromise = new Promise((resolve, reject) => {
            try {
              let s = document.querySelector('script[data-zeo-recaptcha="1"]');
              if (!s) {
                s = document.createElement('script');
                s.src = 'https://www.google.com/recaptcha/enterprise.js?render=' + encodeURIComponent(siteKey);
                s.async = true;
                s.defer = true;
                s.dataset.zeoRecaptcha = '1';
                (document.head || document.documentElement).appendChild(s);
              }

              if (window.grecaptcha && window.grecaptcha.enterprise) {
                try {
                  s.dataset.zeoRecaptchaLoaded = '1';
                } catch (_) {
                  // ignore
                }
                resolve(true);
                return;
              }

              if (s.dataset.zeoRecaptchaLoaded === '1') {
                resolve(true);
                return;
              }

              const onLoad = () => {
                try {
                  s.dataset.zeoRecaptchaLoaded = '1';
                } catch (_) {
                  // ignore
                }
                resolve(true);
              };

              const onErr = () => reject(new Error('Gagal load reCAPTCHA enterprise script'));

              s.addEventListener('load', onLoad, { once: true });
              s.addEventListener('error', onErr, { once: true });

              const startedAt = Date.now();
              const timer = setInterval(() => {
                if (window.grecaptcha && window.grecaptcha.enterprise) {
                  clearInterval(timer);
                  try {
                    s.dataset.zeoRecaptchaLoaded = '1';
                  } catch (_) {
                    // ignore
                  }
                  resolve(true);
                  return;
                }
                if (Date.now() - startedAt > 15000) {
                  clearInterval(timer);
                  reject(new Error('reCAPTCHA Enterprise tidak siap. Pastikan Anda login ke labs.google lalu coba lagi.'));
                }
              }, 50);
            } catch (e) {
              reject(e);
            }
          });
        }

        await window.__zeoRecaptchaEnterprisePromise;

        const start = Date.now();
        while (!(window.grecaptcha && window.grecaptcha.enterprise)) {
          if (Date.now() - start > 15000) {
            throw new Error('reCAPTCHA Enterprise tidak siap. Pastikan Anda login ke labs.google lalu coba lagi.');
          }
          await sleep(50);
        }
      };

      await ensureEnterprise();
      await new Promise((resolve) => window.grecaptcha.enterprise.ready(resolve));
      const token = await window.grecaptcha.enterprise.execute(siteKey, { action });
      console.log('[DEBUG] reCAPTCHA token generated in browser, length:', token.length);
      return token;
    })();`;

    const token = await win.webContents.executeJavaScript(script, true);
    if (!token || typeof token !== 'string') {
      throw new Error('Gagal mendapatkan token reCAPTCHA. Silakan login ke labs.google dan coba lagi.');
    }
    
    // Log token details for debugging (without exposing the full token)
    console.log('[TOKEN] reCAPTCHA token generated successfully');
    console.log('[TOKEN]   - Length:', token.length);
    console.log('[TOKEN]   - Prefix:', token.substring(0, 20) + '...');
    console.log('[TOKEN]   - Action:', recaptchaAction);
    
    // Increment usage counter for window rotation tracking
    windowUsageCount += 1;
    console.log(`[TOKEN] Window usage count: ${windowUsageCount}/${windowRotationThreshold}`);
    
    // Cache token for reuse (Flow Ultra approach: 1 token for 4 prompts)
    cacheToken(token, recaptchaAction);
    
    return token;
  };

  const next = recaptchaTokenQueue.then(run, run);
  recaptchaTokenQueue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

async function postFromLabsWindow({ url, bearer, contentType, body }) {
  const win = await getOrCreateRecaptchaWindow();
  const hasBearer = typeof bearer === 'string' && bearer.trim() !== '';
  const normalizedBearer = hasBearer ? normalizeBearerHeader(bearer) : '';
  const payload = typeof body === 'string' ? body : JSON.stringify(body);

  const script = `(async () => {
    const url = ${JSON.stringify(String(url))};
    const payload = ${JSON.stringify(String(payload))};
    const contentType = ${JSON.stringify(String(contentType || 'application/json'))};
    const bearer = ${JSON.stringify(String(normalizedBearer))};
    const hasBearer = ${JSON.stringify(Boolean(hasBearer))};

    const headers = {
      'accept': '*/*',
      'content-type': contentType,
    };
    if (hasBearer && bearer) {
      headers['authorization'] = bearer;
    }

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 60000); // 60s timeout

    try {
      const res = await fetch(url, {
        method: 'POST',
        mode: 'cors',
        credentials: 'include',
        headers,
        body: payload,
        signal: controller.signal
      });
      clearTimeout(id);
      const text = await res.text();
      return { ok: res.ok, status: res.status, text };
    } catch (e) {
      clearTimeout(id);
      return { ok: false, status: 0, text: e.message || 'Fetch timeout or error' };
    }
  })();`;

  const out = await win.webContents.executeJavaScript(script, true);
  const status = out && typeof out.status === 'number' ? out.status : 0;
  const text = out && typeof out.text === 'string' ? out.text : '';

  if (!out || !out.ok) {
    throw createHttpError(status || 0, text);
  }

  try {
    return JSON.parse(text);
  } catch (_) {
    return text;
  }
}

function normalizeBearerHeader(rawBearer) {
  const str = String(rawBearer || '');
  // Hapus karakter newline/carriage return yang sering ikut saat copy-paste token
  let cleaned = str.replace(/[\r\n]+/g, ' ').trim();

  if (!cleaned) {
    throw new Error('Bearer Token untuk Nano Banana belum dikonfigurasi. Periksa halaman Pengaturan.');
  }

  // Hilangkan prefix "Bearer" jika user sudah menuliskannya manual
  cleaned = cleaned.replace(/^Bearer\s+/i, '');

  return `Bearer ${cleaned}`;
}

function extractErrorInfoForLog(err) {
  try {
    const status = err && err.response && err.response.status;
    const hasResponseData = err && err.response && typeof err.response.data !== 'undefined';
    let text = '';

    if (hasResponseData) {
      const rawData = err.response.data;
      text = typeof rawData === 'string' ? rawData : JSON.stringify(rawData);
    }

    const lowerText = text.toLowerCase();

    if (
      status === 429 ||
      lowerText.includes('resource has been exhausted') ||
      lowerText.includes('resource_exhausted') ||
      lowerText.includes('public_error_user_requests_throttled')
    ) {
      return 'Resource / kuota untuk generate image di server Flow Media / GEM_PIX sementara dibatasi (HTTP 429: RESOURCE_EXHAUSTED / PUBLIC_ERROR_USER_REQUESTS_THROTTLED). Tunggu beberapa menit, lalu coba lagi dengan mengurangi Parallel Image Count atau jumlah gambar yang diproses sekaligus.';
    }

    if (status === 403 && lowerText.includes('recaptcha evaluation failed')) {
      return 'Sistem Google mendeteksi akses ini sebagai bot (HTTP 403: reCAPTCHA evaluation failed). Sistem sedang melakukan rotasi otomatis (window rotation). Silakan tunggu atau coba generate lagi dalam beberapa detik.';
    }

    if (hasResponseData && text) {
      return text.slice(0, 500);
    }

    if (err && err.message) {
      return String(err.message);
    }

    return String(err);
  } catch (_) {
    return String(err);
  }
}


// Upload image to Flow Media asset store and return mediaGenerationId
// imageBase64 should be raw base64 string without data URL prefix.
async function uploadImageForGemPix(imageBase64, bearerKey, aspectRatio = '16:9') {
  const mappedAspectRatio = ASPECT_RATIO_MAP[aspectRatio] || 'IMAGE_ASPECT_RATIO_LANDSCAPE';

  const payload = {
    imageInput: {
      rawImageBytes: imageBase64,
      // compressImage di frontend menghasilkan PNG; namun endpoint ini menerima berbagai mime.
      // Gunakan image/png agar konsisten dengan data URL yang dikirim dari renderer.
      mimeType: 'image/png',
      isUserUploaded: true,
      aspectRatio: mappedAspectRatio,
    },
    clientContext: {
      sessionId: `;${Date.now()}`,
      tool: 'ASSET_MANAGER',
    },
  };

  const normalizedBearer = normalizeBearerHeader(bearerKey);

  const data = await postFromLabsWindow({
    url: API_ENDPOINTS.UPLOAD_IMAGE,
    bearer: normalizedBearer,
    contentType: 'application/json',
    body: payload,
  });

  const mediaGenerationId = data?.mediaGenerationId?.mediaGenerationId;
  if (!mediaGenerationId) {
    throw new Error('Gagal mendapatkan mediaGenerationId dari uploadUserImage untuk GEM_PIX.');
  }

  return mediaGenerationId;
}

// Generate single image using GEM_PIX Flow Media API (Prompt-to-Image),
// with automatic fallback chain:
//   1) Nano Banana Pro (GEM_PIX_2)
//   2) Nano Banana reguler (GEM_PIX) jika Pro kena 429/5xx (limit/terputus)
async function generateImage({
  prompt,
  aspectRatio,
  bearerKey,
  imageInputs,
  flowProjectId,
  operationId,
  rowNumber,
  sendUpdate,
  workflow = 'Prompt to Image',
  imsg,
}) {
  const normalizedBearer = normalizeBearerHeader(bearerKey);

  const emitUpdate = typeof sendUpdate === 'function' ? sendUpdate : () => {};

  // Use passed-in localized messages when available, fallback to ID locale to avoid ReferenceError
  const msg = imsg || getImageMsg('id');

  const mappedAspectRatio = ASPECT_RATIO_MAP[aspectRatio] || 'IMAGE_ASPECT_RATIO_LANDSCAPE';

  const finalImageInputs = Array.isArray(imageInputs) && imageInputs.length > 0 ? imageInputs : [];

  const MAX_IMAGE_INPUTS = {
    GEM_PIX_2: 10,
    NARWHAL: 5,
    R2I: 3,
  };

  const limitImageInputsForModel = (imageModelName) => {
    const key = String(imageModelName || '').toUpperCase();
    const max = MAX_IMAGE_INPUTS[key];
    if (!max || finalImageInputs.length <= max) return finalImageInputs;

    try {
      // eslint-disable-next-line no-console
      console.warn(`[API] Trimming reference images to ${max} for model ${key} (received ${finalImageInputs.length}).`);
    } catch (_) {
      // ignore logging errors
    }

    return finalImageInputs.slice(0, max);
  };

  const buildPayload = async (imageModelName, endpointUrl, recaptchaAction) => {
    const sessionId = `;${Date.now()}`;
    const effectiveAction = String(recaptchaAction || RECAPTCHA_ACTION);
    const recaptchaToken = await getRecaptchaToken(effectiveAction);
    const projectId = getProjectIdFromEndpoint(endpointUrl);

    const recaptchaContext = {
      token: recaptchaToken,
      applicationType: RECAPTCHA_APPLICATION_TYPE,
    };

    try {
      await postFromLabsWindow({
        url: 'https://labs.google/fx/api/trpc/general.submitBatchLog',
        contentType: 'application/json',
        body: {
          json: {
            appEvents: [
              {
                event: effectiveAction,
                eventMetadata: { sessionId },
                eventProperties: [
                  { key: 'TOOL_NAME', stringValue: 'PINHOLE' },
                  { key: 'PINHOLE_PROMPT_BOX_MODE', stringValue: 'IMAGE_GENERATION' },
                  { key: 'USER_AGENT', stringValue: getLabsUserAgent() },
                  { key: 'IS_DESKTOP' },
                ],
                activeExperiments: [],
                eventTime: new Date().toISOString(),
              },
            ],
          },
        },
      });
    } catch (_) {
      // ignore: logging endpoint should not block generation
    }

    const limitedInputs = limitImageInputsForModel(imageModelName);

    return {
      clientContext: {
        recaptchaContext,
        sessionId,
        projectId: projectId || undefined,
        tool: 'PINHOLE',
      },
      requests: [
        {
          clientContext: {
            recaptchaContext,
            sessionId,
            projectId: projectId || undefined,
            tool: 'PINHOLE',
          },
          seed: Math.floor(Math.random() * 1000000),
          imageModelName,
          imageAspectRatio: mappedAspectRatio,
          prompt,
          imageInputs: limitedInputs,
        },
      ],
    };
  };

  const postGenerateWithRecaptchaFallback = async ({ url, imageModelName }) => {
    const actions = [RECAPTCHA_ACTION, RECAPTCHA_ACTION_FALLBACK]
      .map((v) => String(v || '').trim())
      .filter(Boolean)
      .filter((v, i, arr) => arr.indexOf(v) === i);

    console.log(`[API] Attempting to generate image with model: ${imageModelName}`);
    console.log(`[API] Actions chain: ${actions.join(' -> ')}`);

    let lastErr = null;
    for (const action of actions) {
      try {
        console.log(`[API] Trying action: ${action}`);
        const result = await postFromLabsWindow({
          url,
          bearer: normalizedBearer,
          contentType: 'text/plain;charset=UTF-8',
          body: JSON.stringify(await buildPayload(imageModelName, url, action)),
        });
        console.log(`[API] Success with action: ${action}`);
        return result;
      } catch (err) {
        lastErr = err;
        const status = err?.response?.status;
        console.warn(`[API] Failed with action: ${action}, status: ${status}`);
        
        if (isRecaptchaEvaluationFailed(err)) {
          console.warn('[403] reCAPTCHA evaluation failed detected');
          
          // If this is the last action, trigger 403 handler
          if (action === actions[actions.length - 1]) {
            console.warn('[403] All actions exhausted, triggering 403 handler...');
            await handleRecaptcha403();
            // After rotation, throw to trigger outer retry mechanism
            throw err;
          } else {
            // Try next action
            console.warn(`[403] Will retry with next action: ${actions[actions.length - 1]}`);
            continue;
          }
        }
        
        throw err;
      }
    }

    if (lastErr) throw lastErr;
    throw new Error('Gagal memanggil Flow Media: tidak ada reCAPTCHA action yang bisa dicoba.');
  };

  const overrideUrl = buildFlowMediaBatchGenerateUrl(flowProjectId);
  const generateProUrl = overrideUrl || API_ENDPOINTS.GENERATE_PRO;
  const generateFallbackUrl = generateProUrl; // narwhal uses same project endpoint, different model name
  const generateImagenUrl = generateProUrl; // Imagen uses same project endpoint, different model name

  const isThrottleOrEmpty = (err) => {
    const status = err && err.response && err.response.status;
    const msg = String((err && err.message) || err || '').toLowerCase();
    return status === 429 || msg.includes('no encoded image data');
  };

  const sleepWithRandomJitter = (baseMs) => {
    const jitter = Math.random() * 1000; // Add up to 1 second random jitter
    return new Promise(resolve => setTimeout(resolve, baseMs + jitter));
  };

  const maxOuterAttempts = 2;
  let result;
  let modelUsed = 'GEM_PIX_2';
  let lastErr = null;

  for (let outer = 1; outer <= maxOuterAttempts; outer += 1) {
    try {
      // First try Nano Banana Pro (GEM_PIX_2) with simple retry on transient 5xx
      const maxPrimaryAttempts = 3;
      let lastPrimaryError = null;

      for (let attempt = 1; attempt <= maxPrimaryAttempts; attempt += 1) {
        try {
          result = await postGenerateWithRecaptchaFallback({ url: generateProUrl, imageModelName: 'GEM_PIX_2' });
          modelUsed = 'GEM_PIX_2';
          lastPrimaryError = null;
          break;
        } catch (primaryError) {
          lastPrimaryError = primaryError;
          const status =
            primaryError && primaryError.response && primaryError.response.status;

          try {
            // eslint-disable-next-line no-console
            console.warn(
              '[GEM_PIX_2] attempt',
              attempt,
              'error status:',
              status,
              '-',
              extractErrorInfoForLog(primaryError),
            );
          } catch (_) {
            // ignore logging errors
          }

          // Jika bukan 5xx, hentikan retry dan lempar ke blok catch luar
          if (!status || status < 500 || status >= 600 || attempt === maxPrimaryAttempts) {
            throw primaryError;
          }

          // Simple exponential backoff: 2s, 4s (maks 2x jeda)
          const delayMs = 2000 * 2 ** (attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }

      if (!result && lastPrimaryError) {
        throw lastPrimaryError;
      }
    } catch (error) {
      const status = error && error.response && error.response.status;

      try {
        // eslint-disable-next-line no-console
        console.warn('[GEM_PIX_2] primary call error status:', status, '-', extractErrorInfoForLog(error));
      } catch (_) {
        // ignore logging errors
      }

      // If GEM_PIX_2 fails due to limit (429) or server errors (5xx), fallback to GEM_PIX
      const shouldFallback = status === 429 || (status && status >= 500 && status < 600);
      if (shouldFallback) {
        try {
          emitUpdate({
            type: 'IMAGE_STARTED',
            workflow,
            message: `${msg.startingImageGen} (switch to ${friendlyModelName('NARWHAL')})`,
            operationId,
            prompt,
            rowNumber,
            modelUsed: 'NARWHAL',
            restartTimer: true,
          });
          result = await postGenerateWithRecaptchaFallback({ url: generateFallbackUrl, imageModelName: 'NARWHAL' });
          modelUsed = 'NARWHAL';
          lastErr = null;
        } catch (fallbackErr) {
          const fallbackStatus = fallbackErr && fallbackErr.response && fallbackErr.response.status;
          const shouldFallbackImagen = fallbackStatus === 429 || (fallbackStatus && fallbackStatus >= 500 && fallbackStatus < 600);

          if (shouldFallbackImagen) {
            try {
              emitUpdate({
                type: 'IMAGE_STARTED',
                workflow,
                message: `${msg.startingImageGen} (switch to ${friendlyModelName('R2I')})`,
                operationId,
                prompt,
                rowNumber,
                modelUsed: 'R2I',
                restartTimer: true,
              });
              result = await postGenerateWithRecaptchaFallback({ url: generateImagenUrl, imageModelName: 'R2I' });
              modelUsed = 'R2I';
              lastErr = null;
            } catch (imagenErr) {
              lastErr = imagenErr;
              if (outer < maxOuterAttempts) {
                continue;
              }
              imagenErr.message = extractErrorInfoForLog(imagenErr);
              throw imagenErr;
            }
          } else {
            lastErr = fallbackErr;
            if (outer < maxOuterAttempts) {
              continue;
            }
            fallbackErr.message = extractErrorInfoForLog(fallbackErr);
            throw fallbackErr;
          }
        }
      } else {
        lastErr = error;
        if (outer < maxOuterAttempts) {
          continue;
        }
        error.message = extractErrorInfoForLog(error);
        throw error;
      }
    }

    // Parsing + return; if encoded image missing, throw to trigger outer retry if allowed
    try {
      try {
        // Log safe structure info without dumping huge base64 strings
        const safeResult = { ...result };
        if (safeResult.media) {
          safeResult.media = safeResult.media.map(m => ({
            ...m,
            encodedImage: m.encodedImage ? '[BASE64_IMAGE_DATA_TRUNCATED]' : undefined
          }));
        }
        if (safeResult.imagePanels) {
          safeResult.imagePanels = safeResult.imagePanels.map(panel => ({
            ...panel,
            generatedImages: panel.generatedImages ? panel.generatedImages.map(img => ({
              ...img,
              encodedImage: img.encodedImage ? '[BASE64_IMAGE_DATA_TRUNCATED]' : undefined,
              imageBytes: img.imageBytes ? '[BASE64_IMAGE_DATA_TRUNCATED]' : undefined,
              imageData: img.imageData ? '[BASE64_IMAGE_DATA_TRUNCATED]' : undefined
            })) : undefined
          }));
        }
        
        // eslint-disable-next-line no-console
        console.log(
          '[DEBUG] GEM_PIX batchGenerateImages response (truncated):',
          JSON.stringify(safeResult, null, 2),
        );
        // eslint-disable-next-line no-console
        console.log('[DEBUG] Response structure keys:', Object.keys(result || {}));
      } catch {
        // ignore JSON stringify errors
      }

      const remainingCredits =
        result && typeof result.remainingCredits === 'number' && Number.isFinite(result.remainingCredits)
          ? result.remainingCredits
          : null;

      let encodedImage = null;
      let mimeType = 'image/jpeg';

      // Legacy schema
      if (result && Array.isArray(result.imagePanels) && result.imagePanels.length > 0) {
        const firstPanel = result.imagePanels[0];
        const imgArray =
          (firstPanel && Array.isArray(firstPanel.generatedImages) && firstPanel.generatedImages) || [];
        if (imgArray.length > 0) {
          const firstImage = imgArray[0];
          encodedImage = firstImage.encodedImage || firstImage.imageBytes || firstImage.imageData || null;
          mimeType = firstImage.mimeType || mimeType;
        }
      }

      // GEM_PIX schema
      if (
        !encodedImage &&
        result &&
        Array.isArray(result.media) &&
        result.media.length > 0 &&
        result.media[0] &&
        result.media[0].image &&
        result.media[0].image.generatedImage
      ) {
        const gen = result.media[0].image.generatedImage;
        encodedImage = gen.encodedImage || gen.imageBytes || gen.imageData || null;
        mimeType = gen.mimeType || mimeType;

        if (!encodedImage && gen.fifeUrl) {
          console.log('[DEBUG] Downloading image from fifeUrl:', gen.fifeUrl);
          const downloadRes = await fetchBinaryFromRecaptchaWindow(gen.fifeUrl);
          console.log('[DEBUG] fifeUrl download response:', downloadRes ? 'success' : 'failed');

          if (downloadRes && downloadRes.ok && downloadRes.base64) {
            encodedImage = downloadRes.base64;
            mimeType = downloadRes.contentType || mimeType;
            console.log('[DEBUG] Successfully downloaded image, base64 length:', encodedImage.length);
          } else {
            console.log('[DEBUG] fifeUrl download failed, trying fallback method...');

            try {
              const fallbackResponse = await fetch(gen.fifeUrl, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
                  'Accept': 'image/*',
                  'Referer': 'https://labs.google/',
                },
              });

              if (fallbackResponse.ok) {
                const buffer = await fallbackResponse.arrayBuffer();
                const base64 = Buffer.from(buffer).toString('base64');
                encodedImage = base64;
                mimeType = fallbackResponse.headers.get('content-type') || mimeType;
                console.log('[DEBUG] Fallback download successful, base64 length:', encodedImage.length);
              } else {
                console.log('[DEBUG] Fallback download failed, status:', fallbackResponse.status);
              }
            } catch (fallbackErr) {
              console.log('[DEBUG] Fallback download error:', fallbackErr.message);
            }
          }
        }
      }

      if (!encodedImage) {
        throw new Error('No encoded image data found in GEM_PIX response. Lihat log untuk detail.');
      }

      const imageBuffer = Buffer.from(encodedImage, 'base64');

      // Reset 403 counter on successful image generation
      resetConsecutive403();
      console.log(`[IMAGE] Generation successful with model: ${modelUsed}`);

      return {
        success: true,
        imageData: imageBuffer,
        prompt,
        mimeType,
        remainingCredits,
        modelUsed,
      };
    } catch (parseErr) {
      lastErr = parseErr;
      if (outer < maxOuterAttempts && isThrottleOrEmpty(parseErr)) {
        const delayMs = 3000 * outer;
        try {
          // eslint-disable-next-line no-console
          console.warn('[GEM_PIX] retrying due to missing data / throttle. attempt', outer + 1);
        } catch (_) {
          // ignore
        }
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      throw parseErr;
    }
  }

  if (lastErr) throw lastErr;
  throw new Error('Gagal memproses gambar GEM_PIX setelah beberapa percobaan.');
}
const generateSmartFilename = (prompt, itemId) => {
  const now = new Date();
  const dateStr = now.getFullYear() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0');
  const timeStr = String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0');

  // Extract smart keywords from prompt
  let keywords = '';
  let suffix = '';
  if (itemId) {
    suffix = String(itemId)
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
  if (prompt && typeof prompt === 'string') {
    // Remove common words and extract meaningful keywords
    const stopWords = new Set([
      'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'from', 'by', 'as', 'is', 'was', 'are', 'were', 'been',
      'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'should', 'could', 'may', 'might', 'must', 'can', 'into', 'onto',
      'creating', 'depicting', 'showcasing', 'presenting', 'illustrating',
      'generating', 'evoking', 'portraying', 'forming', 'across'
    ]);
    
    const words = prompt
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .slice(0, 5); // Take first 5 meaningful words
    
    keywords = words.join('-');

    // Limit total length to 50 characters
    if (keywords.length > 50) {
      keywords = keywords.slice(0, 50).replace(/-[^-]*$/, ''); // Cut at last dash
    }
  }

  // Always include unique suffix to avoid collisions across same-second prompts
  if (keywords && suffix) {
    return `${dateStr}_${timeStr}_${keywords}_${suffix}.jpg`;
  }
  if (keywords) {
    return `${dateStr}_${timeStr}_${keywords}.jpg`;
  }
  if (suffix) {
    return `${dateStr}_${timeStr}_${suffix}.jpg`;
  }
  // Fallback without keywords/suffix
  return `${dateStr}_${timeStr}_${Math.random().toString(36).slice(2, 8)}.jpg`;
};

async function runPromptImageWorkflow({
  bearerKey,
  flowProjectId,
  aspectRatio,
  batchSize,
  outputFolder,
  sendUpdate,
  outputFormat = 'plain',
  prompts,
  uiLanguage = 'en',
}) {
  const workflow = 'Prompt to Image';
  const imsg = getImageMsg(uiLanguage);

  // Debug: Check if prompts parameter is received
  console.log('[DEBUG] runPromptImageWorkflow received prompts:', prompts ? prompts.length : 'null/undefined');
  console.log('[DEBUG] prompts type:', typeof prompts);
  console.log('[DEBUG] Is prompts array?', Array.isArray(prompts));

  const useTextareaPrompts = Array.isArray(prompts) && prompts.length > 0;

  if (!outputFolder) {
    throw new Error(imsg.outputFolderMissing);
  }
  if (!bearerKey || String(bearerKey).trim() === '') {
    throw new Error(imsg.bearerTokenMissing);
  }

  // Log bearer token info (masked for security)
  const tokenStr = String(bearerKey).trim();
  const tokenPrefix = tokenStr.substring(0, 8);
  const tokenSuffix = tokenStr.substring(tokenStr.length - 8);
  const tokenMasked = `${tokenPrefix}...${tokenSuffix}`;
  console.log('[IMAGE BEARER] Using bearer token:', tokenMasked);
  console.log('[IMAGE BEARER] Flow Project ID:', flowProjectId || 'Not specified');
  
  sendUpdate({ type: 'INFO', workflow, message: imsg.startingWorkflow });

  if (!prompts || !Array.isArray(prompts) || prompts.length === 0) {
    throw new Error(imsg.noPromptsSent);
  }

  console.log('[DEBUG] Using prompts from textarea, count:', prompts.length);
  sendUpdate({ type: 'INFO', workflow, message: imsg.usingTextareaPrompts });
  
  // Convert prompts array to row-like objects
  let finalPendingRows = prompts.map((prompt, index) => ({
    get: (fieldName) => {
      if (fieldName.toLowerCase().includes('prompt')) return prompt;
      if (fieldName.toLowerCase().includes('status')) return '';
      if (fieldName.toLowerCase().includes('row')) return index + 1;
      return '';
    }
  }));
  console.log('[DEBUG] Created', finalPendingRows.length, 'row-like objects from prompts');
  sendUpdate({
    type: 'INFO',
    workflow,
    message: imsg.totalPrompts(finalPendingRows.length),
  });

  const numericCount =
    typeof count === 'number' && Number.isFinite(count) && count > 0 ? Math.floor(count) : null;

  if (numericCount !== null && numericCount < finalPendingRows.length) {
    finalPendingRows = finalPendingRows.slice(0, numericCount);
    sendUpdate({
      type: 'INFO',
      workflow,
      message: imsg.limitingPrompts(finalPendingRows.length),
    });
  }

  if (finalPendingRows.length === 0) {
    sendUpdate({ type: 'INFO', workflow, message: imsg.noPromptsToProcess });
    return { success: true, processed: 0 };
  }

  // Flow Ultra approach: Max 4 parallel image requests to avoid rate limiting/403 errors
  const MAX_IMAGE_PARALLELISM = 4;
  const safeBatchSize = Math.max(1, Math.min(batchSize || 4, MAX_IMAGE_PARALLELISM));
  
  if (batchSize > MAX_IMAGE_PARALLELISM) {
    sendUpdate({ 
      type: 'INFO', 
      workflow, 
      message: imsg.parallelismReduced(batchSize, MAX_IMAGE_PARALLELISM) 
    });
  }
  
  sendUpdate({ type: 'INFO', workflow, message: imsg.usingBatchSize(safeBatchSize) });

  sendUpdate({
    type: 'BATCH_TOTAL',
    workflow,
    total: finalPendingRows.length,
    message: imsg.startingBatch(finalPendingRows.length),
  });

  const results = [];

  for (let i = 0; i < finalPendingRows.length; i += safeBatchSize) {
    const batch = finalPendingRows.slice(i, i + safeBatchSize);
    const batchNumber = Math.floor(i / safeBatchSize) + 1;
    const totalBatches = Math.ceil(finalPendingRows.length / safeBatchSize);

    console.log(`\n[BATCH ${batchNumber}/${totalBatches}] ========== Starting batch ==========`);
    console.log(`[BATCH ${batchNumber}/${totalBatches}] Processing ${batch.length} images (${i + 1}-${Math.min(i + batch.length, finalPendingRows.length)} of ${finalPendingRows.length})`);

    sendUpdate({
      type: 'INFO',
      workflow,
      message: imsg.processingBatch(batchNumber, totalBatches, batch.length),
    });

    const batchResults = await Promise.all(
      batch.map(async (row, index) => {
        const rowIndex = i + index + 1;
        const rawRowNumber = row.get('_rowNumber');
        const parsedRowNumber =
          typeof rawRowNumber === 'number'
            ? rawRowNumber
            : parseInt(String(rawRowNumber || ''), 10);
        const rowNumber = Number.isFinite(parsedRowNumber) && parsedRowNumber > 0 ? parsedRowNumber : rowIndex;

        // Pilih sumber prompt berdasarkan format input (Plain / JSON).
        let rawPrompt = null;

        if (outputFormat === 'json') {
          rawPrompt =
            row.get('JSON') ||
            row.get('json') ||
            row.get('Prompt') ||
            row.get('prompt');
        } else {
          rawPrompt =
            row.get('Prompt') ||
            row.get('prompt') ||
            row.get('Text') ||
            row.get('text') ||
            row.get('Description') ||
            row.get('description') ||
            row.get('Content') ||
            row.get('content');
        }

        if (!rawPrompt || String(rawPrompt).trim() === '') {
          sendUpdate({
            type: 'ERROR',
            workflow,
            message: imsg.promptEmpty(row.get('_rowNumber') || rowIndex),
          });
          return { success: false, error: 'Empty prompt', prompt: '' };
        }

        let prompt = String(rawPrompt);

        // Jika kolom berisi JSON, coba ambil field-field penting seperti
        // plain_text_prompt, prompt_visual_veo, prompt, atau text.
        try {
          const trimmed = prompt.trim();
          if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            const jsonPrompt = JSON.parse(trimmed);

            if (typeof jsonPrompt.plain_text_prompt === 'string' && jsonPrompt.plain_text_prompt.trim() !== '') {
              prompt = jsonPrompt.plain_text_prompt.trim();
            } else if (
              typeof jsonPrompt.prompt_visual_veo === 'string' &&
              jsonPrompt.prompt_visual_veo.trim() !== ''
            ) {
              prompt = jsonPrompt.prompt_visual_veo.trim();
            } else if (typeof jsonPrompt.prompt === 'string' && jsonPrompt.prompt.trim() !== '') {
              prompt = jsonPrompt.prompt.trim();
            } else if (typeof jsonPrompt.text === 'string' && jsonPrompt.text.trim() !== '') {
              prompt = jsonPrompt.text.trim();
            }
          }
        } catch (_) {
          // ignore JSON parse error, use raw prompt apa adanya
        }

        // Create smart operationId after prompt is processed
        const operationId = generateSmartFilename(prompt, `img_${Date.now()}_${rowIndex}`).replace('.jpg', '');

        sendUpdate({
          type: 'IMAGE_STARTED',
          workflow,
          message: imsg.startingImageGen,
          operationId,
          prompt,
          rowNumber,
        });
        console.log('[DEBUG] Sent IMAGE_STARTED event for operationId:', operationId);

        try {
          console.log('[DEBUG] Processing prompt:', prompt);
          console.log('[DEBUG] Prompt length:', prompt.length);
          console.log('[DEBUG] Prompt type:', typeof prompt);
          
          const result = await generateImage({ prompt, aspectRatio, bearerKey, flowProjectId, workflow, imsg });

          const extension = result.mimeType === 'image/png' ? 'png' : 'jpg';
          const filename = `${operationId}.${extension}`;
          console.log('[DEBUG] Smart filename generated:', filename);
          const outputPath = path.join(outputFolder, filename);

          try {
            fs.mkdirSync(outputFolder, { recursive: true });
          } catch (_) {
            // ignore mkdir failure; writeFileSync will throw if it persists
          }

          fs.writeFileSync(outputPath, result.imageData);

          const modelUsed = result.modelUsed || 'GEM_PIX';
          sendUpdate({
            type: 'SUCCESS',
            workflow,
            message: imsg.imageSuccess(friendlyModelName(modelUsed), filename),
            filePath: outputPath,
            fileName: filename,
            operationId,
            modelUsed,
          });

          // No spreadsheet update needed - using textarea prompts only

          return { success: true, prompt, filePath: outputPath, fileName: filename };
        } catch (err) {
          const errorMsg = err?.response?.data?.error?.message || err?.message || String(err);
          sendUpdate({
            type: 'ERROR',
            workflow,
            message: imsg.imageFailed(prompt, errorMsg),
            operationId,
          });

          // No spreadsheet update needed - using textarea prompts only

          return { success: false, error: errorMsg, prompt };
        }
      }),
    );

    results.push(...batchResults.filter((r) => r));

    const processed = Math.min(i + batch.length, finalPendingRows.length);

    console.log(`[BATCH ${batchNumber}/${totalBatches}] Completed: ${batchResults.filter(r => r?.success).length}/${batch.length} successful`);

    sendUpdate({
      type: 'PROGRESS',
      workflow,
      processed,
      total: finalPendingRows.length,
      message: imsg.progress(processed, finalPendingRows.length),
    });

    // Check for proactive window rotation after batch completion
    if (shouldRotateWindow()) {
      console.log(`[BATCH ${batchNumber}/${totalBatches}] Proactive window rotation triggered`);
      await rotateRecaptchaWindow('proactive_batch_boundary');
    }

    if (i + safeBatchSize < finalPendingRows.length) {
      // Add longer delay between batches to reduce rate limiting
      const batchDelay = Math.min(3000, 1000 + (batch.length * 500)); // 1-3 seconds based on batch size
      console.log(`[BATCH ${batchNumber}/${totalBatches}] Waiting ${batchDelay}ms before next batch...`);
      await new Promise((resolve) => setTimeout(resolve, batchDelay));
    }
  }

  const successCount = results.filter((r) => r && r.success).length;
  const failCount = results.filter((r) => r && !r.success).length;

  console.log('\n========== Workflow Complete ==========');
  console.log(`[WORKFLOW] Total: ${finalPendingRows.length}, Success: ${successCount}, Failed: ${failCount}`);
  console.log(`[WORKFLOW] Final window stats - Usage: ${windowUsageCount}/${windowRotationThreshold}, Session: ${windowSessionCounter}`);
  console.log(`[WORKFLOW] Consecutive 403s: ${consecutive403Rotations}`);

  sendUpdate({
    type: 'INFO',
    workflow,
    message: imsg.workflowComplete(successCount, failCount),
  });

  sendUpdate({
    type: 'BATCH_COMPLETE',
    workflow,
    successCount,
    totalCount: finalPendingRows.length,
    message: imsg.batchComplete(successCount, finalPendingRows.length),
  });

  return {
    success: true,
    total: finalPendingRows.length,
    successful: successCount,
    failed: failCount,
    results,
    message: imsg.resultSummary(finalPendingRows.length, successCount, failCount),
  };
}

module.exports = {
  runPromptImageWorkflow,
  generateImage,
  uploadImageForGemPix,
  getRecaptchaToken,
  postFromLabsWindow,
  isRecaptchaEvaluationFailed,
  cleanupRecaptchaResources,
  getImageMsg,
  // 403 handling & window rotation exports
  rotateRecaptchaWindow,
  shouldRotateWindow,
  handleRecaptcha403,
  resetConsecutive403,
};

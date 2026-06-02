// content-interceptor.js
// Runs in MAIN world on labs.google at document_start.
// Hooks native fetch to capture:
//   1. Real reCAPTCHA tokens from outgoing requests to aisandbox-pa.googleapis.com
//   2. Bearer (Authorization) tokens from those same requests
// NOTE: In MAIN world, chrome.runtime is NOT available — we use window.postMessage
// to communicate with ISOLATED world relay (content-relay.js).

(function() {
  if (window.__vsInterceptorInstalled) return;
  window.__vsInterceptorInstalled = true;

  const INTERCEPT_URL = 'aisandbox-pa.googleapis.com';
  const originalFetch = window.fetch;

  window.fetch = async function(input, init) {
    const url = typeof input === 'string' ? input : (input instanceof Request ? input.url : String(input));

    if (url.includes(INTERCEPT_URL)) {
      try {
        // ── 1. Capture Bearer token & Project ID from Authorization header ──────────────────
        const authHeader = init?.headers?.['Authorization'] || init?.headers?.['authorization'] || '';
        if (authHeader && authHeader.startsWith('Bearer ') && authHeader.length > 20) {
          console.log('[VS Interceptor] Captured Bearer token (length:', authHeader.length, ')');
          window.postMessage({ __vsType: 'BEARER_CAPTURED', bearer: authHeader }, '*');
        }

        // ── 1.5. Capture Project ID from URL ──────────────────
        const projectMatch = url.match(/\/projects\/([^\/]+)\//);
        if (projectMatch && projectMatch[1]) {
          const capturedProjectId = projectMatch[1];
          console.log('[VS Interceptor] Captured Project ID:', capturedProjectId);
          window.postMessage({ __vsType: 'PROJECT_ID_CAPTURED', projectId: capturedProjectId }, '*');
        }

        // ── 2. Capture reCAPTCHA token from request body ──────────────────────
        const bodyStr = typeof init?.body === 'string' ? init.body : null;
        if (bodyStr) {
          const parsed = JSON.parse(bodyStr);

          let rcToken = parsed?.clientContext?.recaptchaContext?.token;

          if (!rcToken && Array.isArray(parsed?.requests)) {
            for (const req of parsed.requests) {
              const t = req?.clientContext?.recaptchaContext?.token;
              if (t) { rcToken = t; break; }
              
              // ── 3. Capture Payload Template ──────────────────────
              if (req.imageModelName) {
                console.log('[VS Interceptor] Captured Payload Template for Model:', req.imageModelName);
                window.postMessage({ __vsType: 'PAYLOAD_TEMPLATE_CAPTURED', payloadTemplate: parsed }, '*');
              }
            }
          }

          if (rcToken && typeof rcToken === 'string' && rcToken.length > 100) {
            console.log('[VS Interceptor] Captured reCAPTCHA token (length:', rcToken.length, ')');
            window.postMessage({ __vsType: 'TOKEN_CAPTURED', token: rcToken }, '*');
          }
        }
      } catch (_) {}
    }

    return originalFetch.apply(this, arguments);
  };

  console.log('[VS Interceptor] Installed on', location.hostname, location.pathname);
})();

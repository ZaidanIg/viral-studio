// content-interceptor.js
// Runs in MAIN world on labs.google at document_start.

(function() {
  if (window.__vsInterceptorInstalled) return;
  window.__vsInterceptorInstalled = true;

  const INTERCEPT_URL = 'aisandbox-pa.googleapis.com';
  const originalFetch = window.fetch;

  // Intercept fetch
  window.fetch = async function(input, init) {
    const url = typeof input === 'string' ? input : (input instanceof Request ? input.url : String(input));

    if (url.includes(INTERCEPT_URL)) {
      if (window.__vs_isProxy) return originalFetch.apply(this, arguments);

      try {
        const authHeader = init?.headers?.['Authorization'] || init?.headers?.['authorization'] || '';
        if (authHeader && authHeader.startsWith('Bearer ') && authHeader.length > 20) {
          window.postMessage({ __vsType: 'BEARER_CAPTURED', bearer: authHeader }, '*');
        }

        const projectMatch = url.match(/\/projects\/([^\/]+)\//);
        if (projectMatch && projectMatch[1]) {
          window.postMessage({ __vsType: 'PROJECT_ID_CAPTURED', projectId: projectMatch[1] }, '*');
        }

        const bodyStr = typeof init?.body === 'string' ? init.body : null;
        if (bodyStr) {
          const parsed = JSON.parse(bodyStr);
          let rcToken = parsed?.clientContext?.recaptchaContext?.token;

          if (Array.isArray(parsed?.requests)) {
            for (const req of parsed.requests) {
              const t = req?.clientContext?.recaptchaContext?.token;
              if (t && !rcToken) { rcToken = t; }

              if (req.imageModelName) {
                window.postMessage({ __vsType: 'PAYLOAD_TEMPLATE_CAPTURED', payloadTemplate: parsed, url }, '*');
              }
            }
          }

          if (rcToken && typeof rcToken === 'string' && rcToken.length > 100) {
            window.postMessage({ __vsType: 'RECAPTCHA_CAPTURED', token: rcToken }, '*');
            
            // 🔥 ABORT THE FETCH! 🔥
            // We must prevent Google from consuming the single-use reCAPTCHA token.
            // By returning a fake response, the token remains untouched in Google's backend,
            // allowing us to use it exclusively for Viral Studio!
            console.warn('[VS Interceptor] 🔥 STEALING reCAPTCHA TOKEN AND ABORTING GOOGLE FETCH! 🔥');
            
            // Provide a fake 500 error response so Google's UI stops loading
            return new Response(JSON.stringify({ 
              error: { message: "VS_INTERCEPTED", code: 500 } 
            }), {
              status: 500,
              statusText: "VS Intercepted Token",
              headers: { 'Content-Type': 'application/json' }
            });
          }
        }
      } catch (err) {
        console.error('[VS Interceptor] Error parsing fetch:', err);
      }
    }
    
    return originalFetch.apply(this, arguments);
  };
})();

const WindowManager = require('../core/WindowManager');

class AuthService {
  constructor() {
    this.INJECT_INTERCEPTOR = `
      (function() {
        if (window.__vs_electron_injected) return;
        window.__vs_electron_injected = true;

        // We store the captured bearer token here
        window.__vs_bearer_token = window.__vs_bearer_token || null;

        const originalFetch = window.fetch;
        window.fetch = async function(input, init) {
          const url = typeof input === 'string' ? input : (input instanceof Request ? input.url : String(input));
          
          // Intercept Authorization header
          if (init && init.headers) {
            let auth = null;
            if (init.headers instanceof Headers) auth = init.headers.get('Authorization');
            else if (Array.isArray(init.headers)) auth = init.headers.find(h => h[0].toLowerCase() === 'authorization')?.[1];
            else auth = init.headers['Authorization'] || init.headers['authorization'];
            
            if (auth && auth.startsWith('Bearer ')) {
              window.__vs_bearer_token = auth;
              console.log('[VS Electron] Captured Bearer Token:', auth.substring(0, 20) + '...');
            }
          }

          // If we are executing our proxy fetch, don't trigger interceptors again
          if (init && init.__vs_isProxy) {
            delete init.__vs_isProxy;
            return originalFetch.apply(this, arguments);
          }
          
          const response = await originalFetch.apply(this, arguments);
          const clonedResponse = response.clone();

          if (url.includes('flowMedia:batchGenerateImages')) {
            clonedResponse.json().then(data => {
              console.log('[VS Electron] Intercepted Generate:', data);
              document.title = 'VS_RESULT:' + JSON.stringify(data);
            }).catch(e => console.error(e));
          }

          if (url.includes('uploadUserImage')) {
            clonedResponse.json().then(data => {
              console.log('[VS Electron] Intercepted Upload:', data);
              document.title = 'VS_UPLOAD_RESULT:' + JSON.stringify(data);
            }).catch(e => console.error(e));
          }

          return response;
        };
      })();
    `;
  }

  /**
   * Ensures the interceptor script is injected into the hidden window
   */
  async ensureInterceptor() {
    const win = await WindowManager.getOrCreateHiddenLabsWindow();
    await win.webContents.executeJavaScript(this.INJECT_INTERCEPTOR);
  }
}

module.exports = new AuthService();

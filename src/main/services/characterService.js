const WindowManager = require('../core/WindowManager');
const AuthService = require('./authService');

class CharacterService {
  async uploadImage(payload) {
    const win = await WindowManager.getOrCreateHiddenLabsWindow();
    console.log('[CharacterService] Uploading image...');

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        win.removeListener('page-title-updated', titleListener);
        reject(new Error("Timeout uploading image in hidden window."));
      }, 60000);

      const titleListener = (event, title) => {
        if (title.startsWith('VS_UPLOAD_RESULT:')) {
          clearTimeout(timeout);
          win.removeListener('page-title-updated', titleListener);
          try {
            const data = JSON.parse(title.substring(17));
            const rawMediaId = data?.mediaGenerationId?.mediaGenerationId;
            if (!rawMediaId) return reject(new Error('No media ID returned from upload.'));

            let mediaId = rawMediaId;
            let workflowId = null;
            try {
              const pad = 4 - (rawMediaId.length % 4);
              const padded = pad !== 4 ? rawMediaId + '='.repeat(pad) : rawMediaId;
              const decoded = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
              const matches = decoded.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi);
              if (matches && matches.length >= 2) {
                mediaId = matches[0];
                workflowId = matches[1];
              }
            } catch (e) {}
            resolve({ mediaId, workflowId });
          } catch (e) {
            reject(e);
          }
        }
      };

      win.on('page-title-updated', titleListener);

      AuthService.ensureInterceptor().then(() => {
        // Direct Fetch automation for file upload
        win.webContents.executeJavaScript(`
          (async function() {
            try {
              // Poll for Bearer token for up to 15 seconds
              let retries = 30;
              while (!window.__vs_bearer_token && retries > 0) {
                await new Promise(r => setTimeout(r, 500));
                retries--;
              }

              if (!window.__vs_bearer_token) {
                console.error("No Bearer token intercepted yet. Please wait for Labs to finish loading, or manually click something to generate a token.");
                return;
              }

              const requestPayload = {
                imageInput: {
                  rawImageBytes: "${payload.imageBase64}",
                  mimeType: 'image/jpeg',
                  isUserUploaded: true,
                  aspectRatio: 'IMAGE_ASPECT_RATIO_PORTRAIT_THREE_FOUR'
                },
                clientContext: {
                  sessionId: "${Date.now()}",
                  tool: 'ASSET_MANAGER'
                }
              };

              const res = await window.fetch('https://aisandbox-pa.googleapis.com/v1:uploadUserImage', {
                method: 'POST',
                __vs_isProxy: true,
                headers: {
                  'Accept': '*/*',
                  'Content-Type': 'application/json',
                  'Authorization': window.__vs_bearer_token
                },
                body: JSON.stringify(requestPayload)
              });
              
              const data = await res.json();
              document.title = 'VS_UPLOAD_RESULT:' + JSON.stringify(data);
              console.log("Executed upload fetch successfully!");
            } catch(e) {
              console.error("Direct Upload Fetch Error: ", e);
            }
          })();
        `);
      });
    });
  }

  async generate(payload) {
    const win = await WindowManager.getOrCreateHiddenLabsWindow();
    console.log('[CharacterService] Generating character image...');

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        win.removeListener('page-title-updated', titleListener);
        reject(new Error("Timeout generating image in hidden window."));
      }, 90000);

      const titleListener = (event, title) => {
        if (title.startsWith('VS_RESULT:')) {
          clearTimeout(timeout);
          win.removeListener('page-title-updated', titleListener);
          try {
            const data = JSON.parse(title.substring(10));
            resolve(data);
          } catch (e) {
            reject(e);
          }
        }
      };

      win.on('page-title-updated', titleListener);

      AuthService.ensureInterceptor().then(() => {
        win.webContents.executeJavaScript(`
          (async function() {
            try {
              const promptText = ${JSON.stringify(payload.prompt)};
              
              // 1. Find the prompt textarea (in Google Labs it's usually a textarea or contenteditable)
              const textarea = document.querySelector('textarea, [contenteditable="true"]');
              if (textarea) {
                textarea.value = promptText;
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
                textarea.dispatchEvent(new Event('change', { bubbles: true }));
                
                // 2. Find Generate button
                const buttons = Array.from(document.querySelectorAll('button'));
                const genBtn = buttons.find(b => b.textContent.match(/generate|create/i));
                
                if (genBtn) {
                  setTimeout(() => {
                    genBtn.click();
                    console.log("Clicked Generate button!");
                  }, 500);
                } else {
                  console.error("Generate button not found!");
                }
              } else {
                console.error("Prompt input not found!");
              }
            } catch (e) {
              console.error("DOM Generate Automation Error: ", e);
            }
          })();
        `);
      });
    });
  }
}

module.exports = new CharacterService();

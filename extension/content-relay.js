// content-relay.js
// Runs in ISOLATED world on labs.google.
// Listens to window.postMessage from MAIN world interceptor,
// then forwards captured data to the background service worker.

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (!event.data || !event.data.__vsType) return;

  const { __vsType, token, bearer } = event.data;

  try {
    if (__vsType === 'TOKEN_CAPTURED' && token && token.length > 100) {
      console.log('[VS Relay] Forwarding reCAPTCHA token to background, length:', token.length);
      chrome.runtime.sendMessage({ type: 'VS_RECAPTCHA_TOKEN_CAPTURED', token })
        .catch(err => console.warn('[VS Relay] sendMessage (token) failed:', err.message));
    }

    if (__vsType === 'BEARER_CAPTURED' && bearer && bearer.length > 20) {
      console.log('[VS Relay] Forwarding Bearer token to background, length:', bearer.length);
      chrome.runtime.sendMessage({ type: 'VS_BEARER_TOKEN_CAPTURED', bearer })
        .catch(err => console.warn('[VS Relay] sendMessage (bearer) failed:', err.message));
    }

    if (__vsType === 'PROJECT_ID_CAPTURED' && event.data.projectId) {
      console.log('[VS Relay] Forwarding Project ID to background:', event.data.projectId);
      chrome.runtime.sendMessage({ type: 'VS_PROJECT_ID_CAPTURED', projectId: event.data.projectId })
        .catch(err => console.warn('[VS Relay] sendMessage (projectId) failed:', err.message));
    }

    if (__vsType === 'PAYLOAD_TEMPLATE_CAPTURED' && event.data.payloadTemplate) {
      console.log('[VS Relay] Forwarding Payload Template to background');
      chrome.runtime.sendMessage({ type: 'VS_PAYLOAD_TEMPLATE_CAPTURED', payloadTemplate: event.data.payloadTemplate })
        .catch(err => console.warn('[VS Relay] sendMessage (payloadTemplate) failed:', err.message));
    }
  } catch (err) {
    console.warn('[VS Relay] Error:', err.message);
  }
});

console.log('[VS Relay] Installed on', location.hostname, location.pathname);

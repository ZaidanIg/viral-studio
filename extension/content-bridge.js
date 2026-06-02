// content-bridge.js
// Runs on localhost:3000 to bridge CustomEvents from the Next.js app to the Extension Service Worker

console.log('[Viral Studio Bridge] Content script initialized.');

// Listen for requests from the Web App
window.addEventListener('VIRAL_STUDIO_GENERATE_REQUEST', async (event) => {
  const detail = event.detail;
  
  if (!detail || !detail.id) return;
  
  console.log(`[Viral Studio Bridge] Received request ${detail.id} from Web App, forwarding to Extension Worker...`);
  
  try {
    if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
      throw new Error("Extension context invalidated. Please RELOAD this page (F5) to reconnect to the extension.");
    }
    
    // Forward to background.js
    const response = await chrome.runtime.sendMessage({
      type: 'GENERATE_FLOW_MEDIA',
      payload: detail.payload
    });
    
    // Dispatch response back to Web App
    window.dispatchEvent(new CustomEvent(`VIRAL_STUDIO_GENERATE_RESPONSE_${detail.id}`, {
      detail: { success: true, data: response }
    }));
  } catch (err) {
    console.error(`[Viral Studio Bridge] Error sending message to extension:`, err);
    window.dispatchEvent(new CustomEvent(`VIRAL_STUDIO_GENERATE_RESPONSE_${detail.id}`, {
      detail: { success: false, error: err.message || 'Extension error' }
    }));
  }
});

window.addEventListener('VIRAL_STUDIO_UPLOAD_REQUEST', async (event) => {
  const detail = event.detail;
  
  if (!detail || !detail.id) return;
  
  console.log(`[Viral Studio Bridge] Received upload request ${detail.id} from Web App, forwarding...`);
  
  try {
    if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
      throw new Error("Extension context invalidated. Please RELOAD this page (F5) to reconnect to the extension.");
    }

    const response = await chrome.runtime.sendMessage({
      type: 'UPLOAD_IMAGE',
      payload: detail.payload
    });
    
    window.dispatchEvent(new CustomEvent(`VIRAL_STUDIO_UPLOAD_RESPONSE_${detail.id}`, {
      detail: { success: true, data: response }
    }));
  } catch (err) {
    console.error(`[Viral Studio Bridge] Error sending message to extension:`, err);
    window.dispatchEvent(new CustomEvent(`VIRAL_STUDIO_UPLOAD_RESPONSE_${detail.id}`, {
      detail: { success: false, error: err.message || 'Extension error' }
    }));
  }
});

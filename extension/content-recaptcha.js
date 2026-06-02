// content-recaptcha.js
// This script will be injected into labs.google.com in the MAIN world.

async function extractToken(action = 'IMAGE_GENERATION') {
  try {
    if (!window.grecaptcha || !window.grecaptcha.enterprise) {
      throw new Error('reCAPTCHA enterprise is not defined on this page.');
    }
    
    let RECAPTCHA_SITE_KEY = '6LdsFiUsAAAAAIjVDZcuLhaHiDn5nnHVXVRQGeMV';
    
    // Attempt to detect from DOM
    try {
      const scripts = Array.from(document.querySelectorAll('script[src]'));
      for (const s of scripts) {
        const src = String(s.getAttribute('src') || '');
        if (src.includes('recaptcha') && src.includes('enterprise.js')) {
          const url = new URL(src, location.href);
          const renderKey = url.searchParams.get('render');
          if (renderKey && renderKey.trim()) {
            RECAPTCHA_SITE_KEY = renderKey.trim();
            break;
          }
        }
      }
    } catch (_) {}
    
    const token = await window.grecaptcha.enterprise.execute(RECAPTCHA_SITE_KEY, { action });
    return token;
  } catch (err) {
    throw err;
  }
}

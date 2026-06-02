const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { app } = require('electron');

const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36';

const getStorePath = () => {
  try {
    const dir = app.getPath('userData');
    return path.join(dir, 'ua.json');
  } catch (_) {
    return path.join(process.cwd(), 'ua.json');
  }
};

const safeRead = () => {
  const file = getStorePath();
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.userAgent === 'string' && parsed.userAgent.trim()) {
      return parsed.userAgent.trim();
    }
  } catch (_) {
    // ignore
  }
  return DEFAULT_UA;
};

const safeWrite = (ua) => {
  const file = getStorePath();
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ userAgent: ua }, null, 2), 'utf8');
  } catch (_) {
    // ignore
  }
};

const randomUA = () => {
  // Simple UA variants to reduce cache correlation; not a real spoof
  const chromeMajor = 144 + Math.floor(Math.random() * 3); // 144-146
  const build = `${chromeMajor}.0.${Math.floor(Math.random() * 2000)}.${Math.floor(Math.random() * 200)}`;
  return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${build} Safari/537.36`;
};

let cachedUA = safeRead();

const getUserAgent = () => cachedUA || DEFAULT_UA;

const setUserAgent = (ua) => {
  const next = (ua && String(ua).trim()) || DEFAULT_UA;
  cachedUA = next;
  safeWrite(next);
  return next;
};

const refreshUserAgent = () => {
  const ua = randomUA();
  setUserAgent(ua);
  return ua;
};

module.exports = {
  getUserAgent,
  setUserAgent,
  refreshUserAgent,
  DEFAULT_UA,
};

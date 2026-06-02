const { app, BrowserWindow, ipcMain, dialog, Menu, screen, session } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const axios = require('axios');
const {
  runPromptWorkflow,
  runPromptGenerator,
  analyzeCharacterImageWithGemini,
  callGeminiForScenes,
  generateSingleVideo,
  analyzeGeminiAudio,
} = require('./promptVideoWorkflow.js');
const { runSceneVideoWorkflow } = require('./promptSceneVideoWorkflow.js');
const { runPromptImageWorkflow, generateImage, uploadImageForGemPix, cleanupRecaptchaResources } = require('./promptImageWorkflow.js');
const { getUserAgent, refreshUserAgent } = require('./userAgentStore.js');
const { createClient } = require('@supabase/supabase-js');

// Parse .env manually for main process since we need SUPABASE_SERVICE_ROLE_KEY
let SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
let SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

try {
  const envPath = app?.isPackaged ? path.join(process.resourcesPath, '.env') : path.join(__dirname, '../../.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = match[2] || '';
        val = val.replace(/^['"]|['"]$/g, ''); // remove quotes
        if (key === 'VITE_SUPABASE_URL' || key === 'NEXT_PUBLIC_SUPABASE_URL') SUPABASE_URL = val;
        if (key === 'SUPABASE_SERVICE_ROLE_KEY') SUPABASE_SERVICE_KEY = val;
      }
    });
  }
} catch (e) {
  console.error('Failed to load .env in main process:', e);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Silence noisy console output in packaged builds so end users don't see Electron logs in terminal/CMD.
if (app?.isPackaged) {
  const noop = () => {};
  console.log = noop;
  console.info = noop;
  console.debug = noop;
  console.warn = noop;
}

function getMachineId() {
  try {
    const hostname = os.hostname() || 'unknown-host';
    const userInfo = typeof os.userInfo === 'function' ? os.userInfo() : null;
    const username =
      userInfo && typeof userInfo.username === 'string' && userInfo.username
        ? userInfo.username
        : 'unknown-user';
    const platform = process.platform || 'unknown-platform';
    const raw = `${hostname}::${username}::${platform}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
  } catch (err) {
    return `fallback-${Math.random().toString(36).slice(2)}`;
  }
}

let mainWindow = null;
let tutorialWindow = null;
let isCleaningUp = false;

async function clearTransientSession(reason = 'unspecified') {
  try {
    // Clear only non-persistent data. Avoid specifying unsupported storages (e.g., sessionstorage)
    // and purposely exclude localStorage to keep user settings.
    await session.defaultSession.clearStorageData({
      storages: ['cookies', 'cachestorage', 'indexdb', 'serviceworkers', 'shadercache'],
    });
    await session.defaultSession.clearCache();
    await session.defaultSession.clearAuthCache();
    console.log(`Session data cleared (${reason})`);
  } catch (error) {
    console.warn(`Failed to clear session data (${reason}):`, error.message);
  }
}

// Generate 12 angle labels using Gemini text model
ipcMain.handle('open-oauth-window', async (event, authUrl) => {
  return new Promise((resolve) => {
    let authWindow = new BrowserWindow({
      width: 500,
      height: 700,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
      autoHideMenuBar: true,
      alwaysOnTop: true,
    });

    // Cleanup function
    const closeWindow = () => {
      if (authWindow) {
        authWindow.destroy();
        authWindow = null;
      }
    };

    authWindow.webContents.on('will-redirect', (event, url) => {
      // Check if the redirect URL contains the access_token hash
      // The Supabase site URL might be localhost, so it will redirect there
      if (url.includes('access_token=') || url.includes('error_description=')) {
        event.preventDefault();
        resolve(url); // Send the full redirect URL back to the renderer
        closeWindow();
      }
    });

    authWindow.on('closed', () => {
      authWindow = null;
      resolve(null); // Return null if user closed the window manually
    });

    authWindow.loadURL(authUrl);
  });
});

ipcMain.handle('generate-angle-labels', async (_event, args) => {
  try {
    const { apiKey, productSummary, characterSummary, language = 'id' } = args || {};
    if (!apiKey) {
      throw new Error('API Key Gemini belum dikonfigurasi.');
    }

    const prompt = `You are generating short angle labels for an Ads Maker page.
Requirements:
- Return EXACTLY 12 labels.
- Each label must be 2-3 words, Title Case, no punctuation/symbols, no numbering.
- Use concise cues from product and character summaries.
- Avoid generic words: benefit, product, model, CTA, color words like white/gray unless critical.
- Output as a single comma-separated line.

Product Summary: ${productSummary || '-'}
Character Summary: ${characterSummary || '-'}
Language: ${language} (keep labels language-consistent)
Output format: Label1, Label2, Label3, ... Label12`;

    const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
    const body = {
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
    };

    const response = await axios.post(url, body, {
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
    });

    const candidates = Array.isArray(response.data?.candidates) ? response.data.candidates : [];
    const rawText = candidates
      .flatMap((cand) => (cand?.content?.parts || []).map((p) => (typeof p.text === 'string' ? p.text : '')))
      .join('')
      .trim();

    if (!rawText) {
      throw new Error('Respons Gemini kosong untuk label.');
    }

    const splitByComma = rawText
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.replace(/^[-•\d.\s]+/, '').trim());

    const labels = splitByComma.slice(0, 12);

    if (labels.length < 12) {
      throw new Error(`Gemini hanya mengembalikan ${labels.length} label.`);
    }

    return { ok: true, labels };
  } catch (error) {
    const message = error?.message || String(error);
    return { ok: false, error: message };
  }
});

ipcMain.handle('open-tutorial-window', async (_event, args) => {
  try {
    const url = args && typeof args.url === 'string' ? args.url : '';
    if (!url) {
      return { ok: false, error: 'Tutorial URL kosong.' };
    }

    if (tutorialWindow && !tutorialWindow.isDestroyed()) {
      tutorialWindow.focus();
      tutorialWindow.loadURL(url);
      return { ok: true };
    }

    tutorialWindow = new BrowserWindow({
      width: 1100,
      height: 700,
      show: true,
      icon: path.join(__dirname, '..', 'asset', 'Viral BGK.png'),
      webPreferences: {
        contextIsolation: true,
      },
    });

    tutorialWindow.setMenuBarVisibility(false);
    tutorialWindow.loadURL(url);

    tutorialWindow.on('closed', () => {
      tutorialWindow = null;
    });

    return { ok: true };
  } catch (error) {
    return { ok: false, error: error?.message || String(error) };
  }
});

ipcMain.handle('generate-scene-video', async (_event, args) => {
  try {
    const {
      bearerKey,
      aspectRatio,
      prompt,
      downloadPath,
      flowProjectId,
      durationSeconds,
      uiLanguage,
    } = args || {};

    const { getVideoMsg: getVMsg, generateSingleVideo } = require('./promptGeneratorWorkflow.js');
    const vmsg = getVMsg(uiLanguage);

    if (!bearerKey || !String(bearerKey).trim()) {
      throw new Error(vmsg.bearerTokenMissing || 'Global Bearer Token for VEO is not configured.');
    }

    if (!downloadPath || !String(downloadPath).trim()) {
      throw new Error(vmsg.outputFolderMissing || 'Output folder is not configured.');
    }

    if (!prompt || !String(prompt).trim()) {
      throw new Error(vmsg.promptVideoEmpty || 'Video prompt is empty.');
    }

    const safeAspect = aspectRatio === '9:16' ? '9:16' : '16:9';
    const safeModel = '3.1-fast-low';
    const safeResolution = '720p';

    const targetWindow = BrowserWindow.getAllWindows()[0];
    const sendUpdate = (update) => {
      if (targetWindow && !targetWindow.isDestroyed()) {
        targetWindow.webContents.send('batch-update', {
          ...update,
          workflow: update.workflow || 'Generate Scene (Direct)',
        });
      }
    };

    const result = await generateSingleVideo({
      bearerKey,
      aspectRatio: safeAspect,
      veoModel: safeModel,
      resolution: safeResolution,
      prompt,
      downloadPath,
      flowProjectId,
      uiLanguage,
      durationSeconds,
      sendUpdate,
    });

    return {
      ok: true,
      filePath: result.filePath,
      fileName: result.fileName,
      prompt: result.prompt,
      videoUrl: result.videoUrl,
    };
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    return { ok: false, error: message };
  }
});

ipcMain.handle('analyze-gemini-audio', async (_event, args) => {
  try {
    const { base64, mimeType, fileName, model, apiKey, prompt } = args || {};

    if (!apiKey) {
      throw new Error('API Key Gemini belum dikonfigurasi.');
    }

    if (!base64) {
      throw new Error('Data audio belum dikirim untuk analisis.');
    }

    const analysis = await analyzeGeminiAudio({
      apiKey,
      model: model || 'gemini-3-flash-preview',
      base64,
      mimeType: mimeType || 'audio/mp3',
      fileName,
      prompt,
    });

    return { ok: true, text: analysis };
  } catch (error) {
    const message = error.response?.data?.error?.message || error.message || String(error);
    return { ok: false, error: message };
  }
});

function normalizeBearerHeader(rawBearer) {
  const str = String(rawBearer || '');
  let cleaned = str.replace(/[\r\n]+/g, ' ').trim();
  if (!cleaned) {
    throw new Error('Bearer Token kosong atau tidak valid. Periksa halaman Pengaturan.');
  }
  cleaned = cleaned.replace(/^Bearer\s+/i, '');
  return `Bearer ${cleaned}`;
}

function createMainWindow() {
  if (mainWindow) return;

  const HD = { width: 1280, height: 720 };

  // Enable DevTools hanya saat development; matikan untuk rilis
  const allowDevTools = false;

  // Selalu mulai di ukuran 1280x720 sebagai ukuran dasar.
  const initialSize = HD;

  mainWindow = new BrowserWindow({
    width: initialSize.width,
    height: initialSize.height,
    // Izinkan resize agar tombol maximize/unmaximize aktif,
    // tetapi kita akan mengunci ukuran ke 1280x720 atau 1920x1080 di event handler.
    resizable: true,
    useContentSize: true,
    show: true,
    icon: path.join(__dirname, '..', 'asset', 'Viral BGK.png'),
    // Dark title bar overlay to match in-app theme
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0c0f16',
      symbolColor: '#ffffff',
      height: 32,
    },
    backgroundColor: '#0c0f16',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/index.js'),
      devTools: allowDevTools,
    },
  });

  // Sembunyikan menu bar agar user tidak melihat menu File/Edit/View/Window/Help.
  mainWindow.setMenuBarVisibility(false);
  Menu.setApplicationMenu(null);

  // DevTools shortcuts disallowed di rilis

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Print all renderer console logs/errors to the terminal
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    const levels = ['[RENDERER-VERBOSE]', '[RENDERER-INFO]', '[RENDERER-WARNING]', '[RENDERER-ERROR]'];
    const levelStr = levels[level] || '[RENDERER-LOG]';
    console.log(`${levelStr} ${message} (${sourceId}:${line})`);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Ketika user klik restore (unmaximize), paksa kembali ke ukuran 1280x720.
  // Maximize dibiarkan mengikuti perilaku normal OS (biasanya memenuhi layar kerja,
  // misalnya 1920x1080 di monitor Full HD).
  mainWindow.on('unmaximize', () => {
    mainWindow.setSize(1280, 720);
    mainWindow.center();
  });
}

// Lightweight local file server for serving generated videos to the renderer
const FILE_SERVER_PORT = 3123;
let fileServer = null;

function startFileServer() {
  // Avoid starting multiple servers in the same process (can happen in dev reloads)
  if (fileServer) {
    return;
  }

  const server = http.createServer((req, res) => {
    try {
      const url = new URL(req.url, `http://localhost:${FILE_SERVER_PORT}`);

      if (url.pathname === '/video') {
        const rawPath = url.searchParams.get('path');
        let filePath = rawPath ? decodeURIComponent(rawPath) : null;
        if (!filePath) {
          res.statusCode = 400;
          res.end('File path is required');
          return;
        }

        // Strip file:// prefix if present
        if (filePath.startsWith('file:///')) {
          filePath = filePath.replace(/^file:\/\/\//, '');
        } else if (filePath.startsWith('file://')) {
          filePath = filePath.replace(/^file:\/\//, '');
        }

        fs.stat(filePath, (err, stats) => {
          if (err || !stats.isFile()) {
            res.statusCode = 404;
            res.end('File not found');
            return;
          }

          res.writeHead(200, {
            'Content-Type': 'video/mp4',
          });

          const stream = fs.createReadStream(filePath);
          stream.on('error', () => {
            res.destroy();
          });
          stream.pipe(res);
        });
        return;
      }

      if (url.pathname === '/image') {
        const rawPath = url.searchParams.get('path');
        let filePath = rawPath ? decodeURIComponent(rawPath) : null;
        if (!filePath) {
          res.statusCode = 400;
          res.end('File path is required');
          return;
        }

        // Strip file:// prefix if present
        if (filePath.startsWith('file:///')) {
          filePath = filePath.replace(/^file:\/\/\//, '');
        } else if (filePath.startsWith('file://')) {
          filePath = filePath.replace(/^file:\/\//, '');
        }

        fs.stat(filePath, (err, stats) => {
          if (err || !stats.isFile()) {
            res.statusCode = 404;
            res.end('File not found');
            return;
          }

          const ext = path.extname(filePath).toLowerCase();
          let contentType = 'application/octet-stream';
          if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
          else if (ext === '.png') contentType = 'image/png';
          else if (ext === '.gif') contentType = 'image/gif';
          else if (ext === '.webp') contentType = 'image/webp';
          else if (ext === '.bmp') contentType = 'image/bmp';

          res.writeHead(200, {
            'Content-Type': contentType,
          });

          const stream = fs.createReadStream(filePath);
          stream.on('error', () => {
            res.destroy();
          });
          stream.pipe(res);
        });
        return;
      }

      res.statusCode = 404;
      res.end('Not found');
    } catch (error) {
      res.statusCode = 500;
      res.end('Internal server error');
    }
  });

  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      // Port already in use (likely from another running instance).
      // Log a warning but do not crash the Electron main process.
      console.warn(`File server: port ${FILE_SERVER_PORT} is already in use. Skipping new server instance.`);
    } else {
      console.error('File server error:', err);
    }
  });

  server.listen(FILE_SERVER_PORT, () => {
    console.log(`Local video server listening on http://localhost:${FILE_SERVER_PORT}`);
  });

  fileServer = server;
}

ipcMain.handle('set-main-window-size', (_event, args) => {
  if (!mainWindow) {
    return { ok: false, error: 'Main window is not available.' };
  }

  const preset = args && args.preset;
  let width = 1280;
  let height = 720;

  if (preset === '1080p' || preset === '1920x1080') {
    width = 1920;
    height = 1080;
  }

  mainWindow.setSize(width, height);
  mainWindow.center();

  return { ok: true, width, height };
});

ipcMain.handle('test-bearer-token', async (_event, args) => {
  try {
    const bearerTokenRaw = args && typeof args.bearerToken === 'string' ? args.bearerToken : '';
    const bearer = normalizeBearerHeader(bearerTokenRaw);

    const payload = {
      operations: [
        {
          operation: { name: 'zeo-token-test' },
          sceneId: 'zeo-token-test-scene',
          status: 'MEDIA_GENERATION_STATUS_PENDING',
        },
      ],
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    let response;
    try {
      response = await fetch('https://aisandbox-pa.googleapis.com/v1/video:batchCheckAsyncVideoGenerationStatus', {
        method: 'POST',
        headers: {
          accept: '*/*',
          'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
          authorization: bearer,
          'content-type': 'application/json',
          origin: 'https://labs.google',
          referer: 'https://labs.google/',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        status: response.status,
        error: 'Unauthorized: bearer token tidak valid atau sudah expired.',
      };
    }

    return {
      ok: true,
      status: response.status,
    };
  } catch (error) {
    const message =
      error && error.name === 'AbortError'
        ? 'Request timeout saat test bearer token. Periksa koneksi internet lalu coba lagi.'
        : (error && error.message ? error.message : String(error));
    return { ok: false, error: message };
  }
});

ipcMain.handle('get-user-agent', async () => {
  try {
    const ua = getUserAgent();
    return { ok: true, userAgent: ua };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
});

ipcMain.handle('refresh-user-agent', async () => {
  try {
    const ua = refreshUserAgent();
    await cleanupRecaptchaResources();
    await clearTransientSession('refresh-user-agent');
    return { ok: true, userAgent: ua };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
});

// Provide auth sheet URL to renderer
ipcMain.handle('get-auth-sheet-url', async () => {
  return { ok: true, url: AUTH_SHEET_URL };
});

ipcMain.handle('test-api-key', async (_event, args) => {
  try {
    const apiKeyRaw = args && typeof args.apiKey === 'string' ? args.apiKey : '';
    const provider = args && typeof args.provider === 'string' ? args.provider : '';
    const model = args && typeof args.model === 'string' && args.model.trim() ? args.model.trim() : 'gemini-2.5-flash';

    const apiKey = String(apiKeyRaw || '').trim();
    if (!apiKey) {
      throw new Error('API Key kosong atau tidak valid. Periksa halaman Pengaturan.');
    }

    if (provider && provider !== 'Gemini') {
      throw new Error('Test ApiKey saat ini hanya mendukung AI Provider "Gemini".');
    }

    const url =
      'https://generativelanguage.googleapis.com/v1beta/models/' +
      encodeURIComponent(model) +
      ':generateContent?key=' +
      encodeURIComponent(apiKey);

    const body = {
      contents: [
        {
          parts: [{ text: 'ping' }],
        },
      ],
      generationConfig: {
        maxOutputTokens: 1,
      },
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const text = await response.text();
      let parsedMessage = text;
      try {
        const parsed = JSON.parse(text);
        const msg = parsed && parsed.error && parsed.error.message;
        if (typeof msg === 'string' && msg.trim()) {
          parsedMessage = msg;
        }
      } catch (_) {
        // ignore
      }
      return { ok: false, status: response.status, error: parsedMessage };
    }

    return { ok: true, status: response.status };
  } catch (error) {
    const message =
      error && error.name === 'AbortError'
        ? 'Request timeout saat test API key. Periksa koneksi internet lalu coba lagi.'
        : (error && error.message ? error.message : String(error));
    return { ok: false, error: message };
  }
});

// IPC handler to start Prompt Generator workflow (Video Prompter)
ipcMain.handle('start-prompt-batch', async (_event, args) => {
  const targetWindow = BrowserWindow.getAllWindows()[0];
  const sendUpdate = (update) => {
    if (targetWindow && !targetWindow.isDestroyed()) {
      targetWindow.webContents.send('batch-update', {
        ...update,
        workflow: update.workflow || 'Prompt Generator',
      });
    }
  };

  const {
    config: { bearerToken, folderOutput, aiProvider, aiModel, apiKey },
    options,
  } = args;

  const result = await runPromptGenerator({
    aiProvider,
    aiModel,
    apiKey,
    sendUpdate,
    options: {
      ...options,
      folderOutput,
    },
  });

  return result;
});

const AFFILIATE_MESSAGES = {
  en: {
    outputFolderMissing: 'Global Output Folder is not configured. Open Settings.',
    bearerTokenMissing: 'Global Bearer Token for VEO is not configured. Open Settings.',
    noScenesProvided: 'No affiliate scenes were sent for video generation.',
    noScenesProcessed: 'No affiliate scenes were processed.',
    unsupportedCombo: 'The selected ratio/model/resolution combination is not yet supported for Reference Image. Forced to 16:9, Veo 3.1 Fast, 720p.',
    sceneSkipped: (index) => `Scene #${index} skipped because prompt or image is empty.`,
    sceneWriteFailed: (index, msg) => `Scene #${index} failed to save image to disk: ${msg}`,
    noValidScenes: 'No valid affiliate scenes to process.',
    fatalError: (msg) => `FATAL (Affiliate Video): ${msg}`,
    processAborted: 'Affiliate Video process aborted due to error.',
    bearerTokenMissingImages: 'Global Bearer Token for Nano Banana is not configured. Open Settings.',
    noPromptsProvided: 'No image prompts were sent.',
    emptyPrompt: 'Empty prompt',
  },
  id: {
    outputFolderMissing: 'Folder Output global belum dikonfigurasi. Buka halaman Pengaturan.',
    bearerTokenMissing: 'Global Bearer Token untuk VEO belum dikonfigurasi. Buka halaman Pengaturan.',
    noScenesProvided: 'Tidak ada scene affiliate yang dikirim untuk dibuat video.',
    noScenesProcessed: 'Tidak ada scene affiliate yang diproses.',
    unsupportedCombo: 'Kombinasi rasio/model/resolusi yang dipilih belum didukung untuk Reference Image. Dipaksa ke 16:9, Veo 3.1 Fast, 720p.',
    sceneSkipped: (index) => `Scene #${index} dilewati karena prompt atau gambar kosong.`,
    sceneWriteFailed: (index, msg) => `Scene #${index} gagal menyimpan gambar ke disk: ${msg}`,
    noValidScenes: 'Tidak ada scene affiliate yang valid untuk diproses.',
    fatalError: (msg) => `FATAL (Affiliate Video): ${msg}`,
    processAborted: 'Proses Affiliate Video dihentikan karena error.',
    bearerTokenMissingImages: 'Global Bearer Token untuk Nano Banana belum dikonfigurasi. Buka halaman Pengaturan.',
    noPromptsProvided: 'Tidak ada prompt gambar yang dikirim.',
    emptyPrompt: 'Prompt kosong',
  },
  ms: {
    outputFolderMissing: 'Folder Output global belum dikonfigurasi. Buka Tetapan.',
    bearerTokenMissing: 'Global Bearer Token untuk VEO belum dikonfigurasi. Buka Tetapan.',
    noScenesProvided: 'Tiada scene affiliate yang dihantar untuk penjanaan video.',
    noScenesProcessed: 'Tiada scene affiliate yang diproses.',
    unsupportedCombo: 'Kombinasi nisbah/model/resolusi yang dipilih belum disokong untuk Reference Image. Dipaksa ke 16:9, Veo 3.1 Fast, 720p.',
    sceneSkipped: (index) => `Scene #${index} dilangkau kerana prompt atau imej kosong.`,
    sceneWriteFailed: (index, msg) => `Scene #${index} gagal menyimpan imej ke cakera: ${msg}`,
    noValidScenes: 'Tiada scene affiliate yang sah untuk diproses.',
    fatalError: (msg) => `FATAL (Affiliate Video): ${msg}`,
    processAborted: 'Proses Affiliate Video dihentikan kerana ralat.',
    bearerTokenMissingImages: 'Global Bearer Token untuk Nano Banana belum dikonfigurasi. Buka Tetapan.',
    noPromptsProvided: 'Tiada prompt imej yang dihantar.',
    emptyPrompt: 'Prompt kosong',
  },
};

function getAffiliateMsg(lang) {
  return AFFILIATE_MESSAGES[lang] || AFFILIATE_MESSAGES.id;
}

ipcMain.handle('start-affiliate-video-workflow', async (event, args) => {
  const category = args && args.category;
  const uiLanguage = args && args.uiLanguage ? args.uiLanguage : 'id';
  const amsg = getAffiliateMsg(uiLanguage);
  const sendUpdate = (update) => {
    const finalUpdate = {
      ...update,
      workflow: 'Affiliate Video',
      category,
    };
    event.sender.send('batch-update', finalUpdate);
  };

  try {
    const { bearerKey, downloadPath, aspectRatio, veoModel, resolution, scenes } = args || {};

    if (!downloadPath || !String(downloadPath).trim()) {
      throw new Error(amsg.outputFolderMissing);
    }

    if (!bearerKey || !String(bearerKey).trim()) {
      throw new Error(amsg.bearerTokenMissing);
    }

    if (!Array.isArray(scenes) || scenes.length === 0) {
      sendUpdate({
        type: 'INFO',
        message: amsg.noScenesProvided,
      });
      return { message: amsg.noScenesProcessed };
    }

    // Kombinasi yang saat ini diketahui stabil untuk Image-to-Video di VEO.
    //  - 16:9 + 3.1-fast + 720p: Reference Image (Generate Scene lama)
    //  - 9:16 + 3.1-fast + 720p: StartImage (portrait, start image saja)
    const supportedReferenceCombos = {
      '16:9': {
        '3.1-fast': {
          '720p': true,
        },
        '3.1-fast-low': {
          '720p': true,
        },
      },
      '9:16': {
        '3.1-fast': {
          '720p': true,
        },
        '3.1-fast-low': {
          '720p': true,
        },
      },
    };

    const requestedAspect = aspectRatio === '9:16' ? '9:16' : '16:9';
    let safeAspect = requestedAspect;
    let safeModel = '3.1-fast-low';
    let safeResolution = typeof resolution === 'string' && resolution ? resolution : '720p';

    const isSupported = Boolean(
      supportedReferenceCombos[safeAspect] &&
      supportedReferenceCombos[safeAspect][safeModel] &&
      supportedReferenceCombos[safeAspect][safeModel][safeResolution],
    );

    if (!isSupported) {
      safeAspect = '16:9';
      safeModel = '3.1-fast-low';
      safeResolution = '720p';

      sendUpdate({
        type: 'INFO',
        message:
          amsg.unsupportedCombo,
      });
    }

    const mappedScenes = [];

    scenes.forEach((scene, idx) => {
      const index = typeof scene.index === 'number' ? scene.index : idx + 1;
      const prompt = typeof scene.prompt === 'string' ? scene.prompt.trim() : '';
      const imageBase64 = typeof scene.imageBase64 === 'string' ? scene.imageBase64.trim() : '';
      const category = typeof scene.category === 'string' && scene.category ? scene.category : 'scene';

      if (!prompt || !imageBase64) {
        sendUpdate({
          type: 'SCENE_ERROR',
          index,
          message: amsg.sceneSkipped(index),
        });
        return;
      }

      const safeBaseName = `affiliate_${category}_${index}`.replace(/[^a-z0-9_\-]/gi, '_');
      const fileName = `${safeBaseName}_${Date.now()}.png`;
      const filePath = path.join(downloadPath, fileName);

      try {
        const buffer = Buffer.from(imageBase64, 'base64');
        fs.writeFileSync(filePath, buffer);
      } catch (writeErr) {
        const message = writeErr && writeErr.message ? writeErr.message : String(writeErr);
        sendUpdate({
          type: 'SCENE_ERROR',
          index,
          message: amsg.sceneWriteFailed(index, message),
        });
        return;
      }

      mappedScenes.push({
        index,
        mode: 'single',
        startPath: filePath,
        endPath: '',
        prompt,
      });
    });

    if (mappedScenes.length === 0) {
      return { message: amsg.noValidScenes };
    }

    const result = await runSceneVideoWorkflow({
      bearerKey,
      downloadPath,
      aspectRatio: safeAspect,
      veoModel: safeModel,
      resolution: safeResolution,
      scenes: mappedScenes,
      sendUpdate,
    });

    return result;
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    sendUpdate({ type: 'ERROR', message: amsg.fatalError(message) });
    return { message: amsg.processAborted, error: message };
  }
});

ipcMain.handle('generate-affiliate-images', async (_event, args) => {
  try {
    const { bearerKey, aspectRatioKey, imageResolution, items, references } = args || {};
    const uiLanguage = args && args.uiLanguage ? args.uiLanguage : 'id';
    const amsg2 = getAffiliateMsg(uiLanguage);

    if (!bearerKey || !String(bearerKey).trim()) {
      throw new Error(amsg2.bearerTokenMissingImages);
    }

    if (!Array.isArray(items) || items.length === 0) {
      throw new Error(amsg2.noPromptsProvided);
    }

    const ratioMap = {
      portrait: '9:16',
      vertical: '3:4',
      square: '1:1',
      landscape: '16:9',
    };

    const aspectRatio = ratioMap[aspectRatioKey] || '16:9';

    // Optional: upload reference images to GEM_PIX so they can be used as IMAGE_INPUT_TYPE_REFERENCE
    let productMediaId = null;
    let modelMediaIds = [];
    let supportMediaIds = [];

    try {
      if (references && typeof references === 'object') {
        const { product, models, additional } = references;

        if (typeof product === 'string' && product.trim()) {
          productMediaId = await uploadImageForGemPix(product.trim(), bearerKey, aspectRatio);
        }

        if (Array.isArray(models) && models.length > 0) {
          const limited = models.filter((m) => typeof m === 'string' && m.trim()).slice(0, 2);
          modelMediaIds = await Promise.all(
            limited.map((m) => uploadImageForGemPix(m.trim(), bearerKey, aspectRatio)),
          );
        }

        if (Array.isArray(additional) && additional.length > 0) {
          const limited = additional.filter((m) => typeof m === 'string' && m.trim()).slice(0, 3);
          supportMediaIds = await Promise.all(
            limited.map((m) => uploadImageForGemPix(m.trim(), bearerKey, aspectRatio)),
          );
        }
      }
    } catch (uploadError) {
      // Jika upload referensi gagal, lanjutkan saja dengan prompt teks biasa.
      // Jangan gagalkan seluruh workflow hanya karena reference image bermasalah.
      // eslint-disable-next-line no-console
      console.warn('Gagal mengupload reference image untuk GEM_PIX:', uploadError.message || uploadError);
      productMediaId = null;
      modelMediaIds = [];
      supportMediaIds = [];
    }

    const taskFns = items.map((item, index) => {
      const category = typeof item.category === 'string' ? item.category : 'broll';
      const prompt = typeof item.prompt === 'string' ? item.prompt.trim() : '';

      if (!prompt) {
        return Promise.resolve({
          index,
          category,
          success: false,
          error: amsg2.emptyPrompt,
        });
      }

      // Siapkan imageInputs berbasis kategori jika mediaId tersedia
      const imageInputs = [];

      const pushRef = (mediaId) => {
        if (!mediaId) return;
        imageInputs.push({
          name: mediaId,
          imageInputType: 'IMAGE_INPUT_TYPE_REFERENCE',
        });
      };

      // B-Roll & Commercial: pakai produk + foto pendukung sebagai referensi
      if (category === 'broll' || category === 'commercial') {
        pushRef(productMediaId);
        supportMediaIds.forEach((id) => pushRef(id));
      }

      // UGC: pakai produk + model (jika ada). Kalau tidak ada model, fallback ke produk saja.
      if (category === 'ugc') {
        pushRef(productMediaId);
        if (modelMediaIds.length > 0) {
          modelMediaIds.forEach((id) => pushRef(id));
        }
      }
      return async () => {
        try {
          const result = await generateImage({
            prompt,
            aspectRatio,
            bearerKey,
            imageResolution,
            imageInputs,
          });
          const base64 = result.imageData.toString('base64');
          const mime = result.mimeType || 'image/jpeg';
          const dataUrl = `data:${mime};base64,${base64}`;

          // Emit immediate completion event for this individual image
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('batch-update', {
              type: 'SCENE_COMPLETED',
              workflow: 'Affiliate Image',
              category,
              index,
              dataUrl,
              prompt,
            });
          }

          return {
            index,
            category,
            success: true,
            prompt,
            dataUrl,
            mimeType: mime,
          };
        } catch (error) {
          const message = error && error.message ? error.message : String(error);

          // Emit error event for this individual image
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('batch-update', {
              type: 'SCENE_ERROR',
              workflow: 'Affiliate Image',
              category,
              index,
              message: message,
            });
          }

          return {
            index,
            category,
            success: false,
            prompt,
            error: message,
          };
        }
      };
    });

    const results = [];
    const maxConcurrent = 1;
    const delayBetweenBatchesMs = 1500; // Beri jeda antar gambar agar lebih aman

    for (let i = 0; i < taskFns.length; i += maxConcurrent) {
      if (i > 0 && delayBetweenBatchesMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayBetweenBatchesMs));
      }

      const batch = taskFns.slice(i, i + maxConcurrent);
      const batchResults = await Promise.all(batch.map((fn) => fn()));
      results.push(...batchResults);
    }

    return { ok: true, results };
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    return { ok: false, error: message };
  }
});

ipcMain.handle('generate-video-direct', async (_event, args) => {
  try {
    const {
      bearerKey,
      aspectRatio,
      veoModel,
      resolution,
      prompt,
      downloadPath,
      flowProjectId,
      uiLanguage,
    } = args || {};

    const { getVideoMsg: getVMsg } = require('./promptGeneratorWorkflow.js');
    const vmsg = getVMsg(uiLanguage);

    if (!bearerKey || !String(bearerKey).trim()) {
      throw new Error(vmsg.bearerTokenMissing || 'Global Bearer Token for VEO is not configured.');
    }

    if (!downloadPath || !String(downloadPath).trim()) {
      throw new Error(vmsg.outputFolderMissing || 'Output folder is not configured.');
    }

    if (!prompt || !String(prompt).trim()) {
      throw new Error(vmsg.promptVideoEmpty || 'Video prompt is empty.');
    }

    const safeAspect = aspectRatio === '9:16' ? '9:16' : '16:9';
    const safeModel = '3.1-fast-low';
    const safeResolution = resolution || '720p';

    const targetWindow = BrowserWindow.getAllWindows()[0];
    const sendUpdate = (update) => {
      if (targetWindow && !targetWindow.isDestroyed()) {
        targetWindow.webContents.send('batch-update', {
          ...update,
          workflow: update.workflow || 'Prompt to Video',
        });
      }
    };

    const result = await generateSingleVideo({
      bearerKey,
      aspectRatio: safeAspect,
      veoModel: safeModel,
      resolution: safeResolution,
      prompt,
      downloadPath,
      flowProjectId,
      sendUpdate,
      uiLanguage,
    });

    return {
      ok: true,
      filePath: result.filePath,
      fileName: result.fileName,
      prompt: result.prompt,
    };
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    return { ok: false, error: message };
  }
});

ipcMain.handle('edit-story-frame', async (_event, args) => {
  try {
    const { bearerKey, aspectRatio, imageResolution, imageBase64, instruction, mode } = args || {};

    if (!bearerKey || !String(bearerKey).trim()) {
      throw new Error('Global Bearer Token untuk Imagen belum dikonfigurasi. Buka halaman Pengaturan.');
    }

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      throw new Error('Data gambar untuk Edit/POV frame tidak dikirim.');
    }

    if (!instruction || typeof instruction !== 'string') {
      throw new Error('Instruksi untuk Edit/POV frame tidak dikirim.');
    }

    const validAspects = ['1:1', '16:9', '9:16', '4:3', '3:4'];
    const safeAspect =
      typeof aspectRatio === 'string' && validAspects.includes(aspectRatio)
        ? aspectRatio
        : '16:9';

    // Upload image to GEM_PIX asset store and use it as reference image input.
    const mediaId = await uploadImageForGemPix(imageBase64.trim(), bearerKey, safeAspect);

    const imageInputs = [
      {
        name: mediaId,
        imageInputType: 'IMAGE_INPUT_TYPE_REFERENCE',
      },
    ];

    const result = await generateImage({
      prompt: instruction,
      aspectRatio: safeAspect,
      bearerKey,
      imageResolution,
      imageInputs,
    });

    if (!result || !result.success || !result.imageData) {
      throw new Error('Gagal membuat gambar baru untuk Edit/POV frame.');
    }

    const base64 = result.imageData.toString('base64');
    const mime = result.mimeType || 'image/jpeg';
    const dataUrl = `data:${mime};base64,${base64}`;

    return {
      ok: true,
      dataUrl,
      mimeType: mime,
      mode: mode || 'edit',
    };
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    return { ok: false, error: message };
  }
});

ipcMain.handle('generate-story-scene-images', async (_event, args) => {
  try {
    const { bearerKey, aspectRatio, imageResolution, startPrompt, endPrompt, references } = args || {};

    if (!bearerKey || !String(bearerKey).trim()) {
      throw new Error('Global Bearer Token untuk Imagen belum dikonfigurasi. Buka halaman Pengaturan.');
    }

    const safeAspect = aspectRatio === '9:16' ? '9:16' : '16:9';

    // Optional: upload reference images (misalnya visual karakter) ke GEM_PIX
    // agar bisa dipakai sebagai IMAGE_INPUT_TYPE_REFERENCE untuk start & end.
    let modelMediaIds = [];
    try {
      if (references && typeof references === 'object') {
        const { models } = references;

        if (Array.isArray(models) && models.length > 0) {
          const limited = models.filter((m) => typeof m === 'string' && m.trim()).slice(0, 2);
          modelMediaIds = await Promise.all(limited.map((m) => uploadImageForGemPix(m.trim(), bearerKey, safeAspect)));
        }
      }
    } catch (uploadError) {
      // Jika upload referensi gagal, lanjutkan tanpa imageInputs agar scene tetap bisa digenerate.
      // eslint-disable-next-line no-console
      console.warn('Gagal mengupload reference image untuk generate-story-scene-images:', uploadError.message || uploadError);
      modelMediaIds = [];
    }

    const baseImageInputs = Array.isArray(modelMediaIds) && modelMediaIds.length > 0
      ? modelMediaIds.map((id) => ({
        name: id,
        imageInputType: 'IMAGE_INPUT_TYPE_REFERENCE',
      }))
      : [];

    const startText = typeof startPrompt === 'string' ? startPrompt.trim() : '';
    const endText = typeof endPrompt === 'string' ? endPrompt.trim() : '';

    if (!startText && !endText) {
      throw new Error('Prompt start dan end untuk scene kosong.');
    }

    const toDataUrl = (result) => {
      if (!result || !result.success || !result.imageData) return null;
      const base64 = result.imageData.toString('base64');
      const mime = result.mimeType || 'image/jpeg';
      const dataUrl = `data:${mime};base64,${base64}`;
      return {
        dataUrl,
        prompt: result.prompt,
        mimeType: mime,
      };
    };

    let startImage = null;
    let endImage = null;

    if (startText) {
      let startResult;
      try {
        startResult = await generateImage({
          prompt: startText,
          aspectRatio: safeAspect,
          bearerKey,
          imageResolution,
          imageInputs: baseImageInputs,
        });
      } catch (error) {
        const message = error && error.message ? error.message : String(error);
        startResult = { success: false, error: message };
      }

      startImage = toDataUrl(startResult);
    }

    if (endText) {
      let endImageInputs = baseImageInputs;

      if (startImage && startImage.dataUrl) {
        const parts = String(startImage.dataUrl).split(',');
        const base64 = parts[1] || '';
        if (base64) {
          try {
            const startMediaId = await uploadImageForGemPix(base64.trim(), bearerKey, safeAspect);
            endImageInputs = [
              {
                name: startMediaId,
                imageInputType: 'IMAGE_INPUT_TYPE_REFERENCE',
              },
              ...baseImageInputs,
            ];
          } catch (_uploadErr) {
            endImageInputs = baseImageInputs;
          }
        }
      }

      let endResult;
      try {
        endResult = await generateImage({
          prompt: endText,
          aspectRatio: safeAspect,
          bearerKey,
          imageResolution,
          imageInputs: endImageInputs,
        });
      } catch (error) {
        const message = error && error.message ? error.message : String(error);
        endResult = { success: false, error: message };
      }

      endImage = toDataUrl(endResult);
    }

    const requestedStart = !!startText;
    const requestedEnd = !!endText;

    const requestedCount = (requestedStart ? 1 : 0) + (requestedEnd ? 1 : 0);
    const successCount =
      (requestedStart && startImage ? 1 : 0) + (requestedEnd && endImage ? 1 : 0);

    if (requestedCount > 0 && successCount === 0) {
      if (requestedStart && requestedEnd) {
        throw new Error('Gagal membuat kedua gambar start dan end untuk scene ini.');
      }
      throw new Error('Gagal membuat gambar untuk scene ini.');
    }

    return {
      ok: true,
      start: startImage || null,
      end: endImage || null,
    };
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    return { ok: false, error: message };
  }
});

ipcMain.handle('select-folder', async (_event, args) => {
  const { defaultPath, title } = args || {};

  const result = await dialog.showOpenDialog({
    title: title || 'Pilih Folder',
    properties: ['openDirectory', 'createDirectory'],
    defaultPath: defaultPath || undefined,
  });

  if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
    return { canceled: true };
  }

  return {
    canceled: false,
    path: result.filePaths[0],
  };
});

ipcMain.handle('get-image-files', async (_event, args) => {
  const folderPath = args && typeof args.folderPath === 'string' ? args.folderPath : '';

  if (!folderPath) {
    return { ok: false, error: 'Folder path untuk gambar belum dikirim.' };
  }

  try {
    const entries = fs.readdirSync(folderPath, { withFileTypes: true });
    const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp']);

    const files = entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => imageExtensions.has(path.extname(name).toLowerCase()))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
      .map((name) => path.join(folderPath, name));

    return { ok: true, files };
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    return { ok: false, error: message };
  }
});

ipcMain.handle('start-scene-workflow', async (event, args) => {
  const sendUpdate = (update) => {
    const finalUpdate = {
      ...update,
      workflow: update.workflow || 'Generate Scene',
    };
    event.sender.send('batch-update', finalUpdate);
  };

  const { bearerKey, downloadPath, aspectRatio, veoModel, resolution, scenes, flowProjectId, uiLanguage } = args || {};

  const result = await runSceneVideoWorkflow({
    bearerKey,
    downloadPath,
    aspectRatio,
    veoModel,
    resolution,
    scenes,
    flowProjectId,
    sendUpdate,
    uiLanguage,
  });

  return result;
});

// IPC handler to start Generate Video workflow (Prompt to Video in legacy terms)
ipcMain.handle('start-video-batch', async (event, args) => {
  const sendUpdate = (update) => {
    event.sender.send('batch-update', {
      ...update,
      workflow: update.workflow || 'Prompt to Video',
    });
  };

  const {
    bearerKey,
    flowProjectId,
    aspectRatio,
    veoModel,
    resolution,
    downloadPath,
    batchSize,
    prompts,
    uiLanguage,
    authMode,
    bearerPool,
  } = args || {};

  const result = await runPromptWorkflow({
    bearerKey,
    flowProjectId,
    aspectRatio,
    veoModel,
    resolution,
    downloadPath,
    batchSize,
    sendUpdate,
    prompts,
    uiLanguage,
    authMode,
    bearerPool,
  });

  return result;
});

ipcMain.handle('analyze-character-image', async (_event, args) => {
  try {
    const {
      imageBase64,
      mimeType,
      aiProvider,
      aiModel,
      apiKey,
      schemaParameters,
      language,
      targetLanguage,
      analysisLanguageHint,
    } = args || {};

    if (!imageBase64) {
      throw new Error('Gambar karakter belum dikirim untuk analisis.');
    }

    if (!aiProvider || aiProvider !== 'Gemini') {
      throw new Error('Analisis karakter saat ini hanya mendukung AI Provider "Gemini".');
    }

    if (!apiKey) {
      throw new Error('API Key Gemini untuk analisis karakter belum dikonfigurasi.');
    }

    const model = aiModel || 'gemini-2.5-flash';

    const analysis = await analyzeCharacterImageWithGemini({
      apiKey,
      model,
      imageBase64,
      mimeType,
      schemaParameters,
      language,
      targetLanguage,
      analysisLanguageHint,
    });

    return { ok: true, analysis };
  } catch (error) {
    const message = error.response?.data?.error?.message || error.message || String(error);
    return { ok: false, error: message };
  }
});

ipcMain.handle('license-check', async (_event, args) => {
  try {
    const emailRaw = args && args.email ? String(args.email) : '';
    const email = emailRaw.trim().toLowerCase();

    if (!email) {
      return { ok: false, code: 'BAD_REQUEST', message: 'Mohon isi alamat email terlebih dahulu.' };
    }

    const machineId = getMachineId();

    const { data: license, error } = await supabase
      .from('licenses')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !license) {
      return { ok: false, code: 'NOT_FOUND', message: 'Email tidak ditemukan dalam daftar lisensi.' };
    }

    if (!license.is_active) {
      return { ok: false, code: 'INACTIVE', message: 'Lisensi Anda sudah tidak aktif.' };
    }

    if (license.expires_at && new Date(license.expires_at) < new Date()) {
      return { ok: false, code: 'EXPIRED', message: 'Lisensi Anda sudah kadaluarsa.' };
    }

    if (!license.machine_id) {
      // Bind to this machine
      await supabase.from('licenses').update({ machine_id: machineId }).eq('id', license.id);
      return { ok: true, code: 'OK', message: 'Lisensi berhasil dihubungkan ke perangkat ini.' };
    } else if (license.machine_id !== machineId) {
      return { ok: false, code: 'MACHINE_MISMATCH', message: 'Lisensi ini sudah terhubung dengan perangkat lain.' };
    }

    return { ok: true, code: 'OK', message: 'Lisensi valid.' };
  } catch (error) {
    return { ok: false, code: 'NETWORK_ERROR', message: 'Gagal memproses lisensi. Hubungi admin.' };
  }
});

ipcMain.handle('license-get-info', async (_event, args) => {
  try {
    const emailRaw = args && args.email ? String(args.email) : '';
    const email = emailRaw.trim().toLowerCase();

    if (!email) {
      return { ok: false, code: 'BAD_REQUEST', message: 'Alamat email tidak ditemukan.' };
    }

    const { data: license, error } = await supabase
      .from('licenses')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !license) {
      return { ok: false, code: 'NOT_FOUND', message: 'Lisensi tidak ditemukan.' };
    }

    return {
      ok: true,
      code: 'OK',
      message: 'Info lisensi berhasil diambil.',
      license: {
        email: license.email,
        isActive: license.is_active,
        expiresAt: license.expires_at,
        machineId: license.machine_id,
      },
    };
  } catch (error) {
    return { ok: false, code: 'NETWORK_ERROR', message: 'Gagal mengambil informasi lisensi.' };
  }
});

ipcMain.handle('license-clear-machine', async (_event, args) => {
  try {
    const emailRaw = args && args.email ? String(args.email) : '';
    const email = emailRaw.trim().toLowerCase();

    if (!email) {
      return { ok: false, code: 'BAD_REQUEST', message: 'Alamat email tidak ditemukan.' };
    }

    const { error } = await supabase
      .from('licenses')
      .update({ machine_id: null })
      .eq('email', email);

    if (error) {
      return { ok: false, code: 'ERROR', message: 'Gagal mereset perangkat.' };
    }

    return { ok: true, code: 'OK', message: 'Perangkat berhasil di-reset. Anda dapat login di komputer lain sekarang.' };
  } catch (error) {
    return { ok: false, code: 'NETWORK_ERROR', message: 'Gagal memproses reset lisensi.' };
  }
});

ipcMain.handle('generate-scene-prompt', async (_event, args) => {
  try {
    const { aiProvider, aiModel, apiKey, scene } = args || {};

    if (!scene || !scene.index || !scene.mode || !scene.startPath) {
      throw new Error('Data scene belum lengkap untuk generate prompt.');
    }

    if (!aiProvider || aiProvider !== 'Gemini') {
      throw new Error('Generate Scene Prompt saat ini hanya mendukung AI Provider "Gemini".');
    }

    if (!apiKey) {
      throw new Error('API Key Gemini untuk Generate Scene Prompt belum dikonfigurasi.');
    }

    const model = aiModel || 'gemini-2.5-flash';

    const startName = path.basename(scene.startPath);
    const endName = scene.endPath ? path.basename(scene.endPath) : startName;

    const lines = [];
    lines.push(
      'Anda adalah asisten AI yang menulis prompt teks untuk model text-to-video. Tugas Anda adalah membuat SATU prompt scene sinematik singkat dalam Bahasa Indonesia yang natural.',
    );
    if (scene.mode === 'single') {
      lines.push(`Scene ini berdasarkan SATU gambar tunggal dengan nama file: ${startName}.`);
    } else {
      lines.push(
        `Scene ini berdasarkan DUA gambar: START = ${startName}, END = ${endName}. Perlakukan keduanya sebagai potongan awal dan akhir dari satu movement kamera atau aksi yang sama.`,
      );
    }
    lines.push(
      'PERATURAN KERAS: Lihat baik-baik isi visual gambar referensi. Prompt HARUS menggambarkan isi gambar tersebut secara setia (subjek utama, objek, lingkungan, warna dominan, dan komposisi) tanpa menambahkan elemen yang tidak terlihat jelas di gambar.',
    );
    lines.push(
      'Jika gambar hanya berisi objek atau produk, fokuskan deskripsi pada objek/produk itu sebagai tokoh utama. JANGAN menciptakan karakter manusia, bangunan, atau lokasi baru yang tidak tampak di gambar.',
    );
    lines.push(
      'Fokuskan prompt pada aksi utama, mood atau suasana yang selaras dengan gambar, pergerakan kamera yang wajar, komposisi, dan kualitas sinematik modern.',
    );
    lines.push(
      'Tuliskan prompt akhir dalam 2–3 kalimat pendek berbahasa Indonesia, tanpa judul, tanpa nomor scene, tanpa bullet point, dan tanpa penjelasan tambahan.',
    );

    const instructionText = lines.join('\n');

    let startBase64 = '';
    let endBase64 = null;

    try {
      const startBuffer = fs.readFileSync(scene.startPath);
      startBase64 = startBuffer.toString('base64');

      if (scene.mode !== 'single' && scene.endPath) {
        const endBuffer = fs.readFileSync(scene.endPath);
        endBase64 = endBuffer.toString('base64');
      }
    } catch (fileError) {
      const message = fileError && fileError.message ? fileError.message : String(fileError);
      throw new Error(
        `Gagal membaca file gambar untuk Generate Scene Prompt: ${message}`,
      );
    }

    if (!startBase64) {
      throw new Error('Data gambar start untuk Generate Scene Prompt kosong.');
    }

    const getMimeTypeFromPath = (filePath) => {
      const ext = path.extname(filePath || '').toLowerCase();
      if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
      if (ext === '.png') return 'image/png';
      if (ext === '.webp') return 'image/webp';
      if (ext === '.gif') return 'image/gif';
      return 'image/png';
    };

    const parts = [
      { text: instructionText },
      {
        inlineData: {
          mimeType: getMimeTypeFromPath(scene.startPath),
          data: startBase64,
        },
      },
    ];

    if (endBase64) {
      parts.push({
        inlineData: {
          mimeType: getMimeTypeFromPath(scene.endPath),
          data: endBase64,
        },
      });
    }

    const promptText = await callGeminiForScenes({
      apiKey,
      model,
      instructionText,
      parts,
    });

    const finalPrompt =
      typeof promptText === 'string' ? promptText.trim() : String(promptText || '').trim();

    if (!finalPrompt) {
      throw new Error('AI tidak mengembalikan teks prompt yang dapat digunakan.');
    }

    return { ok: true, prompt: finalPrompt };
  } catch (error) {
    const message = error.response?.data?.error?.message || error.message || String(error);
    return { ok: false, error: message };
  }
});

ipcMain.handle('generate-image-direct', async (_event, args) => {
  try {
    const {
      bearerKey,
      aspectRatio,
      imageResolution,
      prompt,
      outputFolder,
      flowProjectId,
      uiLanguage,
      ingredientImages,
    } = args || {};

    const { getImageMsg: getIMsg } = require('./promptImageWorkflow.js');
    const imsg = getIMsg(uiLanguage);

    if (!bearerKey || !String(bearerKey).trim()) {
      throw new Error(imsg.bearerTokenMissing);
    }

    if (!outputFolder || !String(outputFolder).trim()) {
      throw new Error(imsg.outputFolderMissing);
    }

    if (!prompt || !String(prompt).trim()) {
      throw new Error(imsg.noPromptsSent);
    }

    const safeAspect = aspectRatio === '9:16' ? '9:16' : '16:9';

    // Upload ingredient images as reference inputs if provided
    let imageInputs = [];
    if (Array.isArray(ingredientImages) && ingredientImages.length > 0) {
      console.log(`[generate-image-direct] Uploading ${ingredientImages.length} ingredient image(s)...`);
      for (let i = 0; i < ingredientImages.length; i++) {
        const img = ingredientImages[i];
        if (!img || !img.data) continue;
        try {
          const mediaId = await uploadImageForGemPix(img.data, bearerKey, safeAspect);
          console.log(`[generate-image-direct] Uploaded ingredient ${i + 1}/${ingredientImages.length}: ${mediaId.slice(0, 40)}...`);
          imageInputs.push({
            name: mediaId,
            imageInputType: 'IMAGE_INPUT_TYPE_REFERENCE',
          });
        } catch (uploadErr) {
          console.warn(`[generate-image-direct] Failed to upload ingredient ${i + 1}:`, uploadErr?.message || uploadErr);
          // Continue with other images; don't fail the whole request
        }
      }
      console.log(`[generate-image-direct] Successfully uploaded ${imageInputs.length} ingredient image(s) as references.`);
    }

    const result = await generateImage({
      prompt: String(prompt).trim(),
      aspectRatio: safeAspect,
      bearerKey,
      imageResolution,
      flowProjectId,
      imageInputs,
    });

    const extension = result.mimeType === 'image/png' ? 'png' : 'jpg';
    const filename = `image_regen_${Date.now()}.${extension}`;
    const outputPath = path.join(outputFolder, filename);
    fs.writeFileSync(outputPath, result.imageData);

    const base64 = result.imageData.toString('base64');
    const dataUrl = `data:${result.mimeType || 'image/jpeg'};base64,${base64}`;

    console.log(`[generate-image-direct] Returning result with dataUrl length: ${dataUrl.length}`);

    return {
      ok: true,
      filePath: outputPath,
      fileName: filename,
      dataUrl, // Return Base64 for immediate frontend use
      prompt: result.prompt || String(prompt).trim(),
      modelUsed: result.modelUsed || 'GEM_PIX_2',
      ingredientCount: imageInputs.length,
    };
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    return { ok: false, error: message };
  }
});

// IPC handler to start Prompt to Image workflow (Generate Image page)
ipcMain.handle('start-prompt-image-workflow', async (event, args) => {
  const sendUpdate = (update) => {
    const finalUpdate = {
      ...update,
      workflow: update.workflow || 'Prompt to Image',
    };

    const win = event?.sender?.getOwnerBrowserWindow?.();
    if (!win || win.isDestroyed()) {
      console.warn('[batch-update] target window destroyed, skip send');
      return;
    }

    try {
      event.sender.send('batch-update', finalUpdate);
    } catch (err) {
      console.warn('[batch-update] failed to send update:', err?.message || err);
    }
  };

  const {
    bearerKey,
    flowProjectId,
    aspectRatio,
    imageResolution,
    batchSize,
    outputFolder,
    outputFormat,
    prompts,
    uiLanguage,
  } = args || {};

  const result = await runPromptImageWorkflow({
    bearerKey,
    flowProjectId,
    aspectRatio,
    imageResolution,
    batchSize,
    outputFolder,
    sendUpdate,
    outputFormat,
    prompts,
    uiLanguage,
  });

  return result;
});

// Single instance lock - hanya izinkan 1 instance aplikasi berjalan
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Jika instance lain sudah berjalan, quit aplikasi ini
  app.quit();
} else {
  // Jika ada instance kedua yang mencoba dibuka, fokus ke window yang sudah ada
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    // Attempt to clear transient data from any prior ungraceful termination
    await clearTransientSession('app-start');

    startFileServer();
    createMainWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      }
    });
  });
}

app.on('window-all-closed', async () => {
  if (!isCleaningUp) {
    isCleaningUp = true;

    // Cleanup recaptcha resources (destroy window and clear session data)
    await cleanupRecaptchaResources();

    // Clear transient data (keep localStorage so settings persist)
    await clearTransientSession('window-all-closed');

    // Close file server to prevent port binding issues
    if (fileServer) {
      await new Promise((resolve) => {
        fileServer.close(() => {
          console.log('File server closed');
          resolve();
        });
      });
      fileServer = null;
    }
  }
  // Force exit after cleanup on all platforms (including macOS)
  app.exit(0);
});

app.on('will-quit', async (event) => {
  // Skip if already cleaning up
  if (isCleaningUp) {
    return;
  }

  // Prevent immediate quit to allow async cleanup
  event.preventDefault();
  isCleaningUp = true;

  // Cleanup recaptcha resources (destroy window and clear session data)
  await cleanupRecaptchaResources();

  // Clear transient data (keep localStorage so settings persist)
  await clearTransientSession('will-quit');

  // Ensure file server is closed on app quit
  if (fileServer) {
    fileServer.close(() => {
      console.log('File server closed on quit');
    });
    fileServer = null;
  }

  // Now actually quit
  app.exit(0);
});

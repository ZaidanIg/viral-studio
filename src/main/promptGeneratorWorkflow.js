// electron/videoPromptWorkflow.js
// Adapted from a legacy veo-prompt implementation to work with inline credential JSON

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { shell } = require('electron');
const { getRecaptchaToken, postFromLabsWindow, isRecaptchaEvaluationFailed } = require('./promptImageWorkflow.js');

const RECAPTCHA_ACTION = 'VIDEO_GENERATION';
const RECAPTCHA_ACTION_FALLBACK = 'PINHOLE_GENERATE_IMAGE';
const RECAPTCHA_APPLICATION_TYPE = 'RECAPTCHA_APPLICATION_TYPE_WEB';

async function analyzeGeminiAudio({ apiKey, model = 'gemini-3-flash-preview', base64, mimeType = 'audio/mp3', fileName = '', prompt }) {
  if (!apiKey) throw new Error('API Key Gemini belum dikonfigurasi.');
  if (!base64) throw new Error('Data audio belum dikirim.');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const body = {
    contents: [
      {
        parts: [
          { text: prompt || 'Describe this audio clip' },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64,
            },
          },
        ],
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
  const text = candidates
    .flatMap((cand) => (cand?.content?.parts || []).map((p) => (typeof p.text === 'string' ? p.text : '')))
    .join('')
    .trim();

  if (!text) {
    const snapshot = (() => {
      try { return JSON.stringify(response.data).slice(0, 400); } catch { return '[no snapshot]'; }
    })();
    throw new Error(`Respons Gemini kosong. Snapshot: ${snapshot}`);
  }

  return text;
}

// --- Backend i18n messages for Prompt Generator workflow ---
const BACKEND_MESSAGES = {
  en: {
    providerUnsupported: 'Currently Prompt Generator only supports AI Provider "Gemini".',
    apiKeyMissing: 'API Key for Gemini is not configured.',
    startingBatch: (batch, count, remaining) => `Starting batch ${batch}: requesting ${count} prompts (remaining target: ${remaining}).`,
    sendingInstruction: (batch, count) => `Sending instruction to Gemini for batch ${batch} (${count} prompts)...`,
    rateLimitRetry: (batch, attempt, max, sec) => `Batch ${batch} hit rate limit / temporary error from Gemini (attempt ${attempt}/${max}). Waiting ${sec} seconds before retrying...`,
    batchGeminiFailed: (batch, err) => `Batch ${batch} failed to call Gemini: ${err}`,
    partialBatchContinue: (count) => `Some previous batches succeeded. Continuing with ${count} prompts already collected.`,
    geminiResponseReceived: (batch, len) => `Response from Gemini for batch ${batch} received. Text length: ${len} characters.`,
    batchParseFailed: (batch, err) => `Batch ${batch} failed to parse: ${err}`,
    continueWithPrevious: (count) => `Continuing with ${count} prompts from previous successful batches.`,
    batchNoPrompts: (batch) => `Batch ${batch} did not produce any processable prompts.`,
    batchComplete: (batch, done, total) => `Batch ${batch} complete. Prompts collected: ${done}/${total}.`,
    promptsPrepared: (count) => `Successfully prepared prompt data from AI in this batch. Prompts to process: ${count}.`,
    noPromptsFromAI: 'No prompts were successfully created by AI from all batches.',
    totalFinalPrompts: (count) => `Total final prompts from all batches to process: ${count}.`,
    preparingPrompts: (count) => `Preparing ${count} prompts to write to file...`,
    promptSkippedBanned: (idx, style) => `Prompt #${idx} skipped because it contains banned words for style ${style}.`,
    promptMissingText: (idx) => `Prompt #${idx} from AI does not have "plain_text_prompt". Prompt skipped.`,
    promptCreated: (done, total, idx) => `[${done}/${total}] Prompt #${idx} successfully created and prepared for saving to file.`,
    fileSaved: (txt, json) => `File saved: ${txt} and ${json}`,
    autoOpenDone: 'Auto-open completed for TXT and JSON files.',
    autoOpenFailed: (err) => `Failed to auto-open file: ${err}`,
    fileSaveFailed: (err) => `Failed to save output file: ${err}`,
    batchSuccess: (count) => `Successfully created ${count} new prompts.`,
    fatalError: (err) => `FATAL (Prompt Generator): ${err}`,
    rateLimitHint: (err) => `${err} (Most likely due to Gemini API rate limit. Reduce number of prompts per run or wait a few minutes before trying again.)`,
    processStoppedError: 'Prompt generator process stopped due to error.',
    fallbackArrayParsed: (count) => `AI response is a text array. Successfully built ${count} prompts from fallback AI response format.`,
    arrayNoText: 'JSON is an array but does not contain processable prompt text.',
    noScenesField: 'JSON does not have a "scenes" field or valid prompt array.',
    fallbackExtracted: (count) => `JSON from AI is not fully valid, but successfully extracted prompt text for ${count} prompts (from plain_text_prompt / fallback text pattern in AI response). System uses this fallback.`,
    jsonParseFailed: 'Failed to parse JSON from AI response. Make sure the model returns valid JSON without other text.',
    noValidScenes: 'AI response does not contain a valid "scenes" array.',
    noProcessablePrompts: 'AI response does not contain processable prompts.',
    videoSuccess: (filename) => `Video regeneration complete: ${filename}`,
    regenerationMode: 'Regeneration mode: Processing single prompt...',
  },
  id: {
    providerUnsupported: 'Saat ini Prompt Generator hanya mendukung AI Provider "Gemini".',
    apiKeyMissing: 'API Key untuk Gemini belum dikonfigurasi.',
    startingBatch: (batch, count, remaining) => `Memulai batch ${batch}: meminta ${count} prompt (sisa target: ${remaining}).`,
    sendingInstruction: (batch, count) => `Mengirim instruksi ke Gemini untuk batch ${batch} (${count} prompt)...`,
    rateLimitRetry: (batch, attempt, max, sec) => `Batch ${batch} mendapat rate limit / error sementara dari Gemini (percobaan ${attempt}/${max}). Menunggu ${sec} detik sebelum mencoba lagi...`,
    batchGeminiFailed: (batch, err) => `Batch ${batch} gagal memanggil Gemini: ${err}`,
    partialBatchContinue: (count) => `Beberapa batch sebelumnya telah berhasil. Melanjutkan dengan ${count} prompt yang sudah terkumpul.`,
    geminiResponseReceived: (batch, len) => `Respons dari Gemini untuk batch ${batch} diterima. Panjang teks: ${len} karakter.`,
    batchParseFailed: (batch, err) => `Batch ${batch} gagal diurai: ${err}`,
    continueWithPrevious: (count) => `Melanjutkan dengan ${count} prompt dari batch-batch sebelumnya yang sudah berhasil.`,
    batchNoPrompts: (batch) => `Batch ${batch} tidak menghasilkan prompt yang dapat diproses.`,
    batchComplete: (batch, done, total) => `Batch ${batch} selesai. Prompt terkumpul: ${done}/${total}.`,
    promptsPrepared: (count) => `Berhasil menyiapkan data prompt dari AI pada batch ini. Jumlah prompt yang akan diproses: ${count}.`,
    noPromptsFromAI: 'Tidak ada prompt yang berhasil dibuat oleh AI dari semua batch.',
    totalFinalPrompts: (count) => `Total prompt final dari semua batch yang akan diproses: ${count}.`,
    preparingPrompts: (count) => `Menyiapkan ${count} prompt untuk ditulis ke file...`,
    promptSkippedBanned: (idx, style) => `Prompt #${idx} dilewati karena mengandung kata terlarang untuk style ${style}.`,
    promptMissingText: (idx) => `Prompt #${idx} dari AI tidak memiliki "plain_text_prompt". Prompt dilewati.`,
    promptCreated: (done, total, idx) => `[${done}/${total}] Prompt #${idx} berhasil dibuat dan disiapkan untuk disimpan ke file.`,
    fileSaved: (txt, json) => `File tersimpan: ${txt} dan ${json}`,
    autoOpenDone: 'Auto-open selesai untuk file TXT dan JSON.',
    autoOpenFailed: (err) => `Gagal auto-open file: ${err}`,
    fileSaveFailed: (err) => `Gagal menyimpan file output: ${err}`,
    batchSuccess: (count) => `Berhasil membuat ${count} prompt baru.`,
    fatalError: (err) => `FATAL (Prompt Generator): ${err}`,
    rateLimitHint: (err) => `${err} (Kemungkinan besar karena rate limit Gemini API. Kurangi Jumlah Prompt per run atau tunggu beberapa menit sebelum mencoba lagi.)`,
    processStoppedError: 'Proses generator prompt dihentikan karena error.',
    fallbackArrayParsed: (count) => `Respons AI berupa array teks. Berhasil membangun ${count} prompt dari format cadangan respons AI.`,
    arrayNoText: 'JSON berupa array tetapi tidak berisi teks prompt yang dapat diproses.',
    noScenesField: 'JSON tidak memiliki field "scenes" maupun array prompt yang valid.',
    fallbackExtracted: (count) => `JSON dari AI tidak valid sepenuhnya, tetapi berhasil mengekstrak prompt teks untuk ${count} prompt (dari plain_text_prompt / pola teks cadangan di respons AI). Sistem menggunakan fallback ini.`,
    jsonParseFailed: 'Gagal mengurai JSON dari respons AI. Pastikan model mengembalikan JSON valid tanpa teks lain.',
    noValidScenes: 'Respons AI tidak berisi array "scenes" yang valid.',
    noProcessablePrompts: 'Respons AI tidak mengandung prompt yang dapat diproses.',
    videoSuccess: (filename) => `Video regeneration selesai: ${filename}`,
    regenerationMode: 'Mode regenerasi: Memproses prompt tunggal...',
  },
  ms: {
    providerUnsupported: 'Pada masa ini Prompt Generator hanya menyokong AI Provider "Gemini".',
    apiKeyMissing: 'API Key untuk Gemini belum dikonfigurasi.',
    startingBatch: (batch, count, remaining) => `Memulakan batch ${batch}: meminta ${count} prompt (baki sasaran: ${remaining}).`,
    sendingInstruction: (batch, count) => `Menghantar arahan ke Gemini untuk batch ${batch} (${count} prompt)...`,
    rateLimitRetry: (batch, attempt, max, sec) => `Batch ${batch} terkena had kadar / ralat sementara dari Gemini (percubaan ${attempt}/${max}). Menunggu ${sec} saat sebelum mencuba lagi...`,
    batchGeminiFailed: (batch, err) => `Batch ${batch} gagal memanggil Gemini: ${err}`,
    partialBatchContinue: (count) => `Beberapa batch sebelumnya telah berjaya. Meneruskan dengan ${count} prompt yang sudah terkumpul.`,
    geminiResponseReceived: (batch, len) => `Respons dari Gemini untuk batch ${batch} diterima. Panjang teks: ${len} aksara.`,
    batchParseFailed: (batch, err) => `Batch ${batch} gagal dihurai: ${err}`,
    continueWithPrevious: (count) => `Meneruskan dengan ${count} prompt dari batch-batch sebelumnya yang sudah berjaya.`,
    batchNoPrompts: (batch) => `Batch ${batch} tidak menghasilkan prompt yang boleh diproses.`,
    batchComplete: (batch, done, total) => `Batch ${batch} selesai. Prompt terkumpul: ${done}/${total}.`,
    promptsPrepared: (count) => `Berjaya menyediakan data prompt dari AI pada batch ini. Bilangan prompt yang akan diproses: ${count}.`,
    noPromptsFromAI: 'Tiada prompt yang berjaya dibuat oleh AI dari semua batch.',
    totalFinalPrompts: (count) => `Jumlah prompt akhir dari semua batch yang akan diproses: ${count}.`,
    preparingPrompts: (count) => `Menyediakan ${count} prompt untuk ditulis ke fail...`,
    promptSkippedBanned: (idx, style) => `Prompt #${idx} dilangkau kerana mengandungi perkataan terlarang untuk gaya ${style}.`,
    promptMissingText: (idx) => `Prompt #${idx} dari AI tidak mempunyai "plain_text_prompt". Prompt dilangkau.`,
    promptCreated: (done, total, idx) => `[${done}/${total}] Prompt #${idx} berjaya dibuat dan disediakan untuk disimpan ke fail.`,
    fileSaved: (txt, json) => `Fail disimpan: ${txt} dan ${json}`,
    autoOpenDone: 'Auto-open selesai untuk fail TXT dan JSON.',
    autoOpenFailed: (err) => `Gagal auto-open fail: ${err}`,
    fileSaveFailed: (err) => `Gagal menyimpan fail output: ${err}`,
    batchSuccess: (count) => `Berjaya membuat ${count} prompt baharu.`,
    fatalError: (err) => `FATAL (Prompt Generator): ${err}`,
    rateLimitHint: (err) => `${err} (Kemungkinan besar kerana had kadar API Gemini. Kurangkan bilangan prompt per run atau tunggu beberapa minit sebelum mencuba lagi.)`,
    processStoppedError: 'Proses penjana prompt dihentikan kerana ralat.',
    fallbackArrayParsed: (count) => `Respons AI berupa tatasusunan teks. Berjaya membina ${count} prompt dari format sandaran respons AI.`,
    arrayNoText: 'JSON berupa tatasusunan tetapi tidak mengandungi teks prompt yang boleh diproses.',
    noScenesField: 'JSON tidak mempunyai medan "scenes" mahupun tatasusunan prompt yang sah.',
    fallbackExtracted: (count) => `JSON dari AI tidak sah sepenuhnya, tetapi berjaya mengekstrak teks prompt untuk ${count} prompt (dari plain_text_prompt / pola teks sandaran dalam respons AI). Sistem menggunakan sandaran ini.`,
    jsonParseFailed: 'Gagal menghurai JSON dari respons AI. Pastikan model mengembalikan JSON yang sah tanpa teks lain.',
    noValidScenes: 'Respons AI tidak mengandungi tatasusunan "scenes" yang sah.',
    noProcessablePrompts: 'Respons AI tidak mengandungi prompt yang boleh diproses.',
    videoSuccess: (filename) => `Jana semula video selesai: ${filename}`,
    regenerationMode: 'Mod jana semula: Memproses prompt tunggal...',
  },
};

function getMsg(lang) {
  return BACKEND_MESSAGES[lang] || BACKEND_MESSAGES.en;
}

// --- Backend i18n messages for Video (Prompt to Video) workflow ---
const VIDEO_MESSAGES = {
  en: {
    bearerTokenMissing: 'Global Bearer Token for VEO is not configured. Open Settings.',
    outputFolderMissing: 'Output folder is not configured. Open Settings.',
    promptVideoEmpty: 'Video prompt is empty.',
    regenerationMode: 'Regeneration mode: Processing single prompt...',
    regenerating: (title) => `Regenerating: "${title}..."`,
    regeneratingProgress: (title, pct) => `Regenerating: "${title}..." (${pct}%)`,
    regenStarted: (id) => `Video regeneration started (ID: ${id})`,
    regenTimeout: 'Regeneration timeout - video did not finish in the expected time',
    downloadingVideo: 'Downloading video...',
    regenComplete: (filename) => `Video regeneration complete: ${filename}`,
    regenDone: 'Video regeneration complete.',
    regenFailed: (err) => `Regeneration failed: ${err}`,
    dataReady: (count, batchSize) => `Data ready to process: ${count} valid prompts (Batch size: ${batchSize} parallel)`,
    totalValid: (count) => `Total: ${count} valid prompts`,
    batchStarting: (batch, total, count) => `Batch ${batch}/${total}: Starting ${count} parallel videos...`,
    promptEmpty: (text) => `Prompt is empty or invalid. Original text: "${text}"`,
    processing: (idx, total, title) => `[${idx}/${total}] Processing: "${title}..."`,
    videoCreating: (id) => `Video is being created (ID: ${id})...`,
    waitingApi: 'Waiting for video result from API...',
    apiFailed: 'Video generation failed by API. Prompt may violate policy.',
    stuckStatus: (status) => `Video generation stuck at status: ${status}. There may be a server issue.`,
    generatingRealtime: (pct) => `Generating video: ${pct}% (Real-time from API)`,
    finalizingVideo: (elapsed, status) => `Finalizing video... (${elapsed}s) - Status: ${status}`,
    generatingEstimated: (pct) => `Generating video: ${pct}% (Estimated)`,
    videoTimeout: 'Timeout expired, video did not finish being created.',
    videoSuccess: (filename) => `Video successful via Flow Media / VEO: ${filename}`,
    videoError: (err) => `Error: ${err}`,
    batchDone: (batch) => `Batch ${batch} finished processing.`,
    allDone: (success, total) => `Complete: ${success}/${total} successful.`,
    allDoneReturn: (count) => `Finished processing ${count} prompts.`,
    noPromptsSent: 'No prompts were sent. Please fill in prompts then click Generate.',
    fatalError: (err) => `FATAL: ${err}`,
    processStoppedError: 'Process stopped due to error.',
  },
  id: {
    bearerTokenMissing: 'Bearer Token global untuk VEO belum dikonfigurasi. Buka Pengaturan.',
    outputFolderMissing: 'Folder Output belum dikonfigurasi. Buka Pengaturan.',
    promptVideoEmpty: 'Prompt video kosong.',
    regenerationMode: 'Mode regenerasi: Memproses prompt tunggal...',
    regenerating: (title) => `Regenerasi: "${title}..."`,
    regeneratingProgress: (title, pct) => `Regenerasi: "${title}..." (${pct}%)`,
    regenStarted: (id) => `Regenerasi video berhasil dimulai (ID: ${id})`,
    regenTimeout: 'Regenerasi timeout - video tidak selesai dalam waktu yang diharapkan',
    downloadingVideo: 'Mengunduh video...',
    regenComplete: (filename) => `Regenerasi video selesai: ${filename}`,
    regenDone: 'Regenerasi video selesai.',
    regenFailed: (err) => `Regenerasi gagal: ${err}`,
    dataReady: (count, batchSize) => `Data siap diproses: ${count} prompt valid (Batch size: ${batchSize} parallel)`,
    totalValid: (count) => `Total: ${count} prompt valid`,
    batchStarting: (batch, total, count) => `Batch ${batch}/${total}: Memulai ${count} video parallel...`,
    promptEmpty: (text) => `Prompt kosong atau tidak valid. Teks asli: "${text}"`,
    processing: (idx, total, title) => `[${idx}/${total}] Memproses: "${title}..."`,
    videoCreating: (id) => `Video sedang dibuat (ID: ${id})...`,
    waitingApi: 'Menunggu hasil video dari API...',
    apiFailed: 'Pembuatan video gagal oleh API. Prompt mungkin melanggar kebijakan.',
    stuckStatus: (status) => `Pembuatan video terhenti di status: ${status}. Kemungkinan ada masalah di server.`,
    generatingRealtime: (pct) => `Generating video: ${pct}% (Real-time dari API)`,
    finalizingVideo: (elapsed, status) => `Finalisasi video... (${elapsed}s) - Status: ${status}`,
    generatingEstimated: (pct) => `Generating video: ${pct}% (Estimasi)`,
    videoTimeout: 'Waktu tunggu habis, video tidak selesai dibuat.',
    videoSuccess: (filename) => `Video berhasil via Flow Media / VEO: ${filename}`,
    videoError: (err) => `Error: ${err}`,
    batchDone: (batch) => `Batch ${batch} selesai diproses.`,
    allDone: (success, total) => `Selesai: ${success}/${total} berhasil.`,
    allDoneReturn: (count) => `Selesai memproses ${count} prompt.`,
    noPromptsSent: 'Tidak ada prompt yang dikirim. Silakan isi prompt lalu klik Generate.',
    fatalError: (err) => `FATAL: ${err}`,
    processStoppedError: 'Proses dihentikan karena error.',
  },
  ms: {
    bearerTokenMissing: 'Bearer Token global untuk VEO belum dikonfigurasi. Buka Tetapan.',
    outputFolderMissing: 'Folder Output belum dikonfigurasi. Buka Tetapan.',
    promptVideoEmpty: 'Prompt video kosong.',
    regenerationMode: 'Mod jana semula: Memproses prompt tunggal...',
    regenerating: (title) => `Jana semula: "${title}..."`,
    regeneratingProgress: (title, pct) => `Jana semula: "${title}..." (${pct}%)`,
    regenStarted: (id) => `Jana semula video berjaya dimulakan (ID: ${id})`,
    regenTimeout: 'Jana semula tamat masa - video tidak selesai dalam masa yang dijangka',
    downloadingVideo: 'Memuat turun video...',
    regenComplete: (filename) => `Jana semula video selesai: ${filename}`,
    regenDone: 'Jana semula video selesai.',
    regenFailed: (err) => `Jana semula gagal: ${err}`,
    dataReady: (count, batchSize) => `Data sedia diproses: ${count} prompt sah (Saiz batch: ${batchSize} selari)`,
    totalValid: (count) => `Jumlah: ${count} prompt sah`,
    batchStarting: (batch, total, count) => `Batch ${batch}/${total}: Memulakan ${count} video selari...`,
    promptEmpty: (text) => `Prompt kosong atau tidak sah. Teks asal: "${text}"`,
    processing: (idx, total, title) => `[${idx}/${total}] Memproses: "${title}..."`,
    videoCreating: (id) => `Video sedang dijana (ID: ${id})...`,
    waitingApi: 'Menunggu hasil video dari API...',
    apiFailed: 'Penjanaan video gagal oleh API. Prompt mungkin melanggar dasar.',
    stuckStatus: (status) => `Penjanaan video tersekat pada status: ${status}. Mungkin ada masalah di pelayan.`,
    generatingRealtime: (pct) => `Menjana video: ${pct}% (Masa nyata dari API)`,
    finalizingVideo: (elapsed, status) => `Memuktamadkan video... (${elapsed}s) - Status: ${status}`,
    generatingEstimated: (pct) => `Menjana video: ${pct}% (Anggaran)`,
    videoTimeout: 'Masa menunggu tamat, video tidak selesai dijana.',
    videoSuccess: (filename) => `Video berjaya melalui Flow Media / VEO: ${filename}`,
    videoError: (err) => `Ralat: ${err}`,
    batchDone: (batch) => `Batch ${batch} selesai diproses.`,
    allDone: (success, total) => `Selesai: ${success}/${total} berjaya.`,
    allDoneReturn: (count) => `Selesai memproses ${count} prompt.`,
    noPromptsSent: 'Tiada prompt yang dihantar. Sila isi prompt kemudian klik Jana.',
    fatalError: (err) => `FATAL: ${err}`,
    processStoppedError: 'Proses dihentikan kerana ralat.',
  },
};

function getVideoMsg(lang) {
  return VIDEO_MESSAGES[lang] || VIDEO_MESSAGES.en;
}

// --- API Configuration ---
const API_ENDPOINTS = {
  GENERATE: 'https://aisandbox-pa.googleapis.com/v1/video:batchAsyncGenerateVideoText',
  STATUS: 'https://aisandbox-pa.googleapis.com/v1/video:batchCheckAsyncVideoGenerationStatus',
};

const ASPECT_RATIO_MAP = {
  '16:9': {
    apiValue: 'VIDEO_ASPECT_RATIO_LANDSCAPE',
    models: {
      '3.1-fast-low': {
        '720p': 'veo_3_1_t2v_fast_ultra_relaxed',
      },
    },
  },
  '9:16': {
    apiValue: 'VIDEO_ASPECT_RATIO_PORTRAIT',
    models: {
      '3.1-fast-low': {
        '720p': 'veo_3_1_t2v_fast_portrait_ultra_relaxed',
      },
    },
  },
};

// (Image-to-Video mappings moved to promptSceneVideoWorkflow.js)

// --- Helper Functions ---
function formatOutput(data, format = 'plain') {
  if (format === 'json') {
    return JSON.stringify(data, null, 2);
  }

  if (typeof data === 'object') {
    if (data.fileName) {
      return `Video berhasil dibuat: ${data.fileName}`;
    }
    return Object.entries(data)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
  }
  return String(data);
}

function normalizeBearerHeader(rawBearer) {
  const str = String(rawBearer || '');
  // Hapus karakter newline/carriage return yang sering ikut saat copy-paste token
  let cleaned = str.replace(/[\r\n]+/g, ' ').trim();

  if (!cleaned) {
    throw new Error('Bearer Token untuk VEO kosong atau tidak valid. Periksa pengaturan Bearer Token.');
  }

  // Hilangkan prefix "Bearer" jika user sudah menuliskannya manual
  cleaned = cleaned.replace(/^Bearer\s+/i, '');

  return `Bearer ${cleaned}`;
}

function isInvalidArgumentError(err) {
  try {
    const status = err && err.response && err.response.status;
    if (status !== 400) return false;
    const data = err && err.response && err.response.data;
    const text = typeof data === 'string' ? data : JSON.stringify(data || '');
    return (
      text.includes('INVALID_ARGUMENT') ||
      text.toLowerCase().includes('request contains an invalid argument')
    );
  } catch (_) {
    return false;
  }
}

// --- Real VEO API Client ---
const VEO_API = {
  generateVideo: async (
    prompt,
    bearerKey,
    aspectRatio,
    veoModel = '3.1-fast-low',
    resolution = '720p',
    flowProjectId = null,
  ) => {
    const { v4: uuidv4 } = await import('uuid');
    const mappedAspectRatio = ASPECT_RATIO_MAP[aspectRatio];
    const normalizedBearer = normalizeBearerHeader(bearerKey);

    const actions = [RECAPTCHA_ACTION, RECAPTCHA_ACTION_FALLBACK]
      .map((v) => String(v || '').trim())
      .filter(Boolean)
      .filter((v, i, arr) => arr.indexOf(v) === i);

    let lastErr = null;
    const modelKey = mappedAspectRatio?.models?.[veoModel]?.[resolution];
    if (!modelKey) {
      throw new Error(`Video model key tidak ditemukan untuk model ${veoModel} dan resolusi ${resolution}.`);
    }

    for (const action of actions) {
      try {
        const sessionId = `;${Date.now()}`;
        const projectId = String(flowProjectId || '').trim() || uuidv4();
        const recaptchaToken = await getRecaptchaToken(action);
        const recaptchaContext = { token: recaptchaToken, applicationType: RECAPTCHA_APPLICATION_TYPE };

        const payload = {
          clientContext: { recaptchaContext, sessionId, projectId, tool: 'PINHOLE', userPaygateTier: 'PAYGATE_TIER_TWO' },
          requests: [{ aspectRatio: mappedAspectRatio.apiValue, seed: Math.floor(Math.random() * 100000), textInput: { prompt }, videoModelKey: modelKey, metadata: { sceneId: uuidv4() } }],
        };

        console.log('[VIDEO_FLOW] generateVideo start', { promptPreview: (prompt || '').slice(0, 60), aspectRatio, veoModel, resolution, action, modelKey, projectId });

        const data = await postFromLabsWindow({ url: API_ENDPOINTS.GENERATE, bearer: normalizedBearer, contentType: 'text/plain;charset=UTF-8', body: JSON.stringify(payload) });

        const operationName = data?.operations?.[0]?.operation;
        const opId = operationName?.name;
        if (!opId) throw new Error('Respons VEO tidak valid: operationId tidak ditemukan.');

        const remainingCredits = typeof data?.remainingCredits === 'number' && Number.isFinite(data.remainingCredits) ? data.remainingCredits : undefined;
        console.log('[VIDEO_FLOW] generateVideo ok', { opId, remainingCredits });
        return { operationId: opId, remainingCredits };
      } catch (err) {
        lastErr = err;
        if (isRecaptchaEvaluationFailed(err) && action !== actions[actions.length - 1]) continue;
        throw err;
      }
    }

    if (lastErr) throw lastErr;
    throw new Error('Gagal memanggil VEO: tidak ada reCAPTCHA action yang bisa dicoba.');
  },

  checkStatus: async (operationId, bearerKey) => {
    const opName = typeof operationId === 'string' ? operationId : operationId?.name || '';
    const payload = { operations: [{ operation: { name: opName } }] };
    const response = await axios.post(API_ENDPOINTS.STATUS, payload, {
      headers: {
        accept: '*/*',
        'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
        authorization: normalizeBearerHeader(bearerKey),
        'content-type': 'application/json',
        origin: 'https://labs.google',
        referer: 'https://labs.google/',
        'sec-ch-ua': '"Google Chrome";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'cross-site',
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
        'x-browser-channel': 'stable',
        'x-browser-copyright': 'Copyright 2025 Google LLC. All rights reserved.',
        'x-browser-validation': 'AGaxImjg97xQkd0h3geRTArJi8Y=',
        'x-browser-year': '2025',
        'x-client-data': 'CJG2yQEIprbJAQipncoBCIeWywEIlKHLAQiFoM0BCI2OzwE=',
      },
    });

    const operation = response.data.operations[0];

    const isCompleted =
      operation.status === 'MEDIA_GENERATION_STATUS_COMPLETED' ||
      operation.status === 'MEDIA_GENERATION_STATUS_SUCCESSFUL' ||
      operation.status === 'MEDIA_GENERATION_STATUS_FAILED';

    const baseResult = {
      completed: isCompleted,
      status: operation.status,
      progress: operation.operation?.metadata?.progress || null,
      errorMessage:
        operation.operation?.error?.message ||
        operation.operation?.metadata?.statusMessage ||
        operation.operation?.metadata?.terminalErrorMessage ||
        null,
    };

    const url = operation.operation?.metadata?.video?.fifeUrl || null;

    console.log('[VIDEO_FLOW] checkStatus', {
      opName,
      status: operation.status,
      completed: isCompleted,
      hasUrl: Boolean(url),
      progress: baseResult.progress,
      errorMessage: baseResult.errorMessage,
    });

    if (!isCompleted) {
      return baseResult;
    }

    if (operation.status === 'MEDIA_GENERATION_STATUS_FAILED') {
      return {
        ...baseResult,
        url: null,
      };
    }

    return {
      ...baseResult,
      url,
    };
  },

  downloadVideo: async (url) => {
    console.log('[VIDEO_FLOW] downloadVideo start', { urlPreview: (url || '').slice(0, 80) });
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    console.log('[VIDEO_FLOW] downloadVideo ok', { dataSize: response.data?.length || 0 });
    return response.data;
  },
};


// --- Helper: Parse JSON Prompt ---
function parsePromptData(promptText) {
  try {
    const data = JSON.parse(promptText);

    // New schema: plain_text_prompt contains the full prompt text to send to VEO.
    if (typeof data.plain_text_prompt === 'string' && data.plain_text_prompt.trim() !== '') {
      const plain = data.plain_text_prompt.trim();
      return {
        isJSON: true,
        originalData: data,
        generatedPrompt: plain,
        displayTitle: plain.substring(0, 50) + (plain.length > 50 ? '...' : ''),
      };
    }

    if (data.text && typeof data.text === 'string') {
      return {
        isJSON: true,
        originalData: data,
        generatedPrompt: data.text.trim(),
        displayTitle: data.text.substring(0, 50) + (data.text.length > 50 ? '...' : ''),
      };
    }

    let generatedPrompt = '';

    if (data.proyek_video) {
      generatedPrompt += `${data.proyek_video}. `;
    } else if (data.project_title) {
      generatedPrompt += `${data.project_title}. `;
    }

    if (data.style) {
      generatedPrompt += `Style: ${data.style}. `;
    }

    if (data.setting) {
      generatedPrompt += `Setting: ${data.setting}. `;
    }

    if (data.characters && Array.isArray(data.characters)) {
      const charDescriptions = data.characters
        .map((char) => {
          let desc = char.name || '';
          if (char.color) desc += ` (${char.color})`;
          if (char.weapon) desc += ` with ${char.weapon}`;
          if (char.ability) desc += `, ${char.ability}`;
          if (char.fighting_style) desc += `, ${char.fighting_style}`;
          return desc;
        })
        .join('; ');
      generatedPrompt += `Characters: ${charDescriptions}. `;
    }

    if (data.climax_event) {
      generatedPrompt += `Climax: ${data.climax_event}. `;
    }

    if (data.outcome) {
      generatedPrompt += `Outcome: ${data.outcome}`;
    }

    const finalPrompt = generatedPrompt.trim();

    return {
      isJSON: true,
      originalData: data,
      generatedPrompt: finalPrompt,
      displayTitle:
        data.proyek_video ||
        data.project_title ||
        finalPrompt.substring(0, 50) + (finalPrompt.length > 50 ? '...' : ''),
    };
  } catch (e) {
    return {
      isJSON: false,
      originalData: null,
      generatedPrompt: promptText.trim(),
      displayTitle: promptText.substring(0, 50) + (promptText.length > 50 ? '...' : ''),
    };
  }
}

async function generateSingleVideo({
  bearerKey,
  aspectRatio = '16:9',
  veoModel = '3.1-fast-low',
  resolution = '720p',
  prompt,
  downloadPath,
  flowProjectId,
}) {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  if (!downloadPath) {
    throw new Error('Folder Output global belum dikonfigurasi. Buka halaman Pengaturan.');
  }

  if (!bearerKey || String(bearerKey).trim() === '') {
    throw new Error('Global Bearer Token untuk VEO belum dikonfigurasi. Buka halaman Pengaturan.');
  }

  if (!prompt || String(prompt).trim() === '') {
    throw new Error('Prompt video kosong.');
  }

  const finalPrompt = String(prompt).trim();

  const startResult = await VEO_API.generateVideo(
    finalPrompt,
    bearerKey,
    aspectRatio,
    veoModel,
    resolution,
    flowProjectId,
  );
  const operationId = typeof startResult === 'string' ? startResult : startResult.operationId;
  const modelUsed = (startResult && startResult.modelUsed) || veoModel;

  let videoUrl = null;

  const maxAttempts = 90;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await sleep(10000);
    const result = await VEO_API.checkStatus(operationId, bearerKey);

    if (result.completed && result.url) {
      videoUrl = result.url;
      break;
    }

    if (result.status === 'MEDIA_GENERATION_STATUS_FAILED') {
      const reason =
        result.errorMessage ||
        'Video generation failed by API. Prompt mungkin melanggar policy.';
      throw new Error(reason);
    }
  }

  if (!videoUrl) {
    throw new Error('Waktu tunggu habis, video tidak selesai dibuat.');
  }

  const videoData = await VEO_API.downloadVideo(videoUrl);

  const safeTitleBase =
    finalPrompt.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 24) || 'video';
  const fileName = `${safeTitleBase}_${Date.now()}.mp4`;
  const filePath = path.join(downloadPath, fileName);

  try {
    fs.mkdirSync(downloadPath, { recursive: true });
  } catch (_) {
    // ignore mkdir failure; writeFileSync will throw if it persists
  }

  fs.writeFileSync(filePath, videoData);

  return {
    filePath,
    fileName,
    prompt: finalPrompt,
  };
}

// --- Prompt Generation Workflow (Video Prompter) ---

function extractJsonObjectFromText(rawText) {
  if (typeof rawText !== 'string') {
    throw new Error('Respons AI bukan string.');
  }

  let text = rawText.trim();

  // Hapus code fence markdown seperti ```json ... ```
  text = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();

  // Helper: ekstrak substring JSON dengan menghitung kurung kurawal seimbang,
  // mengabaikan kurung di dalam string.
  const extractBalanced = (source, startIndex) => {
    const len = source.length;
    let inString = false;
    let escape = false;
    let depth = 0;
    let start = -1;

    for (let i = startIndex; i < len; i += 1) {
      const ch = source[i];

      if (start === -1) {
        if (ch === '{') {
          start = i;
          depth = 1;
        }
        continue;
      }

      if (escape) {
        escape = false;
        continue;
      }

      if (ch === '\\') {
        escape = true;
        continue;
      }

      if (ch === '"') {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (ch === '{') {
          depth += 1;
        } else if (ch === '}') {
          depth -= 1;
          if (depth === 0) {
            return source.slice(start, i + 1).trim();
          }
        }
      }
    }

    return null;
  };

  // 1) Coba parse langsung dulu
  try {
    JSON.parse(text);
    return text;
  } catch (e) {
    // lanjut ke strategi ekstraksi di bawah
  }

  // 2) Coba fokus dari pola {"scenes": jika ada
  const scenesIndex = text.indexOf('{"scenes"');
  if (scenesIndex !== -1) {
    const candidate = extractBalanced(text, scenesIndex);
    if (candidate) {
      try {
        JSON.parse(candidate);
        return candidate;
      } catch (e) {
        // lanjut ke strategi berikutnya
      }
    }
  }

  // 3) Jika tidak ada pola {"scenes", pakai kurung kurawal pertama di teks
  const firstBrace = text.indexOf('{');
  if (firstBrace !== -1) {
    const candidate = extractBalanced(text, firstBrace);
    if (candidate) {
      try {
        JSON.parse(candidate);
        return candidate;
      } catch (e) {
        // tetap gagal, akan ditangani caller
      }
    }
  }

  // 4) Jika semua gagal, kembalikan teks apa adanya (akan gagal di JSON.parse selanjutnya)
  return text;
}

async function analyzeCharacterImageWithGemini({
  apiKey,
  model,
  imageBase64,
  mimeType,
  schemaParameters = [],
  language = 'en',
  targetLanguage = 'en',
  analysisLanguageHint = '',
}) {
  if (!apiKey) {
    throw new Error('API Key untuk Gemini belum dikonfigurasi.');
  }
  if (!imageBase64) {
    throw new Error('Data gambar untuk analisis karakter kosong.');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const isGemini25 = typeof model === 'string' && model.startsWith('gemini-2.5');
  const generationConfig = {
    temperature: 0.4,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 1024,
  };

  if (isGemini25) {
    generationConfig.thinkingConfig = { thinkingBudget: 0 };
  } else {
    generationConfig.responseMimeType = 'application/json';
  }

  const paramList = Array.isArray(schemaParameters) && schemaParameters.length > 0
    ? schemaParameters
    : [
      'Character Name',
      'Gender',
      'Age',
      'Ethnicity/Race',
      'Skin Tone',
    ];

  const instructionLines = [];
  instructionLines.push(
    'You are an AI assistant that analyzes a single character image (photo or illustration) and returns a character description in JSON format.',
  );
  const langInstruction =
    targetLanguage === 'en'
      ? 'Fill each attribute concisely and clearly in English. If information is not visible or unclear from the image, fill with an empty string "".'
      : targetLanguage === 'ms'
        ? 'Isi setiap atribut secara ringkas dan jelas dalam Bahasa Melayu. Jika maklumat tidak kelihatan atau tidak jelas daripada gambar, isi dengan rentetan kosong "".'
        : 'Isi setiap atribut secara singkat dan jelas dalam Bahasa Indonesia. Jika suatu informasi tidak terlihat atau tidak jelas dari gambar, isi dengan string kosong "".';
  instructionLines.push(langInstruction);
  if (analysisLanguageHint) {
    instructionLines.push(analysisLanguageHint);
  }
  instructionLines.push('List of keys that MUST be used exactly (case-sensitive):');
  paramList.forEach((name, idx) => {
    instructionLines.push(`${idx + 1}. ${name}`);
  });
  instructionLines.push(
    'REQUIRED OUTPUT: only ONE JSON object with keys exactly as listed above. Do not add any other text, explanation, or markdown.',
  );

  const instructionText = instructionLines.join('\n');

  const body = {
    contents: [
      {
        parts: [
          { text: instructionText },
          {
            inline_data: {
              mime_type: mimeType || 'image/png',
              data: imageBase64,
            },
          },
        ],
      },
    ],
    generationConfig,
  };

  const response = await axios.post(url, body, {
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
  });

  const data = response.data || {};
  console.log('[DEBUG] Full API Response (analyzeCharacterImageWithGemini):', JSON.stringify(data, null, 2));
  const candidates = Array.isArray(data.candidates) ? data.candidates : [];

  if (!candidates.length || !candidates[0].content || !candidates[0].content.parts) {
    if (data.error) {
      const code = data.error.code || data.error.status || 'UNKNOWN';
      const msg = data.error.message || 'Tidak ada pesan error.';
      throw new Error(`Respons AI analisis karakter tidak valid. Gemini error (${code}): ${msg}`);
    }

    let snapshot = '';
    try {
      snapshot = JSON.stringify(data).slice(0, 600);
    } catch (e) {
      snapshot = '[Gagal meng-serialize response.data]';
    }
    throw new Error(
      `Respons AI analisis karakter tidak valid. Snapshot respons: ${snapshot}`,
    );
  }

  const text = candidates[0].content.parts
    .map((part) => (typeof part.text === 'string' ? part.text : ''))
    .join('')
    .trim();

  if (!text) {
    throw new Error('Respons AI analisis karakter kosong.');
  }

  const cleaned = extractJsonObjectFromText(text);

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(
      `Gagal mengurai JSON dari respons analisis karakter. Pesan: ${err.message || String(
        err,
      )}`,
    );
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Analisis karakter dari AI bukan berupa objek JSON.');
  }

  return parsed;
}

async function callGeminiForScenes({ apiKey, model, instructionText, parts }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  // Untuk Gemini 2.5, batasi maxOutputTokens agar model tidak menghabiskan semua token
  // untuk "thoughts" internal sehingga tidak ada teks jawaban yang dikirim.
  const isGemini25 = typeof model === 'string' && model.startsWith('gemini-2.5');
  const maxOutputTokens = isGemini25 ? 2048 : 8192;

  const generationConfig = {
    // Meningkatkan peluang model mengembalikan output yang rapi
    temperature: 0.7,
    topP: 0.95,
    topK: 40,
    maxOutputTokens,
  };

  // Untuk Gemini 2.5, matikan "thinking" agar token tidak habis di thoughtsTokenCount.
  // Lihat dokumentasi Gemini API: thinkingConfig.thinkingBudget = 0
  if (isGemini25) {
    generationConfig.thinkingConfig = { thinkingBudget: 0 };
  } else {
    // Model lain masih boleh meminta output JSON langsung.
    generationConfig.responseMimeType = 'application/json';
  }

  const finalParts = Array.isArray(parts) && parts.length > 0
    ? parts
    : [{ text: instructionText }];

  const body = {
    contents: [
      {
        parts: finalParts,
      },
    ],
    generationConfig,
  };

  const response = await axios.post(url, body, {
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
  });

  const data = response.data || {};
  console.log('[DEBUG] Full API Response (callGeminiForScenes):', JSON.stringify(data, null, 2));
  const candidates = Array.isArray(data.candidates) ? data.candidates : [];

  if (!candidates.length || !candidates[0].content || !candidates[0].content.parts) {
    // Jika Gemini mengembalikan objek error, sertakan informasinya agar lebih mudah debug.
    if (data.error) {
      const code = data.error.code || data.error.status || 'UNKNOWN';
      const msg = data.error.message || 'Tidak ada pesan error.';
      throw new Error(`Respons AI tidak berisi kandidat yang valid. Gemini error (${code}): ${msg}`);
    }

    // Jika tidak ada error eksplisit, kirim snapshot singkat dari response.data.
    let snapshot = '';
    try {
      snapshot = JSON.stringify(data).slice(0, 600);
    } catch (e) {
      snapshot = '[Gagal meng-serialize response.data]';
    }
    throw new Error(
      `Respons AI tidak berisi kandidat yang valid. Snapshot respons: ${snapshot}`,
    );
  }

  const text = candidates[0].content.parts
    .map((part) => (typeof part.text === 'string' ? part.text : ''))
    .join('')
    .trim();

  if (!text) {
    throw new Error('Respons AI kosong.');
  }

  return text;
}

function buildPromptGenerationInstruction({
  theme,
  style,
  camera = [],
  composition = [],
  lighting = [],
  lens = [],
  emotionalTone = [],
  skinTone = [],
  ambientSound = [],
  negativePrompt = [],
  sfx = [],
  language = [],
  dialog = [],
  characterSourcePrompt,
  promptStyle = 'photo', // 'photo' | 'conceptual' | 'video'
  promptMode = 'continuous', // 'continuous' | 'independent'
  sceneCount,
}) {
  const targetLanguageMap = {
    english: 'en',
    indonesian: 'id',
    indonesia: 'id',
    'bahasa indonesia': 'id',
    malay: 'ms',
    malaysia: 'ms',
    'bahasa melayu': 'ms',
  };
  const normalizedLang = Array.isArray(language) && language.length > 0
    ? String(language[0] || '').toLowerCase()
    : 'english';
  const targetLanguage = targetLanguageMap[normalizedLang] || 'en';
  const isEnglish = targetLanguage === 'en';
  const isMalay = targetLanguage === 'ms';
  const isVector = promptStyle === 'conceptual';
  const isVideo = promptStyle === 'video';
  const isPhoto = promptStyle === 'photo';

  const lines = [];

  if (characterSourcePrompt) {
    lines.push(
      isEnglish
        ? 'BASE PROMPT (must preserve subject/background/framing):'
        : isMalay
          ? 'PROMPT SUMBER (wajib dikekalkan subjek/latar/bingkai):'
          : 'PROMPT SUMBER (wajib dipertahankan subjek/latar/framing):',
    );
    lines.push(characterSourcePrompt);
    lines.push(
      isEnglish
        ? 'Respect the base prompt above. Maintain subject identity, clothing, lighting, and background unless minor tweaks are requested.'
        : isMalay
          ? 'Hormati prompt sumber di atas. Kekalkan identiti subjek, pakaian, pencahayaan, dan latar kecuali pengubahsuaian kecil.'
          : 'Hormati prompt sumber di atas. Pertahankan identitas subjek, pakaian, pencahayaan, dan latar kecuali modifikasi minor.',
    );
    if (promptMode === 'continuous') {
      lines.push(
        isEnglish
          ? 'Create small variations ONLY: keep same setting and framing; change wording/detail lightly without changing context.'
          : isMalay
            ? 'Buat variasi kecil SAHAJA: kekal pada latar dan bingkai yang sama; ubah diksi/butiran ringan tanpa mengubah konteks.'
            : 'Buat variasi kecil SAJA: tetap pada latar dan framing yang sama; ubah diksi/detail ringan tanpa mengubah konteks.',
      );
    } else {
      lines.push(
        isEnglish
          ? 'Create independent variations but KEEP the same subject, outfit, and general mood from the base prompt.'
          : isMalay
            ? 'Buat variasi bebas tetapi KEKALKAN subjek, pakaian, dan suasana umum dari prompt sumber.'
            : 'Buat variasi mandiri tetapi TETAP mempertahankan subjek, pakaian, dan mood umum dari prompt sumber.',
      );
    }
  }

  if (isEnglish) {
    lines.push(
      `You are an AI assistant who creates high-quality image prompts for microstock (e.g., Adobe Stock, Shutterstock). Your task is to create ${sceneCount} image ideas, each usable as a standalone stock image.`,
    );
    lines.push('Write everything in natural, descriptive English.');
    lines.push('STRICT: Output must be entirely in English. Do NOT switch languages.');
    lines.push('Respond ONLY in English. Do NOT use Indonesian.');
    if (isVector) {
      lines.push(
        'STYLE REQUIREMENT: These must be VECTOR ILLUSTRATIONS (not photos). Use clean outlines, flat or minimally gradated colors, consistent line weight, and keep shapes SVG/AI-ready. Avoid photorealism, camera terms, bokeh, or photographic lighting; focus on clear, scalable vector aesthetic.',
      );
    } else if (isVideo) {
      lines.push(
        'VIDEO REQUIREMENT: Describe a short stock video clip (5–10 seconds) with clear subject motion and camera movement. Mention pacing, movement type (pan/tilt/dolly/handheld), and ensure it is smooth, stable, and loop-friendly if possible.',
      );
    } else if (isPhoto) {
      lines.push(
        'STYLE REQUIREMENT: Create diverse stock PHOTO descriptions; vary composition, angle, and color palette across prompts to avoid similarity. No repetition of key phrases across outputs.',
      );
    }
    const pillarLine = isVector
      ? 'MANDATORY CREATIVE FRAMEWORK (VECTOR): Use FIVE PILLARS and keep it vector-ready — 1) Subject (non-human/non-animal objects or textures suited for vector), 2) Environment (context/lighting described for illustration, not photography), 3) Composition (framing/layout for vector), 4) Style (vector aesthetic: flat/minimal gradients, consistent stroke), 5) Technical (SVG/AI-ready: stroke weight, color palette, layer cleanliness, no camera/lens jargon). Mention all five pillars explicitly.'
      : isVideo
        ? 'MANDATORY CREATIVE FRAMEWORK (VIDEO): Use FIVE PILLARS with motion — 1) Subject (non-human/non-animal objects/scenes), 2) Environment (atmosphere/lighting plus ambient motion like wind/water), 3) Composition (shot type/framing and camera move), 4) Style (aesthetic/grade, not photoreal lens jargon), 5) Technical (resolution, fps, stabilization, loopability, smooth motion, duration 5–8 seconds). Mention all five pillars explicitly and highlight motion.'
        : isPhoto
          ? 'MANDATORY CREATIVE FRAMEWORK (PHOTO): FIVE PILLARS — 1) Subject (non-human/non-animal, safe for stock), 2) Environment (atmosphere/lighting), 3) Composition (varied angles/framing), 4) Style (aesthetic/grading), 5) Technical (camera/lens/optics). Enforce diversity: each prompt must change angle, palette, or composition vs previous.'
          : 'MANDATORY CREATIVE FRAMEWORK: Build each prompt using the FIVE PILLARS: Subjek (non-human, non-animal textures/objects), Environment (atmosphere/lighting), Composition (camera angle/framing), Style (aesthetic), Technical (camera/lens/optics settings). Every prompt must explicitly cover all five pillars.';
    lines.push(pillarLine);
  } else if (isMalay) {
    lines.push(
      `Anda adalah pembantu AI yang mencipta prompt imej berkualiti tinggi untuk microstock (contohnya Adobe Stock, Shutterstock). Tugas anda adalah mencipta ${sceneCount} idea imej yang setiap satu boleh digunakan sebagai satu imej stok tersendiri.`,
    );
    lines.push('Tulis semua kandungan dalam Bahasa Melayu yang semula jadi dan deskriptif.');
    lines.push('WAJIB gunakan Bahasa Melayu sahaja. Jangan menggunakan bahasa lain.');
    if (isVector) {
      lines.push(
        'KEPERLUAN GAYA: Ini mesti ILUSTRASI VEKTOR (bukan foto). Gunakan outline bersih, warna rata atau gradasi minimum, ketebalan garisan konsisten, bentuk sedia SVG/AI. Elakkan fotorealisme, istilah kamera, bokeh, atau pencahayaan fotografi; fokus pada estetika vektor yang jelas dan boleh diskala.',
      );
    } else if (isVideo) {
      lines.push(
        'KEPERLUAN VIDEO: Huraikan klip video pendek (5–10 saat) dengan pergerakan subjek dan pergerakan kamera yang jelas. Nyatakan tempo, jenis pergerakan (pan/tilt/dolly/handheld), dan pastikan lancar, stabil, serta idealnya boleh digelung.',
      );
    } else if (isPhoto) {
      lines.push(
        'KEPERLUAN FOTO: Buat penerangan foto stok yang pelbagai; variasikan komposisi, sudut, dan palet warna di setiap prompt untuk mengelakkan persamaan. Jangan ulang frasa kunci di prompt berbeza.',
      );
    }
    const pillarLine = isVector
      ? 'RANGKA KERJA WAJIB (VEKTOR): Gunakan LIMA TIANG dan pastikan sedia vektor — 1) Subjek (objek/tekstur bukan manusia/bukan haiwan untuk vektor), 2) Persekitaran (konteks/pencahayaan untuk ilustrasi, bukan fotografi), 3) Komposisi (susun atur/bingkai untuk vektor), 4) Gaya (estetika vektor: rata/gradasi minimum, garisan konsisten), 5) Teknikal (sedia SVG/AI: ketebalan garisan, palet warna, lapisan kemas, tanpa istilah kamera/lensa). Nyatakan semua tiang.'
      : isVideo
        ? 'RANGKA KERJA WAJIB (VIDEO): Gunakan LIMA TIANG dengan pergerakan — 1) Subjek (bukan manusia/bukan haiwan), 2) Persekitaran (suasana/pencahayaan serta gerakan semula jadi seperti angin/air), 3) Komposisi (jenis tangkapan/bingkai dan pergerakan kamera), 4) Gaya (estetika/penggredan tanpa jargon lensa foto), 5) Teknikal (resolusi, fps, penstabilan, boleh digelung, gerakan lancar, tempoh 5–8 saat). Nyatakan semua tiang dan sorot aspek pergerakan.'
        : isPhoto
          ? 'RANGKA KERJA WAJIB (FOTO): LIMA TIANG — 1) Subjek (bukan manusia/bukan haiwan, selamat untuk stok), 2) Persekitaran (suasana/pencahayaan), 3) Komposisi (sudut/bingkai bervariasi), 4) Gaya (estetika/penggredan), 5) Teknikal (kamera/lensa/optik). Paksa kepelbagaian: setiap prompt mesti berbeza sudut, palet warna, atau komposisi berbanding prompt lain.'
          : 'RANGKA KERJA WAJIB: Bina setiap prompt dengan LIMA TIANG: Subjek (tekstur/objek bukan manusia/bukan haiwan), Persekitaran (suasana/pencahayaan), Komposisi (sudut/bingkai), Gaya (estetika), Teknikal (tetapan kamera/lensa/optik). Setiap prompt wajib menyebut kelima-lima tiang.';
    lines.push(pillarLine);
  } else {
    lines.push(
      `Anda adalah asisten AI yang membuat prompt gambar berkualitas tinggi untuk microstock (misalnya Adobe Stock, Shutterstock). Tugas Anda adalah membuat ${sceneCount} ide gambar yang masing-masing bisa dipakai sebagai satu gambar stok mandiri.`,
    );
    lines.push('Tulis semua isi dalam Bahasa Indonesia yang natural dan deskriptif.');
    lines.push('WAJIB gunakan Bahasa Indonesia saja. Jangan menggunakan bahasa lain.');
    if (isVector) {
      lines.push(
        'PERSYARATAN GAYA: Ini harus ILUSTRASI VEKTOR (bukan foto). Gunakan outline bersih, warna flat atau gradasi minimal, ketebalan garis konsisten, bentuk siap SVG/AI. Hindari fotorealisme, istilah kamera, bokeh, atau pencahayaan fotografi; fokus pada estetika vektor yang jelas dan skalabel.',
      );
    } else if (isVideo) {
      lines.push(
        'PERSYARATAN VIDEO: Deskripsikan klip video pendek (5–10 detik) dengan gerakan subjek dan pergerakan kamera yang jelas. Sebutkan tempo, jenis gerakan (pan/tilt/dolly/handheld), dan pastikan halus, stabil, serta idealnya dapat di-loop.',
      );
    } else if (isPhoto) {
      lines.push(
        'PERSYARATAN FOTO: Buat deskripsi foto stok yang beragam; variasikan komposisi, angle, dan palet warna di setiap prompt untuk menghindari kemiripan. Jangan ulang frasa kunci di prompt berbeda.',
      );
    }
    const pillarLine = isVector
      ? 'KERANGKA WAJIB (VEKTOR): Gunakan LIMA PILAR dan pastikan siap vektor — 1) Subjek (objek/tekstur non-manusia/non-hewan untuk vektor), 2) Environment (konteks/pencahayaan untuk ilustrasi, bukan fotografi), 3) Composition (layout/framing untuk vektor), 4) Style (estetika vektor: flat/gradasi minimal, stroke konsisten), 5) Technical (siap SVG/AI: ketebalan garis, palet warna, layer rapi, tanpa istilah kamera/lensa). Sebutkan semua pilar.'
      : isVideo
        ? 'KERANGKA WAJIB (VIDEO): Gunakan LIMA PILAR dengan gerakan — 1) Subjek (non-manusia/non-hewan), 2) Environment (atmosfer/pencahayaan plus gerak alami seperti angin/air), 3) Composition (shot/framing dan gerak kamera), 4) Style (estetika/grading tanpa jargon lensa foto), 5) Technical (resolusi, fps, stabilisasi, loopable, gerak halus, durasi 5–8 detik). Sebutkan semua pilar dan sorot aspek gerak.'
        : isPhoto
          ? 'KERANGKA WAJIB (FOTO): LIMA PILAR — 1) Subjek (non-manusia/non-hewan, aman stok), 2) Environment (atmosfer/pencahayaan), 3) Composition (angle/framing bervariasi), 4) Style (estetika/grading), 5) Technical (kamera/lensa/optik). Wajib variasi: setiap prompt beda angle, palet warna, atau komposisi dibanding prompt lain.'
          : 'KERANGKA WAJIB: Bangun setiap prompt dengan LIMA PILAR: Subjek (tekstur/objek non-manusia/non-hewan), Environment (atmosfer/pencahayaan), Composition (angle/framing), Style (estetika), Technical (setting kamera/lensa/optik). Setiap prompt wajib menyebut kelima pilar.';
    lines.push(pillarLine);
  }

  if (promptMode === 'continuous') {
    lines.push(
      isEnglish
        ? 'Mode: CONTINUOUS. Prompts may relate to each other within one big theme, but each must stand alone as a single stock image description.'
        : isMalay
          ? 'Mod: BERTERUSAN. Semua prompt boleh saling berkaitan dalam tema besar yang sama, tetapi setiap prompt tetap mesti boleh berdiri sendiri sebagai penerangan satu imej stok.'
          : 'Mode: CONTINUOUS. Semua prompt boleh saling berkaitan dalam tema besar yang sama, tetapi setiap prompt tetap harus dapat berdiri sendiri sebagai deskripsi satu gambar stok.',
    );
  } else {
    lines.push(
      isEnglish
        ? 'Mode: INDEPENDENT. Each prompt is a completely separate image idea (not part of a sequential story), though visual style can stay consistent.'
        : isMalay
          ? 'Mod: BEBAS. Setiap prompt adalah idea imej yang sepenuhnya berasingan (bukan sebahagian daripada satu cerita berurutan), namun gaya visual boleh konsisten.'
          : 'Mode: INDEPENDENT. Setiap prompt adalah ide gambar yang sepenuhnya terpisah (bukan bagian dari satu cerita berurutan), namun gaya visual boleh konsisten.',
    );
  }

  if (theme) {
    lines.push(isEnglish ? `Main theme: ${theme}.` : isMalay ? `Tema utama: ${theme}.` : `Tema utama cerita: ${theme}.`);
  }
  if (style && style !== 'none') {
    lines.push(isEnglish ? `Primary visual style: ${style}.` : isMalay ? `Gaya visual utama: ${style}.` : `Gaya visual utama (style): ${style}.`);
  }

  const joinIfAny = (label, arr) => {
    if (Array.isArray(arr) && arr.length > 0) {
      lines.push(`${label}: ${arr.join(', ')}.`);
    }
  };

  // Apply light randomization to break similarity across large batches
  const shuffleTake = (arr, take = 3) => {
    if (!Array.isArray(arr) || !arr.length) return [];
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, Math.max(1, Math.min(take, copy.length)));
  };
  const randomizedCamera = shuffleTake(camera, 3);
  const randomizedComposition = shuffleTake(composition, 3);
  const randomizedLighting = shuffleTake(lighting, 3);
  const randomizedLens = shuffleTake(lens, 2);

  if (isEnglish) {
    const pillarReminder = isVector
      ? 'ALWAYS COVER ALL FIVE PILLARS (VECTOR): 1) Subject (non-human/non-animal, stylized for vector), 2) Environment (context/lighting phrased for illustration, not photo), 3) Composition (layout/framing for vector), 4) Style (flat/minimal gradients, clean strokes, consistent line weight), 5) Technical (SVG/AI-ready: stroke weight, palette, layer cleanliness; avoid camera/lens terms). Mention each pillar explicitly.'
      : isVideo
        ? 'ALWAYS COVER ALL FIVE PILLARS (VIDEO): 1) Subject (non-human/non-animal, with motion), 2) Environment (atmosphere/lighting plus ambient motion), 3) Composition (shot type/framing and camera movement), 4) Style (aesthetic/grading without photo-lens jargon), 5) Technical (resolution, fps 25–30, stabilization, smooth/loopable movement). Mention each pillar explicitly and describe motion.'
        : isPhoto
          ? 'ALWAYS COVER ALL FIVE PILLARS (PHOTO): 1) Subject (non-human/non-animal, stock-safe), 2) Environment (atmosphere/lighting), 3) Composition (vary angles/framing across prompts), 4) Style (aesthetic/grading), 5) Technical (camera/lens/optics). Force variety: change angle/palette/composition per prompt; avoid repeating key phrases.'
          : 'ALWAYS COVER ALL FIVE PILLARS IN EVERY PROMPT: 1) Subject (non-human, non-animal textures/objects, safe for commercial use), 2) Environment (atmosphere, weather, lighting context), 3) Composition (angle/framing like macro, top-down, symmetry), 4) Style (aesthetic such as cinematic, photorealistic, hyper-detailed), 5) Technical (camera/lens/optics settings: focal length, aperture, ISO, resolution). Mention each pillar explicitly.';
    lines.push(pillarReminder);
  } else if (isMalay) {
    const pillarReminder = isVector
      ? 'SENTIASA NYATAKAN LIMA TIANG (VEKTOR): 1) Subjek (bukan manusia/bukan haiwan, digayakan untuk vektor), 2) Persekitaran (konteks/pencahayaan untuk ilustrasi, bukan foto), 3) Komposisi (susun atur/bingkai untuk vektor), 4) Gaya (rata/gradasi minimum, garisan kemas, ketebalan konsisten), 5) Teknikal (sedia SVG/AI: ketebalan garisan, palet, kekemasan lapisan; elakkan istilah kamera/lensa). Nyatakan setiap tiang.'
      : isVideo
        ? 'SENTIASA NYATAKAN LIMA TIANG (VIDEO): 1) Subjek (bukan manusia/bukan haiwan, dengan pergerakan), 2) Persekitaran (suasana/pencahayaan serta gerakan semula jadi), 3) Komposisi (jenis tangkapan/bingkai dan pergerakan kamera), 4) Gaya (estetika/penggredan tanpa jargon lensa foto), 5) Teknikal (resolusi, fps 25–30, penstabilan, gerakan lancar/boleh digelung). Nyatakan setiap tiang dan huraikan pergerakan.'
        : isPhoto
          ? 'SENTIASA NYATAKAN LIMA TIANG (FOTO): 1) Subjek (bukan manusia/bukan haiwan, selamat untuk stok), 2) Persekitaran (suasana/pencahayaan), 3) Komposisi (sudut/bingkai bervariasi antara prompt), 4) Gaya (estetika/penggredan), 5) Teknikal (kamera/lensa/optik). Paksa kepelbagaian: berbeza sudut/palet/komposisi per prompt; elakkan frasa berulang.'
          : 'SENTIASA NYATAKAN LIMA TIANG DI SETIAP PROMPT: 1) Subjek (tekstur/objek bukan manusia/bukan haiwan, selamat komersial), 2) Persekitaran (suasana, cuaca, konteks pencahayaan), 3) Komposisi (sudut/bingkai seperti makro, atas-bawah, simetri), 4) Gaya (estetika seperti sinematik, fotorealistik, hyper-detailed), 5) Teknikal (tetapan kamera/lensa/optik: panjang fokus, apertur, ISO, resolusi). Nyatakan setiap tiang secara eksplisit.';
    lines.push(pillarReminder);
  } else {
    const pillarReminder = isVector
      ? 'SELALU CANTUMKAN LIMA PILAR (VEKTOR): 1) Subjek (non-manusia/non-hewan, distilisasi untuk vektor), 2) Environment (konteks/pencahayaan untuk ilustrasi, bukan foto), 3) Composition (layout/framing untuk vektor), 4) Style (flat/gradasi minimal, stroke rapi, ketebalan konsisten), 5) Technical (siap SVG/AI: ketebalan garis, palet, kerapian layer; hindari istilah kamera/lensa). Sebutkan tiap pilar.'
      : isVideo
        ? 'SELALU CANTUMKAN LIMA PILAR (VIDEO): 1) Subjek (non-manusia/non-hewan, dengan gerak), 2) Environment (atmosfer/pencahayaan plus gerak alami), 3) Composition (shot/framing dan gerak kamera), 4) Style (estetika/grading tanpa jargon lensa foto), 5) Technical (resolusi, fps 25–30, stabilisasi, gerak halus/loopable). Sebutkan tiap pilar dan jelaskan gerak.'
        : isPhoto
          ? 'SELALU CANTUMKAN LIMA PILAR (FOTO): 1) Subjek (non-manusia/non-hewan, aman stok), 2) Environment (atmosfer/pencahayaan), 3) Composition (angle/framing bervariasi antar prompt), 4) Style (estetika/grading), 5) Technical (kamera/lensa/optik). Paksa variasi: beda angle/palet/komposisi per prompt; hindari frasa berulang.'
          : 'SELALU CANTUMKAN LIMA PILAR DI TIAP PROMPT: 1) Subjek (tekstur/objek non-manusia/non-hewan, aman komersial), 2) Environment (atmosfer, cuaca, konteks pencahayaan), 3) Composition (angle/framing seperti macro, top-down, simetri), 4) Style (estetika seperti sinematik, fotorealistik, hyper-detailed), 5) Technical (setting kamera/lensa/optik: focal length, aperture, ISO, resolusi). Sebutkan setiap pilar secara eksplisit.';
    lines.push(pillarReminder);
  }

  joinIfAny(isEnglish ? 'Camera choices' : isMalay ? 'Pilihan kamera' : 'Pilihan kamera', randomizedCamera.length ? randomizedCamera : camera);
  joinIfAny(isEnglish ? 'Frame composition' : isMalay ? 'Komposisi bingkai' : 'Komposisi frame', randomizedComposition.length ? randomizedComposition : composition);
  joinIfAny(isEnglish ? 'Lighting' : isMalay ? 'Pencahayaan' : 'Pencahayaan', randomizedLighting.length ? randomizedLighting : lighting);
  joinIfAny(isEnglish ? 'Lens' : isMalay ? 'Lensa' : 'Lensa', randomizedLens.length ? randomizedLens : lens);
  joinIfAny(isEnglish ? 'Emotional tone' : isMalay ? 'Nada emosi' : 'Nuansa emosional', emotionalTone);
  joinIfAny(isEnglish ? 'Skin tone' : isMalay ? 'Warna kulit' : 'Warna kulit', skinTone);
  joinIfAny(isEnglish ? 'Ambient sound' : isMalay ? 'Bunyi persekitaran' : 'Suara latar/ambient', ambientSound);
  joinIfAny('SFX', sfx);
  joinIfAny(isEnglish ? 'Dialog/Audio language' : isMalay ? 'Bahasa dialog/audio' : 'Bahasa dialog/audio', language);
  joinIfAny(isEnglish ? 'Dialog style' : isMalay ? 'Gaya dialog' : 'Gaya dialog', dialog);

  const negativeList =
    Array.isArray(negativePrompt) && negativePrompt.length > 0
      ? negativePrompt
      : isEnglish
        ? [
          'text',
          'wording',
          'letter',
          'number',
          'statistic',
          'graph',
          'chart',
          'logo',
          'brand',
          'trademark',
          'copyright',
          'flag',
          'money',
          'usd',
          'coin',
          'bitcoin',
          'card',
          'payment terminal',
          'car',
          'motorcycle',
          'truck',
          'bus',
          'vehicle',
          'laptop',
          'computer',
          'phone',
          'smartphone',
          'tablet',
          'smart watch',
          'watch',
          'house',
          'building',
          'office',
          'shop',
          'gate',
          'fence',
          'ancient',
          'history',
          'vintage',
          'old',
          'spiral',
          'string',
          'rope',
          'stick',
          'ruler',
          'compass',
          'clock',
          'writing',
          'paper',
          'pen',
          'book',
          'alcohol',
          'blood',
          'gore',
          'cyber',
          'aerial view',
          'drone',
          'multiple panels',
          'collage',
          'split screen',
          'oblique',
          'diagonal',
          'blurry',
          'pixelated',
          'low resolution',
          'low quality',
          'distorted anatomy',
          'bad quality',
          'jpeg artifacts',
          'noise',
          'watermarks',
          'english text',
          'construction cranes',
        ]
        : isMalay
          ? [
            'teks',
            'tulisan',
            'tera air',
            'sari kata',
            'logo',
            'jenama',
            'tanda dagangan',
            'hak cipta',
            'bendera',
            'wang',
            'syiling',
            'bitcoin',
            'kad',
            'terminal pembayaran',
            'kabur',
            'herotan',
            'blur',
            'kualiti rendah',
            'resolusi rendah',
            'bingkai menegak',
            'watak tidak konsisten',
            'bahasa inggeris',
            'tulisan inggeris',
            'suara inggeris',
            'dialog inggeris',
            'lagu',
            'muzik',
            'beberapa panel',
            'kolaj',
            'skrin belah',
            'senget',
            'pepenjuru',
            'lingkaran',
            'tali',
            'tali rami',
            'pembaris',
            'kompas',
            'jam',
            'tulisan',
            'kertas',
            'pen',
            'buku',
            'alkohol',
            'darah',
            'gore',
            'siber',
            'dron',
            'pemandangan udara',
            'kren pembinaan',
          ]
          : [
            'teks',
            'tulisan',
            'watermark',
            'subtitle',
            'logo',
            'merek',
            'trademark',
            'hak cipta',
            'bendera',
            'uang',
            'koin',
            'bitcoin',
            'kartu',
            'terminal pembayaran',
            'buram',
            'distorsi',
            'blur',
            'kualitas rendah',
            'resolusi rendah',
            'bingkai vertikal',
            'karakter tidak konsisten',
            'bahasa inggris',
            'tulisan inggris',
            'suara inggris',
            'dialog inggris',
            'lagu',
            'musik',
            'beberapa panel',
            'collage',
            'split screen',
            'miring',
            'diagonal',
            'spiral',
            'tali',
            'tali rami',
            'penggaris',
            'kompas',
            'jam',
            'tulisan',
            'kertas',
            'pena',
            'buku',
            'alkohol',
            'darah',
            'gore',
            'cyber',
            'drone',
            'pemandangan udara',
            'kerusakan struktur',
          ];

  if (isVector) {
    const vectorBans = isEnglish
      ? [
        'photograph',
        'photo',
        'photorealistic',
        'realistic photo',
        'depth of field',
        'bokeh',
        'lens blur',
        'camera lens',
        'grainy',
        'noisy',
      ]
      : [
        'foto',
        'fotografi',
        'fotorealistik',
        'realistis seperti foto',
        'depth of field',
        'bokeh',
        'blur lensa',
        'lensa kamera',
        'grain',
        'noise',
      ];
    vectorBans.forEach((item) => negativeList.push(item));
  }

  const hasHumanBan = negativeList.some((item) =>
    typeof item === 'string' ? /human|person|people|manusia|orang/i.test(item) : false,
  );

  if (characterSourcePrompt) {
    lines.push(
      isEnglish
        ? 'If recurring human characters are needed, use the following character description as reference so visual identity stays consistent across all prompts (name, physical traits, clothing, and style). Do not change their visual identity, only pose/expression and scene context.'
        : isMalay
          ? 'Jika watak manusia berulang diperlukan, gunakan penerangan watak berikut sebagai rujukan supaya penampilan visual konsisten di semua prompt (nama, ciri fizikal, pakaian, dan gaya). Jangan ubah identiti visual mereka, hanya pose/ekspresi dan konteks adegan.'
          : 'Jika diperlukan karakter manusia berulang, gunakan deskripsi karakter berikut sebagai referensi agar tampilan visualnya konsisten di semua prompt gambar (nama, ciri fisik, pakaian, dan gaya). Jangan ubah identitas visualnya, hanya pose/ekspresi dan konteks adegan.',
    );
    lines.push(characterSourcePrompt);
  } else {
    lines.push(
      isEnglish
        ? 'If human characters are needed, create up to 3 main characters that stay consistent across all prompts (name, physical traits, clothing, and style).'
        : isMalay
          ? 'Jika watak manusia diperlukan, cipta sehingga 3 watak utama yang konsisten di semua prompt (nama, ciri fizikal, pakaian, dan gaya).'
          : 'Jika diperlukan karakter manusia, buat maksimal 3 karakter utama yang konsisten di semua prompt gambar (nama, ciri fisik, pakaian, dan gaya).',
    );
  }

  lines.push(
    isEnglish
      ? isVideo
        ? 'For EACH prompt, write one paragraph (~40–80 words) describing a short video clip: include subject motion, camera movement, pacing, and how the scene evolves over ~5–10 seconds. Keep it concise and cinematic for stock usage.'
        : 'For EACH prompt, write one paragraph (about 40–80 words) describing a single static image (for vector: describe illustration content, not a photo) that clearly conveys the main subject, background/environment, composition, style, and technical notes. Avoid long narratives; focus on one strong visual moment.'
      : isMalay
        ? isVideo
          ? 'Untuk SETIAP prompt, tulis satu perenggan (~40–80 patah perkataan) yang menghuraikan klip video pendek: sertakan pergerakan subjek, pergerakan kamera, tempo, dan bagaimana adegan berkembang selama ~5–10 saat. Ringkas dan sinematik untuk stok.'
          : 'Untuk SETIAP prompt, tulis satu perenggan (40–80 patah perkataan) yang menghuraikan satu imej statik (untuk vektor: huraikan kandungan ilustrasi, bukan foto) yang jelas menyampaikan subjek, persekitaran, komposisi, gaya, dan nota teknikal. Elakkan naratif panjang; fokus pada satu momen visual yang kuat.'
        : isVideo
          ? 'Untuk SETIAP prompt, tulis satu paragraf (~40–80 kata) yang menggambarkan klip video pendek: sertakan gerak subjek, pergerakan kamera, tempo, dan bagaimana adegan berkembang selama ~5–10 detik. Ringkas dan sinematik untuk stok.'
          : 'Untuk SETIAP prompt, tulis satu paragraf (40–80 kata) yang menggambarkan satu gambar statis (untuk vektor: deskripsikan ilustrasi, bukan foto) yang jelas menyampaikan subjek, lingkungan, komposisi, gaya, dan catatan teknis. Hindari narasi panjang; fokus pada satu momen visual yang kuat.',
  );
  lines.push(
    isEnglish
      ? isVideo
        ? 'No need to add dialog; keep audio minimal (ambient only if needed). Focus on visual motion and camera flow that make a premium stock video (smooth, stable, loopable if possible).'
        : 'No need to add dialog or sound; focus on visual details that help create high-quality stock images (for vector: keep it illustrator-friendly).'
      : isMalay
        ? isVideo
          ? 'Tidak perlu dialog; audio seminimum mungkin (persekitaran sahaja jika perlu). Fokus pada pergerakan visual dan aliran kamera yang menjadikan video stok premium (lancar, stabil, idealnya boleh digelung).'
          : 'Tidak perlu menulis dialog atau bunyi; fokus pada butiran visual untuk imej stok berkualiti (untuk vektor: kekal mesra ilustrator).'
        : isVideo
          ? 'Tidak perlu dialog; audio seminimal mungkin (ambient jika perlu). Fokus pada gerak visual dan alur kamera yang membuat video stok premium (halus, stabil, idealnya bisa loop).'
          : 'Tidak perlu menuliskan dialog atau suara; fokus pada detail visual untuk gambar stok berkualitas (untuk vektor: tetap ramah ilustrator).',
  );
  if (hasHumanBan) {
    lines.push(
      isEnglish
        ? 'Explicitly DO NOT add humans, faces, human bodies, fictional characters, or any human figures. Focus only on landscapes, natural objects, buildings, or inanimate objects.'
        : isMalay
          ? 'Secara eksplisit JANGAN tambah manusia, wajah, badan manusia, watak fiksyen, atau sebarang sosok manusia dalam penerangan imej. Fokus hanya pada landskap, objek semula jadi, bangunan, atau objek tidak bernyawa.'
          : 'Secara eksplisit JANGAN menambahkan manusia, wajah, tubuh manusia, karakter fiksi, atau sosok orang apa pun di dalam deskripsi gambar. Fokus hanya pada lanskap, objek alam, bangunan, atau benda mati.',
    );
  }
  lines.push(
    isEnglish
      ? 'Always avoid the following in every scene: ' + negativeList.join(', ') + '.'
      : isMalay
        ? 'Sentiasa elakkan perkara berikut dalam setiap adegan: ' + negativeList.join(', ') + '.'
        : 'Selalu hindari hal-hal berikut dalam setiap scene: ' + negativeList.join(', ') + '.',
  );

  if (isEnglish) {
    lines.push('REQUIRED OUTPUT FORMAT:');
    lines.push('1) Output ONLY ONE JSON array of strings, no other fields, no wrapper object, and no markdown.');
    lines.push('2) Example output format:');
    lines.push('["A woman standing by a pastel lake at dusk, ...", "A minimalist living room with soft pastel colors, ...", "..."]');
    lines.push(`3) The array MUST have EXACTLY ${sceneCount} elements. UNDER NO CIRCUMSTANCES may it have fewer or more than ${sceneCount} elements.`);
    lines.push('4) Each string in the array is ONE paragraph image description. Do not add numbering at the beginning like "Scene 1:"; start directly with the image description.');
  } else if (isMalay) {
    lines.push('FORMAT OUTPUT WAJIB:');
    lines.push('1) Output HANYA SATU tatasusunan JSON yang mengandungi rentetan, tanpa medan lain, tanpa objek pembungkus dan tanpa markdown.');
    lines.push('2) Contoh format output:');
    lines.push('["Seorang wanita berdiri di tepi tasik pastel ketika senja, ...", "Pemandangan ruang tamu minimalis dengan warna pastel lembut, ...", "..."]');
    lines.push(`3) Tatasusunan tersebut WAJIB mempunyai TEPAT ${sceneCount} elemen. DALAM APA JUA KEADAAN tidak boleh kurang atau lebih daripada ${sceneCount} elemen.`);
    lines.push('4) Setiap rentetan dalam tatasusunan adalah SATU perenggan penerangan imej. Jangan tambah penomboran di awal seperti "Scene 1:"; mulakan terus dengan penerangan imej.');
  } else {
    lines.push('FORMAT OUTPUT WAJIB:');
    lines.push('1) Output HANYA SATU JSON array berisi string, tanpa field lain, tanpa objek pembungkus dan tanpa markdown.');
    lines.push('2) Contoh bentuk output:');
    lines.push('["Seorang wanita berdiri di tepi danau pastel saat senja, ...", "Pemandangan ruang tamu minimalis dengan warna pastel lembut, ...", "..."]');
    lines.push(`3) Array tersebut WAJIB memiliki TEPAT ${sceneCount} elemen. UNDER NO CIRCUMSTANCES boleh kurang atau lebih dari ${sceneCount} elemen.`);
    lines.push('4) Setiap string di dalam array adalah SATU paragraf deskripsi gambar. Jangan menambahkan penomoran di awal seperti "Scene 1:"; langsung mulai dengan deskripsi gambarnya.');
  }

  return lines.join('\n');
}

async function runPromptGenerator({
  aiProvider,
  aiModel,
  apiKey,
  sendUpdate,
  options = {},
}) {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const msg = getMsg(options.uiLanguage);

  try {
    if (!aiProvider || aiProvider !== 'Gemini') {
      throw new Error(msg.providerUnsupported);
    }
    if (!aiModel) {
      aiModel = 'gemini-2.5-flash';
    }
    if (!apiKey) {
      throw new Error(msg.apiKeyMissing);
    }

    const promptStyle = options.promptType || 'photo'; // photo|conceptual|video
    const promptMode = options.promptMode === 'independent' ? 'independent' : 'continuous';
    const requestedCount = options.jumlahPrompt ? parseInt(options.jumlahPrompt, 10) : null;

    let sceneCount = 0;
    if (Number.isInteger(requestedCount) && requestedCount > 0) {
      sceneCount = requestedCount;
    } else {
      sceneCount = 10;
    }

    // Untuk Gemini 2.5, gunakan batch lebih kecil (1 scene per panggilan)
    // agar risiko MAX_TOKENS berkurang. Untuk model lain tetap 5.
    const isGemini25Model = typeof aiModel === 'string' && aiModel.startsWith('gemini-2.5');
    const MAX_BATCH_SIZE = isGemini25Model ? 1 : 5;
    const targetSceneCount = sceneCount;
    const perBatchDelayMs = isGemini25Model ? 7000 : 500;

    const isRetriableGeminiError = (err) => {
      const statusCode = err && err.response && err.response.status;
      const errorData = err && err.response && err.response.data && err.response.data.error;
      const errorStatus = errorData && (errorData.status || errorData.code);

      // Rate limit / quota
      if (statusCode === 429 || errorStatus === 'RESOURCE_EXHAUSTED') {
        return true;
      }

      // Sisi server Gemini sedang bermasalah (sementara), misalnya 5xx/UNAVAILABLE
      if (
        statusCode === 500 ||
        statusCode === 502 ||
        statusCode === 503 ||
        statusCode === 504 ||
        errorStatus === 'UNAVAILABLE'
      ) {
        return true;
      }

      return false;
    };

    const stripScenePrefix = (text) => {
      if (typeof text !== 'string') return text;
      return text.replace(/^\s*Scene\s+\d+\s*:\s*/i, '').trim();
    };

    const parseScenesFromResponse = (rawResponse, batchSceneCount) => {
      const cleanedResponse = extractJsonObjectFromText(rawResponse);

      let parsed;
      let scenes;
      try {
        parsed = JSON.parse(cleanedResponse);

        // Path utama: schema lengkap dengan field "scenes"
        if (parsed && Array.isArray(parsed.scenes)) {
          scenes = parsed.scenes;
        } else if (Array.isArray(parsed)) {
          // Fallback 1: respons berupa JSON array of strings / prompt objects
          const arr = parsed;
          const plainScenesFromArray = [];
          const maxFromArray = Math.min(batchSceneCount, arr.length);

          for (let i = 0; i < maxFromArray; i += 1) {
            const item = arr[i];
            const text =
              typeof item === 'string'
                ? item
                : item && typeof item === 'object'
                  ? item.Prompt || item.prompt || item.text || ''
                  : '';

            if (!text) {
              // eslint-disable-next-line no-continue
              continue;
            }

            plainScenesFromArray.push({
              index: i + 1,
              mode: promptMode,
              theme: options.theme || '',
              style: options.style || '',
              language:
                Array.isArray(options.language) && options.language.length > 0
                  ? options.language[0]
                  : 'Indonesia',
              characters_block: '',
              core_block: stripScenePrefix(text),
              cinematography_block: '',
              color_and_light_block: '',
              dialog_and_audio_block: '',
              negative_instructions_block: '',
              negative_list:
                Array.isArray(options.negativePrompt) && options.negativePrompt.length > 0
                  ? options.negativePrompt
                  : [
                    'teks',
                    'tulisan',
                    'watermark',
                    'subtitle',
                    'logo',
                  ],
              plain_text_prompt: stripScenePrefix(text),
            });
          }

          if (plainScenesFromArray.length > 0) {
            scenes = plainScenesFromArray;
            sendUpdate({
              type: 'INFO',
              message: msg.fallbackArrayParsed(plainScenesFromArray.length),
            });
          } else {
            throw new Error(msg.arrayNoText);
          }
        } else {
          // Parsed tanpa field scenes dan bukan array, lempar ke fallback regex
          throw new Error(msg.noScenesField);
        }
      } catch (err) {
        // Fallback 2: coba ekstrak plain_text_prompt dari respons AI dengan regex,
        // sehingga kita tetap bisa menulis prompt ke sheet walau JSON global tidak sempurna.
        let plainScenes = [];

        if (typeof cleanedResponse === 'string') {
          try {
            const regex = /"plain_text_prompt"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
            let matchPlain;
            let sceneIndexCounter = 1;

            while (
              (matchPlain = regex.exec(cleanedResponse)) !== null &&
              sceneIndexCounter <= batchSceneCount
            ) {
              const raw = matchPlain[1];
              let promptText = '';
              try {
                // Gunakan JSON.parse agar escape sequence (\n, \", dll) diinterpretasikan dengan benar.
                promptText = JSON.parse(`{"x":"${raw}"}`).x;
              } catch (innerErr) {
                // Jika gagal unescape, lanjut ke match berikutnya.
                // eslint-disable-next-line no-continue
                continue;
              }

              plainScenes.push({
                index: sceneIndexCounter,
                mode: promptMode,
                theme: options.theme || '',
                style: options.style || '',
                language:
                  Array.isArray(options.language) && options.language.length > 0
                    ? options.language[0]
                    : 'Indonesia',
                plain_text_prompt: stripScenePrefix(promptText),
              });

              sceneIndexCounter += 1;
            }
          } catch (regexErr) {
            // Abaikan, akan ditangani sebagai error parse biasa di bawah.
          }
        }

        // Jika jumlah prompt dari plain_text_prompt masih kurang dari yang diminta,
        // coba ekstrak pola "Prompt #X:" dari respons mentah (mirip proyek lama).
        if (plainScenes.length < batchSceneCount) {
          const textSource =
            typeof rawResponse === 'string'
              ? rawResponse
              : typeof cleanedResponse === 'string'
                ? cleanedResponse
                : '';

          if (textSource) {
            try {
              const promptRegex = /Prompt\s+(\d+)\s*:\s*([\s\S]*?)(?=Prompt\s+\d+\s*:|$)/gi;
              const existingIndexes = new Set(plainScenes.map((s) => s.index));
              let promptMatch;

              while (
                (promptMatch = promptRegex.exec(textSource)) !== null &&
                plainScenes.length < batchSceneCount
              ) {
                const idx = parseInt(promptMatch[1], 10);
                if (!Number.isFinite(idx)) {
                  // eslint-disable-next-line no-continue
                  continue;
                }
                if (existingIndexes.has(idx)) {
                  // eslint-disable-next-line no-continue
                  continue;
                }

                const body = promptMatch[2] ? promptMatch[2].trim() : '';
                if (!body) {
                  // eslint-disable-next-line no-continue
                  continue;
                }

                plainScenes.push({
                  index: idx,
                  mode: promptMode,
                  theme: options.theme || '',
                  style: options.style || '',
                  language:
                    Array.isArray(options.language) && options.language.length > 0
                      ? options.language[0]
                      : 'Indonesia',
                  plain_text_prompt: stripScenePrefix(body),
                });
                existingIndexes.add(idx);
              }
            } catch (promptRegexErr) {
              // Abaikan, tetap lanjut ke pengecekan plainScenes di bawah.
            }
          }
        }

        if (plainScenes.length > 0) {
          // Urutkan berdasarkan index dan batasi ke batchSceneCount agar progres dan preview konsisten.
          scenes = plainScenes
            .slice()
            .sort((a, b) => (a.index || 0) - (b.index || 0))
            .slice(0, batchSceneCount);
          sendUpdate({
            type: 'INFO',
            message: msg.fallbackExtracted(scenes.length),
          });
        } else {
          const previewLength = 1000;
          const preview =
            typeof cleanedResponse === 'string'
              ? cleanedResponse.slice(0, previewLength) +
              (cleanedResponse.length > previewLength ? '... [dipotong]' : '')
              : '';

          sendUpdate({
            type: 'ERROR',
            message: `DEBUG JSON PARSE ERROR: ${err.message || String(err)}`,
          });

          sendUpdate({
            type: 'ERROR',
            message: `DEBUG RAW AI RESPONSE (awal): ${preview}`,
          });

          throw new Error(msg.jsonParseFailed);
        }
      }

      if (!Array.isArray(scenes)) {
        throw new Error(msg.noValidScenes);
      }
      if (!scenes.length) {
        throw new Error(msg.noProcessablePrompts);
      }

      const maxScenesByAI = Math.min(batchSceneCount, scenes.length);

      sendUpdate({
        type: 'INFO',
        message: msg.promptsPrepared(maxScenesByAI),
      });

      return scenes.slice(0, maxScenesByAI);
    };

    const allScenes = [];
    let totalGenerated = 0;
    let batchNumber = 0;
    let abortFurtherBatches = false;

    while (totalGenerated < targetSceneCount && !abortFurtherBatches) {
      batchNumber += 1;
      const remaining = targetSceneCount - totalGenerated;
      const batchSceneCount = Math.min(MAX_BATCH_SIZE, remaining);

      sendUpdate({
        type: 'INFO',
        message: msg.startingBatch(batchNumber, batchSceneCount, remaining),
      });

      const instructionText = buildPromptGenerationInstruction({
        theme: options.theme,
        style: options.style,
        camera: options.camera,
        composition: options.composition,
        lighting: options.lighting,
        lens: options.lens,
        emotionalTone: options.emotionalTone,
        skinTone: options.skinTone,
        ambientSound: options.ambientSound,
        negativePrompt: options.negativePrompt,
        sfx: options.sfx,
        language: options.language,
        dialog: options.dialog,
        characterSourcePrompt: options.characterSourcePrompt,
        promptType: promptStyle,
        sceneCount: batchSceneCount,
      });

      sendUpdate({
        type: 'INFO',
        message: msg.sendingInstruction(batchNumber, batchSceneCount),
      });

      let rawResponse = null;
      const maxAttempts = 3;
      let attempt = 0;

      while (attempt < maxAttempts && !abortFurtherBatches) {
        attempt += 1;
        try {
          rawResponse = await callGeminiForScenes({ apiKey, model: aiModel, instructionText });
          break;
        } catch (apiError) {
          const errorMessage = apiError.message || String(apiError);
          const retriable = isRetriableGeminiError(apiError);

          if (retriable && attempt < maxAttempts) {
            const backoffMs = isGemini25Model ? attempt * 8000 : attempt * 4000;
            sendUpdate({
              type: 'INFO',
              message: msg.rateLimitRetry(batchNumber, attempt, maxAttempts, Math.round(backoffMs / 1000)),
            });
            await sleep(backoffMs);
            // eslint-disable-next-line no-continue
            continue;
          }

          sendUpdate({
            type: 'ERROR',
            message: msg.batchGeminiFailed(batchNumber, errorMessage),
          });

          if (allScenes.length > 0) {
            sendUpdate({
              type: 'INFO',
              message: msg.partialBatchContinue(allScenes.length),
            });
            abortFurtherBatches = true;
            break;
          }

          throw apiError;
        }
      }

      if (abortFurtherBatches) {
        break;
      }

      if (!rawResponse) {
        break;
      }

      sendUpdate({
        type: 'INFO',
        message: msg.geminiResponseReceived(batchNumber, typeof rawResponse === 'string' ? rawResponse.length : 0),
      });

      let batchScenes;
      try {
        batchScenes = parseScenesFromResponse(rawResponse, batchSceneCount);
      } catch (parseError) {
        const errorMessage = parseError.message || String(parseError);
        sendUpdate({
          type: 'ERROR',
          message: msg.batchParseFailed(batchNumber, errorMessage),
        });

        if (allScenes.length > 0) {
          sendUpdate({
            type: 'INFO',
            message: msg.continueWithPrevious(allScenes.length),
          });
          break;
        }

        break;
      }

      if (!Array.isArray(batchScenes) || !batchScenes.length) {
        sendUpdate({
          type: 'ERROR',
          message: msg.batchNoPrompts(batchNumber),
        });
        break;
      }

      const normalizedBatchScenes = batchScenes.map((scene, idx) => {
        const globalIndex = totalGenerated + idx + 1;

        const updatedPlainText = stripScenePrefix(scene.plain_text_prompt);

        return {
          ...scene,
          index: globalIndex,
          plain_text_prompt: updatedPlainText,
        };
      });

      allScenes.push(...normalizedBatchScenes);
      totalGenerated = allScenes.length;

      sendUpdate({
        type: 'PROGRESS',
        processed: totalGenerated,
        total: targetSceneCount,
        message: msg.batchComplete(batchNumber, totalGenerated, targetSceneCount),
      });

      await sleep(perBatchDelayMs);
    }

    const totalScenes = allScenes.length;

    if (!totalScenes) {
      throw new Error(msg.noPromptsFromAI);
    }

    sendUpdate({
      type: 'INFO',
      message: msg.totalFinalPrompts(totalScenes),
    });

    sendUpdate({
      type: 'PROMPT_PREVIEW_RESET',
      total: totalScenes,
    });

    sendUpdate({
      type: 'INFO',
      message: msg.preparingPrompts(totalScenes),
    });

    let processed = 0;
    const plainPrompts = [];
    const jsonPrompts = [];
    const shouldAutoOpen = options.autoOpen === true;

    const filterPrompt = (text) => {
      if (typeof text !== 'string') return false;
      // Untuk Prompt Finder (ada characterSourcePrompt), jangan filter manusia supaya identitas subjek terjaga.
      if (options.characterSourcePrompt) return false;

      const lower = text.toLowerCase();
      const globalBans = ['human', 'people', 'person', 'man ', 'woman ', 'girl ', 'boy '];
      if (globalBans.some((b) => lower.includes(b))) return true;
      if (promptStyle === 'conceptual') {
        const vectorBans = [
          'photograph',
          'photo',
          'photorealistic',
          'realistic photo',
          'depth of field',
          'bokeh',
          'lens blur',
          'camera lens',
          'iso',
          'aperture',
        ];
        if (vectorBans.some((b) => lower.includes(b))) return true;
      }
      if (promptStyle === 'video') {
        const stillBans = ['still photo', 'static image'];
        if (stillBans.some((b) => lower.includes(b))) return true;
      }
      return false;
    };

    for (let i = 0; i < totalScenes; i += 1) {
      const scene = allScenes[i] || {};

      const sceneIndex = typeof scene.index === 'number' ? scene.index : i + 1;
      const plainText = scene.plain_text_prompt ? String(scene.plain_text_prompt) : '';
      if (filterPrompt(plainText)) {
        sendUpdate({
          type: 'INFO',
          message: msg.promptSkippedBanned(sceneIndex, promptStyle),
        });
        // eslint-disable-next-line no-continue
        continue;
      }
      let jsonObject = scene.json && typeof scene.json === 'object' ? scene.json : scene;
      if (promptStyle === 'video') {
        const cine =
          jsonObject.cinematography_block ||
          'Camera movement: smooth pan/tilt or dolly, stabilized, duration 5–8s, 25–30fps.';
        const colorLight =
          jsonObject.color_and_light_block ||
          'Color/Light: soft cinematic grade, balanced contrast, clean highlights, no harsh flicker.';
        jsonObject = {
          ...jsonObject,
          cinematography_block: cine,
          color_and_light_block: colorLight,
        };
      }

      if (!plainText) {
        sendUpdate({
          type: 'ERROR',
          message: msg.promptMissingText(sceneIndex),
        });
        // eslint-disable-next-line no-continue
        continue;
      }

      plainPrompts.push(plainText);
      jsonPrompts.push({
        index: sceneIndex,
        prompt: plainText,
        rawPrompt: plainText,
        json: jsonObject,
      });

      // Kirim preview segera agar UI (Prompt Finder) menampilkan teks prompt tanpa menunggu file selesai.
      sendUpdate({
        type: 'PROMPT_PREVIEW',
        index: sceneIndex,
        prompt: plainText,
        rawPrompt: plainText,
        json: jsonObject,
        notes: scene.notes || '',
      });

      processed += 1;

      const localeMap = { en: 'en-US', id: 'id-ID', ms: 'ms-MY' };
      const generatedAt = new Date().toLocaleString(localeMap[options.uiLanguage] || 'en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      const notes = `Generated at ${generatedAt} using gemini/${aiModel}`;

      sendUpdate({
        type: 'PROMPT_PREVIEW',
        index: sceneIndex,
        prompt: plainText,
        rawPrompt: plainText,
        json: JSON.stringify(jsonObject),
        notes,
      });

      sendUpdate({
        type: 'INFO',
        message: msg.promptCreated(processed, totalScenes, sceneIndex),
      });

      await sleep(50);
    }

    // Simpan ke file (plaintext + JSON)
    try {
      const outputPath = options.folderOutput || options.downloadPath || '';
      const fileNameBase = options.promptFileName || `prompts_${Date.now()}`;
      const txtPath = path.join(outputPath, fileNameBase);
      const jsonPath = txtPath.endsWith('.txt')
        ? txtPath.replace(/\.txt$/i, '.json')
        : `${txtPath}.json`;

      try {
        fs.mkdirSync(path.dirname(txtPath), { recursive: true });
      } catch (_) {
        // ignore mkdir failure; writeFileSync will throw if it persists
      }

      fs.writeFileSync(txtPath, plainPrompts.join('\n'), 'utf-8');
      fs.writeFileSync(jsonPath, JSON.stringify(jsonPrompts, null, 2), 'utf-8');

      sendUpdate({
        type: 'INFO',
        message: msg.fileSaved(txtPath, jsonPath),
      });

      if (shouldAutoOpen) {
        try {
          await shell.openPath(txtPath);
          await shell.openPath(jsonPath);
          sendUpdate({
            type: 'INFO',
            message: msg.autoOpenDone,
          });
        } catch (openErr) {
          sendUpdate({
            type: 'ERROR',
            message: msg.autoOpenFailed(openErr.message || String(openErr)),
          });
        }
      }
    } catch (writeErr) {
      sendUpdate({
        type: 'ERROR',
        message: msg.fileSaveFailed(writeErr.message || String(writeErr)),
      });
    }

    sendUpdate({
      type: 'BATCH_COMPLETE',
      workflow: 'Prompt Generator',
      successCount: processed,
      totalCount: totalScenes,
    });

    return { message: msg.batchSuccess(processed) };
  } catch (error) {
    const statusCode = error.response?.status;
    const errorStatus = error.response?.data?.error?.status || error.response?.data?.error?.code;
    let errorMessage = error.response?.data?.error?.message || error.message;

    if (statusCode === 429 || errorStatus === 'RESOURCE_EXHAUSTED') {
      errorMessage = msg.rateLimitHint(errorMessage);
    }

    sendUpdate({ type: 'ERROR', message: msg.fatalError(errorMessage) });
    return { message: msg.processStoppedError, error: errorMessage };
  }
}

// --- 429 Helper Functions ---
function is429Error(err) {
  if (err?.response?.status === 429) return true;
  const msg = err?.response?.data?.error?.message || err?.message || '';
  return msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429');
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// --- Main Workflow ---
async function runPromptWorkflow({
  bearerKey,
  flowProjectId,
  aspectRatio,
  veoModel,
  resolution,
  outputFormat = 'plain',
  downloadPath,
  batchSize = 4,
  sendUpdate,
  regeneratePrompt = null,
  prompts = null,
  uiLanguage = 'en',
  authMode = 'manual',
  bearerPool = [],
}) {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const vmsg = getVideoMsg(uiLanguage);

  // --- 429 retry wrapper ---
  const generateVideoWithBearer429Retry = async (prompt, currentBearerKey, currentProjectId) => {
    const MAX_CYCLES = 3;
    const validPool = Array.isArray(bearerPool)
      ? bearerPool.filter((e) => (e.jenis || '').toLowerCase() === 'lengkap' && e.bearerToken)
      : [];

    if (authMode === 'auto' && validPool.length > 0) {
      let attemptCount = 0;
      for (let cycle = 0; cycle < MAX_CYCLES; cycle++) {
        const shuffled = shuffleArray(validPool);
        for (const entry of shuffled) {
          attemptCount++;
          try {
            return await VEO_API.generateVideo(
              prompt, entry.bearerToken, aspectRatio, veoModel, resolution, entry.flowProjectId || currentProjectId
            );
          } catch (err) {
            if (is429Error(err)) {
              sendUpdate({ type: 'INFO', workflow: 'Prompt to Video', message: `429 rate limit (percobaan ${attemptCount}) — ganti bearer, tunggu 5 detik...` });
              await sleep(5000);
            } else {
              throw err;
            }
          }
        }
      }
      throw new Error(`[SKIP_429] Semua ${validPool.length} bearer dicoba ${MAX_CYCLES} siklus (${validPool.length * MAX_CYCLES}x), semua kena 429.`);
    } else {
      // MANUAL: retry 3x bearer yang sama
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          return await VEO_API.generateVideo(prompt, currentBearerKey, aspectRatio, veoModel, resolution, currentProjectId);
        } catch (err) {
          if (is429Error(err) && attempt < 3) {
            sendUpdate({ type: 'INFO', workflow: 'Prompt to Video', message: `429 rate limit — retry ${attempt}/3, tunggu 5 detik...` });
            await sleep(5000);
          } else if (is429Error(err)) {
            throw new Error(`[SKIP_429] 429 setelah 3x retry: ${err.message}`);
          } else {
            throw err;
          }
        }
      }
    }
  };

  try {
    // Regeneration mode kept for compatibility (not used in new UI for now)
    if (regeneratePrompt) {
      sendUpdate({ type: 'INFO', message: vmsg.regenerationMode });
      const parsedPrompt = parsePromptData(regeneratePrompt);
      const prompt = parsedPrompt.generatedPrompt;
      const displayTitle = parsedPrompt.displayTitle;

      sendUpdate({
        type: 'PROGRESS',
        workflow: 'Prompt to Video',
        processed: 1,
        total: 1,
        message: vmsg.regenerating(displayTitle),
      });

      try {
        const startResult = await VEO_API.generateVideo(
          prompt,
          bearerKey,
          aspectRatio,
          veoModel,
          resolution,
          flowProjectId,
        );
        const operationIdFull = typeof startResult === 'string' ? startResult : startResult.operationId;
        const remainingCredits =
          startResult && typeof startResult === 'object'
            ? startResult.remainingCredits
            : undefined;
        const shortId = operationIdFull.split('/').pop().substring(0, 8);

        sendUpdate({ type: 'INFO', message: vmsg.regenStarted(shortId) });
        sendUpdate({
          type: 'VIDEO_STARTED',
          operationId: shortId,
          shortId,
          prompt: displayTitle,
          workflow: 'Prompt to Video',
          remainingCredits,
        });

        let attempts = 0;
        const maxAttempts = veoModel === '3.1-fast-low' ? 180 : 60;
        let videoUrl = null;

        while (attempts < maxAttempts) {
          await sleep(5000);
          attempts++;

          try {
            const statusResult = await VEO_API.checkStatus(operationIdFull, bearerKey);

            if (statusResult.completed && statusResult.url) {
              videoUrl = statusResult.url;
              break;
            }

            const progressPercent = Math.min(95, (attempts / maxAttempts) * 100);
            sendUpdate({
              type: 'PROGRESS',
              processed: 1,
              total: 1,
              message: vmsg.regeneratingProgress(displayTitle, progressPercent.toFixed(0)),
            });
          } catch (statusError) {
            console.error('Status check error:', statusError);
            if (attempts >= maxAttempts) {
              throw statusError;
            }
          }
        }

        if (!videoUrl) {
          throw new Error(vmsg.regenTimeout);
        }

        sendUpdate({ type: 'INFO', message: vmsg.downloadingVideo });
        const videoData = await VEO_API.downloadVideo(videoUrl);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `${displayTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.mp4`;
        const filePath = path.join(downloadPath, filename);

        try {
          fs.mkdirSync(downloadPath, { recursive: true });
        } catch (_) {
          // ignore mkdir failure; writeFileSync will throw if it persists
        }

        fs.writeFileSync(filePath, videoData);

        sendUpdate({
          type: 'VIDEO_COMPLETED',
          operationId: shortId,
          shortId,
          filePath,
          filename,
          prompt: displayTitle,
          workflow: 'Prompt to Video',
        });

        sendUpdate({ type: 'INFO', message: vmsg.regenComplete(filename) });
        sendUpdate({
          type: 'BATCH_COMPLETE',
          workflow: 'Prompt to Video',
          successCount: 1,
          totalCount: 1,
        });

        return { message: vmsg.regenDone };
      } catch (error) {
        const errorMessage = error.response?.data?.error?.message || error.message;
        sendUpdate({ type: 'ERROR', message: vmsg.regenFailed(errorMessage) });
        throw error;
      }
    }

    // Textarea mode: gunakan prompt langsung dari UI
    if (Array.isArray(prompts) && prompts.length > 0) {
      const promptItems = prompts
        .map((p) => (typeof p === 'string' ? p.trim() : ''))
        .filter((p) => p.length > 0)
        .map((p, idx) => ({
          index: idx + 1,
          promptText: p,
        }));

      sendUpdate({
        type: 'INFO',
        message: vmsg.dataReady(promptItems.length, batchSize),
      });
      sendUpdate({
        type: 'BATCH_TOTAL',
        workflow: 'Prompt to Video',
        total: promptItems.length,
        message: vmsg.totalValid(promptItems.length),
      });

      const batches = [];
      for (let i = 0; i < promptItems.length; i += batchSize) {
        batches.push(promptItems.slice(i, i + batchSize));
      }

      let processedCount = 0;
      let successCount = 0;

      for (const [batchIndex, batch] of batches.entries()) {
        sendUpdate({
          type: 'INFO',
          message: vmsg.batchStarting(batchIndex + 1, batches.length, batch.length),
        });

        const batchResults = await Promise.allSettled(
          batch.map(async (item, indexInBatch) => {
            const globalIndex = batchIndex * batchSize + indexInBatch;
            const rowNumber = item.index;

            const parsedPrompt = parsePromptData(item.promptText);
            const prompt = parsedPrompt.generatedPrompt;
            const displayTitle = parsedPrompt.displayTitle;

            if (!prompt || prompt.trim() === '') {
              throw new Error(vmsg.promptEmpty(item.promptText));
            }

            sendUpdate({
              type: 'PROGRESS',
              workflow: 'Prompt to Video',
              processed: globalIndex + 1,
              total: promptItems.length,
              message: vmsg.processing(globalIndex + 1, promptItems.length, displayTitle),
            });

            let operationId = null;
            let shortId = null;

            try {
              const startResult = await generateVideoWithBearer429Retry(prompt, bearerKey, flowProjectId);
              operationId = typeof startResult === 'string' ? startResult : startResult.operationId;
              const remainingCredits =
                startResult && typeof startResult === 'object'
                  ? startResult.remainingCredits
                  : undefined;
              shortId = operationId.split('/').pop();

              sendUpdate({
                type: 'VIDEO_STARTED',
                workflow: 'Prompt to Video',
                operationId: shortId,
                prompt,
                rowNumber,
                remainingCredits,
                message: vmsg.videoCreating(shortId),
              });

              sendUpdate({ type: 'INFO', message: vmsg.waitingApi });

              let videoUrl = null;
              const startTime = Date.now();
              let lastStatus = null;
              let sameStatusCount = 0;

              const maxAttempts = veoModel === '3.1-fast-low' ? 90 : 30;
              const estimatedTotalSeconds = veoModel === '3.1-fast-low' ? 900 : 180;

              for (let i = 0; i < maxAttempts; i++) {
                await sleep(10000);
                const result = await VEO_API.checkStatus(operationId, bearerKey);

                if (result.completed) {
                  videoUrl = result.url;
                  break;
                }

                if (result.status === 'MEDIA_GENERATION_STATUS_FAILED') {
                  throw new Error(vmsg.apiFailed);
                }

                const normalStates = [
                  'MEDIA_GENERATION_STATUS_PENDING',
                  'MEDIA_GENERATION_STATUS_QUEUED',
                  'MEDIA_GENERATION_STATUS_ACTIVE',
                  'MEDIA_GENERATION_STATUS_SUCCESSFUL',
                ];
                if (result.status && !normalStates.includes(result.status) && result.status === lastStatus) {
                  sameStatusCount++;
                  const maxSameStatusCount = veoModel === '3.1-fast-low' ? 30 : 10;
                  if (sameStatusCount >= maxSameStatusCount) {
                    throw new Error(
                      vmsg.stuckStatus(result.status),
                    );
                  }
                } else {
                  lastStatus = result.status;
                  sameStatusCount = 0;
                }

                if (result.progress) {
                  const percentage = Math.round(result.progress * 100);
                  sendUpdate({
                    type: 'VIDEO_PROGRESS',
                    workflow: 'Prompt to Video',
                    operationId: shortId,
                    percentage,
                    rowNumber,
                    message: vmsg.generatingRealtime(percentage),
                  });
                } else {
                  const elapsedSeconds = (Date.now() - startTime) / 1000;
                  const estimatedPercentage = Math.min(
                    95,
                    Math.round((elapsedSeconds / estimatedTotalSeconds) * 100),
                  );

                  const message =
                    estimatedPercentage >= 95
                      ? vmsg.finalizingVideo(Math.floor(elapsedSeconds), result.status || 'PENDING')
                      : vmsg.generatingEstimated(estimatedPercentage);

                  sendUpdate({
                    type: 'VIDEO_PROGRESS',
                    workflow: 'Prompt to Video',
                    operationId: shortId,
                    percentage: estimatedPercentage,
                    elapsedSeconds: Math.floor(elapsedSeconds),
                    rowNumber,
                    message,
                  });
                }
              }

              if (!videoUrl) throw new Error(vmsg.videoTimeout);

              sendUpdate({ type: 'INFO', message: vmsg.downloadingVideo });
              const videoData = await VEO_API.downloadVideo(videoUrl);

              const fileName = `${prompt.replace(/[^a-z0-9]/gi, '_').substring(0, 20)}_${Date.now()}.mp4`;
              const filePath = path.join(downloadPath, fileName);

              try {
                fs.mkdirSync(downloadPath, { recursive: true });
              } catch (_) {
                // ignore mkdir failure; writeFileSync will throw if it persists
              }

              fs.writeFileSync(filePath, videoData);

              sendUpdate({
                type: 'SUCCESS',
                workflow: 'Prompt to Video',
                message: vmsg.videoSuccess(fileName),
                filePath,
                operationId: shortId,
                rowNumber,
              });

              const resultData = {
                operationId: shortId,
                prompt,
                filePath,
                fileName,
                rowNumber,
              };

              sendUpdate({
                type: 'VIDEO_COMPLETED',
                workflow: 'Prompt to Video',
                operationId: shortId,
                shortId,
                filePath,
                filename: fileName,
                prompt,
                rowNumber,
                result: formatOutput(resultData, outputFormat),
              });

              return { ok: true, result: resultData };
            } catch (error) {
              const isSkip = typeof error.message === 'string' && error.message.startsWith('[SKIP_429]');
              const errMessage = isSkip
                ? error.message.replace('[SKIP_429] ', '')
                : (error?.response?.data?.error?.message || error.message);

              sendUpdate({
                type: 'ERROR',
                workflow: 'Prompt to Video',
                operationId: shortId || operationId,
                prompt,
                rowNumber,
                message: isSkip ? `Prompt dilewati: ${errMessage}` : vmsg.videoError(errMessage),
              });

              if (isSkip) return { ok: false, skipped: true };
              throw error;
            }
          }),
        );

        batchResults.forEach((result) => {
          processedCount++;
          // Hanya hitung sukses jika fulfilled DAN ok === true
          // Prompt yang di-skip 429 (return {ok:false}) tidak dihitung sukses
          if (result.status === 'fulfilled' && result.value?.ok === true) successCount++;
        });

        sendUpdate({
          type: 'PROGRESS',
          workflow: 'Prompt to Video',
          processed: processedCount,
          total: promptItems.length,
          message: vmsg.batchDone(batchIndex + 1),
        });

        // Delay antar batch untuk mode manual
        if (authMode !== 'auto' && batchIndex < batches.length - 1) {
          await sleep(10000);
        }
      }

      sendUpdate({
        type: 'BATCH_COMPLETE',
        workflow: 'Prompt to Video',
        successCount,
        totalCount: promptItems.length,
        message: vmsg.allDone(successCount, promptItems.length),
      });

      return { ok: true, message: vmsg.allDoneReturn(promptItems.length) };
    }

    throw new Error(vmsg.noPromptsSent);
  } catch (error) {
    const errorMessage = error.response?.data?.error?.message || error.response?.data || error.message;
    sendUpdate({ type: 'ERROR', message: vmsg.fatalError(errorMessage) });
    return { message: vmsg.processStoppedError, error: errorMessage };
  }
}

module.exports = {
  runPromptWorkflow,
  runPromptGenerator,
  analyzeCharacterImageWithGemini,
  callGeminiForScenes,
  analyzeGeminiAudio,
  generateSingleVideo,
  getVideoMsg,
};

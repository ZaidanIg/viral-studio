// Image-to-Video workflows (start image, start+end, reference image)
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { getRecaptchaToken, postFromLabsWindow, isRecaptchaEvaluationFailed } = require('./promptImageWorkflow.js');

// --- i18n: Scene workflow messages ---
const SCENE_MESSAGES = {
  en: {
    outputFolderMissing: 'Global Output Folder is not configured. Open Settings.',
    bearerTokenMissing: 'Global Bearer Token for VEO is not configured. Open Settings.',
    noScenesSent: 'No scenes were sent for Generate Scene.',
    noScenesProcessed: 'No scenes were processed.',
    limitingScenes: (max, total) => `Limiting Generate Scene to the first ${max} scenes out of ${total} available.`,
    startingBatch: (count) => `Starting Generate Scene for ${count} scenes...`,
    promptEmpty: (idx) => `Prompt for Scene #${idx} is empty. Scene skipped.`,
    startImageMissing: (idx) => `Start image for Scene #${idx} not found (startPath empty). Scene skipped.`,
    endImageMissing: (idx) => `End image for Scene #${idx} not found (endPath empty). Scene skipped.`,
    preparingSingle: (idx) => `Scene #${idx}: preparing start image as video reference...`,
    preparingPair: (idx) => `Scene #${idx}: preparing start & end images as video reference...`,
    readingStartEnd: (idx) => `Scene #${idx}: reading start & end image files as video reference...`,
    imageDataEmpty: (idx) => `Start/end image data for Scene #${idx} is empty.`,
    uploadingStartEnd: (idx) => `Scene #${idx}: uploading start & end images to VEO...`,
    creatingStartEnd: (idx) => `Scene #${idx}: creating video from start→end images + prompt...`,
    readingStart: (idx) => `Scene #${idx}: reading start image file as reference image...`,
    startImageDataEmpty: (idx) => `Start image data for Scene #${idx} is empty.`,
    uploadingReference: (idx) => `Scene #${idx}: uploading reference image to VEO...`,
    creatingFromStart: (idx) => `Scene #${idx}: creating video from start image + prompt...`,
    preparingMontage: (idx, count) => `Scene #${idx}: preparing ${count} reference images for video montage...`,
    uploadingMontage: (idx, count) => `Scene #${idx}: uploading ${count} reference images to VEO...`,
    creatingMontage: (idx) => `Scene #${idx}: creating video from multiple reference images + prompt...`,
    montageImagesMissing: (idx) => `Reference images for Scene #${idx} are missing. At least 1 image required.`,
    videoGenerating: (idx, shortId) => `Scene #${idx}: video is being generated (ID: ${shortId})...`,
    statusCheck: (idx, status, progress, est) => `Scene #${idx}: status=${status}, apiProgress=${progress}, est=${est}%`,
    videoProcessing: (idx, est) => `Scene #${idx}: video still processing... (~${est}%)`,
    statusCheckFailed: (idx, http, msg) => `Scene #${idx} failed status check (HTTP ${http}): ${msg}`,
    videoFailed: 'Video generation failed by API. Prompt may violate policy.',
    timeout: 'Timeout reached, video was not completed.',
    downloading: (idx) => `Scene #${idx}: downloading video from VEO...`,
    sceneCompleted: (idx, fileName) => `Scene #${idx} completed. Video saved: ${fileName}.`,
    videoCompleted: (idx, fileName) => `Scene #${idx}: video completed (${fileName}).`,
    progressUpdate: (processed, total) => `Progress Generate Scene: ${processed}/${total} scenes completed.`,
    promptLength: (len) => `(prompt length: ${len} characters)`,
    sceneFailed: (idx, msg) => `Scene #${idx} failed: ${msg}`,
    progressWithErrors: (processed, total) => `Progress Generate Scene: ${processed}/${total} scenes processed (some failed).`,
    batchComplete: (success, total) => `Generate Scene completed. ${success}/${total} videos successfully created.`,
    fatalError: (msg) => `FATAL (Generate Scene): ${msg}`,
    stoppedDueToError: 'Generate Scene process stopped due to error.',
    // VEO_API error messages
    uploadResponseInvalid: 'uploadUserImage response invalid: mediaGenerationId not found.',
    aspectRatioNotSupported: (ratio, type) => `Aspect ratio "${ratio}" is not supported for ${type}.`,
    modelResolutionNotSupported: (model, res, type) => `Combination of model "${model}" and resolution "${res}" is not supported for ${type}.`,
    modelResolutionNotSupportedHint: (model, res, type) => `Combination of model "${model}" and resolution "${res}" is not supported for ${type}. Try using Veo 3.1 Fast with 720p resolution and 16:9 aspect ratio.`,
    veoResponseInvalid: 'VEO response invalid: operationId not found.',
    veoRequestFailed: (key, err) => `VEO request failed (videoModelKey="${key}"): ${err}`,
    modelKeyNotFound: 'Video model key not found or invalid for the selected combination.',
    recaptchaFailed: (type) => `Failed to call VEO ${type}: no reCAPTCHA action available to try.`,
    bearerTokenInvalid: 'Bearer Token for VEO is empty or invalid. Check Bearer Token settings.',
  },
  id: {
    outputFolderMissing: 'Folder Output global belum dikonfigurasi. Buka halaman Pengaturan.',
    bearerTokenMissing: 'Global Bearer Token untuk VEO belum dikonfigurasi. Buka halaman Pengaturan.',
    noScenesSent: 'Tidak ada scene yang dikirim untuk Generate Scene.',
    noScenesProcessed: 'Tidak ada scene yang diproses.',
    limitingScenes: (max, total) => `Membatasi Generate Scene menjadi ${max} scene pertama dari ${total} scene yang tersedia.`,
    startingBatch: (count) => `Memulai Generate Scene untuk ${count} scene...`,
    promptEmpty: (idx) => `Prompt untuk Scene #${idx} kosong. Scene dilewati.`,
    startImageMissing: (idx) => `Start image untuk Scene #${idx} tidak ditemukan (startPath kosong). Scene dilewati.`,
    endImageMissing: (idx) => `End image untuk Scene #${idx} tidak ditemukan (endPath kosong). Scene dilewati.`,
    preparingSingle: (idx) => `Scene #${idx}: menyiapkan gambar start sebagai referensi video...`,
    preparingPair: (idx) => `Scene #${idx}: menyiapkan gambar start & end sebagai referensi video...`,
    readingStartEnd: (idx) => `Scene #${idx}: membaca file gambar start & end sebagai referensi video...`,
    imageDataEmpty: (idx) => `Data gambar start/end untuk Scene #${idx} kosong.`,
    uploadingStartEnd: (idx) => `Scene #${idx}: mengupload gambar start & end ke VEO...`,
    creatingStartEnd: (idx) => `Scene #${idx}: membuat video dari gambar start→end + prompt...`,
    readingStart: (idx) => `Scene #${idx}: membaca file gambar start sebagai reference image...`,
    startImageDataEmpty: (idx) => `Data gambar start untuk Scene #${idx} kosong.`,
    uploadingReference: (idx) => `Scene #${idx}: mengupload reference image ke VEO...`,
    creatingFromStart: (idx) => `Scene #${idx}: membuat video dari start image + prompt...`,
    preparingMontage: (idx, count) => `Scene #${idx}: menyiapkan ${count} reference images untuk video montage...`,
    uploadingMontage: (idx, count) => `Scene #${idx}: mengupload ${count} reference images ke VEO...`,
    creatingMontage: (idx) => `Scene #${idx}: membuat video dari multiple reference images + prompt...`,
    montageImagesMissing: (idx) => `Reference images untuk Scene #${idx} tidak ada. Minimal 1 gambar diperlukan.`,
    videoGenerating: (idx, shortId) => `Scene #${idx}: video sedang dibuat (ID: ${shortId})...`,
    statusCheck: (idx, status, progress, est) => `Scene #${idx}: status=${status}, apiProgress=${progress}, est=${est}%`,
    videoProcessing: (idx, est) => `Scene #${idx}: video masih diproses... (~${est}%)`,
    statusCheckFailed: (idx, http, msg) => `Scene #${idx} gagal cek status API (HTTP ${http}): ${msg}`,
    videoFailed: 'Video generation gagal oleh API. Prompt mungkin melanggar policy.',
    timeout: 'Waktu tunggu habis, video tidak selesai dibuat.',
    downloading: (idx) => `Scene #${idx}: mengunduh video dari VEO...`,
    sceneCompleted: (idx, fileName) => `Scene #${idx} selesai. Video disimpan: ${fileName}.`,
    videoCompleted: (idx, fileName) => `Scene #${idx}: video selesai (${fileName}).`,
    progressUpdate: (processed, total) => `Progress Generate Scene: ${processed}/${total} scene selesai.`,
    promptLength: (len) => `(panjang prompt: ${len} karakter)`,
    sceneFailed: (idx, msg) => `Scene #${idx} gagal: ${msg}`,
    progressWithErrors: (processed, total) => `Progress Generate Scene: ${processed}/${total} scene diproses (beberapa gagal).`,
    batchComplete: (success, total) => `Generate Scene selesai. ${success}/${total} video berhasil dibuat.`,
    fatalError: (msg) => `FATAL (Generate Scene): ${msg}`,
    stoppedDueToError: 'Proses Generate Scene dihentikan karena error.',
    // VEO_API error messages
    uploadResponseInvalid: 'Respons uploadUserImage tidak valid: mediaGenerationId tidak ditemukan.',
    aspectRatioNotSupported: (ratio, type) => `Aspect ratio "${ratio}" tidak didukung untuk ${type}.`,
    modelResolutionNotSupported: (model, res, type) => `Kombinasi model "${model}" dan resolusi "${res}" tidak didukung untuk ${type}.`,
    modelResolutionNotSupportedHint: (model, res, type) => `Kombinasi model "${model}" dan resolusi "${res}" belum didukung untuk ${type}. Coba gunakan Veo 3.1 Fast dengan resolusi 720p dan aspect ratio 16:9.`,
    veoResponseInvalid: 'Respons VEO tidak valid: operationId tidak ditemukan.',
    veoRequestFailed: (key, err) => `VEO request gagal (videoModelKey="${key}"): ${err}`,
    modelKeyNotFound: 'Video model key tidak ditemukan atau tidak valid untuk kombinasi yang dipilih.',
    recaptchaFailed: (type) => `Gagal memanggil VEO ${type}: tidak ada reCAPTCHA action yang bisa dicoba.`,
    bearerTokenInvalid: 'Bearer Token untuk VEO kosong atau tidak valid. Periksa pengaturan Bearer Token.',
  },
  ms: {
    outputFolderMissing: 'Folder Output global belum dikonfigurasi. Buka halaman Tetapan.',
    bearerTokenMissing: 'Global Bearer Token untuk VEO belum dikonfigurasi. Buka halaman Tetapan.',
    noScenesSent: 'Tiada scene yang dihantar untuk Generate Scene.',
    noScenesProcessed: 'Tiada scene yang diproses.',
    limitingScenes: (max, total) => `Mengehadkan Generate Scene kepada ${max} scene pertama daripada ${total} scene yang tersedia.`,
    startingBatch: (count) => `Memulakan Generate Scene untuk ${count} scene...`,
    promptEmpty: (idx) => `Prompt untuk Scene #${idx} kosong. Scene dilangkau.`,
    startImageMissing: (idx) => `Imej mula untuk Scene #${idx} tidak ditemui (startPath kosong). Scene dilangkau.`,
    endImageMissing: (idx) => `Imej akhir untuk Scene #${idx} tidak ditemui (endPath kosong). Scene dilangkau.`,
    preparingSingle: (idx) => `Scene #${idx}: menyediakan imej mula sebagai rujukan video...`,
    preparingPair: (idx) => `Scene #${idx}: menyediakan imej mula & akhir sebagai rujukan video...`,
    readingStartEnd: (idx) => `Scene #${idx}: membaca fail imej mula & akhir sebagai rujukan video...`,
    imageDataEmpty: (idx) => `Data imej mula/akhir untuk Scene #${idx} kosong.`,
    uploadingStartEnd: (idx) => `Scene #${idx}: memuat naik imej mula & akhir ke VEO...`,
    creatingStartEnd: (idx) => `Scene #${idx}: mencipta video dari imej mula→akhir + prompt...`,
    readingStart: (idx) => `Scene #${idx}: membaca fail imej mula sebagai imej rujukan...`,
    startImageDataEmpty: (idx) => `Data imej mula untuk Scene #${idx} kosong.`,
    uploadingReference: (idx) => `Scene #${idx}: memuat naik imej rujukan ke VEO...`,
    creatingFromStart: (idx) => `Scene #${idx}: mencipta video dari imej mula + prompt...`,
    videoGenerating: (idx, shortId) => `Scene #${idx}: video sedang dijana (ID: ${shortId})...`,
    statusCheck: (idx, status, progress, est) => `Scene #${idx}: status=${status}, apiProgress=${progress}, est=${est}%`,
    videoProcessing: (idx, est) => `Scene #${idx}: video masih diproses... (~${est}%)`,
    statusCheckFailed: (idx, http, msg) => `Scene #${idx} gagal semak status API (HTTP ${http}): ${msg}`,
    videoFailed: 'Penjanaan video gagal oleh API. Prompt mungkin melanggar polisi.',
    timeout: 'Masa menunggu tamat, video tidak siap dijana.',
    downloading: (idx) => `Scene #${idx}: memuat turun video dari VEO...`,
    sceneCompleted: (idx, fileName) => `Scene #${idx} selesai. Video disimpan: ${fileName}.`,
    videoCompleted: (idx, fileName) => `Scene #${idx}: video selesai (${fileName}).`,
    progressUpdate: (processed, total) => `Kemajuan Generate Scene: ${processed}/${total} scene selesai.`,
    promptLength: (len) => `(panjang prompt: ${len} aksara)`,
    sceneFailed: (idx, msg) => `Scene #${idx} gagal: ${msg}`,
    progressWithErrors: (processed, total) => `Kemajuan Generate Scene: ${processed}/${total} scene diproses (sebahagian gagal).`,
    batchComplete: (success, total) => `Generate Scene selesai. ${success}/${total} video berjaya dijana.`,
    fatalError: (msg) => `FATAL (Generate Scene): ${msg}`,
    stoppedDueToError: 'Proses Generate Scene dihentikan kerana ralat.',
    // VEO_API error messages
    uploadResponseInvalid: 'Respons uploadUserImage tidak sah: mediaGenerationId tidak ditemui.',
    aspectRatioNotSupported: (ratio, type) => `Nisbah aspek "${ratio}" tidak disokong untuk ${type}.`,
    modelResolutionNotSupported: (model, res, type) => `Kombinasi model "${model}" dan resolusi "${res}" tidak disokong untuk ${type}.`,
    modelResolutionNotSupportedHint: (model, res, type) => `Kombinasi model "${model}" dan resolusi "${res}" belum disokong untuk ${type}. Cuba gunakan Veo 3.1 Fast dengan resolusi 720p dan nisbah aspek 16:9.`,
    veoResponseInvalid: 'Respons VEO tidak sah: operationId tidak ditemui.',
    veoRequestFailed: (key, err) => `Permintaan VEO gagal (videoModelKey="${key}"): ${err}`,
    modelKeyNotFound: 'Video model key tidak ditemui atau tidak sah untuk kombinasi yang dipilih.',
    recaptchaFailed: (type) => `Gagal memanggil VEO ${type}: tiada reCAPTCHA action yang boleh dicuba.`,
    bearerTokenInvalid: 'Bearer Token untuk VEO kosong atau tidak sah. Semak tetapan Bearer Token.',
  },
};

function getSceneMsg(lang) {
  return SCENE_MESSAGES[lang] || SCENE_MESSAGES['en'];
}

const RECAPTCHA_ACTION = 'VIDEO_GENERATION';
const RECAPTCHA_ACTION_FALLBACK = 'PINHOLE_GENERATE_IMAGE';
const RECAPTCHA_APPLICATION_TYPE = 'RECAPTCHA_APPLICATION_TYPE_WEB';

const IMAGE_API_ENDPOINTS = {
  UPLOAD_IMAGE: 'https://aisandbox-pa.googleapis.com/v1:uploadUserImage',
  GENERATE: 'https://aisandbox-pa.googleapis.com/v1/video:batchAsyncGenerateVideoStartImage',
  GENERATE_START_END: 'https://aisandbox-pa.googleapis.com/v1/video:batchAsyncGenerateVideoStartAndEndImage',
  GENERATE_REFERENCE: 'https://aisandbox-pa.googleapis.com/v1/video:batchAsyncGenerateVideoReferenceImages',
};

const API_ENDPOINTS = {
  STATUS: 'https://aisandbox-pa.googleapis.com/v1/video:batchCheckAsyncVideoGenerationStatus',
};

const IMAGE_ASPECT_RATIO_MAP = {
  '16:9': {
    apiValue: 'VIDEO_ASPECT_RATIO_LANDSCAPE',
    imageAspectRatio: 'IMAGE_ASPECT_RATIO_LANDSCAPE',
    models: {
      '3.1-fast-low': {
        '720p': 'veo_3_1_i2v_s_fast_ultra',
      },
      '3.1-fast': {
        '720p': 'veo_3_1_i2v_s_fast_ultra',
      },
    },
  },
  '9:16': {
    apiValue: 'VIDEO_ASPECT_RATIO_PORTRAIT',
    imageAspectRatio: 'IMAGE_ASPECT_RATIO_PORTRAIT',
    models: {
      '3.1-fast-low': {
        '720p': 'veo_3_1_i2v_s_fast_portrait_ultra',
      },
      '3.1-fast': {
        '720p': 'veo_3_1_i2v_s_fast_portrait_ultra',
      },
    },
  },
};

const IMAGE_START_END_MODELS = {
  '16:9': {
    '3.1-fast-low': {
      '720p': 'veo_3_1_i2v_s_fast_fl_ultra_relaxed',
    },
    '3.1-fast': {
      '720p': 'veo_3_1_i2v_s_fast_fl_ultra_relaxed',
    },
  },
  '9:16': {
    '3.1-fast-low': {
      '720p': 'veo_3_1_i2v_s_fast_portrait_fl_ultra_relaxed',
    },
    '3.1-fast': {
      '720p': 'veo_3_1_i2v_s_fast_portrait_fl_ultra_relaxed',
    },
  },
};

const IMAGE_REFERENCE_MODELS = {
  '16:9': {
    '3.1-fast-low': {
      '720p': 'veo_3_1_r2v_fast_landscape_ultra',
    },
    '3.1-fast': {
      '720p': 'veo_3_1_r2v_fast_landscape_ultra',
    },
  },
  '9:16': {
    '3.1-fast-low': {
      '720p': 'veo_3_1_r2v_fast_portrait_ultra',
    },
    '3.1-fast': {
      '720p': 'veo_3_1_r2v_fast_portrait_ultra',
    },
  },
};

function normalizeBearerHeader(rawBearer) {
  const str = String(rawBearer || '');
  let cleaned = str.replace(/[\r\n]+/g, ' ').trim();
  if (!cleaned) {
    throw new Error('Bearer Token untuk VEO kosong atau tidak valid. Periksa pengaturan Bearer Token.');
  }
  cleaned = cleaned.replace(/^Bearer\s+/i, '');
  return `Bearer ${cleaned}`;
}

function isInvalidArgumentError(err) {
  try {
    const status = err?.response?.status;
    if (status !== 400) return false;
    const data = err?.response?.data;
    const text = typeof data === 'string' ? data : JSON.stringify(data || '');
    return text.includes('INVALID_ARGUMENT') || text.toLowerCase().includes('request contains an invalid argument');
  } catch (_) {
    return false;
  }
}

const VEO_API = {
  // Step 1: upload image, get mediaId
  uploadImage: async (imageBase64, bearerKey, aspectRatio = '16:9') => {
    const mappedAspectRatio = IMAGE_ASPECT_RATIO_MAP[aspectRatio];
    if (!mappedAspectRatio) {
      throw new Error(`Aspect ratio "${aspectRatio}" tidak didukung untuk Image-to-Video.`);
    }

    const payload = {
      imageInput: {
        rawImageBytes: imageBase64,
        mimeType: 'image/jpeg',
        isUserUploaded: true,
        aspectRatio: mappedAspectRatio.imageAspectRatio,
      },
      clientContext: {
        sessionId: `;${Date.now()}`,
        tool: 'ASSET_MANAGER',
      },
    };

    const normalizedBearer = normalizeBearerHeader(bearerKey);

    const data = await postFromLabsWindow({
      url: IMAGE_API_ENDPOINTS.UPLOAD_IMAGE,
      bearer: normalizedBearer,
      contentType: 'application/json',
      body: payload,
    });

    const mediaGenerationId = data?.mediaGenerationId?.mediaGenerationId;
    if (!mediaGenerationId) {
      throw new Error('Respons uploadUserImage tidak valid: mediaGenerationId tidak ditemukan.');
    }

    return mediaGenerationId;
  },

  // Step 2: generate video from single start image
  generateVideoFromImage: async ({ mediaId, prompt, bearerKey, aspectRatio = '16:9', veoModel = '3.1-fast-low', resolution = '720p', flowProjectId = null, }) => {
    const mappedAspectRatio = IMAGE_ASPECT_RATIO_MAP[aspectRatio];
    if (!mappedAspectRatio) {
      throw new Error(`Aspect ratio "${aspectRatio}" tidak didukung untuk Image-to-Video.`);
    }

    const aspectModels = mappedAspectRatio.models || {};
    const normalizedBearer = normalizeBearerHeader(bearerKey);
    const { v4: uuidv4 } = await import('uuid');

    const actions = [RECAPTCHA_ACTION, RECAPTCHA_ACTION_FALLBACK]
      .map((v) => String(v || '').trim())
      .filter(Boolean)
      .filter((v, i, arr) => arr.indexOf(v) === i);

    let lastErr = null;
    const modelAttempts = ['3.1-fast-low', '3.1-fast'];

    for (const modelAttempt of modelAttempts) {
      const modelsForAspect = aspectModels[modelAttempt];
      if (!modelsForAspect || !modelsForAspect['720p']) {
        lastErr = new Error(`Kombinasi model "${modelAttempt}" dan resolusi "${resolution}" belum didukung untuk Image-to-Video.`);
        continue;
      }

      const modelKey = modelsForAspect['720p'];
      const modelKeyCandidates = [modelKey]
        .map((v) => (typeof v === 'string' ? v.trim() : ''))
        .filter(Boolean)
        .filter((v, i, arr) => arr.indexOf(v) === i);

      let retryWithNextModel = false;

      for (const action of actions) {
        try {
          const sessionId = `;${Date.now()}`;
          const projectId = String(flowProjectId || '').trim() || uuidv4();

          for (let candidateIndex = 0; candidateIndex < modelKeyCandidates.length; candidateIndex += 1) {
            const candidateKey = modelKeyCandidates[candidateIndex];
            if (!candidateKey) continue;

            try {
              const recaptchaToken = await getRecaptchaToken(action);
              const recaptchaContext = { token: recaptchaToken, applicationType: RECAPTCHA_APPLICATION_TYPE };

              const payload = {
                clientContext: {
                  recaptchaContext,
                  sessionId,
                  projectId,
                  tool: 'PINHOLE',
                  userPaygateTier: 'PAYGATE_TIER_TWO',
                },
                requests: [
                  {
                    aspectRatio: mappedAspectRatio.apiValue,
                    seed: Math.floor(Math.random() * 100000),
                    textInput: { prompt },
                    videoModelKey: candidateKey,
                    startImage: { mediaId },
                    metadata: { sceneId: uuidv4() },
                  },
                ],
              };

              const data = await postFromLabsWindow({
                url: IMAGE_API_ENDPOINTS.GENERATE,
                bearer: normalizedBearer,
                contentType: 'text/plain;charset=UTF-8',
                body: JSON.stringify(payload),
              });

              const operationName = data?.operations?.[0]?.operation;
              const opId = operationName?.name;
              if (!opId) throw new Error('Respons VEO tidak valid: operationId tidak ditemukan.');

              const remainingCredits =
                typeof data?.remainingCredits === 'number' && Number.isFinite(data.remainingCredits)
                  ? data.remainingCredits
                  : undefined;

              return { operationId: opId, remainingCredits, modelUsed: modelAttempt };
            } catch (candidateErr) {
              lastErr = candidateErr;
              const status = candidateErr?.response?.status;
              if (status === 429 && modelAttempt !== modelAttempts[modelAttempts.length - 1]) {
                retryWithNextModel = true;
                break;
              }
              if (isInvalidArgumentError(candidateErr) && candidateIndex < modelKeyCandidates.length - 1) {
                continue;
              }
              if (isRecaptchaEvaluationFailed(candidateErr)) throw candidateErr;

              const errText = candidateErr?.response?.data
                ? typeof candidateErr.response.data === 'string'
                  ? candidateErr.response.data
                  : JSON.stringify(candidateErr.response.data)
                : candidateErr?.message || String(candidateErr);
              throw new Error(`VEO request gagal (videoModelKey="${candidateKey}"): ${errText}`);
            }
          }

          if (retryWithNextModel) break;

          throw new Error('Video model key tidak ditemukan atau tidak valid untuk kombinasi yang dipilih.');
        } catch (err) {
          lastErr = err;
          if (retryWithNextModel) break;
          if (isRecaptchaEvaluationFailed(err) && action !== actions[actions.length - 1]) {
            continue;
          }
          throw err;
        }
      }

      if (retryWithNextModel) {
        console.warn('[VEO] 429 encountered, retrying with next model...');
        continue;
      }
    }

    if (lastErr) throw lastErr;
    throw new Error('Gagal memanggil VEO Start Image: tidak ada reCAPTCHA action yang bisa dicoba.');
  },

  // Multiple Reference Images-to-Video (Montage)
  generateVideoFromMultipleReferences: async ({ mediaIds, prompt, bearerKey, aspectRatio = '16:9', veoModel = '3.1-fast-low', resolution = '720p', flowProjectId = null, }) => {
    const mappedAspectRatio = IMAGE_ASPECT_RATIO_MAP[aspectRatio];
    if (!mappedAspectRatio) {
      throw new Error(`Aspect ratio "${aspectRatio}" tidak didukung untuk Montage.`);
    }

    const normalizedBearer = normalizeBearerHeader(bearerKey);
    const { v4: uuidv4 } = await import('uuid');

    const actions = [RECAPTCHA_ACTION, RECAPTCHA_ACTION_FALLBACK]
      .map((v) => String(v || '').trim())
      .filter(Boolean)
      .filter((v, i, arr) => arr.indexOf(v) === i);

    let lastErr = null;
    const modelAttempts = ['3.1-fast-low', '3.1-fast'];

    for (const modelAttempt of modelAttempts) {
      const modelsForAspect = (IMAGE_REFERENCE_MODELS[aspectRatio] || {})[modelAttempt];
      if (!modelsForAspect || !modelsForAspect[resolution]) {
        lastErr = new Error(
          `Kombinasi model "${modelAttempt}" dan resolusi "${resolution}" belum didukung untuk Montage. ` +
            'Coba gunakan Veo 3.1 Fast dengan resolusi 720p dan aspect ratio 16:9.',
        );
        continue;
      }

      const modelKey = modelsForAspect[resolution];
      const modelKeyCandidates = [modelKey]
        .map((v) => (typeof v === 'string' ? v.trim() : ''))
        .filter(Boolean)
        .filter((v, i, arr) => arr.indexOf(v) === i);

      let retryWithNextModel = false;

      for (const action of actions) {
        try {
          const sessionId = `;${Date.now()}`;
          const projectId = String(flowProjectId || '').trim() || uuidv4();
          const recaptchaToken = await getRecaptchaToken(action);
          const recaptchaContext = { token: recaptchaToken, applicationType: RECAPTCHA_APPLICATION_TYPE };

          for (let candidateIndex = 0; candidateIndex < modelKeyCandidates.length; candidateIndex += 1) {
            const candidateKey = modelKeyCandidates[candidateIndex];
            if (!candidateKey) continue;

            try {
              const payload = {
                clientContext: {
                  recaptchaContext,
                  sessionId,
                  projectId,
                  tool: 'PINHOLE',
                  userPaygateTier: 'PAYGATE_TIER_TWO',
                },
                requests: [
                  {
                    aspectRatio: mappedAspectRatio.apiValue,
                    metadata: { sceneId: uuidv4() },
                    referenceImages: mediaIds.map((mediaId) => ({
                      imageUsageType: 'IMAGE_USAGE_TYPE_ASSET',
                      mediaId,
                    })),
                    seed: Math.floor(Math.random() * 100000),
                    textInput: { prompt },
                    videoModelKey: candidateKey,
                  },
                ],
              };

              const data = await postFromLabsWindow({
                url: IMAGE_API_ENDPOINTS.GENERATE_REFERENCE,
                bearer: normalizedBearer,
                contentType: 'text/plain;charset=UTF-8',
                body: JSON.stringify(payload),
              });

              const operationName = data?.operations?.[0]?.operation;
              const opId = operationName?.name;
              if (!opId) throw new Error('Respons VEO tidak valid: operationId tidak ditemukan.');

              const remainingCredits =
                typeof data?.remainingCredits === 'number' && Number.isFinite(data.remainingCredits)
                  ? data.remainingCredits
                  : undefined;

              return { operationId: opId, remainingCredits, modelUsed: modelAttempt };
            } catch (candidateErr) {
              lastErr = candidateErr;
              const status = candidateErr?.response?.status;
              if (status === 429 && modelAttempt !== modelAttempts[modelAttempts.length - 1]) {
                retryWithNextModel = true;
                break;
              }
              if (isInvalidArgumentError(candidateErr) && candidateIndex < modelKeyCandidates.length - 1) {
                continue;
              }
              if (isRecaptchaEvaluationFailed(candidateErr)) throw candidateErr;

              const errText = candidateErr?.response?.data
                ? typeof candidateErr.response.data === 'string'
                  ? candidateErr.response.data
                  : JSON.stringify(candidateErr.response.data)
                : candidateErr?.message || String(candidateErr);
              throw new Error(`VEO request gagal (videoModelKey="${candidateKey}"): ${errText}`);
            }
          }

          if (retryWithNextModel) break;

          throw new Error('Video model key tidak ditemukan atau tidak valid untuk kombinasi yang dipilih.');
        } catch (err) {
          lastErr = err;
          if (retryWithNextModel) break;
          if (isRecaptchaEvaluationFailed(err) && action !== actions[actions.length - 1]) {
            continue;
          }
          throw err;
        }
      }

      if (retryWithNextModel) {
        console.warn('[VEO] 429 encountered, retrying with next model...');
        continue;
      }
    }

    if (lastErr) throw lastErr;
    throw new Error('Gagal memanggil VEO Montage: tidak ada reCAPTCHA action yang bisa dicoba.');
  },

  // Reference Image-to-Video (Single)
  generateVideoFromReferenceImage: async ({ mediaId, prompt, bearerKey, aspectRatio = '16:9', veoModel = '3.1-fast-low', resolution = '720p', flowProjectId = null, }) => {
    const mappedAspectRatio = IMAGE_ASPECT_RATIO_MAP[aspectRatio];
    if (!mappedAspectRatio) {
      throw new Error(`Aspect ratio "${aspectRatio}" tidak didukung untuk Reference Image.`);
    }

    const aspectModels = IMAGE_REFERENCE_MODELS[aspectRatio] || {};
    const normalizedModel = '3.1-fast-low';
    const modelsForAspect = aspectModels[normalizedModel];
    if (!modelsForAspect || !modelsForAspect[resolution]) {
      throw new Error(
        `Kombinasi model "${veoModel}" dan resolusi "${resolution}" belum didukung untuk Reference Image. ` +
          'Coba gunakan Veo 3.1 Fast dengan resolusi 720p dan aspect ratio 16:9.',
      );
    }

    const modelKey = modelsForAspect[resolution];
    const normalizedBearer = normalizeBearerHeader(bearerKey);
    const { v4: uuidv4 } = await import('uuid');

    const actions = [RECAPTCHA_ACTION, RECAPTCHA_ACTION_FALLBACK]
      .map((v) => String(v || '').trim())
      .filter(Boolean)
      .filter((v, i, arr) => arr.indexOf(v) === i);

    let lastErr = null;
    for (const action of actions) {
      try {
        const sessionId = `;${Date.now()}`;
        const projectId = String(flowProjectId || '').trim() || uuidv4();
        const recaptchaToken = await getRecaptchaToken(action);
        const recaptchaContext = { token: recaptchaToken, applicationType: RECAPTCHA_APPLICATION_TYPE };

        const payload = {
          clientContext: {
            recaptchaContext,
            sessionId,
            projectId,
            tool: 'PINHOLE',
            userPaygateTier: 'PAYGATE_TIER_TWO',
          },
          requests: [
            {
              aspectRatio: mappedAspectRatio.apiValue,
              metadata: { sceneId: uuidv4() },
              referenceImages: [
                {
                  imageUsageType: 'IMAGE_USAGE_TYPE_ASSET',
                  mediaId,
                },
              ],
              seed: Math.floor(Math.random() * 100000),
              textInput: { prompt },
              videoModelKey: modelKey,
            },
          ],
        };

        const data = await postFromLabsWindow({
          url: IMAGE_API_ENDPOINTS.GENERATE_REFERENCE,
          bearer: normalizedBearer,
          contentType: 'text/plain;charset=UTF-8',
          body: JSON.stringify(payload),
        });

        const operationName = data?.operations?.[0]?.operation;
        const opId = operationName?.name;
        if (!opId) throw new Error('Respons VEO tidak valid: operationId tidak ditemukan.');

        const remainingCredits =
          typeof data?.remainingCredits === 'number' && Number.isFinite(data.remainingCredits)
            ? data.remainingCredits
            : undefined;

        return { operationId: opId, remainingCredits };
      } catch (err) {
        lastErr = err;
        if (isRecaptchaEvaluationFailed(err) && action !== actions[actions.length - 1]) {
          continue;
        }
        throw err;
      }
    }

    if (lastErr) throw lastErr;
    throw new Error('Gagal memanggil VEO Reference Image: tidak ada reCAPTCHA action yang bisa dicoba.');
  },

  // Start+End Image-to-Video
  generateVideoStartAndEndImage: async ({ startMediaId, endMediaId, prompt, bearerKey, aspectRatio = '16:9', veoModel = '3.1-fast-low', resolution = '720p', flowProjectId = null, }) => {
    const mappedAspectRatio = IMAGE_ASPECT_RATIO_MAP[aspectRatio];
    if (!mappedAspectRatio) {
      throw new Error(`Aspect ratio "${aspectRatio}" tidak didukung untuk Start+End Image.`);
    }

    const aspectModels = IMAGE_START_END_MODELS[aspectRatio] || {};
    const normalizedBearer = normalizeBearerHeader(bearerKey);
    const { v4: uuidv4 } = await import('uuid');

    const actions = [RECAPTCHA_ACTION, RECAPTCHA_ACTION_FALLBACK]
      .map((v) => String(v || '').trim())
      .filter(Boolean)
      .filter((v, i, arr) => arr.indexOf(v) === i);

    let lastErr = null;
    const modelAttempts = ['3.1-fast-low', '3.1-fast'];

    for (const modelAttempt of modelAttempts) {
      const modelsForAspect = aspectModels[modelAttempt];
      if (!modelsForAspect || !modelsForAspect['720p']) {
        lastErr = new Error(`Kombinasi model "${modelAttempt}" dan resolusi "${resolution}" belum didukung untuk Start+End Image.`);
        continue;
      }

      const modelKey = modelsForAspect['720p'];
      const modelKeyCandidates = [modelKey]
        .map((v) => (typeof v === 'string' ? v.trim() : ''))
        .filter(Boolean)
        .filter((v, i, arr) => arr.indexOf(v) === i);

      let retryWithNextModel = false;

      for (const action of actions) {
        try {
          const sessionId = `;${Date.now()}`;
          const projectId = String(flowProjectId || '').trim() || uuidv4();

          for (let candidateIndex = 0; candidateIndex < modelKeyCandidates.length; candidateIndex += 1) {
            const candidateKey = modelKeyCandidates[candidateIndex];
            if (!candidateKey) continue;

            try {
              const recaptchaToken = await getRecaptchaToken(action);
              const recaptchaContext = { token: recaptchaToken, applicationType: RECAPTCHA_APPLICATION_TYPE };

              const payload = {
                mediaGenerationContext: {
                  batchId: uuidv4(),
                },
                clientContext: {
                  recaptchaContext,
                  sessionId,
                  projectId,
                  tool: 'PINHOLE',
                  userPaygateTier: 'PAYGATE_TIER_TWO',
                },
                requests: [
                  {
                    aspectRatio: mappedAspectRatio.apiValue,
                    seed: Math.floor(Math.random() * 100000),
                    textInput: {
                      structuredPrompt: {
                        parts: [{ text: prompt }],
                      },
                    },
                    videoModelKey: candidateKey,
                    startImage: { mediaId: startMediaId },
                    endImage: { mediaId: endMediaId },
                    metadata: {},
                  },
                ],
                useV2ModelConfig: true,
              };

              const data = await postFromLabsWindow({
                url: IMAGE_API_ENDPOINTS.GENERATE_START_END,
                bearer: normalizedBearer,
                contentType: 'text/plain;charset=UTF-8',
                body: JSON.stringify(payload),
              });

              const operationName = data?.operations?.[0]?.operation;
              const opId = operationName?.name;
              if (!opId) throw new Error('Respons VEO tidak valid: operationId tidak ditemukan.');

              const remainingCredits =
                typeof data?.remainingCredits === 'number' && Number.isFinite(data.remainingCredits)
                  ? data.remainingCredits
                  : undefined;

              return { operationId: opId, remainingCredits, modelUsed: modelAttempt };
            } catch (candidateErr) {
              lastErr = candidateErr;
              const status = candidateErr?.response?.status;
              if (status === 429 && modelAttempt !== modelAttempts[modelAttempts.length - 1]) {
                retryWithNextModel = true;
                break;
              }
              if (isInvalidArgumentError(candidateErr) && candidateIndex < modelKeyCandidates.length - 1) {
                continue;
              }
              if (isRecaptchaEvaluationFailed(candidateErr)) throw candidateErr;

              const errText = candidateErr?.response?.data
                ? typeof candidateErr.response.data === 'string'
                  ? candidateErr.response.data
                  : JSON.stringify(candidateErr.response.data)
                : candidateErr?.message || String(candidateErr);
              throw new Error(`VEO request gagal (videoModelKey="${candidateKey}"): ${errText}`);
            }
          }

          if (retryWithNextModel) break;

          throw new Error('Video model key tidak ditemukan atau tidak valid untuk kombinasi yang dipilih.');
        } catch (err) {
          lastErr = err;
          if (retryWithNextModel) break;
          if (isRecaptchaEvaluationFailed(err) && action !== actions[actions.length - 1]) {
            continue;
          }
          throw err;
        }
      }

      if (retryWithNextModel) {
        console.warn('[VEO] 429 encountered, retrying with next model...');
        continue;
      }
    }

    if (lastErr) throw lastErr;
    throw new Error('Gagal memanggil VEO Start+End Image: tidak ada reCAPTCHA action yang bisa dicoba.');
  },

  checkStatus: async (operationId, bearerKey) => {
    const normalizedBearer = normalizeBearerHeader(bearerKey);
    const opName = typeof operationId === 'string' ? operationId : operationId?.name || '';
    const body = { operations: [{ operation: { name: opName } }] };

    let httpStatusCode = null;
    let rawResponseData = null;

    try {
      const response = await axios.post(API_ENDPOINTS.STATUS, body, {
        headers: {
          accept: '*/*',
          'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
          authorization: normalizedBearer,
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

      httpStatusCode = response.status;
      rawResponseData = response.data;

      const data = response.data;
      const result = data?.operationResults?.[0];
      const alt = data?.operations?.[0];

      const statusFromResult =
        result?.metadata?.state || result?.metadata?.stateMessage || result?.state || result?.status;
      const statusFromAlt =
        alt?.status || alt?.operation?.metadata?.state || alt?.operation?.metadata?.statusMessage;

      const status = statusFromResult ?? statusFromAlt ?? 'UNKNOWN';

      // Prioritaskan fifeUrl seperti kode lama, lalu coba alternatif lain
      const url =
        alt?.operation?.metadata?.video?.fifeUrl ||
        result?.operationResult?.videoResult?.videoUri ||
        alt?.operation?.metadata?.video?.videoUri ||
        alt?.operation?.metadata?.video?.gcsUri ||
        null;

      const progressFromResult = typeof result?.metadata?.progress === 'number' ? result.metadata.progress : null;
      const progressFromAlt = typeof alt?.operation?.metadata?.progress === 'number' ? alt.operation.metadata.progress : null;
      const progress = progressFromResult ?? progressFromAlt ?? null;

      const completedStates = ['MEDIA_GENERATION_STATUS_SUCCESSFUL', 'MEDIA_GENERATION_STATUS_COMPLETED', 'MEDIA_GENERATION_STATUS_FAILED'];
      const completed = completedStates.includes(status);

      const errorMessage =
        result?.operationResult?.error?.message ||
        alt?.operation?.error?.message ||
        alt?.operation?.metadata?.terminalErrorMessage ||
        alt?.operation?.metadata?.statusMessage ||
        null;

      return { status, url, completed, progress, errorMessage, httpStatusCode, rawResponseData };
    } catch (error) {
      // Tangkap HTTP error codes (400, 403, 500, dll)
      httpStatusCode = error.response?.status || null;
      const errorData = error.response?.data;
      const errorCode = errorData?.error?.code || errorData?.error?.status || null;
      const errorMsg = errorData?.error?.message || error.message || 'Unknown error';

      throw new Error(
        `HTTP ${httpStatusCode || 'UNKNOWN'}: ${errorMsg}` +
        (errorCode ? ` (Error Code: ${errorCode})` : '')
      );
    }
  },

  downloadVideo: async (videoUrl) => {
    const { data } = await axios.get(videoUrl, { responseType: 'arraybuffer' });
    return data;
  },
};

async function runSceneVideoWorkflow({
  bearerKey,
  downloadPath,
  aspectRatio = '16:9',
  veoModel = '3.1-fast-low',
  resolution = '720p',
  scenes = [],
  flowProjectId,
  sendUpdate,
  uiLanguage = 'en',
}) {
  const workflow = 'Generate Scene';
  const smsg = getSceneMsg(uiLanguage);
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  try {
    if (!downloadPath) {
      throw new Error(smsg.outputFolderMissing);
    }

    if (!bearerKey || String(bearerKey).trim() === '') {
      throw new Error(smsg.bearerTokenMissing);
    }

    if (!Array.isArray(scenes) || scenes.length === 0) {
      sendUpdate({ type: 'INFO', workflow, message: smsg.noScenesSent });
      return { message: smsg.noScenesProcessed };
    }

    const MAX_SCENES = 12;
    let sceneList = scenes;
    if (sceneList.length > MAX_SCENES) {
      sendUpdate({
        type: 'INFO',
        workflow,
        message: smsg.limitingScenes(MAX_SCENES, sceneList.length),
      });
      sceneList = sceneList.slice(0, MAX_SCENES);
    }

    const totalScenes = sceneList.length;

    sendUpdate({
      type: 'BATCH_TOTAL',
      workflow,
      total: totalScenes,
      message: smsg.startingBatch(totalScenes),
    });

    let processed = 0;
    let successCount = 0;
    // Flow Ultra approach: Max 4 concurrent requests (same as image generation)
    // With proper payload structure (clientContext in requests[]), video can handle same concurrency as image
    const CONCURRENCY = 4;

    const processScene = async (scene, i) => {
      const index = typeof scene.index === 'number' ? scene.index : i + 1;
      const prompt = (scene.prompt || '').trim();
      const startPath = (scene.startPath || '').trim();
      const endPath = (scene.endPath || '').trim();
      const startImageBase64Raw = typeof scene.startImageBase64 === 'string' ? scene.startImageBase64.trim() : '';
      const endImageBase64Raw = typeof scene.endImageBase64 === 'string' ? scene.endImageBase64.trim() : '';

      if (!prompt) {
        sendUpdate({
          type: 'SCENE_ERROR',
          workflow,
          index,
          message: smsg.promptEmpty(index),
        });
        processed += 1;
        return;
      }

      const mode = scene.mode || 'single';
      const referenceImagesRaw = scene.referenceImages || [];

      // Mode-specific validation
      if (mode === 'montage') {
        // Montage mode: validate referenceImages
        if (!Array.isArray(referenceImagesRaw) || referenceImagesRaw.length === 0) {
          sendUpdate({
            type: 'SCENE_ERROR',
            workflow,
            index,
            message: smsg.montageImagesMissing(index),
          });
          processed += 1;
          return;
        }
      } else {
        // Other modes (single, pair-chunk, pair-sliding): validate startPath/startImageBase64
        if (!startPath && !startImageBase64Raw) {
          sendUpdate({
            type: 'SCENE_ERROR',
            workflow,
            index,
            message: smsg.startImageMissing(index),
          });
          processed += 1;
          return;
        }

        // Pair modes: also validate endPath/endImageBase64
        if ((mode === 'pair-chunk' || mode === 'pair-sliding') && !endPath && !endImageBase64Raw) {
          sendUpdate({
            type: 'SCENE_ERROR',
            workflow,
            index,
            message: smsg.endImageMissing(index),
          });
          processed += 1;
          return;
        }
      }

      sendUpdate({
        type: 'SCENE_STARTED',
        workflow,
        index,
        message:
          mode === 'montage'
            ? smsg.preparingMontage(index, referenceImagesRaw.length)
            : mode === 'single'
            ? smsg.preparingSingle(index)
            : smsg.preparingPair(index),
      });

      try {
        const adjustedVeoModel = '3.1-fast-low';
        let operationId;

        if (mode === 'pair-chunk' || mode === 'pair-sliding') {
          sendUpdate({ type: 'INFO', workflow, message: smsg.readingStartEnd(index) });

          let startBase64 = '';
          let endBase64 = '';

          if (startImageBase64Raw) {
            const commaIndex = startImageBase64Raw.indexOf(',');
            startBase64 = commaIndex !== -1 ? startImageBase64Raw.slice(commaIndex + 1) : startImageBase64Raw;
          } else {
            const startBuffer = fs.readFileSync(startPath);
            startBase64 = startBuffer.toString('base64');
          }

          if (endImageBase64Raw) {
            const commaEnd = endImageBase64Raw.indexOf(',');
            endBase64 = commaEnd !== -1 ? endImageBase64Raw.slice(commaEnd + 1) : endImageBase64Raw;
          } else {
            const endBuffer = fs.readFileSync(endPath);
            endBase64 = endBuffer.toString('base64');
          }

          if (!startBase64 || !endBase64) {
            throw new Error(smsg.imageDataEmpty(index));
          }

          sendUpdate({ type: 'INFO', workflow, message: smsg.uploadingStartEnd(index) });

          const startMediaId = await VEO_API.uploadImage(startBase64, bearerKey, aspectRatio);
          const endMediaId = await VEO_API.uploadImage(endBase64, bearerKey, aspectRatio);

          sendUpdate({ type: 'INFO', workflow, message: smsg.creatingStartEnd(index) });

          operationId = await VEO_API.generateVideoStartAndEndImage({
            startMediaId,
            endMediaId,
            prompt,
            bearerKey,
            aspectRatio,
            veoModel: adjustedVeoModel,
            resolution,
            flowProjectId,
          });
        } else if (mode === 'montage') {
          // Mode Montage: multiple reference images
          sendUpdate({ type: 'INFO', workflow, message: smsg.uploadingMontage(index, referenceImagesRaw.length) });

          const mediaIds = [];
          for (let i = 0; i < referenceImagesRaw.length; i += 1) {
            const refImg = referenceImagesRaw[i];
            let imageBase64 = '';

            if (refImg.data) {
              // Base64 data from frontend
              const commaIndex = refImg.data.indexOf(',');
              imageBase64 = commaIndex !== -1 ? refImg.data.slice(commaIndex + 1) : refImg.data;
            } else {
              throw new Error(`Reference image #${i + 1} data is missing for Scene #${index}.`);
            }

            if (!imageBase64) {
              throw new Error(`Reference image #${i + 1} data is empty for Scene #${index}.`);
            }

            const mediaId = await VEO_API.uploadImage(imageBase64, bearerKey, aspectRatio);
            mediaIds.push(mediaId);
          }

          sendUpdate({ type: 'INFO', workflow, message: smsg.creatingMontage(index) });

          // Call generateVideoFromMultipleReferences with array of mediaIds
          operationId = await VEO_API.generateVideoFromMultipleReferences({
            mediaIds,
            prompt,
            bearerKey,
            aspectRatio,
            veoModel: adjustedVeoModel,
            resolution,
            flowProjectId,
          });
        } else {
          sendUpdate({ type: 'INFO', workflow, index, message: smsg.readingStart(index) });

          let imageBase64 = '';

          if (startImageBase64Raw) {
            const commaIndex = startImageBase64Raw.indexOf(',');
            imageBase64 = commaIndex !== -1 ? startImageBase64Raw.slice(commaIndex + 1) : startImageBase64Raw;
          } else {
            const imageBuffer = fs.readFileSync(startPath);
            imageBase64 = imageBuffer.toString('base64');
          }

          if (!imageBase64) {
            throw new Error(smsg.startImageDataEmpty(index));
          }

          sendUpdate({ type: 'INFO', workflow, message: smsg.uploadingReference(index) });

          const mediaId = await VEO_API.uploadImage(imageBase64, bearerKey, aspectRatio);

          sendUpdate({ type: 'INFO', workflow, message: smsg.creatingFromStart(index) });

          operationId = await VEO_API.generateVideoFromImage({
            mediaId,
            prompt,
            bearerKey,
            aspectRatio,
            veoModel: adjustedVeoModel,
            resolution,
            flowProjectId,
          });
        }

        const opValue = typeof operationId === 'string' ? { operationId } : operationId;
        const shortId = opValue.operationId.split('/').pop();

        sendUpdate({ type: 'INFO', workflow, message: smsg.videoGenerating(index, shortId) });
        sendUpdate({
          type: 'VIDEO_STARTED',
          workflow,
          operationId: opValue.operationId,
          shortId,
          prompt,
          remainingCredits: opValue.remainingCredits,
        });

        let videoUrl = null;
        const startTime = Date.now();
        const pollIntervalMs = 5000;
        const maxDurationSeconds = adjustedVeoModel === '3.1-fast-low' ? 240 : 180;
        const maxAttempts = Math.ceil((maxDurationSeconds * 1000) / pollIntervalMs);
        const estimatedTotalSeconds = maxDurationSeconds;
        let completedWithoutUrlCount = 0;
        const MAX_URL_RETRIES = 15;

        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
          await sleep(pollIntervalMs);
          
          let result;
          try {
            result = await VEO_API.checkStatus(opValue.operationId, bearerKey);
          } catch (statusError) {
            const httpStatus = statusError.response?.status || null;
            const errorMsg = statusError.message || String(statusError);
            
            sendUpdate({
              type: 'SCENE_ERROR',
              workflow,
              index,
              message: smsg.statusCheckFailed(index, httpStatus || 'N/A', errorMsg),
            });
            
            throw new Error(`HTTP ${httpStatus || 'UNKNOWN'} - ${errorMsg}`);
          }

          // Check FAILED status first, before any retry logic
          if (result.status === 'MEDIA_GENERATION_STATUS_FAILED') {
            const reason = result.errorMessage || smsg.videoFailed;
            throw new Error(`HTTP ${result.httpStatusCode || 200} - ${reason}`);
          }

          if (result.completed && result.url) {
            videoUrl = result.url;
            break;
          }

          // Legacy behavior: If completed but no URL, we simply continue looping (implicit retry)
          // instead of throwing an error. This allows for eventual consistency if the URL appears later.

          const elapsedSeconds = (Date.now() - startTime) / 1000;
          const progressFromApi = typeof result?.progress === 'number' ? Math.round(result.progress) : null;
          const estimatedPercentage = Math.min(95, Math.max(progressFromApi ?? 0, Math.round((elapsedSeconds / estimatedTotalSeconds) * 100)));

          if (attempt % 3 === 0) {
            sendUpdate({ type: 'INFO', workflow, index, message: smsg.statusCheck(index, result.status || 'UNKNOWN', progressFromApi ?? '-', estimatedPercentage) });
          }

          sendUpdate({
            type: 'PROGRESS',
            workflow,
            index,
            processed,
            total: totalScenes,
            message: smsg.videoProcessing(index, estimatedPercentage),
          });
        }

        if (!videoUrl) {
          throw new Error(smsg.timeout);
        }

        sendUpdate({ type: 'INFO', workflow, message: smsg.downloading(index) });
        const videoData = await VEO_API.downloadVideo(videoUrl);

        const safeTitleBase = prompt.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 24) || `scene_${index}`;
        const fileName = `${safeTitleBase}_${Date.now()}.mp4`;
        const filePath = path.join(downloadPath, fileName);

        try {
          fs.mkdirSync(downloadPath, { recursive: true });
        } catch (_) {
          // ignore mkdir failure; writeFileSync will throw if it persists
        }

        fs.writeFileSync(filePath, videoData);

        successCount += 1;
        processed += 1;

        const normalizedFilePath = filePath.replace(/\\/g, '/');
        videoUrl = `file:///${encodeURI(normalizedFilePath)}`;

        sendUpdate({
          type: 'SCENE_COMPLETED',
          workflow,
          index,
          filePath,
          fileName,
          videoUrl,
          message: smsg.sceneCompleted(index, fileName),
        });

        // Kirim event VIDEO_COMPLETED agar pola sama dengan Generate Video
        sendUpdate({
          type: 'VIDEO_COMPLETED',
          workflow,
          operationId: shortId,
          shortId,
          prompt,
          filePath,
          fileName,
          videoUrl,
          message: smsg.videoCompleted(index, fileName),
        });

        sendUpdate({
          type: 'PROGRESS',
          workflow,
          processed,
          total: totalScenes,
          message: smsg.progressUpdate(processed, totalScenes),
        });
      } catch (error) {
        const httpStatus = error?.response?.status || null;
        const apiError = error?.response?.data?.error;
        let errorMessage = apiError?.message || error.message || String(error);
        
        // Deteksi HTTP status code dan beri label yang jelas
        let errorPrefix = '';
        if (httpStatus === 400) {
          errorPrefix = '[HTTP 400 - Bad Request] ';
        } else if (httpStatus === 403) {
          errorPrefix = '[HTTP 403 - Forbidden] ';
        } else if (httpStatus === 404) {
          errorPrefix = '[HTTP 404 - Not Found] ';
        } else if (httpStatus === 429) {
          errorPrefix = '[HTTP 429 - Rate Limit] ';
        } else if (httpStatus === 500) {
          errorPrefix = '[HTTP 500 - Server Error] ';
        } else if (httpStatus === 503) {
          errorPrefix = '[HTTP 503 - Service Unavailable] ';
        } else if (httpStatus) {
          errorPrefix = `[HTTP ${httpStatus}] `;
        }

        try {
          const details = apiError?.details;
          if (Array.isArray(details) && details.length > 0) {
            const badRequest = details.find((d) => d && typeof d === 'object' && String(d['@type'] || '').includes('BadRequest'));
            const violations = badRequest?.fieldViolations;
            if (Array.isArray(violations) && violations.length > 0) {
              const first = violations[0] || {};
              const field = first.field || 'unknown_field';
              const desc = first.description || 'no description';
              errorMessage += ` (field ${field}: ${desc})`;
            }
          }
        } catch (_) {
          // ignore
        }

        processed += 1;
        const promptLength = typeof prompt === 'string' ? prompt.length : 0;
        const fullErrorMessage = `${errorPrefix}${errorMessage} ${smsg.promptLength(promptLength)}`;
        
        sendUpdate({ type: 'SCENE_ERROR', workflow, index, message: smsg.sceneFailed(index, fullErrorMessage) });
        sendUpdate({ type: 'PROGRESS', workflow, processed, total: totalScenes, message: smsg.progressWithErrors(processed, totalScenes) });
      }
    };

    for (let start = 0; start < sceneList.length; start += CONCURRENCY) {
      const batch = sceneList.slice(start, start + CONCURRENCY);
      await Promise.allSettled(batch.map((scene, idx) => processScene(scene, start + idx)));
      
      // Delay antar batch untuk mengurangi tekanan ke API
      if (start + CONCURRENCY < sceneList.length) {
        await sleep(3000);
      }
    }

    sendUpdate({
      type: 'BATCH_COMPLETE',
      workflow,
      successCount,
      totalCount: totalScenes,
      message: smsg.batchComplete(successCount, totalScenes),
    });

    return {
      message: smsg.batchComplete(successCount, totalScenes),
      successCount,
      totalCount: totalScenes,
    };
  } catch (error) {
    const errorMessage = error.response?.data?.error?.message || error.message || String(error);
    sendUpdate({ type: 'ERROR', workflow, message: smsg.fatalError(errorMessage) });
    return { message: smsg.stoppedDueToError, error: errorMessage };
  }
}

module.exports = { VEO_API, runSceneVideoWorkflow, getSceneMsg };

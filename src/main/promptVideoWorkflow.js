// Video workflows consolidated (prompt-to-video and scene-based).
// Image-to-video flows remain in promptGeneratorWorkflow.js to avoid regression risk.
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { shell } = require('electron');
const { getRecaptchaToken, postFromLabsWindow, isRecaptchaEvaluationFailed } = require('./promptImageWorkflow.js');

const RECAPTCHA_ACTION = 'VIDEO_GENERATION';
const RECAPTCHA_ACTION_FALLBACK = 'PINHOLE_GENERATE_IMAGE';
const RECAPTCHA_APPLICATION_TYPE = 'RECAPTCHA_APPLICATION_TYPE_WEB';

// --- API Configuration ---
const API_ENDPOINTS = {
  GENERATE: 'https://aisandbox-pa.googleapis.com/v1/video:batchAsyncGenerateVideoText',
  STATUS: 'https://aisandbox-pa.googleapis.com/v1/video:batchCheckAsyncVideoGenerationStatus',
};

// Aspect ratio → model map for text-to-video
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

// --- Helpers ---
function normalizeBearerHeader(rawBearer) {
  const str = String(rawBearer || '');
  let cleaned = str.replace(/[\r\n]+/g, ' ').trim();
  if (!cleaned) {
    throw new Error('Bearer Token kosong atau tidak valid. Periksa halaman Pengaturan.');
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

function formatOutput(data, format = 'plain') {
  if (format === 'json') return JSON.stringify(data, null, 2);
  if (typeof data === 'object') {
    if (data.fileName) return `Video berhasil dibuat: ${data.fileName}`;
    return Object.entries(data)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
  }
  return String(data);
}

function parsePromptData(rawPrompt) {
  try {
    const obj = JSON.parse(rawPrompt);
    if (typeof obj === 'object' && obj.prompt) {
      return {
        generatedPrompt: obj.prompt,
        displayTitle: obj.title || obj.prompt?.slice(0, 50) || 'Prompt JSON',
      };
    }
  } catch (_) {
    // ignore parse error, treat as plain text
  }
  return {
    generatedPrompt: String(rawPrompt || ''),
    displayTitle: String(rawPrompt || '').slice(0, 50),
  };
}

// --- VEO API Client (text-to-video only) ---
const VEO_API = {
  generateVideo: async (prompt, bearerKey, aspectRatio, veoModel = '3.1-fast-low', resolution = '720p', flowProjectId = null) => {
    const { v4: uuidv4 } = await import('uuid');
    const mappedAspectRatio = ASPECT_RATIO_MAP[aspectRatio];
    const normalizedBearer = normalizeBearerHeader(bearerKey);

    const actions = [RECAPTCHA_ACTION, RECAPTCHA_ACTION_FALLBACK]
      .map((v) => String(v || '').trim())
      .filter(Boolean)
      .filter((v, i, arr) => arr.indexOf(v) === i);

    let lastErr = null;
    const modelAttempts = [veoModel, '3.1-fast']
      .map((v) => (typeof v === 'string' ? v.trim() : ''))
      .filter(Boolean)
      .filter((v, i, arr) => arr.indexOf(v) === i);

    for (const modelAttempt of modelAttempts) {
      const modelMap = mappedAspectRatio.models[modelAttempt];
      const modelKey = modelMap && modelMap[resolution];
      if (!modelKey) {
        lastErr = new Error(`Video model key tidak ditemukan untuk model ${modelAttempt} dan resolusi ${resolution}.`);
        continue;
      }

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
              const recaptchaContext = {
                token: recaptchaToken,
                applicationType: RECAPTCHA_APPLICATION_TYPE,
              };

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
                    metadata: { sceneId: uuidv4() },
                  },
                ],
              };

              console.log('[VIDEO_FLOW] generateVideo start', {
                promptPreview: (prompt || '').slice(0, 60),
                aspectRatio,
                veoModel: modelAttempt,
                resolution,
                action,
                candidateKey,
                projectId,
              });

              const data = await postFromLabsWindow({
                url: API_ENDPOINTS.GENERATE,
                bearer: normalizedBearer,
                contentType: 'text/plain;charset=UTF-8',
                body: JSON.stringify(payload),
              });

              const operationName = data?.operations?.[0]?.operation;
              const opId = operationName?.name;
              if (!opId) {
                throw new Error('Respons VEO tidak valid: operationId tidak ditemukan.');
              }

              const remainingCredits =
                typeof data?.remainingCredits === 'number' && Number.isFinite(data.remainingCredits)
                  ? data.remainingCredits
                  : undefined;

              console.log('[VIDEO_FLOW] generateVideo ok', { opId, remainingCredits, modelUsed: modelAttempt });
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
              throw candidateErr;
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
        console.warn('[VIDEO_FLOW] 429 encountered, retrying with next VEO model candidate...');
        continue;
      }
    }

    if (lastErr) throw lastErr;
    throw new Error('Gagal memanggil VEO: tidak ada reCAPTCHA action yang bisa dicoba.');
  },

  checkStatus: async (operationId, bearerKey) => {
    const normalizedBearer = normalizeBearerHeader(bearerKey);
    const opName = typeof operationId === 'string' ? operationId : operationId?.name || '';
    const body = { operations: [{ operation: { name: opName } }] };
    const { data } = await axios.post(API_ENDPOINTS.STATUS, body, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: normalizedBearer,
      },
    });

    const result = data?.operationResults?.[0];
    const alt = data?.operations?.[0];

    const status =
      result?.metadata?.state ||
      result?.metadata?.stateMessage ||
      result?.state ||
      alt?.status ||
      alt?.operation?.metadata?.state ||
      alt?.operation?.metadata?.statusMessage;

    const url =
      alt?.operation?.metadata?.video?.fifeUrl ||
      result?.operationResult?.videoResult?.videoUri ||
      alt?.operation?.metadata?.video?.videoUri ||
      alt?.operation?.metadata?.video?.gcsUri ||
      null;

    const progress =
      typeof result?.metadata?.progress === 'number'
        ? result.metadata.progress
        : typeof alt?.operation?.metadata?.progress === 'number'
          ? alt.operation.metadata.progress
          : null;

    const completedStates = [
      'MEDIA_GENERATION_STATUS_SUCCESSFUL',
      'MEDIA_GENERATION_STATUS_COMPLETED',
      'MEDIA_GENERATION_STATUS_FAILED',
    ];
    const completed = completedStates.includes(status);

    const errorMessage =
      result?.operationResult?.error?.message ||
      alt?.operation?.error?.message ||
      alt?.operation?.metadata?.terminalErrorMessage ||
      alt?.operation?.metadata?.statusMessage ||
      null;

    console.log('[VIDEO_FLOW] checkStatus', {
      opName,
      status,
      completed,
      hasUrl: Boolean(url),
      progress,
      errorMessage,
    });

    return { status, url, completed, progress, errorMessage };
  },

  downloadVideo: async (videoUrl) => {
    console.log('[VIDEO_FLOW] downloadVideo start', { urlPreview: (videoUrl || '').slice(0, 80) });
    const { data } = await axios.get(videoUrl, { responseType: 'arraybuffer' });
    console.log('[VIDEO_FLOW] downloadVideo ok', { dataSize: data?.length || 0 });
    return data;
  },
};

// --- Single video ---
async function generateSingleVideo({
  prompt,
  bearerKey,
  aspectRatio = '16:9',
  veoModel = '3.1-fast-low',
  resolution = '720p',
  flowProjectId = null,
  downloadPath,
  sendUpdate,
  uiLanguage = 'en',
}) {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const { getVideoMsg } = require('./promptGeneratorWorkflow.js');
  const vmsg = getVideoMsg(uiLanguage);

  try {
    sendUpdate({ type: 'INFO', message: vmsg.downloadingVideo });

    const normalizedModel = veoModel === '3.1-fast-low' ? '3.1-fast-low' : '3.1-fast-low';
    const startResult = await VEO_API.generateVideo(prompt, bearerKey, aspectRatio, normalizedModel, resolution, flowProjectId);

    const operationId = typeof startResult === 'string' ? startResult : startResult.operationId;
    const remainingCredits = startResult && typeof startResult === 'object' ? startResult.remainingCredits : undefined;
    const shortId = operationId.split('/').pop();

    sendUpdate({
      type: 'VIDEO_STARTED',
      workflow: 'Single Video',
      operationId: shortId,
      prompt,
      remainingCredits,
      message: vmsg.videoCreating(shortId),
    });

    let videoUrl = null;
    const startTime = Date.now();
    let lastStatus = null;
    let sameStatusCount = 0;

    const maxAttempts = veoModel === '3.1-fast-low' ? 90 : 30;
    const estimatedTotalSeconds = veoModel === '3.1-fast-low' ? 900 : 180;

    for (let i = 0; i < maxAttempts; i += 1) {
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
        sameStatusCount += 1;
        if (sameStatusCount >= 10) {
          throw new Error(vmsg.stuckStatus(result.status));
        }
      } else {
        lastStatus = result.status;
        sameStatusCount = 0;
      }

      if (result.progress) {
        const percentage = Math.round(result.progress * 100);
        sendUpdate({
          type: 'VIDEO_PROGRESS',
          workflow: 'Single Video',
          operationId: shortId,
          percentage,
          message: vmsg.generatingRealtime(percentage),
        });
      } else {
        const elapsedSeconds = (Date.now() - startTime) / 1000;
        const estimatedPercentage = Math.min(95, Math.round((elapsedSeconds / estimatedTotalSeconds) * 100));
        sendUpdate({
          type: 'VIDEO_PROGRESS',
          workflow: 'Single Video',
          operationId: shortId,
          percentage: estimatedPercentage,
          elapsedSeconds: Math.floor(elapsedSeconds),
          message:
            estimatedPercentage >= 95
              ? vmsg.finalizingVideo(Math.floor(elapsedSeconds), result.status || 'PENDING')
              : vmsg.generatingEstimated(estimatedPercentage),
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
      workflow: 'Single Video',
      message: vmsg.videoSuccess(fileName),
      filePath,
      operationId: shortId,
    });

    return { fileName, filePath };
  } catch (err) {
    const errorMsg = err?.response?.data?.error?.message || err?.response?.data || err.message;
    sendUpdate({ type: 'ERROR', workflow: 'Single Video', message: vmsg.videoError(errorMsg) });
    throw err;
  }
}

// --- Batch scene workflow (text-to-video per scene) ---
async function runSceneVideoWorkflow({
  bearerKey,
  downloadPath,
  aspectRatio = '16:9',
  veoModel = '3.1-fast-low',
  resolution = '720p',
  scenes = [],
  flowProjectId,
  sendUpdate,
}) {
  const workflow = 'Generate Scene';
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  try {
    if (!Array.isArray(scenes) || scenes.length === 0) {
      throw new Error('Tidak ada scene yang diberikan.');
    }

    const sceneList = scenes.map((scene, idx) => ({ ...scene, index: idx + 1 }));
    let successCount = 0;
    let processed = 0;
    const totalScenes = sceneList.length;

    for (let i = 0; i < sceneList.length; i += 1) {
      const scene = sceneList[i] || {};
      const index = typeof scene.index === 'number' ? scene.index : i + 1;
      const prompt = (scene.prompt || '').trim();

      sendUpdate({
        type: 'SCENE_STARTED',
        workflow,
        index,
        message: `Scene #${index}: memulai text-to-video...`,
      });

      try {
        const normalizedModel = veoModel === '3.1-fast-low' ? '3.1-fast-low' : '3.1-fast-low';
        const startResult = await VEO_API.generateVideo(prompt, bearerKey, aspectRatio, normalizedModel, resolution, flowProjectId);

        const opValue = typeof startResult === 'string' ? { operationId: startResult } : startResult;
        const shortId = opValue.operationId.split('/').pop();

        sendUpdate({
          type: 'INFO',
          workflow,
          message: `Scene #${index}: video sedang dibuat (ID: ${shortId})...`,
        });

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

        const maxAttempts = veoModel === '3.1-fast-low' ? 90 : 30;
        const estimatedTotalSeconds = veoModel === '3.1-fast-low' ? 900 : 180;

        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
          await sleep(10000);
          const result = await VEO_API.checkStatus(opValue.operationId, bearerKey);

          if (result.completed && result.url) {
            videoUrl = result.url;
            break;
          }

          if (result.status === 'MEDIA_GENERATION_STATUS_FAILED') {
            const reason = result.errorMessage || 'Video generation failed by API. Prompt mungkin melanggar policy.';
            throw new Error(reason);
          }

          const elapsedSeconds = (Date.now() - startTime) / 1000;
          const estimatedPercentage = Math.min(95, Math.round((elapsedSeconds / estimatedTotalSeconds) * 100));

          sendUpdate({
            type: 'PROGRESS',
            workflow,
            index,
            processed,
            total: totalScenes,
            message: `Scene #${index}: video masih diproses... (~${estimatedPercentage}%)`,
          });
        }

        if (!videoUrl) {
          throw new Error('Waktu tunggu habis, video tidak selesai dibuat.');
        }

        sendUpdate({
          type: 'INFO',
          workflow,
          message: `Scene #${index}: mengunduh video dari VEO...`,
        });

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

        sendUpdate({
          type: 'SCENE_COMPLETED',
          workflow,
          index,
          filePath,
          fileName,
          message: `Scene #${index} selesai. Video disimpan: ${fileName}.`,
        });

        sendUpdate({
          type: 'PROGRESS',
          workflow,
          processed,
          total: totalScenes,
          message: `Progress Generate Scene: ${processed}/${totalScenes} scene selesai.`,
        });
      } catch (error) {
        processed += 1;
        const errMsg = error?.response?.data?.error?.message || error?.message || String(error);
        sendUpdate({
          type: 'ERROR',
          workflow,
          index,
          message: `Scene #${index} gagal: ${errMsg}`,
        });
      }
    }

    sendUpdate({ type: 'BATCH_COMPLETE', workflow, successCount, totalCount: totalScenes });
    return { message: 'Generate Scene selesai.', successCount, totalScenes };
  } catch (error) {
    const errMsg = error?.response?.data?.error?.message || error?.message || String(error);
    sendUpdate({ type: 'ERROR', workflow, message: `FATAL: ${errMsg}` });
    return { message: 'Generate Scene dihentikan karena error.', error: errMsg };
  }
}

// --- Prompt batch workflow (text-to-video) ---
async function runPromptWorkflow(...args) {
  return require('./promptGeneratorWorkflow.js').runPromptWorkflow(...args);
}

async function runPromptGenerator(...args) {
  return require('./promptGeneratorWorkflow.js').runPromptGenerator(...args);
}

async function analyzeCharacterImageWithGemini(...args) {
  return require('./promptGeneratorWorkflow.js').analyzeCharacterImageWithGemini(...args);
}

async function callGeminiForScenes(...args) {
  return require('./promptGeneratorWorkflow.js').callGeminiForScenes(...args);
}

async function analyzeGeminiAudio(...args) {
  return require('./promptGeneratorWorkflow.js').analyzeGeminiAudio(...args);
}

module.exports = {
  runPromptWorkflow,
  runPromptGenerator,
  analyzeCharacterImageWithGemini,
  callGeminiForScenes,
  analyzeGeminiAudio,
  runSceneVideoWorkflow,
  generateSingleVideo,
};

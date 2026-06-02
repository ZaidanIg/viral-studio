// electron/preload.js
// Bridge between renderer (React) and Electron main process

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('zeoAPI', {
  startPromptBatch: (args) => ipcRenderer.invoke('start-prompt-batch', args),
  startVideoBatch: (args) => ipcRenderer.invoke('start-video-batch', args),
  startPromptImageWorkflow: (args) => ipcRenderer.invoke('start-prompt-image-workflow', args),
  generateSingleImage: (args) => ipcRenderer.invoke('generate-image-direct', args),
  generateSingleVideo: (args) => ipcRenderer.invoke('generate-video-direct', args),
  generateSceneVideo: (args) => ipcRenderer.invoke('generate-scene-video', args),
  testBearerToken: (args) => ipcRenderer.invoke('test-bearer-token', args),
  testApiKey: (args) => ipcRenderer.invoke('test-api-key', args),
  generateScenePrompt: (args) => ipcRenderer.invoke('generate-scene-prompt', args),
  startSceneWorkflow: (args) => ipcRenderer.invoke('start-scene-workflow', args),
  startAffiliateVideoWorkflow: (args) => ipcRenderer.invoke('start-affiliate-video-workflow', args),
  generateStorySceneImages: (args) => ipcRenderer.invoke('generate-story-scene-images', args),
  editStoryFrame: (args) => ipcRenderer.invoke('edit-story-frame', args),
  selectFolder: (args) => ipcRenderer.invoke('select-folder', args),
  getImageFiles: (args) => ipcRenderer.invoke('get-image-files', args),
  onBatchUpdate: (callback) => {
    const listener = (_event, update) => callback(update);
    ipcRenderer.on('batch-update', listener);
    return () => ipcRenderer.removeListener('batch-update', listener);
  },
  analyzeCharacterImage: (args) => ipcRenderer.invoke('analyze-character-image', args),
  generateAffiliateImages: (args) => ipcRenderer.invoke('generate-affiliate-images', args),
  licenseCheck: (args) => ipcRenderer.invoke('license-check', args),
  getLicenseInfo: (args) => ipcRenderer.invoke('license-get-info', args),
  clearLicenseMachine: (args) => ipcRenderer.invoke('license-clear-machine', args),
  setMainWindowSize: (args) => ipcRenderer.invoke('set-main-window-size', args),
  getUserAgent: () => ipcRenderer.invoke('get-user-agent'),
  refreshUserAgent: () => ipcRenderer.invoke('refresh-user-agent'),
  openTutorialWindow: (args) => ipcRenderer.invoke('open-tutorial-window', args),
  analyzeGeminiAudio: (args) => ipcRenderer.invoke('analyze-gemini-audio', args),
  generateAngleLabels: (args) => ipcRenderer.invoke('generate-angle-labels', args),
  openOAuthWindow: (url) => ipcRenderer.invoke('open-oauth-window', url),
});

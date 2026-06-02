const { ipcMain } = require('electron');
const characterService = require('../services/characterService');

function registerCharacterIpc() {
  ipcMain.handle('character:uploadImage', async (event, payload) => {
    try {
      console.log('[IPC Character] uploadImage');
      return await characterService.uploadImage(payload);
    } catch (error) {
      console.error('[IPC Character] Error:', error);
      throw new Error(error.message);
    }
  });

  ipcMain.handle('character:generate', async (event, payload) => {
    try {
      console.log('[IPC Character] generate');
      return await characterService.generate(payload);
    } catch (error) {
      console.error('[IPC Character] Error:', error);
      throw new Error(error.message);
    }
  });
}

module.exports = registerCharacterIpc;

const { ipcMain } = require('electron');
const marketingService = require('../services/marketingService');

function registerMarketingIpc() {
  ipcMain.handle('marketing:generateStoryboard', async (event, payload) => {
    try {
      console.log('[IPC Marketing] generateStoryboard');
      return await marketingService.generateStoryboard(payload);
    } catch (error) {
      console.error('[IPC Marketing] Error:', error);
      throw new Error(error.message);
    }
  });
}

module.exports = registerMarketingIpc;

const { ipcMain } = require('electron');
const productService = require('../services/productService');

function registerProductIpc() {
  ipcMain.handle('product:uploadImage', async (event, payload) => {
    try {
      console.log('[IPC Product] uploadImage');
      return await productService.uploadProductImage(payload);
    } catch (error) {
      console.error('[IPC Product] Error:', error);
      throw new Error(error.message);
    }
  });

  ipcMain.handle('product:generateScene', async (event, payload) => {
    try {
      console.log('[IPC Product] generateScene');
      return await productService.generateProductScene(payload);
    } catch (error) {
      console.error('[IPC Product] Error:', error);
      throw new Error(error.message);
    }
  });
}

module.exports = registerProductIpc;

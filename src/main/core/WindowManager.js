const { BrowserWindow } = require('electron');
const path = require('path');

class WindowManager {
  constructor() {
    this.mainWindow = null;
    this.hiddenLabsWindow = null;
  }

  createMainWindow() {
    if (this.mainWindow) return this.mainWindow;

    this.mainWindow = new BrowserWindow({
      width: 1280,
      height: 800,
      title: 'Viral Studio',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, '../preload.js')
      }
    });

    const isDev = process.env.NODE_ENV !== 'production';

    if (isDev) {
      this.mainWindow.loadURL('http://localhost:3000');
    } else {
      this.mainWindow.loadURL('http://localhost:3000');
    }

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    return this.mainWindow;
  }

  getMainWindow() {
    return this.mainWindow;
  }

  async getOrCreateHiddenLabsWindow() {
    if (this.hiddenLabsWindow) return this.hiddenLabsWindow;

    this.hiddenLabsWindow = new BrowserWindow({
      width: 1280,
      height: 800,
      show: true, // Keep true during dev for debugging/login
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        partition: 'persist:google-labs',
      }
    });

    await this.hiddenLabsWindow.loadURL('https://labs.google/fx/tools/flow/project/86f9aaba-3beb-427d-8dd8-9f567a25333f/edit/5f895e43-ee85-41b6-85ee-0bbed2486fa8');

    this.hiddenLabsWindow.on('closed', () => {
      this.hiddenLabsWindow = null;
    });

    return this.hiddenLabsWindow;
  }
}

// Export a singleton instance
module.exports = new WindowManager();

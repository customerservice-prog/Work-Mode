import { app, BrowserWindow, shell, dialog, screen } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_ORIGIN = 'http://127.0.0.1:3168';
const MAIN_URL = APP_ORIGIN + '/';
const fileDir = path.dirname(fileURLToPath(import.meta.url));
const iconPath = path.join(fileDir, 'assets', 'work-mode.ico');
let mainWindow = null;
let server = null;
let shutdownBrowser = null;
let isClosing = false;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('before-quit', event => {
    if (isClosing) return;
    isClosing = true;
    event.preventDefault();
    void (async () => {
      try {
        await Promise.race([
          shutdownBrowser?.(),
          new Promise(resolve => setTimeout(resolve, 1800))
        ]);
        if (server) {
          server.closeAllConnections();
          await new Promise(resolve => server.close(() => resolve()));
        }
      } catch (err) {
        console.error('Work-Mode shutdown:', err.message);
      } finally {
        app.quit();
      }
    })();
  });

  app.whenReady().then(async () => {
    try {
      // Load the existing browser agent within the installed desktop app.
      // Nothing listens on a public network address.
      process.env.WORKMODE_DESKTOP = '1';
      process.env.WORKMODE_EMBEDDED = '1';
      const operator = await import('../server.js');
      server = await operator.startLocalServer(3168);
      shutdownBrowser = operator.stopBrowser;
      app.setAppUserModelId('com.workmode.desktop');

      const area = screen.getPrimaryDisplay().workArea;
      // Fit small inexpensive laptops without requiring a 900px-wide window.
      const width = Math.max(700, Math.min(1280, area.width - 24));
      const height = Math.max(500, Math.min(820, area.height - 20));
      mainWindow = new BrowserWindow({
        width, height, minWidth: 700, minHeight: 500,
        autoHideMenuBar: true,
        show: false,
        backgroundColor: '#111218',
        icon: iconPath,
        title: 'Work-Mode',
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          webSecurity: true,
          backgroundThrottling: false
        }
      });

      const wc = mainWindow.webContents;
      wc.setWindowOpenHandler(({ url }) => {
        if (/^https:\/\//i.test(url)) void shell.openExternal(url).catch(() => {});
        return { action: 'deny' };
      });
      wc.on('will-navigate', (event, url) => {
        if (url !== MAIN_URL) {
          event.preventDefault();
          if (/^https:\/\//i.test(url)) void shell.openExternal(url).catch(() => {});
        }
      });
      wc.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
      mainWindow.once('ready-to-show', () => mainWindow?.show());
      mainWindow.on('closed', () => { mainWindow = null; });
      await mainWindow.loadURL(MAIN_URL);
    } catch (err) {
      dialog.showErrorBox('Work-Mode could not start',
        'The desktop app could not start its local browser assistant.\n\n' +
        String(err.message || err) +
        '\n\nIf another Work-Mode server is already running, close it and try again.');
      app.quit();
    }
  });
}

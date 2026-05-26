const { app, BrowserWindow, shell, ipcMain, dialog, protocol, Menu } = require('electron');
const path = require('path');
const { join } = require('path');
const fs = require('fs/promises');
const chokidar = require('chokidar');
const crypto = require('crypto');
const { pathToFileURL } = require('url');
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.error('Failed to load sharp:', e);
}

const { autoUpdater } = require('electron-updater');
const pluginManager = require('./managers/PluginManager.cjs');

// Setup detailed updater logging to stdout
autoUpdater.logger = {
  info(msg) { console.log('[updater]', msg); if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('updater-log', 'INFO: ' + msg); },
  warn(msg) { console.warn('[updater]', msg); if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('updater-log', 'WARN: ' + msg); },
  error(msg) { console.error('[updater]', msg); if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('updater-log', 'ERROR: ' + msg); },
  debug(msg) { console.debug('[updater]', msg); if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('updater-log', 'DEBUG: ' + msg); }
};

// autoUpdater config
let isAutoDownloadEnabled = false;
let windowState = {};
try {
  // Use synchronous fs to load settings before app is fully ready
  const fsSync = require('fs');
  const storePath = path.join(app.getPath('userData'), 'update-settings.json');
  if (fsSync.existsSync(storePath)) {
    const data = fsSync.readFileSync(storePath, 'utf8');
    const settings = JSON.parse(data);
    isAutoDownloadEnabled = settings.autoDownload === true;
  }
  
  const windowStatePath = path.join(app.getPath('userData'), 'window-state.json');
  if (fsSync.existsSync(windowStatePath)) {
    windowState = JSON.parse(fsSync.readFileSync(windowStatePath, 'utf8'));
  }
} catch (e) { }
autoUpdater.autoDownload = isAutoDownloadEnabled;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.disableDifferentialDownload = true; // Fix for GitHub Releases Checksum mismatch
autoUpdater.disableWebInstaller = true; // Fix warning
autoUpdater.forceDevUpdateConfig = true; // Allow checking in dev mode

const watchers = new Map(); // panelId -> watcher instance

// Register schemes as privileged
protocol.registerSchemesAsPrivileged([
  { scheme: 'media', privileges: { secure: true, supportFetchAPI: true, standard: true, bypassCSP: true } },
  { scheme: 'yiziview-plugin', privileges: { secure: true, supportFetchAPI: true, standard: true, bypassCSP: true } }
]);

// Prevent garbage collection
let mainWindow;

const WECHAT_APP_ID = "wxfc4cbbde568ce709";
const WECHAT_REDIRECT_URI = "https://wx-cloth-ehtgmbzhgb.cn-shenzhen.fcapp.run/client/wx_login_redirect";

function attachHtmlFriendlyHeaders(session) {
  session.webRequest.onHeadersReceived({ urls: ["*://*/*"] }, (details, callback) => {
    const responseHeaders = {};
    for (const [key, values] of Object.entries(details.responseHeaders || {})) {
      const k = key.toLowerCase();
      responseHeaders[k] = Array.isArray(values) ? [...values] : [String(values)];
    }

    const disposition = responseHeaders["content-disposition"]?.[0] ?? "";
    if (/attachment/i.test(disposition)) {
      delete responseHeaders["content-disposition"];
    }

    const ct0 = responseHeaders["content-type"]?.[0]?.split(";")[0]?.trim().toLowerCase() ?? "";
    if (
      ct0 === "application/octet-stream" ||
      ct0 === "binary/octet-stream" ||
      ct0 === "application/x-download" ||
      ct0 === "application/force-download" ||
      ct0 === "application/x-msdownload"||
      ct0 === "text/plain"
    ) {
      responseHeaders["content-type"] = ["text/html; charset=utf-8"];
    }

    callback({ responseHeaders });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: windowState.bounds?.width || 1200,
    height: windowState.bounds?.height || 800,
    x: windowState.bounds?.x,
    y: windowState.bounds?.y,
    show: false, // Don't show until ready-to-show
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false // Temporarily disable
    },
    titleBarStyle: 'hidden', // Custom title bar for that "premium" feel
    titleBarOverlay: {
      color: '#00000000',
      symbolColor: '#ffffff',
      height: 32
    },
    backgroundColor: '#1a1a1a', // Dark theme base
  });

  const isDev = !app.isPackaged;
  const devUrl = 'http://localhost:5173';
  const prodPath = join(__dirname, '../dist/index.html');

  if (isDev) {
    mainWindow.loadURL(devUrl);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(prodPath);
  }

  mainWindow.once('ready-to-show', () => {
    if (windowState.isMaximized) {
      mainWindow.maximize();
    }
    mainWindow.show();
    // Reset zoom level to 100% on startup to rescue from previous sessions
    mainWindow.webContents.setZoomLevel(0);
  });

  const saveWindowState = () => {
    try {
      if (!mainWindow.isDestroyed()) {
        const fsSync = require('fs');
        const statePath = path.join(app.getPath('userData'), 'window-state.json');
        const state = {
          bounds: mainWindow.getNormalBounds ? mainWindow.getNormalBounds() : mainWindow.getBounds(),
          isMaximized: mainWindow.isMaximized()
        };
        fsSync.writeFileSync(statePath, JSON.stringify(state));
      }
    } catch(e) {
      console.error('Failed to save window state:', e);
    }
  };

  mainWindow.on('close', saveWindowState);

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Handle Global Shortcuts and UI Zoom Locking
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown') {
      // Enable F12 to open DevTools
      if (input.key === 'F12') {
        mainWindow.webContents.toggleDevTools();
        event.preventDefault();
        return;
      }

      // Handle UI Zoom
      if (input.control || input.meta) {
        // Ctrl + 0: Reset Zoom (Rescue)
        if (input.key === '0') {
          mainWindow.webContents.setZoomLevel(0);
          event.preventDefault();
        }
        // Lock Zoom: Block Ctrl + Plus/Equal and Ctrl + Minus
        else if (input.key === '=' || input.key === '+' || input.key === '-') {
          // If the user wants to be able to zoom in once to get back, 
          // we could allow it, but since we reset it on startup and with Ctrl+0,
          // and they asked to "lock" it, we block these.
          event.preventDefault();
        }
      }
    }
  });
}

app.whenReady().then(async () => {
  // Initialize plugins FIRST (includes OTA file swap on disk)
  // Must happen BEFORE cache clearing so that stale bytecode for old plugin URLs is purged
  await pluginManager.init();

  // Clear all caches after OTA swap to prevent stale code contamination
  try {
    const { session } = require('electron');
    await session.defaultSession.clearCache(); // Clear HTTP disk cache (latest.yml + plugin assets)
    await session.defaultSession.clearCodeCaches({}); // Clear V8 compiled bytecode cache for ALL URLs
    const updaterCacheDir = path.join(app.getPath('appData'), '../Local', 'yiziview-updater', 'pending');
    await fs.rm(updaterCacheDir, { recursive: true, force: true });
    if (pluginManager.otaSwapPerformed) {
      console.log('[PluginManager] Post-swap cache purge complete (HTTP + CodeCache)');
    }
    console.log('[updater] Successfully cleared old updater temporary files and caches');
  } catch (e) {
    console.log('[updater] Clean up non-critical cache skipped:', e.message);
  }

  // Register protocol for serving local files
  protocol.registerFileProtocol('media', (request, callback) => {
    let url = request.url.replace('media://local/', '');
    url = url.replace('media://', ''); // robust fallback

    // Strip query strings or hash used for cache busting BEFORE decoding
    const questionMarkIndex = url.indexOf('?');
    if (questionMarkIndex !== -1) {
      url = url.substring(0, questionMarkIndex);
    }
    const hashIndex = url.indexOf('#');
    if (hashIndex !== -1) {
      url = url.substring(0, hashIndex);
    }

    url = decodeURIComponent(url);

    // Safety check just in case valid paths come through weirdly
    try {
      return callback(url);
    } catch (error) {
      console.error('Protocol error:', error);
      return callback(404);
    }
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // Check for updates shortly after startup
  if (app.isPackaged) {
    setTimeout(() => {
      autoUpdater.checkForUpdatesAndNotify().catch(console.error);
    }, 3000);
  }

  // --- PLUGIN HOT RELOAD (Development) ---
  if (!app.isPackaged) {
      console.log('[Dev] Starting Plugin Watcher for Hot Reload...');
      const pluginsPath = path.join(__dirname, '../plugins');
      const watcher = chokidar.watch(pluginsPath, {
          ignored: /(^|[\/\\])\../, // ignore dotfiles
          persistent: true,
          ignoreInitial: true,
      });

      let reloadTimeout = null;
      watcher.on('all', (event, filePath) => {
          if (filePath.endsWith('.js') || filePath.endsWith('.json') || filePath.endsWith('.css')) {
              // Debounce reload slightly
              clearTimeout(reloadTimeout);
              reloadTimeout = setTimeout(async () => {
                  console.log(`[Plugin HotReload] Triggered by ${event} in ${filePath}`);
                  await pluginManager.scanPlugins();
                  if (mainWindow && !mainWindow.isDestroyed()) {
                      mainWindow.webContents.send('plugin-changed');
                  }
              }, 200);
          }
      });
  }

});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC Handlers
ipcMain.handle('ping', () => 'pong');

ipcMain.handle('plugin-open-wx-login', async (event, payload) => {
  let state = payload;
  let needsPhone = true; // default to true to be safe
  if (typeof payload === 'object' && payload !== null) {
    state = payload.state;
    needsPhone = payload.needsPhone !== false;
  }

  const wxLoginUrl =
    "https://open.weixin.qq.com/connect/qrconnect?" +
    `appid=${WECHAT_APP_ID}&` +
    `redirect_uri=${encodeURIComponent(WECHAT_REDIRECT_URI)}&` +
    "response_type=code&" +
    "scope=snsapi_login&" +
    `state=${encodeURIComponent(state)}` +
    "#wechat_redirect";

  // 保证登录窗口是唯一的
  if (global.wxLoginWindow && !global.wxLoginWindow.isDestroyed()) {
    global.wxLoginWindow.focus();
  } else {
    global.wxLoginWindow = new BrowserWindow({
      parent: mainWindow,
      modal: false,
      width: 400,
      height: 500,
      resizable: false,
      minimizable: false,
      maximizable: false,
      autoHideMenuBar: true,
      alwaysOnTop: true,
      closable: true,
      title: 'WeChat Login — YiziView',
      backgroundColor: '#111111',
      webPreferences: {
        partition: `wxqr-unique`,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    global.wxLoginWindow.on('closed', () => {
      global.wxLoginWindow = null;
    });
  }
  const loginWindow = global.wxLoginWindow;

  attachHtmlFriendlyHeaders(loginWindow.webContents.session);
  loginWindow.loadURL(wxLoginUrl);

  let wxLoginClosedSent = false;

  // Inject dark theme CSS after the WeChat page finishes loading
  loginWindow.webContents.on('did-finish-load', () => {
    const currentUrl = loginWindow.webContents.getURL();
    
    // If it's the backend redirect page, replace the entire body with a custom UI
    if (currentUrl.startsWith(WECHAT_REDIRECT_URI)) {
      // 1. Kick off original login flow early
      if (!wxLoginClosedSent && !event.sender.isDestroyed()) {
        event.sender.send('wx-login-closed');
        wxLoginClosedSent = true;
      }

      const phoneHtml = needsPhone ? `
            <div style="margin-top: 30px; width: 100%; max-width: 260px; text-align: center; display: flex; flex-direction: column; gap: 12px; align-items: center;">
              <p style="color: #888; font-size: 12px; letter-spacing: 1px;">Please enter your mobile number<br>to complete registration</p>
              <input type="text" id="phone_input" placeholder="Phone Number" style="width: 200px; background: #222; border: 1px solid #444; color: white; padding: 10px 14px; border-radius: 6px; outline: none; text-align: center; font-size: 14px; letter-spacing: 1px;" />
              <button onclick="window.location.href='https://phone-submit/?phone=' + document.getElementById('phone_input').value" style="width: 200px; background: #3b82f6; border: none; color: white; padding: 10px 14px; border-radius: 6px; cursor: pointer; font-weight: bold; letter-spacing: 1px; margin-top: 4px;">CONTINUE</button>
            </div>
      ` : `
            <div style="margin-top: 30px; text-align: center;">
              <p style="color: #888; font-size: 13px;">Login Complete. You can now close this window.</p>
            </div>
      `;

      if (!needsPhone) {
        setTimeout(() => {
          if (loginWindow && !loginWindow.isDestroyed()) {
            loginWindow.close();
          }
        }, 1500);
      }

      loginWindow.webContents.executeJavaScript(`
        document.body.innerHTML = \`
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background-color: #111; color: #fff; font-family: ui-sans-serif, system-ui, sans-serif;">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 20px;">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            <h2 style="font-size: 16px; font-weight: 500; letter-spacing: 2px; color: #eee; margin: 0; text-align: center;">AUTHORIZATION SUCCESS</h2>
            \${ \`${phoneHtml}\` }
          </div>
        \`;
      `).catch(() => {});
    } else {
      // It's the WeChat QR code page
      loginWindow.webContents.insertCSS(`
        body, html {
          background: #111 !important;
          color: #ccc !important;
        }
        .wrp_code {
          background: #1a1a1a !important;
          border-radius: 12px !important;
          border: 1px solid #333 !important;
          padding: 20px !important;
        }
        .title {
          color: #eee !important;
        }
        .info {
          color: #888 !important;
        }
        .qrcode img, .impowerBox .qrcode img {
          border-radius: 8px !important;
        }
        /* Hide unnecessary WeChat branding noise */
        .status_browser, .faq, .os-tips, .norma498l_title_desc {
          display: none !important;
        }
        /* Overall container centering */
        .login_container, .qrcode_container, .wrp_code_login, .impowerBox {
          background: transparent !important;
        }
      `).catch(() => {});
    }
  });

  loginWindow.webContents.on('will-navigate', (e, url) => {
    if (url.startsWith('https://phone-submit/?phone=')) {
      e.preventDefault();
      const phone = new URL(url).searchParams.get('phone');
      if (phone && phone.trim() !== '' && !event.sender.isDestroyed()) {
        event.sender.send('wx-login-phone', phone.trim());
      }
      setTimeout(() => {
        if (loginWindow && !loginWindow.isDestroyed()) {
          loginWindow.close();
        }
      }, 300);
    }
  });

  loginWindow.on('close', () => {
    // Send event back to the window that requested it, if not yet sent
    if (!wxLoginClosedSent && !event.sender.isDestroyed()) {
      event.sender.send('wx-login-closed');
      wxLoginClosedSent = true;
    }
  });
  return true;
});

ipcMain.handle('get-plugins', () => {
    return pluginManager.getRendererPluginsConfig();
});

ipcMain.handle('get-ota-status', () => {
    return pluginManager.getOtaStatus();
});

ipcMain.handle('get-all-plugins', () => {
    return pluginManager.getAllPlugins();
});

ipcMain.on('plugin-open-dir', () => {
    pluginManager.openPluginDir();
});

ipcMain.handle('plugin-toggle', (event, { id, enabled }) => {
    pluginManager.togglePlugin(id, enabled);
    return true;
});

ipcMain.handle('plugin-delete', async (event, id) => {
    return await pluginManager.deletePlugin(id);
});

ipcMain.handle('plugin-download-asset', async (event, { url, outputPath }) => {
    const https = require('https');
    const http = require('http');
    const fs = require('fs');
    const path = require('path');
    
    return new Promise((resolve) => {
        try {
            fs.mkdirSync(path.dirname(outputPath), { recursive: true });
            const file = fs.createWriteStream(outputPath);
            
            const client = url.startsWith('https') ? https : http;
            client.get(url, (response) => {
                if (response.statusCode >= 200 && response.statusCode < 300) {
                    response.pipe(file);
                    file.on('finish', () => {
                        file.close(() => resolve({ success: true, path: outputPath }));
                    });
                } else {
                    file.close();
                    fs.unlink(outputPath, () => {});
                    resolve({ success: false, error: `HTTP ${response.statusCode}` });
                }
            }).on('error', (err) => {
                fs.unlink(outputPath, () => {});
                resolve({ success: false, error: err.message });
            });
        } catch (e) {
            resolve({ success: false, error: e.message });
        }
    });
});

ipcMain.handle('check-for-updates', async () => {
  try {
    const checkPromise = autoUpdater.checkForUpdates();
    const result = await Promise.race([
      checkPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Update check timed out after 20 seconds. Network issue?')), 20000))
    ]);
    return result ? { hasUpdate: true, version: result.updateInfo?.version } : null;
  } catch (error) {
    // Return a safe string error to avoid IPC serialization failures
    throw new Error(error.message || String(error));
  }
});
ipcMain.handle('install-update', () => autoUpdater.quitAndInstall(false, true));

let cancellationToken = null;
ipcMain.handle('download-update', async () => {
  try {
    const CancellationToken = require('builder-util-runtime').CancellationToken;
    cancellationToken = new CancellationToken();
    await autoUpdater.downloadUpdate(cancellationToken);
    return true;
  } catch (e) {
    throw new Error(e.message || String(e));
  }
});

ipcMain.handle('cancel-update', () => {
  if (cancellationToken) {
    cancellationToken.cancel();
    cancellationToken = null;
    // Reset state
    currentUpdateState = { state: 'idle', data: [] };
    if (mainWindow) {
      mainWindow.webContents.send('auto-update-state', currentUpdateState);
    }
    return true;
  }
  return false;
});

ipcMain.handle('get-auto-update-setting', () => isAutoDownloadEnabled);
ipcMain.handle('set-auto-update-setting', async (event, enabled) => {
  isAutoDownloadEnabled = enabled;
  autoUpdater.autoDownload = enabled;
  try {
    const storePath = path.join(app.getPath('userData'), 'update-settings.json');
    await fs.writeFile(storePath, JSON.stringify({ autoDownload: enabled }));
    return true;
  } catch (e) {
    return false;
  }
});

// Track the latest state to provide to frontend when requested
let currentUpdateState = { state: 'idle', data: [] };
ipcMain.handle('get-update-state', () => currentUpdateState);

// Forward auto-updater events to the renderer
const updaterEvents = [
  'checking-for-update',
  'update-available',
  'update-not-available',
  'error',
  'download-progress',
  'update-downloaded'
];

updaterEvents.forEach(eventName => {
  autoUpdater.on(eventName, (...args) => {
    let data = [];
    try {
      if (eventName === 'error' && args[0]) {
        data = [args[0].message || String(args[0])];
      } else if (eventName === 'download-progress' && args[0]) {
        data = [{ percent: args[0].percent || 0 }];
      } else if (eventName === 'update-available' && args[0]) {
        data = [{ version: args[0].version || 'unknown' }];
      } else if (eventName === 'update-downloaded') {
        data = []; // Do not pass Info to prevent IPC serialization fail
      }
    } catch (e) {
      console.error('Error extracting updater event args', e);
    }

    currentUpdateState = { state: eventName, data };

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('auto-update-state', currentUpdateState);
    }
  });
});

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle('scan-folder', async (event, args) => {
  // Support both old signature (string) and new ({ path, panelId })
  const folderPath = typeof args === 'string' ? args : args.path;
  const panelId = typeof args === 'object' ? args.panelId : 'default';
  const isRecursive = typeof args === 'object' ? args.isRecursive : false;

  try {
    // 1. Manage Watcher for this panel
    let w;
    const existingEntry = watchers.get(panelId);

    // Check if we can reuse the existing watcher
    // We now store { path, watcher } in the map
    if (existingEntry && existingEntry.path === folderPath && existingEntry.watcher) {
      w = existingEntry.watcher;
      // Clean up old listeners to prevent duplicates (since event.sender might have changed although unlikely in same session)
      w.removeAllListeners('add');
      w.removeAllListeners('unlink');
    } else {
      // Close old watcher if it exists
      if (existingEntry) {
        // Handle both legacy (direct watcher) and new ({watcher}) format
        const oldW = existingEntry.watcher || existingEntry;
        if (oldW && typeof oldW.close === 'function') {
          await oldW.close();
        }
      }

      w = chokidar.watch(folderPath, {
        ignored: /(^|[\/\\])\../, // ignore dotfiles
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: {
          stabilityThreshold: 100,
          pollInterval: 100
        },
        depth: isRecursive ? undefined : 0
      });

      watchers.set(panelId, { path: folderPath, watcher: w });
    }

    w.on('add', (path) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('folder-change', { type: 'add', path });
      }
    });

    w.on('unlink', (path) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('folder-change', { type: 'unlink', path });
      }
    });

    // 2. Read Files
    let filePaths = [];
    if (isRecursive) {
      const ignoreDirs = ['.git', 'node_modules', '.vscode', 'build', 'dist', '.yizi-thumbnails', '.thumbcache'];
      const walkDirIterative = async (rootDir, maxDepth = 20) => {
          const out = [];
          // queue of { dir, depth }
          const queue = [{ dir: rootDir, depth: 0 }];

          while (queue.length > 0) {
              const { dir: currentDir, depth } = queue.shift();
              if (depth > maxDepth) continue;

              let entries = [];
              try {
                  entries = await fs.readdir(currentDir, { withFileTypes: true });
              } catch (e) {
                  // Ignore permissions error or missing folders
                  continue;
              }

              for (const entry of entries) {
                  if (entry.isDirectory()) {
                      if (!entry.name.startsWith('.') && !ignoreDirs.includes(entry.name)) {
                          queue.push({ dir: path.join(currentDir, entry.name), depth: depth + 1 });
                      }
                  } else if (entry.isFile()) {
                      out.push(path.join(currentDir, entry.name));
                  }
              }
          }
          return out;
      };
      filePaths = await walkDirIterative(folderPath);
    } else {
      const files = await fs.readdir(folderPath);
      filePaths = files.map(file => path.join(folderPath, file));
    }

    console.log(`[Scan] Scanning ${folderPath}${isRecursive ? ' (Recursive)' : ''}, found ${filePaths.length} files`);

    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.mp4', '.webm', '.mov', '.mkv'];
    
    // Map full paths to image objects
    const images = await Promise.all(filePaths
      .filter(fullPath => {
        const ext = path.extname(fullPath).toLowerCase();
        return imageExtensions.includes(ext);
      })
      .map(async fullPath => {
        const file = path.basename(fullPath);
        const fileUrl = pathToFileURL(fullPath).href; // file:///C:/...
        const mediaUrl = fileUrl.replace('file:///', 'media://local/');
        
        let subDir = '';
        if (isRecursive) {
            const relPath = path.relative(folderPath, fullPath);
            const parentDir = path.dirname(relPath);
            if (parentDir !== '.' && parentDir !== '') {
                // Ensure front-slashes for consistent cross-platform display
                subDir = parentDir.split(path.sep).join('/');
            }
        }

        let stats = { size: 0, mtimeMs: 0 };
        try {
          stats = await fs.stat(fullPath);
        } catch (e) {
          // ignore
        }

        return {
          name: file,
          path: fullPath,
          url: mediaUrl,
          size: stats.size,
          mtimeMs: stats.mtimeMs,
          subDir: subDir
        };
      }));

    console.log(`[Scan] Returning ${images.length} images`);
    return images;
  } catch (error) {
    console.error('Error scanning folder:', error);
    return [];
  }
});

ipcMain.handle('trash-file', async (event, filePath) => {
  try {
    // Normalize path to handle mixed slashes or relative paths
    const p = path.normalize(filePath);
    await shell.trashItem(p);

    // Cleanup Metadata (Tags)
    try {
      const data = await fs.readFile(fileTagsPath, 'utf-8');
      const fileTags = JSON.parse(data);

      // Normalize the deleted file path for comparison
      const normalizedDeletedPath = path.normalize(filePath).toLowerCase();

      // Find and remove all matching entries (handles different path formats)
      let changed = false;
      for (const key of Object.keys(fileTags)) {
        const normalizedKey = path.normalize(key).toLowerCase();
        if (normalizedKey === normalizedDeletedPath) {
          delete fileTags[key];
          changed = true;
          console.log(`Cleaned up tag entry for deleted file: ${key}`);
        }
      }

      if (changed) {
        await fs.writeFile(fileTagsPath, JSON.stringify(fileTags, null, 2));
      }
    } catch (e) {
      // Ignore tag cleanup errors
      console.error('Error cleaning up tags:', e);
    }

    // Cleanup Thumbnail
    try {
      const cacheDir = path.join(app.getPath('userData'), 'thumbnails');
      const hash = crypto.createHash('md5').update(filePath).digest('hex');
      const cachePath = path.join(cacheDir, `${hash}.jpg`);
      await fs.unlink(cachePath);
    } catch (e) {
      // Ignore thumbnail cleanup errors (might not exist)
    }

    return true;
  } catch (error) {
    console.error(`Error trashing file (${filePath}):`, error);
    // If file doesn't exist, loop through checking?
    // Actually, sometimes 'Failed to parse path' is due to invalid chars.
    return false;
  }
});

ipcMain.handle('show-item-in-folder', async (event, filePath) => {
  shell.showItemInFolder(filePath);
  return true;
});

ipcMain.handle('create-folder', async (event, { parentPath, folderName }) => {
  try {
    const fullPath = path.join(parentPath, folderName);
    await fs.mkdir(fullPath);
    return true;
  } catch (error) {
    console.error('Error creating folder:', error);
    return false;
  }
});

ipcMain.handle('rename-item', async (event, { oldPath, newName }) => {
  try {
    const dir = path.dirname(oldPath);
    const newPath = path.join(dir, newName);
    await fs.rename(oldPath, newPath);
    return true;
  } catch (err) {
    console.error('Rename failed', err);
    return false;
  }
});

// ============================================
// STS PLUGIN OTA UPDATER HANDLER
// ============================================
ipcMain.handle('plugin-sts-update-download', async (event, { url, sha256Checksum }) => {
  const https = require('https');
  const crypto = require('crypto');
  const { execSync } = require('child_process');
  
  return new Promise(async (resolve, reject) => {
    try {
      console.log(`[PluginUpdater] Starting secure download...`);
      const pluginsDir = path.join(app.getPath('userData'), 'plugins');
      const tempUpdatesDir = path.join(pluginsDir, '.temp-updates');
      
      // Ensure temp directory exists
      await fs.mkdir(tempUpdatesDir, { recursive: true });
      
      const zipPath = path.join(tempUpdatesDir, 'aistudio.zip');
      const extractTarget = path.join(tempUpdatesDir, 'Yizi-studio-AIstudio-new');
      
      // Clean up previous artifacts
      try { await fs.rm(zipPath, { force: true }); } catch (e) {}
      try { await fs.rm(extractTarget, { recursive: true, force: true }); } catch (e) {}

      // Download file stream
      const fileStream = require('fs').createWriteStream(zipPath);
      
      const requestLib = url.startsWith('https:') ? require('https') : require('http');
      requestLib.get(url, (response) => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          return reject(new Error(`[PluginUpdater] HTTP Failed: ${response.statusCode}`));
        }

        const totalBytes = parseInt(response.headers['content-length'], 10);
        let downloadedBytes = 0;

        response.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          // Send progress to renderer
          if (!event.sender.isDestroyed()) {
             event.sender.send('plugin-update-progress', {
                 percent: totalBytes ? Math.round((downloadedBytes / totalBytes) * 100) : 0
             });
          }
        });

        response.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close(async () => {
             console.log(`[PluginUpdater] Download finished. Verifying SHA-256...`);
             try {
                // Verify SHA256 integrity
                const fileBuffer = await fs.readFile(zipPath);
                const hashSum = crypto.createHash('sha256');
                hashSum.update(fileBuffer);
                const localHash = hashSum.digest('hex');

                if (localHash !== sha256Checksum) {
                   await fs.rm(zipPath, { force: true });
                   return reject(new Error(`[PluginUpdater] CRITICAL: SHA-256 checksum mismatch! Expected ${sha256Checksum}, got ${localHash}. File deleted.`));
                }
                
                console.log(`[PluginUpdater] SHA-256 Validated! Extracting...`);
                // Extract using Windows Native PowerShell to avoid dependencies
                await fs.mkdir(extractTarget, { recursive: true });
                const psCommand = `Expand-Archive -Path "${zipPath}" -DestinationPath "${extractTarget}" -Force`;
                execSync(psCommand, { shell: 'powershell.exe', stdio: 'ignore' });
                
                console.log(`[PluginUpdater] Extraction completed!`);
                await fs.rm(zipPath, { force: true });
                resolve({ success: true });

             } catch (validationErr) {
                 reject(validationErr);
             }
          });
        });
      }).on('error', (err) => {
        fs.unlink(zipPath).catch(()=>{});
        reject(new Error(`[PluginUpdater] Network error: ${err.message}`));
      });

    } catch (err) {
      reject(new Error(`[PluginUpdater] Preparation error: ${err.message}`));
    }
  });
});

ipcMain.handle('app-relaunch', () => {
  console.log('[System] Restarting application due to plugin update...');
  app.relaunch();
  app.exit(0);
});



ipcMain.handle('move-items', async (event, { sourcePaths, targetPath }) => {
  // Move files/folders to targetPath
  let successCount = 0;
  const pathUpdates = []; // Track {oldPath, newPath} for tag updates

  for (const src of sourcePaths) {
    try {
      const fileName = path.basename(src);
      const dest = path.join(targetPath, fileName);
      try {
        await fs.rename(src, dest);
      } catch (err) {
        if (err.code === 'EXDEV') {
          // Cross-device move: copy then delete
          await fs.cp(src, dest, { recursive: true });
          await fs.rm(src, { recursive: true, force: true });
        } else {
          throw err;
        }
      }

      // Track path change for tag updates
      pathUpdates.push({ oldPath: src, newPath: dest });
      successCount++;
    } catch (error) {
      console.error(`Error moving ${src}:`, error);
    }
  }

  // Update tag database with new paths
  if (pathUpdates.length > 0) {
    try {
      let fileTags = {};
      try {
        const data = await fs.readFile(fileTagsPath, 'utf-8');
        fileTags = JSON.parse(data);
      } catch (e) { }

      let changed = false;
      for (const { oldPath, newPath } of pathUpdates) {
        // Update direct file paths
        if (fileTags[oldPath]) {
          fileTags[newPath] = fileTags[oldPath];
          delete fileTags[oldPath];
          changed = true;
        }

        // Update paths for files inside moved folders
        const oldPathPrefix = oldPath + path.sep;
        const newPathPrefix = newPath + path.sep;
        for (const filePath in fileTags) {
          if (filePath.startsWith(oldPathPrefix)) {
            const relativePath = filePath.substring(oldPathPrefix.length);
            const updatedPath = path.join(newPathPrefix, relativePath);
            fileTags[updatedPath] = fileTags[filePath];
            delete fileTags[filePath];
            changed = true;
          }
        }
      }

      if (changed) {
        await fs.writeFile(fileTagsPath, JSON.stringify(fileTags, null, 2));
      }
    } catch (error) {
      console.error('Error updating tag database after move:', error);
    }
  }

  return successCount;
});

ipcMain.handle('copy-items', async (event, { sourcePaths, targetPath, overwrite = false }) => {
  let successCount = 0;
  for (const src of sourcePaths) {
    try {
      const fileName = path.basename(src);
      let dest = path.join(targetPath, fileName);

      if (!overwrite) {
        // Check collision and auto-rename if not overwriting
        try {
          await fs.access(dest);
          // If exist, generate new name
          const ext = path.extname(fileName);
          const nameBody = path.basename(fileName, ext);
          let counter = 1;
          while (true) {
            const newName = `${nameBody} (Copy${counter > 1 ? ' ' + counter : ''})${ext}`;
            dest = path.join(targetPath, newName);
            try {
              await fs.access(dest);
              counter++;
            } catch {
              break;
            }
          }
        } catch (e) {
          // Dest likely doesn't exist, proceed
        }
      }

      await fs.cp(src, dest, { recursive: true });
      successCount++;
    } catch (error) {
      console.error(`Error copying ${src}:`, error);
    }
  }
  return successCount;
});

ipcMain.handle('check-collisions', async (event, { sourcePaths, targetPath }) => {
  const collisions = [];
  for (const src of sourcePaths) {
    const fileName = path.basename(src);
    const dest = path.join(targetPath, fileName);
    // If we're dropping/pasting in the exact same directory, it's not a standard overwrite collision,
    // it's an auto-copying action. No need to flag it as conflicting in the prompt.
    if (path.normalize(src).toLowerCase() === path.normalize(dest).toLowerCase()) {
      continue;
    }
    try {
      await fs.access(dest);
      collisions.push(fileName);
    } catch (e) {
      // Doesn't exist
    }
  }
  return collisions;
});

ipcMain.on('show-context-menu', (event, filePath) => {
  const template = [
    {
      label: 'Delete to Recycle Bin',
      click: () => {
        event.sender.send('context-menu-command', 'delete', filePath);
      }
    },
    { type: 'separator' },
    {
      label: 'Show in Explorer',
      click: () => {
        shell.showItemInFolder(filePath);
      }
    }
  ];
  const menu = Menu.buildFromTemplate(template);
  menu.popup({ window: BrowserWindow.fromWebContents(event.sender) });
});

const hasSubdirectories = async (dirPath) => {
  try {
    const dir = await fs.opendir(dirPath);
    let hasSub = false;
    for await (const dirent of dir) {
      if (dirent.isDirectory() && !dirent.name.startsWith('.')) {
        hasSub = true;
        break; // Found one, no need to continue
      }
    }
    return hasSub;
  } catch (error) {
    return false;
  }
};

ipcMain.handle('get-subdirectories', async (event, folderPath) => {
  try {
    const dirents = await fs.readdir(folderPath, { withFileTypes: true });
    // Filter first (Exclude dots, and common junk)
    const ignoredFolders = new Set(['node_modules', '__pycache__', '$RECYCLE.BIN', 'System Volume Information', '.git', '.vs', '.idea', '.vscode']);
    const folders = dirents.filter(dirent =>
      dirent.isDirectory() &&
      !dirent.name.startsWith('.') &&
      !ignoredFolders.has(dirent.name)
    );

    // Then check each for children (parallel)
    const result = await Promise.all(folders.map(async (dirent) => {
      const fullPath = path.join(folderPath, dirent.name);
      return {
        name: dirent.name,
        path: fullPath,
        hasChildren: await hasSubdirectories(fullPath)
      };
    }));

    return result;
  } catch (error) {
    console.error('Error reading subdirectories for:', folderPath, error);
    return [];
  }
});

ipcMain.handle('check-has-subdirectories', async (event, folderPath) => {
  return await hasSubdirectories(folderPath);
});

ipcMain.handle('search-folders', async (event, { roots, query }) => {
  const ignoredFolders = new Set(['node_modules', '__pycache__', '$RECYCLE.BIN', 'System Volume Information', '.git', '.vs', '.idea', '.vscode']);
  const results = [];
  const queryLower = query.toLowerCase();
  
  const searchDir = async (dirPath, currentDepth) => {
    if (currentDepth > 10) return;
    try {
      const dirents = await fs.readdir(dirPath, { withFileTypes: true });
      for (const dirent of dirents) {
        if (dirent.isDirectory() && !dirent.name.startsWith('.') && !ignoredFolders.has(dirent.name)) {
          const fullPath = path.join(dirPath, dirent.name);
          if (dirent.name.toLowerCase().includes(queryLower)) {
            // Found a match
            results.push({ name: dirent.name, path: fullPath, hasChildren: null });
          }
          await searchDir(fullPath, currentDepth + 1);
        }
      }
    } catch (e) {
      // ignore access errors
    }
  };

  await Promise.all(roots.map(root => searchDir(root, 0)));
  
  // Also check if the roots themselves match
  for (const root of roots) {
    const rootName = path.basename(root);
    if (rootName.toLowerCase().includes(queryLower)) {
      results.push({ name: rootName, path: root, hasChildren: null });
    }
  }

  const uniqueResults = [];
  const seenPaths = new Set();
  for (const r of results) {
    if (!seenPaths.has(r.path)) {
      seenPaths.add(r.path);
      uniqueResults.push(r);
    }
  }
  
  uniqueResults.sort((a, b) => a.name.localeCompare(b.name));
  return uniqueResults;
});

const favoritesPath = path.join(app.getPath('userData'), 'folders.json');

ipcMain.handle('get-favorites', async () => {
  try {
    const data = await fs.readFile(favoritesPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    // If file doesn't exist or error, return empty array
    return [];
  }
});

ipcMain.handle('save-favorites', async (event, favorites) => {
  try {
    await fs.writeFile(favoritesPath, JSON.stringify(favorites, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving favorites:', error);
    return false;
  }
});

// --- Expanded Folders Persistence ---
const expandedFoldersPath = path.join(app.getPath('userData'), 'expanded_folders.json');
let expandedFoldersCache = new Set();
let expandedFoldersLoaded = false;

const loadExpandedFolders = async () => {
  if (expandedFoldersLoaded) return;
  try {
    const data = await fs.readFile(expandedFoldersPath, 'utf-8');
    expandedFoldersCache = new Set(JSON.parse(data));
  } catch (e) {
    expandedFoldersCache = new Set();
  }
  expandedFoldersLoaded = true;
};

// Auto-save debounce
let saveExpandedTimeout = null;
const saveExpandedFolders = () => {
  if (saveExpandedTimeout) clearTimeout(saveExpandedTimeout);
  saveExpandedTimeout = setTimeout(async () => {
    try {
      await fs.writeFile(expandedFoldersPath, JSON.stringify([...expandedFoldersCache], null, 2));
    } catch (e) {
      console.error('Failed to save expanded folders:', e);
    }
  }, 1000); // Save after 1s of inactivity
};

// Crop Image
ipcMain.handle('crop-image', async (event, { imagePath, cropData }) => {
  try {
    const ext = path.extname(imagePath);
    const basename = path.basename(imagePath, ext);
    const dir = path.dirname(imagePath);

    // Always write to a temporary file first to avoid sharp lock errors
    const tempPath = path.join(dir, `${basename}_temp_${Date.now()}${ext}`);
    // Determine the final output path based on overwrite flag inside cropData
    const finalPath = cropData.overwrite ? imagePath : path.join(dir, `${basename}_crop_${Date.now()}${ext}`);

    const fileBuffer = await fs.readFile(imagePath);
    let pipeline = sharp(fileBuffer);

    if (cropData.rotation) {
      // For rotated images, the bounding area changes. Get exact dimensions first.
      const rotated = await pipeline.rotate(cropData.rotation).toBuffer({ resolveWithObject: true });

      let left = Math.round(cropData.x);
      let top = Math.round(cropData.y);
      let width = Math.round(cropData.width);
      let height = Math.round(cropData.height);

      if (left < 0) left = 0;
      if (top < 0) top = 0;
      
      if (left + width > rotated.info.width) {
        left = Math.max(0, rotated.info.width - width);
        if (left + width > rotated.info.width) width = rotated.info.width - left;
      }
      
      if (top + height > rotated.info.height) {
        top = Math.max(0, rotated.info.height - height);
        if (top + height > rotated.info.height) height = rotated.info.height - top;
      }

      // Extract based on the safe parameters, from the rotated buffer.
      pipeline = sharp(rotated.data).extract({ left, top, width, height });
    } else {
      const meta = await pipeline.metadata();
      let left = Math.round(cropData.x);
      let top = Math.round(cropData.y);
      let width = Math.round(cropData.width);
      let height = Math.round(cropData.height);

      // Clamp to image bounds to prevent Sharp extraction errors
      if (left < 0) left = 0;
      if (top < 0) top = 0;
      if (left + width > meta.width) width = meta.width - left;
      if (top + height > meta.height) height = meta.height - top;
      if (width <= 0 || height <= 0) {
        return { success: false, error: 'Crop area is empty after clamping.' };
      }

      pipeline = sharp(fileBuffer).extract({ left, top, width, height });
    }

    if (cropData.targetWidth || cropData.targetHeight) {
      pipeline = pipeline.resize({
        width: cropData.targetWidth || null,
        height: cropData.targetHeight || null,
        fit: 'inside'
      });
    }

    await pipeline.toFile(tempPath);

    // Replace the target file using fs.rename.
    // If overwrite is true, this replaces the original file.
    await fs.rename(tempPath, finalPath);

    if (cropData.overwrite) {
      try {
        // Invalidate thumbnail cache for the overwritten file
        const cacheDir = path.join(app.getPath('userData'), 'thumbnails');
        const hash = crypto.createHash('md5').update(finalPath).digest('hex');

        // Delete all sizes for this hash
        const files = await fs.readdir(cacheDir);
        for (const file of files) {
          if (file.startsWith(hash)) {
            await fs.unlink(path.join(cacheDir, file));
          }
        }
      } catch (e) {
        console.error('Failed to cleanup thumbnail cache for cropped image:', e);
      }
    }

    return { success: true, path: finalPath, timestamp: Date.now() };
  } catch (error) {
    console.error('Failed to crop image:', error);
    return { success: false, error: error.message };
  }
});

// Save Edited Image (from canvas data URL)
ipcMain.handle('save-edited-image', async (event, { imagePath, dataUrl, overwrite }) => {
  try {
    const ext = path.extname(imagePath);
    const basename = path.basename(imagePath, ext);
    const dir = path.dirname(imagePath);

    const tempPath = path.join(dir, `${basename}_temp_${Date.now()}${ext}`);
    const finalPath = overwrite ? imagePath : path.join(dir, `${basename}_edit_${Date.now()}${ext}`);

    // Decode base64 data URL to buffer
    const base64Data = dataUrl.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const lowerExt = ext.toLowerCase();
    if (lowerExt === '.svg') {
      // Direct file write for vector SVGs to bypass Sharp rasterization
      await fs.writeFile(tempPath, buffer);
    } else {
      // Use sharp to convert to the correct format
      let pipeline = sharp(buffer);
      if (lowerExt === '.jpg' || lowerExt === '.jpeg') {
        pipeline = pipeline.jpeg({ quality: 95 });
      } else if (lowerExt === '.png') {
        pipeline = pipeline.png();
      } else if (lowerExt === '.webp') {
        pipeline = pipeline.webp({ quality: 95 });
      }

      await pipeline.toFile(tempPath);
    }
    await fs.rename(tempPath, finalPath);

    if (overwrite) {
      try {
        const cacheDir = path.join(app.getPath('userData'), 'thumbnails');
        const hash = crypto.createHash('md5').update(finalPath).digest('hex');
        const files = await fs.readdir(cacheDir);
        for (const file of files) {
          if (file.startsWith(hash)) {
            await fs.unlink(path.join(cacheDir, file));
          }
        }
      } catch (e) {
        console.error('Failed to cleanup thumbnail cache for edited image:', e);
      }
    }

    return { success: true, path: finalPath, timestamp: Date.now() };
  } catch (error) {
    console.error('Failed to save edited image:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-expanded-folders', async () => {
  await loadExpandedFolders();
  return [...expandedFoldersCache];
});

ipcMain.handle('set-folder-expanded', async (event, { path: folderPath, expanded }) => {
  await loadExpandedFolders();
  if (expanded) {
    expandedFoldersCache.add(folderPath);
  } else {
    expandedFoldersCache.delete(folderPath);
  }
  saveExpandedFolders();
  return true;
});

ipcMain.handle('collapse-all-expanded-folders', async () => {
  await loadExpandedFolders();
  expandedFoldersCache.clear();
  saveExpandedFolders();
  return true;
});

ipcMain.handle('read-library-files', async (event, dirPath) => {
  try {
    const fsNode = require('fs');
    if (!fsNode.existsSync(dirPath)) return [];
    
    // Safety check if dir is actually a dir
    const stat = fsNode.statSync(dirPath);
    if (!stat.isDirectory()) return [];

    const files = fsNode.readdirSync(dirPath);
    return files.filter(f => f.endsWith('.txt')).map(f => ({
        name: f,
        path: path.join(dirPath, f)
    }));
  } catch (e) {
    console.error('read-library-files error:', e);
    return [];
  }
});

const sessionPath = path.join(app.getPath('userData'), 'session.json');

ipcMain.handle('get-session', async () => {
  try {
    const data = await fs.readFile(sessionPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
});

ipcMain.handle('save-session', async (event, session) => {
  try {
    await fs.writeFile(sessionPath, JSON.stringify(session, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving session:', error);
    return false;
  }
});

ipcMain.on('start-drag', (event, filePaths) => {
  const iconName = path.join(__dirname, 'assets', 'drag_icon.png');

  if (Array.isArray(filePaths) && filePaths.length > 1) {
    event.sender.startDrag({
      files: filePaths,
      icon: iconName
    });
  } else {
    // Single file fallback (or if array has 1)
    const file = Array.isArray(filePaths) ? filePaths[0] : filePaths;
    event.sender.startDrag({
      file: file,
      icon: iconName
    });
  }
});

const { clipboard } = require('electron');

ipcMain.handle('copy-to-clipboard', async (event, filePaths) => {
  try {
    // Join paths with comma, wrap in single quotes, escape existing single quotes
    // Escape for PowerShell single-quoted strings: only single quotes need doubling
    // Also wrap the entire -Command in a script block to avoid interpretation issues
    const pathsArg = filePaths.map(p => `'${p.replace(/'/g, "''")}'`).join(',');
    const command = `powershell -ExecutionPolicy Bypass -NoProfile -Command "& { Set-Clipboard -Path ${pathsArg} }"`;

    const { exec } = require('child_process');
    return new Promise((resolve) => {
      exec(command, (error) => {
        if (error) {
          console.error('Clipboard Write Error:', error);
          // Fallback to text (better than nothing)
          clipboard.writeText(filePaths.join('\n'));
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  } catch (e) {
    console.error('Clipboard copy error:', e);
    return false;
  }
});

const tagsPath = path.join(app.getPath('userData'), 'tags.json');

ipcMain.handle('get-tags', async () => {
  try {
    const data = await fs.readFile(tagsPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
});

ipcMain.handle('create-tag', async (event, tagName) => {
  try {
    let tags = [];
    try {
      const data = await fs.readFile(tagsPath, 'utf-8');
      tags = JSON.parse(data);
      if (!Array.isArray(tags)) tags = [];
    } catch (e) { tags = []; }

    if (!tags.find(t => t.name === tagName)) {
      tags.push({ name: tagName, id: Date.now().toString() });
      await fs.writeFile(tagsPath, JSON.stringify(tags, null, 2));
    }
    return tags;
  } catch (error) {
    console.error('Error creating tag:', error);
    return [];
  }
});

ipcMain.handle('delete-tag', async (event, tagName) => {
  try {
    // 1. Delete from tags.json
    let tags = [];
    try {
      const data = await fs.readFile(tagsPath, 'utf-8');
      tags = JSON.parse(data);
      if (!Array.isArray(tags)) tags = [];
    } catch (e) { return []; }

    const newTags = tags.filter(t => t.name !== tagName);
    await fs.writeFile(tagsPath, JSON.stringify(newTags, null, 2));

    // 2. Remove tag from all files in file_tags.json
    const fileTagsPath = path.join(app.getPath('userData'), 'file_tags.json');
    try {
      let fileTags = {};
      try {
        const ftData = await fs.readFile(fileTagsPath, 'utf-8');
        fileTags = JSON.parse(ftData);
      } catch (e) { }

      let changed = false;
      for (const filePath in fileTags) {
        const tagList = fileTags[filePath];
        if (Array.isArray(tagList) && tagList.includes(tagName)) {
          fileTags[filePath] = tagList.filter(t => t !== tagName);
          // Remove file entry if it has no tags left
          if (fileTags[filePath].length === 0) {
            delete fileTags[filePath];
          }
          changed = true;
        }
      }

      if (changed) {
        await fs.writeFile(fileTagsPath, JSON.stringify(fileTags, null, 2));
      }
    } catch (error) {
      console.error('Error cleaning up file tags:', error);
    }

    return newTags;
  } catch (error) {
    console.error('Error deleting tag:', error);
    return [];
  }
});

ipcMain.handle('rename-tag', async (event, { oldName, newName }) => {
  try {
    if (!oldName || !newName || oldName === newName) return [];

    // 1. Update tags definitions
    let tags = [];
    try {
      const data = await fs.readFile(tagsPath, 'utf-8');
      tags = JSON.parse(data);
    } catch (e) { tags = []; }

    const tagIndex = tags.findIndex(t => t.name === oldName);
    if (tagIndex === -1) return tags; // Tag not found

    // Check if new name already exists
    if (tags.find(t => t.name === newName)) {
      // Merge? or Error? For now simple error or skip
      console.warn('Tag rename failed: new name already exists');
      return tags;
    }

    tags[tagIndex].name = newName;
    await fs.writeFile(tagsPath, JSON.stringify(tags, null, 2));

    // 2. Update file associations
    let fileTags = {};
    let changed = false;
    try {
      const ftData = await fs.readFile(fileTagsPath, 'utf-8');
      fileTags = JSON.parse(ftData);
    } catch (e) { }

    for (const filePath in fileTags) {
      const fileTagList = fileTags[filePath];
      if (fileTagList.includes(oldName)) {
        // Replace oldName with newName
        fileTags[filePath] = fileTagList.map(t => t === oldName ? newName : t);
        changed = true;
      }
    }

    if (changed) {
      await fs.writeFile(fileTagsPath, JSON.stringify(fileTags, null, 2));
    }

    return tags;
  } catch (error) {
    console.error('Error renaming tag:', error);
    return [];
  }
});

const fileTagsPath = path.join(app.getPath('userData'), 'file_tags.json');

ipcMain.handle('add-files-to-tag', async (event, { files, tagName }) => {
  try {
    if (!files || !Array.isArray(files)) return false;

    let fileTags = {};
    try {
      const data = await fs.readFile(fileTagsPath, 'utf-8');
      fileTags = JSON.parse(data);
    } catch (e) { }

    let changed = false;
    for (const filePath of files) {
      if (!filePath) continue; // Skip empty/undefined
      if (!fileTags[filePath]) fileTags[filePath] = [];
      if (!fileTags[filePath].includes(tagName)) {
        fileTags[filePath].push(tagName);
        changed = true;
      }
    }

    if (changed) {
      await fs.writeFile(fileTagsPath, JSON.stringify(fileTags, null, 2));
    }
    return true;
  } catch (error) {
    console.error('Error adding files to tag:', error);
    return false;
  }
});

ipcMain.handle('remove-files-from-tag', async (event, { files, tagName }) => {
  try {
    let fileTags = {};
    try {
      const data = await fs.readFile(fileTagsPath, 'utf-8');
      fileTags = JSON.parse(data);
    } catch (e) { return true; }

    let changed = false;
    for (const filePath of files) {
      if (fileTags[filePath]) {
        fileTags[filePath] = fileTags[filePath].filter(t => t !== tagName);
        if (fileTags[filePath].length === 0) delete fileTags[filePath];
        changed = true;
      }
    }

    if (changed) {
      await fs.writeFile(fileTagsPath, JSON.stringify(fileTags, null, 2));
    }
    return true;
  } catch (error) {
    console.error('Error removing files from tag:', error);
    return false;
  }
});

ipcMain.handle('get-files-by-tag', async (event, { tagNames, mode }) => {
  try {
    let fileTags = {};
    try {
      const data = await fs.readFile(fileTagsPath, 'utf-8');
      fileTags = JSON.parse(data);
    } catch (e) { return []; }

    // Normalize to array
    const tagsToFind = Array.isArray(tagNames) ? tagNames : [tagNames];
    if (tagsToFind.length === 0) return [];

    // Default mode = union
    const filterMode = mode || 'union';

    const matchingFiles = [];
    for (const [filePath, tags] of Object.entries(fileTags)) {
      // Guard against bad data
      if (!filePath || filePath === 'undefined' || filePath === 'null') continue;

      let match = false;
      if (filterMode === 'intersection') {
        // AND Logic: File must have ALL tags
        match = tagsToFind.every(t => tags.includes(t));
      } else {
        // OR Logic: File has AT LEAST ONE tag
        match = tags.some(t => tagsToFind.includes(t));
      }

      if (match) {
        // Check if file actually exists before including it
        try {
          await fs.access(filePath);
          const name = path.basename(filePath);
          matchingFiles.push({
            name,
            path: filePath,
            url: `media://local/${filePath.replace(/\\/g, '/')}`
          });
        } catch (e) {
          // File doesn't exist, skip it
          // Optionally clean up the stale entry (but we'll do this separately to avoid slowing down queries)
          console.warn(`File in tags database no longer exists: ${filePath}`);
        }
      }
    }
    return matchingFiles;
  } catch (error) {
    console.error('Error getting files by tag:', error);
    return [];
  }
});

ipcMain.handle('get-tags-for-files', async (event, filePaths) => {
  try {
    let fileTags = {};
    try {
      const data = await fs.readFile(fileTagsPath, 'utf-8');
      fileTags = JSON.parse(data);
    } catch (e) { return {}; }

    const result = {};
    for (const filePath of filePaths) {
      if (fileTags[filePath]) {
        result[filePath] = fileTags[filePath];
      } else {
        result[filePath] = [];
      }
    }
    return result;
  } catch (error) {
    console.error('Error getting tags for files:', error);
    return {};
  }
});

ipcMain.handle('read-clipboard', async () => {
  const formats = clipboard.availableFormats();

  // 1. Try text/uri-list (Common for linux/browsers/some apps)
  if (formats.includes('text/uri-list')) {
    try {
      const buffer = clipboard.readBuffer('text/uri-list');
      // Usually utf-8 or ascii
      const str = buffer.toString('utf-8');
      // Format: line by line, each is a URI (file://...)
      const paths = str.split(/[\r\n]+/)
        .filter(line => line.trim().startsWith('file://'))
        .map(line => {
          try {
            const urlObj = new URL(line.trim());
            if (urlObj.protocol === 'file:') {
              let p = urlObj.pathname;
              // Windows fix: /D:/foo -> D:/foo
              if (process.platform === 'win32' && /^\/[a-zA-Z]:/.test(p)) {
                p = p.substring(1);
              }
              return decodeURIComponent(p);
            }
          } catch (e) { return null; }
          return null;
        })
        .filter(p => p);

      if (paths.length > 0) {
        return paths.join('\n');
      }
    } catch (e) {
      console.error('URI List parse error:', e);
    }
  }

  // 2. Try Standard Text
  let content = clipboard.readText();
  // Check if content looks like file paths (absolute paths specific to OS)
  if (content && /^[a-zA-Z]:\\/.test(content.trim())) {
    return content;
  }

  // 3. PowerShell for Multi-File (CF_HDROP)
  try {
    const { exec } = require('child_process');
    const psTimeout = new Promise(resolve => setTimeout(() => resolve('timeout'), 2000));

    const psRun = new Promise((resolve) => {
      // Updated command: Use JSON encoding to avoid console encoding issues (GBK/UTF-8)
      const cmd = 'powershell -ExecutionPolicy Bypass -NoProfile -Command "& { @(Get-Clipboard -Format FileDropList).FullName | ConvertTo-Json -Compress }"';
      exec(cmd, (error, stdout) => {
        if (error) {
          console.error('PS Error:', error);
          resolve('');
        } else {
          try {
            const json = JSON.parse(stdout.trim());
            const paths = Array.isArray(json) ? json.join('\n') : json;
            resolve(paths);
          } catch (e) {
            // If not valid JSON, process output empty or fallback
            // console.warn('PS JSON Parse Error (maybe empty):', e); 
            resolve('');
          }
        }
      });
    });

    const psResult = await Promise.race([psRun, psTimeout]);
    if (psResult && psResult !== 'timeout') {
      return psResult;
    }
  } catch (err) {
    console.error('PS Exception:', err);
  }

  // 4. Fallback: FileNameW
  if (formats.includes('FileNameW')) {
    try {
      const buffer = clipboard.readBuffer('FileNameW');
      let filePath = buffer.toString('ucs2');
      filePath = filePath.replace(/\0/g, '');
      if (filePath) return filePath;
    } catch (e) {
      console.error('Buffer read error:', e);
    }
  }

  return content || '';
});

ipcMain.handle('read-image-metadata', async (event, filePath) => {
  try {
    const buffer = await fs.readFile(filePath);

    // Simple PNG Text Chunk Reader
    // Signature: 89 50 4E 47 0D 0A 1A 0A
    if (buffer[0] !== 0x89 || buffer[1] !== 0x50) return {}; // Not PNG

    let offset = 8;
    const result = { parameters: '', prompt: '', workflow: '' };

    while (offset < buffer.length) {
      if (offset + 8 > buffer.length) break;
      const length = buffer.readUInt32BE(offset);
      const type = buffer.toString('ascii', offset + 4, offset + 8);
      offset += 8;

      if (type === 'tEXt') {
        // Keyword null Text
        let nullByteIndex = -1;
        for (let i = 0; i < length; i++) {
          if (buffer[offset + i] === 0) {
            nullByteIndex = i;
            break;
          }
        }
        if (nullByteIndex !== -1) {
          const keyword = buffer.toString('latin1', offset, offset + nullByteIndex);
          const text = buffer.toString('latin1', offset + nullByteIndex + 1, offset + length);
          if (keyword === 'parameters') result.parameters = text;
          if (keyword === 'prompt') result.prompt = text;
          if (keyword === 'workflow') result.workflow = text;
        }
      } else if (type === 'iTXt') {
        // Keyword(utf8) + 0 + CompFlag + CompMethod + LangTag + 0 + TransKeyword + 0 + Text(utf8)
        // Simply searching for keyword usually works for these standard keys
        let idx = 0;
        let nullsFound = 0;
        let keywordEnd = -1;
        // Find first null
        for (let i = 0; i < length; i++) {
          if (buffer[offset + i] === 0) {
            keywordEnd = i;
            break;
          }
        }
        if (keywordEnd !== -1) {
          const keyword = buffer.toString('utf8', offset, offset + keywordEnd);
          // Skip headers to find text
          // Structure is tricky to parse perfectly without strict spec adherence, 
          // but usually text is at the end. 
          // Let's rely on tEXt for ComfyUI which is standard. 
          // Only some tools use iTXt.
          // If we really need iTXt, we implement heavier parsing. 
          // For now, most Comfy/A1111 use tEXt.
        }
      }

      offset += length + 4; // +4 for CRC
    }

    // If prompt is missing but workflow exists (common in ComfyUI), try to extract from workflow
    if (!result.prompt && result.workflow) {
      try {
        const workflow = JSON.parse(result.workflow);
        // Look for nodes with class_type 'Text Multiline', 'Primitive', etc.
        // Or finding nodes that are inputs to KSampler/CLIPTextEncode

        let foundText = [];

        // Strategy 1: Iterate all nodes and find specific text widgets
        if (workflow.nodes) {
          workflow.nodes.forEach(node => {
            if (node.widgets_values) {
              // Arrays of strings are potential prompts
              node.widgets_values.forEach(val => {
                if (typeof val === 'string' && val.length > 20) {
                  // Heuristic: Long strings are likely prompts
                  foundText.push(val);
                }
              });
            }
          });
        }

        // Strategy 2: If API format (object with keys as node IDs)
        if (!workflow.nodes && typeof workflow === 'object') {
          Object.values(workflow).forEach(node => {
            if (node.inputs && node.inputs.text && typeof node.inputs.text === 'string') {
              foundText.push(node.inputs.text);
            }
            // Handle 'Text Multiline' specifically as per user request
            if (node.class_type === 'Text Multiline' && node.inputs && node.inputs.text) {
              // Add to start if it's explicitly a text node
              foundText.unshift(node.inputs.text);
            }
            // CLIPTextEncode usually has 'text' input
            if (node.class_type === 'CLIPTextEncode' && node.inputs && node.inputs.text) {
              foundText.push(node.inputs.text);
            }
          });
        }

        if (foundText.length > 0) {
          // Join distinctive prompts
          result.prompt = [...new Set(foundText)].join('\n\n');
        }
      } catch (e) {
        // Ignore parse errors
      }
    }

    // Also check 'prompt' JSON content if it exists but is raw JSON
    if (result.prompt && result.prompt.trim().startsWith('{')) {
      try {
        // If prompt is actually the API JSON (common in some save workflows)
        const promptJson = JSON.parse(result.prompt);
        let foundText = [];
        Object.values(promptJson).forEach(node => {
          if (node.inputs && node.inputs.text && typeof node.inputs.text === 'string') {
            foundText.push(node.inputs.text);
          }
        });
        if (foundText.length > 0) {
          result.prompt_parsed = [...new Set(foundText)].join('\n\n');
        }
      } catch (e) { }
    }

    return result;
  } catch (error) {
    console.error('Error reading metadata:', error);
    return {};
  }
});

// --- Optimized Thumbnail System with Queue & Deduping ---
const thumbnailQueue = [];
const activeThumbnailRequests = new Map(); // path -> Promise
const MAX_CONCURRENT_THUMBNAILS = 4; // Adjust based on CPU cores
let servingThumbnails = 0;

async function processThumbnailQueue() {
  if (servingThumbnails >= MAX_CONCURRENT_THUMBNAILS || thumbnailQueue.length === 0) return;

  servingThumbnails++;
  const { filePath, size, resolve, reject } = thumbnailQueue.shift();

  try {
    const result = await generateThumbnailInternal(filePath, size);
    resolve(result);
  } catch (err) {
    reject(err);
  } finally {
    servingThumbnails--;
    processThumbnailQueue();
  }
}

async function generateThumbnailInternal(filePath, size = 600) {
  const cacheDir = path.join(app.getPath('userData'), 'thumbnails');
  try { await fs.access(cacheDir); } catch { await fs.mkdir(cacheDir, { recursive: true }); }

  const hash = crypto.createHash('md5').update(filePath).digest('hex');
  const cachePath = path.join(cacheDir, `${hash}_${size}.jpg`);

  try {
    await fs.access(cachePath);
    const [sourceStats, cacheStats] = await Promise.all([fs.stat(filePath), fs.stat(cachePath)]);
    if (sourceStats.mtime <= cacheStats.mtime) {
      return `media://local/${cachePath.replace(/\\/g, '/')}`;
    }
  } catch { }

  // Atomic write to avoid black thumbnails/partial reads
  const tmpPath = `${cachePath}.tmp`;
  try {
    const fileBuffer = await fs.readFile(filePath);
    await sharp(fileBuffer)
      .resize(size, size, { fit: 'outside', rotate: true, withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toFile(tmpPath);
  } catch (error) {
    if (cachePath) await fs.unlink(tmpPath).catch(() => {});
    throw error;
  }
  await fs.rename(tmpPath, cachePath);

  return `media://local/${cachePath.replace(/\\/g, '/')}`;
}

ipcMain.handle('get-thumbnail', async (event, filePath, size = 600) => {
  const ext = path.extname(filePath).toLowerCase();
  if (['.mp4', '.webm', '.mov', '.mkv'].includes(ext)) {
    return `media://local/${filePath.replace(/\\/g, '/')}`;
  }

  if (!sharp) return `media://local/${filePath.replace(/\\/g, '/')}`;

  const requestKey = `${filePath}_${size}`;
  // Deduping: If already processing this file+size, return the existing promise
  if (activeThumbnailRequests.has(requestKey)) {
    return activeThumbnailRequests.get(requestKey);
  }

  const promise = new Promise((resolve, reject) => {
    thumbnailQueue.push({ filePath, size, resolve, reject });
    processThumbnailQueue();
  }).finally(() => {
    activeThumbnailRequests.delete(requestKey);
  });

  activeThumbnailRequests.set(requestKey, promise);
  return promise;
});
ipcMain.handle('clear-thumbnails-for-folder', async (event, folderPath) => {
  const cacheDir = path.join(app.getPath('userData'), 'thumbnails');
  try {
    const dirents = await fs.readdir(folderPath, { withFileTypes: true });
    const files = dirents.filter(d => d.isFile()).map(d => path.join(folderPath, d.name));

    // Read cache directory once instead of per-file
    let cacheFiles = [];
    try { cacheFiles = await fs.readdir(cacheDir); } catch (e) { }

    let deletedCount = 0;
    for (const filePath of files) {
      const hash = crypto.createHash('md5').update(filePath).digest('hex');
      for (const cacheFile of cacheFiles) {
        if (cacheFile.startsWith(hash)) {
          try {
            await fs.unlink(path.join(cacheDir, cacheFile));
            deletedCount++;
          } catch (e) { }
        }
      }
    }
    return { success: true, count: deletedCount };
  } catch (error) {
    console.error('Failed to clear thumbnails for folder:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('set-network-mode', async (event, mode) => {
  try {
    const { session } = require('electron');
    if (mode === 'direct') {
      await session.defaultSession.setProxy({ mode: 'direct', proxyRules: 'direct://' });
      console.log('Network Mode: Forced DIRECT (Proxy Bypassed)');
    } else {
      await session.defaultSession.setProxy({ mode: 'system' });
      console.log('Network Mode: SYSTEM (Proxy Enabled)');
    }
    return { success: true };
  } catch (error) {
    console.error('Failed to set network mode:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('export-settings', async (event, frontendSettings) => {
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Export User Settings',
    defaultPath: 'yiziview_settings_backup.json',
    filters: [{ name: 'JSON Files', extensions: ['json'] }]
  });

  if (!filePath) return { success: false };

  try {
    let tags = [];
    try { tags = JSON.parse(await fs.readFile(tagsPath, 'utf8')); } catch (e) { }

    let fileTags = {};
    try { fileTags = JSON.parse(await fs.readFile(fileTagsPath, 'utf8')); } catch (e) { }

    let folders = [];
    try { folders = JSON.parse(await fs.readFile(favoritesPath, 'utf8')); } catch (e) { }

    let expandedFolders = [];
    try { expandedFolders = JSON.parse(await fs.readFile(expandedFoldersPath, 'utf8')); } catch (e) { }

    const exportData = {
      tags,
      fileTags,
      folders,
      expandedFolders,
      frontendSettings: frontendSettings || {}
    };
    await fs.writeFile(filePath, JSON.stringify(exportData, null, 2));

    return { success: true, path: filePath };
  } catch (error) {
    console.error('Failed to export settings:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('import-settings', async () => {
  const { filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Import User Settings',
    filters: [{ name: 'JSON Files', extensions: ['json'] }],
    properties: ['openFile']
  });

  if (!filePaths || filePaths.length === 0) return { success: false };

  try {
    const importData = JSON.parse(await fs.readFile(filePaths[0], 'utf8'));

    // Import Tag List
    if (importData.tags && Array.isArray(importData.tags)) {
      let currentTags = [];
      try { currentTags = JSON.parse(await fs.readFile(tagsPath, 'utf8')); } catch (e) { }

      // Merge tags by name
      const tagMap = new Map();
      currentTags.forEach(t => tagMap.set(t.name, t));
      importData.tags.forEach(t => {
        if (!tagMap.has(t.name)) {
          tagMap.set(t.name, t);
        }
      });
      await fs.writeFile(tagsPath, JSON.stringify(Array.from(tagMap.values()), null, 2));
    }

    // Import File-Tag Associations
    if (importData.fileTags && typeof importData.fileTags === 'object') {
      let currentFileTags = {};
      try { currentFileTags = JSON.parse(await fs.readFile(fileTagsPath, 'utf8')); } catch (e) { }

      const mergedFileTags = { ...currentFileTags };
      for (const [fPath, tags] of Object.entries(importData.fileTags)) {
        if (mergedFileTags[fPath]) {
          mergedFileTags[fPath] = Array.from(new Set([...mergedFileTags[fPath], ...tags]));
        } else {
          mergedFileTags[fPath] = tags;
        }
      }
      await fs.writeFile(fileTagsPath, JSON.stringify(mergedFileTags, null, 2));
    }

    // Import Folders (Favorites)
    if (importData.folders && Array.isArray(importData.folders)) {
      let currentFolders = [];
      try { currentFolders = JSON.parse(await fs.readFile(favoritesPath, 'utf8')); } catch (e) { }
      const folderMap = new Map();
      currentFolders.forEach(f => folderMap.set(f.path, f));
      importData.folders.forEach(f => {
        if (!folderMap.has(f.path)) {
          folderMap.set(f.path, f);
        }
      });
      await fs.writeFile(favoritesPath, JSON.stringify(Array.from(folderMap.values()), null, 2));
    }

    // Import Expanded Folders
    if (importData.expandedFolders && Array.isArray(importData.expandedFolders)) {
      let currentExpanded = new Set();
      try { currentExpanded = new Set(JSON.parse(await fs.readFile(expandedFoldersPath, 'utf8'))); } catch (e) { }
      importData.expandedFolders.forEach(f => currentExpanded.add(f));
      
      if (typeof expandedFoldersCache !== 'undefined') {
        importData.expandedFolders.forEach(f => expandedFoldersCache.add(f));
      }
      await fs.writeFile(expandedFoldersPath, JSON.stringify(Array.from(currentExpanded), null, 2));
    }

    return { 
      success: true, 
      count: (importData.tags?.length || 0),
      frontendSettings: importData.frontendSettings || null
    };
  } catch (error) {
    console.error('Failed to import settings:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-dirname', (event, p) => path.dirname(p));
ipcMain.handle('get-basename', (event, p) => path.basename(p));

const { app, BrowserWindow, shell, ipcMain, dialog, protocol, Menu } = require('electron');
const path = require('path');
const { join } = require('path');
const fs = require('fs/promises');
const chokidar = require('chokidar');
const crypto = require('crypto');
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.error('Failed to load sharp:', e);
}

const watchers = new Map(); // panelId -> watcher instance

// Register media scheme as privileged
protocol.registerSchemesAsPrivileged([
  { scheme: 'media', privileges: { secure: true, supportFetchAPI: true, standard: true, bypassCSP: true } }
]);

// Prevent garbage collection
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
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
    mainWindow.show();
  });

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  // Register protocol for serving local files
  protocol.registerFileProtocol('media', (request, callback) => {
    let url = request.url.replace('media://local/', '');
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
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC Handlers
ipcMain.handle('ping', () => 'pong');

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

  try {
    // 1. Manage Watcher for this panel
    if (watchers.has(panelId)) {
      await watchers.get(panelId).close();
      watchers.delete(panelId);
    }

    const w = chokidar.watch(folderPath, {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      persistent: true,
      ignoreInitial: true,
      depth: 0
    });

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

    watchers.set(panelId, w);

    // 2. Read Files
    const files = await fs.readdir(folderPath);
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'];
    // Use pathToFileURL for safe encoding (handles Chinese, spaces, #, etc.)
    const { pathToFileURL } = require('url');

    const images = files
      .filter(file => imageExtensions.includes(path.extname(file).toLowerCase()))
      .map(file => {
        const fullPath = path.join(folderPath, file);
        const fileUrl = pathToFileURL(fullPath).href; // file:///C:/... (encoded)
        // Convert to media schema
        const mediaUrl = fileUrl.replace('file:///', 'media://local/');

        return {
          name: file,
          path: fullPath,
          url: mediaUrl
        };
      });

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
  } catch (error) {
    console.error('Error renaming item:', error);
    return false;
  }
});

ipcMain.handle('move-items', async (event, { sourcePaths, targetPath }) => {
  // Move files/folders to targetPath
  let successCount = 0;
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
      successCount++;
    } catch (error) {
      console.error(`Error moving ${src}:`, error);
    }
  }
  return successCount;
});

ipcMain.handle('copy-items', async (event, { sourcePaths, targetPath }) => {
  let successCount = 0;
  for (const src of sourcePaths) {
    try {
      const fileName = path.basename(src);
      let dest = path.join(targetPath, fileName);

      // Check collision and auto-rename
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
            // Valid name found
            break;
          }
        }
      } catch (e) {
        // Dest likely doesn't exist, proceed
      }

      await fs.cp(src, dest, { recursive: true });
      successCount++;
    } catch (error) {
      console.error(`Error copying ${src}:`, error);
    }
  }
  return successCount;
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
    // Filter first
    const folders = dirents.filter(dirent => dirent.isDirectory() && !dirent.name.startsWith('.'));

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
    console.error('Error reading subdirectories:', error);
    return [];
  }
});

ipcMain.handle('check-has-subdirectories', async (event, folderPath) => {
  return await hasSubdirectories(folderPath);
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
    const pathsArg = filePaths.map(p => `'${p.replace(/'/g, "''")}'`).join(',');

    // PowerShell command: Set-Clipboard -Path 'path1','path2'
    const command = `powershell -ExecutionPolicy Bypass -NoProfile -Command "Set-Clipboard -Path ${pathsArg}"`;

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
    console.error(e);
    console.error(e);
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
    let tags = [];
    try {
      const data = await fs.readFile(tagsPath, 'utf-8');
      tags = JSON.parse(data);
      if (!Array.isArray(tags)) tags = [];
    } catch (e) { return []; }

    const newTags = tags.filter(t => t.name !== tagName);
    await fs.writeFile(tagsPath, JSON.stringify(newTags, null, 2));
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
  console.log('VERSION_DEBUG_CHECK_V2');
  const formats = clipboard.availableFormats();
  console.log('Clipboard Formats:', formats);

  // 1. Try text/uri-list (Common for linux/browsers/some apps)
  if (formats.includes('text/uri-list')) {
    try {
      const buffer = clipboard.readBuffer('text/uri-list');
      // Usually utf-8 or ascii
      const str = buffer.toString('utf-8');
      console.log('Raw URI List:', str);
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
        console.log('Read via text/uri-list:', paths);
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

    return result;
  } catch (error) {
    console.error('Error reading metadata:', error);
    return {};
  }
});

ipcMain.handle('get-thumbnail', async (event, filePath) => {
  if (!sharp) return `media://local/${filePath.replace(/\\/g, '/')}`; // Fallback if sharp missing

  try {
    // Create cache dir if needed
    const cacheDir = path.join(app.getPath('userData'), 'thumbnails');
    try {
      await fs.access(cacheDir);
    } catch {
      await fs.mkdir(cacheDir, { recursive: true });
    }

    // Hash file path for cache key
    const hash = crypto.createHash('md5').update(filePath).digest('hex');
    const cachePath = path.join(cacheDir, `${hash}.jpg`);

    // Check if exists
    try {
      await fs.access(cachePath);
      return `media://local/${cachePath.replace(/\\/g, '/')}`;
    } catch {
      // Generate
      await sharp(filePath)
        .resize(600, 600, { fit: 'outside', withoutEnlargement: true }) // Ensure both sides are at least 600
        .jpeg({ quality: 85 })
        .toFile(cachePath);

      return `media://local/${cachePath.replace(/\\/g, '/')}`;
    }
  } catch (error) {
    console.error('Thumbnail generation error:', error);
    // Fallback to original
    return `media://local/${filePath.replace(/\\/g, '/')}`;
  }
});
ipcMain.handle('clear-thumbnail-cache', async () => {
  const cacheDir = path.join(app.getPath('userData'), 'thumbnails');
  try {
    const files = await fs.readdir(cacheDir);
    for (const file of files) {
      await fs.unlink(path.join(cacheDir, file));
    }
    return { success: true };
  } catch (error) {
    console.error('Failed to clear thumbnail cache:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('export-tags', async () => {
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Tags Data',
    defaultPath: 'yiziview_tags_backup.json',
    filters: [{ name: 'JSON Files', extensions: ['json'] }]
  });

  if (!filePath) return { success: false };

  try {
    let tags = [];
    try { tags = JSON.parse(await fs.readFile(tagsPath, 'utf8')); } catch (e) { }

    let fileTags = {};
    try { fileTags = JSON.parse(await fs.readFile(fileTagsPath, 'utf8')); } catch (e) { }

    const exportData = { tags, fileTags };
    await fs.writeFile(filePath, JSON.stringify(exportData, null, 2));

    return { success: true, path: filePath };
  } catch (error) {
    console.error('Failed to export tags:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('import-tags', async () => {
  const { filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Import Tags Data',
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

    return { success: true, count: (importData.tags?.length || 0) };
  } catch (error) {
    console.error('Failed to import tags:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-dirname', (event, p) => path.dirname(p));
ipcMain.handle('get-basename', (event, p) => path.basename(p));

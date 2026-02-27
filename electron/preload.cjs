const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    ping: () => ipcRenderer.invoke('ping'),
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    scanFolder: (path, panelId) => ipcRenderer.invoke('scan-folder', { path, panelId }),
    trashFile: (path) => ipcRenderer.invoke('trash-file', path),
    startDrag: (path) => ipcRenderer.send('start-drag', path),
    // File System
    createFolder: (parentPath, folderName) => ipcRenderer.invoke('create-folder', { parentPath, folderName }),
    renameItem: (oldPath, newName) => ipcRenderer.invoke('rename-item', { oldPath, newName }),
    moveItems: (sourcePaths, targetPath) => ipcRenderer.invoke('move-items', { sourcePaths, targetPath }),
    copyItems: (sourcePaths, targetPath) => ipcRenderer.invoke('copy-items', { sourcePaths, targetPath }),

    // Drag & Drop
    getFilePath: (file) => {
        try {
            const path = webUtils.getPathForFile(file);
            console.log('webUtils path:', path);
            return path;
        } catch (e) {
            console.error('webUtils error:', e);
            return file.path;
        }
    },

    // Context Menu
    showContextMenu: (path) => ipcRenderer.send('show-context-menu', path),
    showItemInFolder: (path) => ipcRenderer.invoke('show-item-in-folder', path),
    onContextMenuCommand: (callback) => ipcRenderer.on('context-menu-command', callback),

    // Folder Tree / Favorites
    getSubdirectories: (path) => ipcRenderer.invoke('get-subdirectories', path),
    checkHasSubdirectories: (path) => ipcRenderer.invoke('check-has-subdirectories', path),
    getFavorites: () => ipcRenderer.invoke('get-favorites'),
    saveFavorites: (favorites) => ipcRenderer.invoke('save-favorites', favorites),

    // Expanded State
    getExpandedFolders: () => ipcRenderer.invoke('get-expanded-folders'),
    setFolderExpanded: (path, expanded) => ipcRenderer.invoke('set-folder-expanded', { path, expanded }),

    // Session
    getSession: () => ipcRenderer.invoke('get-session'),
    saveSession: (session) => ipcRenderer.invoke('save-session', session),

    // File Watcher
    onFolderChange: (callback) => {
        const subscription = (event, ...args) => callback(event, ...args);
        ipcRenderer.on('folder-change', subscription);
        return () => ipcRenderer.removeListener('folder-change', subscription);
    },

    // Clipboard
    copyToClipboard: (paths) => ipcRenderer.invoke('copy-to-clipboard', paths),
    readClipboard: () => ipcRenderer.invoke('read-clipboard'),

    // Tag System
    getTags: () => ipcRenderer.invoke('get-tags'),
    createTag: (tagName) => ipcRenderer.invoke('create-tag', tagName),
    renameTag: (oldName, newName) => ipcRenderer.invoke('rename-tag', { oldName, newName }),
    deleteTag: (tagName) => ipcRenderer.invoke('delete-tag', tagName),
    addFilesToTag: (files, tagName) => ipcRenderer.invoke('add-files-to-tag', { files, tagName }),
    removeFilesFromTag: (files, tagName) => ipcRenderer.invoke('remove-files-from-tag', { files, tagName }),
    getFilesByTag: (args) => ipcRenderer.invoke('get-files-by-tag', args),
    getTagsForFiles: (filePaths) => ipcRenderer.invoke('get-tags-for-files', filePaths),
    readImageMetadata: (filePath) => ipcRenderer.invoke('read-image-metadata', filePath),
    getThumbnail: (filePath) => ipcRenderer.invoke('get-thumbnail', filePath),
    cropImage: (imagePath, cropData) => ipcRenderer.invoke('crop-image', { imagePath, cropData }),

    // Settings
    clearThumbnailCache: () => ipcRenderer.invoke('clear-thumbnail-cache'),
    exportTags: () => ipcRenderer.invoke('export-tags'),
    importTags: () => ipcRenderer.invoke('import-tags'),

    // Utils
    getDirname: (p) => ipcRenderer.invoke('get-dirname', p),
    getBasename: (p) => ipcRenderer.invoke('get-basename', p),

    // Auto Updater
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    installUpdate: () => ipcRenderer.invoke('install-update'),
    getUpdateState: () => ipcRenderer.invoke('get-update-state'),
    onUpdateStateChange: (callback) => {
        const subscription = (event, ...args) => callback(event, ...args);
        ipcRenderer.on('auto-update-state', subscription);
        return () => ipcRenderer.removeListener('auto-update-state', subscription);
    },
    onUpdaterLog: (callback) => {
        const subscription = (event, msg) => callback(msg);
        ipcRenderer.on('updater-log', subscription);
        return () => ipcRenderer.removeListener('updater-log', subscription);
    }
});

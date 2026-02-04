const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    ping: () => ipcRenderer.invoke('ping'),
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    scanFolder: (path) => ipcRenderer.invoke('scan-folder', path),
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

    // File Watcher
    onFolderChange: (callback) => ipcRenderer.on('folder-change', callback),

    // Clipboard
    copyToClipboard: (paths) => ipcRenderer.invoke('copy-to-clipboard', paths),
    readClipboard: () => ipcRenderer.invoke('read-clipboard'),

    // Tag System
    getTags: () => ipcRenderer.invoke('get-tags'),
    createTag: (tagName) => ipcRenderer.invoke('create-tag', tagName),
    deleteTag: (tagName) => ipcRenderer.invoke('delete-tag', tagName),
    addFilesToTag: (files, tagName) => ipcRenderer.invoke('add-files-to-tag', { files, tagName }),
    removeFilesFromTag: (files, tagName) => ipcRenderer.invoke('remove-files-from-tag', { files, tagName }),
    getFilesByTag: (args) => ipcRenderer.invoke('get-files-by-tag', args),
    getTagsForFiles: (filePaths) => ipcRenderer.invoke('get-tags-for-files', filePaths),
    readImageMetadata: (filePath) => ipcRenderer.invoke('read-image-metadata', filePath),
    getThumbnail: (filePath) => ipcRenderer.invoke('get-thumbnail', filePath),
});

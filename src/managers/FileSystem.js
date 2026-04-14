/**
 * FileSystem Manager
 * Handles communication with the Electron Main process for file operations.
 */
export const FileSystem = {
    /**
     * Select a folder via native dialog.
     * @returns {Promise<string|null>}
     */
    selectFolder: async () => {
        return await window.electron.selectFolder();
    },

    /**
     * Scan a folder for images.
     */
    scanFolder: async (folderPath, panelId) => {
        if (!folderPath) return [];
        try {
            return await window.electron.scanFolder(folderPath, panelId);
        } catch (e) {
            console.error(e);
            return [];
        }
    },

    /**
     * Internal metadata sync (Colors, Favorites) on file operations
     */
    _syncMetadata: (oldPath, newPath, action) => {
        try {
            // 1. Image Colors
            const colors = JSON.parse(localStorage.getItem('yizi_image_colors') || '{}');
            let colorsChanged = false;
            if (action === 'delete') {
                if (colors[oldPath]) {
                    delete colors[oldPath];
                    colorsChanged = true;
                }
            } else if (action === 'move') {
                if (colors[oldPath]) {
                    colors[newPath] = colors[oldPath];
                    delete colors[oldPath];
                    colorsChanged = true;
                }
            }
            if (colorsChanged) {
                localStorage.setItem('yizi_image_colors', JSON.stringify(colors));
                window.dispatchEvent(new Event('image-colors-updated'));
            }

            // 2. Favorites
            const favs = JSON.parse(localStorage.getItem('yizi_fav_images') || '[]');
            const favSet = new Set(favs);
            let favsChanged = false;
            
            if (action === 'delete') {
                if (favSet.has(oldPath)) {
                    favSet.delete(oldPath);
                    favsChanged = true;
                }
            } else if (action === 'move') {
                if (favSet.has(oldPath)) {
                    favSet.delete(oldPath);
                    favSet.add(newPath);
                    favsChanged = true;
                }
            }
            
            if (favsChanged) {
                localStorage.setItem('yizi_fav_images', JSON.stringify([...favSet]));
                window.dispatchEvent(new Event('fav-images-updated'));
            }
        } catch (e) {
            console.error('Failed to sync metadata:', e);
        }
    },

    /**
     * Delete a file to trash.
     * @param {string} filePath 
     * @returns {Promise<boolean>}
     */
    deleteFile: async (filePath) => {
        const result = await window.electron.trashFile(filePath);
        if (result !== false) {
            FileSystem._syncMetadata(filePath, null, 'delete');
        }
        return result;
    },

    /**
     * Show context menu for a file.
     * @param {string} filePath
     */
    showContextMenu: (filePath) => {
        window.electron.showContextMenu(filePath);
    },

    showInFolder: (filePath) => {
        window.electron.showItemInFolder(filePath);
    },

    /**
     * Listen for context menu commands.
     * @param {function} callback
     */
    onContextMenuCommand: (callback) => {
        window.electron.onContextMenuCommand(callback);
    },

    /**
     * Get subdirectories of a folder.
     * @param {string} folderPath 
     * @returns {Promise<Array>}
     */
    getSubdirectories: async (folderPath) => {
        return await window.electron.getSubdirectories(folderPath);
    },

    /**
     * Check if a folder has subdirectories.
     * @param {string} folderPath 
     * @returns {Promise<boolean>}
     */
    checkHasSubdirectories: async (folderPath) => {
        return await window.electron.checkHasSubdirectories(folderPath);
    },

    /**
     * Search recursively in the provided root directories for folders matching query
     * @param {Array<string>} roots 
     * @param {string} query 
     * @returns {Promise<Array>}
     */
    searchFolders: async (roots, query) => {
        return await window.electron.searchFolders(roots, query);
    },

    /**
     * Get favorite folders.
     * @returns {Promise<Array>}
     */
    getFavorites: async () => {
        return await window.electron.getFavorites();
    },

    /**
     * Save favorite folders.
     * @param {Array} favorites 
     * @returns {Promise<boolean>}
     */
    saveFavorites: async (favorites) => {
        return await window.electron.saveFavorites(favorites);
    },

    /**
     * Subscribe to folder changes.
     * @param {function} callback
     */
    onFolderChange: (callback) => {
        if (window.electron.onFolderChange) {
            window.electron.onFolderChange(callback);
        }
    },

    createFolder: async (parentPath, folderName) => {
        return await window.electron.createFolder(parentPath, folderName);
    },

    renameItem: async (oldPath, newName) => {
        const result = await window.electron.renameItem(oldPath, newName);
        if (result !== false) {
            const sep = oldPath.lastIndexOf('\\') !== -1 ? '\\' : '/';
            const oldDir = oldPath.substring(0, oldPath.lastIndexOf(sep));
            const newPath = oldDir + sep + newName;
            FileSystem._syncMetadata(oldPath, newPath, 'move');
        }
        return result;
    },

    moveItems: async (sourcePaths, targetPath) => {
        const result = await window.electron.moveItems(sourcePaths, targetPath);
        // We only attempt to sync metadata if there wasn't a total failure
        if (result !== false && Array.isArray(sourcePaths)) {
            const targetSep = targetPath.indexOf('\\') !== -1 ? '\\' : '/';
            sourcePaths.forEach(oldPath => {
                const sep = oldPath.lastIndexOf('\\') !== -1 ? '\\' : '/';
                const filename = oldPath.substring(oldPath.lastIndexOf(sep) + 1);
                const newPath = targetPath.endsWith(targetSep) ? targetPath + filename : targetPath + targetSep + filename;
                FileSystem._syncMetadata(oldPath, newPath, 'move');
            });
        }
        return result;
    },

    // Internal Clipboard State
    _clipboardState: { action: 'copy', paths: [] },

    _updateClipboard: (action, paths) => {
        FileSystem._clipboardState = { action, paths };
        window.dispatchEvent(new CustomEvent('clipboard-changed', { detail: FileSystem._clipboardState }));
    },

    copyItems: async (sourcePaths, targetPath, overwrite = false) => {
        return await window.electron.copyItems(sourcePaths, targetPath, overwrite);
    },

    checkCollisions: async (sourcePaths, targetPath) => {
        return await window.electron.checkCollisions(sourcePaths, targetPath);
    },

    clearThumbnailsForFolder: async (folderPath) => {
        return await window.electron.clearThumbnailsForFolder(folderPath);
    },

    copyToClipboard: async (paths) => {
        FileSystem._updateClipboard('copy', paths);
        return await window.electron.copyToClipboard(paths);
    },

    cutToClipboard: async (paths) => {
        FileSystem._updateClipboard('cut', paths);
        return await window.electron.copyToClipboard(paths);
    },

    readClipboard: async () => {
        const result = await window.electron.readClipboard();
        if (typeof result === 'string' && result) {
            return result.split('\n').map(p => p.trim()).filter(p => p);
        }
        return Array.isArray(result) ? result : [];
    },

    pasteFromClipboard: async (targetPath) => {
        const internalState = FileSystem._clipboardState;
        let sources = [];
        let isCut = false;

        if (internalState && internalState.paths && internalState.paths.length > 0) {
            sources = internalState.paths;
            isCut = internalState.action === 'cut';
        } else {
            sources = await FileSystem.readClipboard();
        }

        if (sources.length === 0) return 0;

        let successCount = 0;
        if (isCut) {
            successCount = await window.electron.moveItems(sources, targetPath);
            FileSystem._updateClipboard('copy', []);
        } else {
            successCount = await window.electron.copyItems(sources, targetPath);
        }
        return successCount;
    },

    getTags: async () => {
        return await window.electron.getTags();
    },

    createTag: async (tagName) => {
        return await window.electron.createTag(tagName);
    },

    renameTag: async (oldName, newName) => {
        return await window.electron.renameTag(oldName, newName);
    },

    deleteTag: async (tagName) => {
        return await window.electron.deleteTag(tagName);
    },

    addFilesToTag: async (files, tagName) => {
        return await window.electron.addFilesToTag(files, tagName);
    },

    removeFilesFromTag: async (files, tagName) => {
        return await window.electron.removeFilesFromTag(files, tagName);
    },

    getFilesByTag: async (tagNames, mode = 'union') => {
        return await window.electron.getFilesByTag({ tagNames, mode });
    },

    getTagsForFiles: async (filePaths) => {
        return await window.electron.getTagsForFiles(filePaths);
    },

    readImageMetadata: async (filePath) => {
        return await window.electron.readImageMetadata(filePath);
    },

    getThumbnail: async (filePath, size) => {
        return await window.electron.getThumbnail(filePath, size);
    },

    startDrag: (paths) => {
        window.electron.startDrag(paths);
    },

    getSession: async () => {
        return await window.electron.getSession();
    },

    saveSession: async (session) => {
        return await window.electron.saveSession(session);
    }
};

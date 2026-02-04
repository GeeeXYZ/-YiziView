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
     * @param {string} folderPath 
     * @returns {Promise<Array>}
     */
    scanFolder: async (folderPath) => {
        if (!folderPath) return [];
        try {
            return await window.electron.scanFolder(folderPath);
        } catch (e) {
            console.error(e);
            return [];
        }
    },

    /**
     * Delete a file to trash.
     * @param {string} filePath 
     * @returns {Promise<boolean>}
     */
    deleteFile: async (filePath) => {
        return await window.electron.trashFile(filePath);
    },

    /**
     * Start native drag operation.
     * @param {string} filePath 
     */
    startDrag: (filePath) => {
        window.electron.startDrag(filePath);
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
        return await window.electron.renameItem(oldPath, newName);
    },

    moveItems: async (sourcePaths, targetPath) => {
        return await window.electron.moveItems(sourcePaths, targetPath);
    },

    copyItems: async (sourcePaths, targetPath) => {
        return await window.electron.copyItems(sourcePaths, targetPath);
    },

    copyToClipboard: async (paths) => {
        return await window.electron.copyToClipboard(paths);
    },

    readClipboard: async () => {
        return await window.electron.readClipboard();
    },

    getTags: async () => {
        return await window.electron.getTags();
    },

    createTag: async (tagName) => {
        return await window.electron.createTag(tagName);
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

    getFilesByTag: async (tagName) => {
        return await window.electron.getFilesByTag(tagName);
    },

    getTagsForFiles: async (filePaths) => {
        return await window.electron.getTagsForFiles(filePaths);
    },

    readImageMetadata: async (filePath) => {
        return await window.electron.readImageMetadata(filePath);
    }
};

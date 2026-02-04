import { FileSystem } from './FileSystem';

export const ConfigManager = {
    /**
     * Load favorites from disk.
     * @returns {Promise<Array>} List of favorite folder paths
     */
    loadFavorites: async () => {
        return await FileSystem.getFavorites();
    },

    /**
     * Save favorites to disk.
     * @param {Array} favorites List of favorite folder paths
     */
    saveFavorites: async (favorites) => {
        await FileSystem.saveFavorites(favorites);
    },

    /**
     * Add a folder to favorites if not already present.
     * @param {string} folderPath 
     * @returns {Promise<Array>} Updated favorites list
     */
    addFavorite: async (folderPath) => {
        const favorites = await FileSystem.getFavorites();
        if (!favorites.includes(folderPath)) {
            const newFavorites = [...favorites, folderPath];
            await FileSystem.saveFavorites(newFavorites);
            return newFavorites;
        }
        return favorites;
    },

    /**
     * Remove a folder from favorites.
     * @param {string} folderPath 
     * @returns {Promise<Array>} Updated favorites list
     */
    removeFavorite: async (folderPath) => {
        const favorites = await FileSystem.getFavorites();
        const newFavorites = favorites.filter(p => p !== folderPath);
        await FileSystem.saveFavorites(newFavorites);
        return newFavorites;
    },

    // --- Tags ---
    getTags: async () => {
        return await FileSystem.getTags();
    },

    createTag: async (tagName) => {
        return await FileSystem.createTag(tagName);
    },

    deleteTag: async (tagName) => {
        return await FileSystem.deleteTag(tagName);
    },

    addFilesToTag: async (files, tagName) => {
        return await FileSystem.addFilesToTag(files, tagName);
    },

    removeFilesFromTag: async (files, tagName) => {
        return await FileSystem.removeFilesFromTag(files, tagName);
    },

    getFilesByTag: async (tagName) => {
        return await FileSystem.getFilesByTag(tagName);
    },

    getTagsForFiles: async (filePaths) => {
        return await FileSystem.getTagsForFiles(filePaths);
    }
};

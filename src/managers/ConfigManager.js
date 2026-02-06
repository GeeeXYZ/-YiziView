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
            window.dispatchEvent(new CustomEvent('favorites-updated', { detail: newFavorites }));
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
        window.dispatchEvent(new CustomEvent('favorites-updated', { detail: newFavorites }));
        return newFavorites;
    },

    // --- Tags ---
    getTags: async () => {
        return await FileSystem.getTags();
    },

    createTag: async (tagName) => {
        const newTags = await FileSystem.createTag(tagName);
        window.dispatchEvent(new CustomEvent('tags-updated', { detail: newTags }));
        return newTags;
    },

    renameTag: async (oldName, newName) => {
        const newTags = await FileSystem.renameTag(oldName, newName);
        window.dispatchEvent(new CustomEvent('tags-updated', { detail: newTags }));
        return newTags;
    },

    deleteTag: async (tagName) => {
        const newTags = await FileSystem.deleteTag(tagName);
        window.dispatchEvent(new CustomEvent('tags-updated', { detail: newTags }));
        return newTags;
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
    },

    // --- Session ---
    getSession: async () => {
        return await FileSystem.getSession();
    },

    saveSession: async (session) => {
        return await FileSystem.saveSession(session);
    }
};

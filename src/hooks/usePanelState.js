import { useState, useEffect } from 'react';
import { FileSystem } from '@/managers/FileSystem';

/**
 * Custom hook to manage state for a single panel
 * Each panel has its own folder, images, selection, etc.
 */
export const usePanelState = (panelId) => {
    const [currentFolder, setCurrentFolder] = useState(null);
    const [images, setImages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedIndices, setSelectedIndices] = useState(new Set());
    const [lastSelectedIndex, setLastSelectedIndex] = useState(null);
    const [viewingIndex, setViewingIndex] = useState(null);
    const [aspectRatio, setAspectRatio] = useState('1:1');
    const [sortConfig, setSortConfig] = useState({ type: 'name', direction: 'asc' });

    // Help application sort
    const applySort = (imgs, config = sortConfig) => {
        const { type, direction } = config;
        return [...imgs].sort((a, b) => {
            if (type === 'name') {
                const nameA = a.name.toLowerCase();
                const nameB = b.name.toLowerCase();
                return direction === 'asc'
                    ? nameA.localeCompare(nameB)
                    : nameB.localeCompare(nameA);
            } else if (type === 'date') {
                return direction === 'asc'
                    ? a.mtimeMs - b.mtimeMs
                    : b.mtimeMs - a.mtimeMs;
            }
            return 0;
        });
    };

    // Folder change listener (Auto-refresh)
    useEffect(() => {
        if (!currentFolder || currentFolder === 'Favorites' || currentFolder.startsWith('Tag: ') || currentFolder.startsWith('Tags (')) return;

        let debounceTimer = null;

        const handleFolderChange = async ({ type, path: changedPath }) => {
            const changedDir = await window.electron.getDirname(changedPath);
            const normalize = (p) => p ? p.replace(/[\\/]+/g, '/').replace(/\/+$/, '').toLowerCase() : '';
            if (normalize(changedDir) === normalize(currentFolder)) {
                if (debounceTimer) clearTimeout(debounceTimer);
                debounceTimer = setTimeout(async () => {
                    const updatedImages = await FileSystem.scanFolder(currentFolder, panelId);
                    setImages(applySort(updatedImages));
                    debounceTimer = null;
                }, 200);
            }
        };

        const removeListener = window.electron.onFolderChange((event, data) => handleFolderChange(data));
        return () => {
            if (removeListener) removeListener();
            if (debounceTimer) clearTimeout(debounceTimer);
        };
    }, [currentFolder, sortConfig]); // Added sortConfig to dependency

    // Handle folder selection
    const handleFolderSelect = async (folderPath) => {
        setCurrentFolder(folderPath);
        setLoading(true);
        let imgs = [];

        if (folderPath === 'Favorites') {
            const favPaths = JSON.parse(localStorage.getItem('yizi_fav_images') || '[]');
            imgs = favPaths.map(p => {
                const name = p.split(/[\\/]/).pop();
                // We need to encode it properly like pathToFileURL would
                // Since this is frontend, we'll construct the media URL carefully
                const cleanPath = p.replace(/\\/g, '/');
                let urlPath = cleanPath.split('/').map(encodeURIComponent).join('/');
                if (!urlPath.startsWith('/')) urlPath = '/' + urlPath;
                return {
                    name,
                    path: p,
                    url: `media://local${urlPath}`,
                    mtimeMs: 0
                };
            });
        } else {
            imgs = await FileSystem.scanFolder(folderPath, panelId);
        }

        setImages(applySort(imgs));
        setLoading(false);
        setSelectedIndices(new Set());
        setLastSelectedIndex(null);
        setViewingIndex(null);
    };

    // Handle tag selection
    const handleTagSelect = async (tags, mode = 'union') => {
        setCurrentFolder(null);
        const tagList = Array.isArray(tags) ? tags : [tags];

        if (tagList.length === 0) {
            setImages([]);
            setCurrentFolder(null);
            return;
        }

        setLoading(true);
        const files = await FileSystem.getFilesByTag(tagList, mode);
        setImages(applySort(files));
        setLoading(false);
        setSelectedIndices(new Set());
        setLastSelectedIndex(null);
        setViewingIndex(null);

        const modeStr = mode === 'intersection' ? 'AND' : 'OR';
        const displayStr = tagList.length === 1 ? `Tag: ${tagList[0]}` : `Tags (${modeStr}): ${tagList.join(', ')}`;
        setCurrentFolder(displayStr);
    };

    // Handle sort change
    const handleSortChange = (type, direction) => {
        const newConfig = { type, direction };
        setSortConfig(newConfig);
        setImages(applySort(images, newConfig));
    };

    // Navigation for viewer
    const handleNext = () => {
        if (viewingIndex !== null && viewingIndex < images.length - 1) {
            setViewingIndex(viewingIndex + 1);
        }
    };

    const handlePrev = () => {
        if (viewingIndex !== null && viewingIndex > 0) {
            setViewingIndex(viewingIndex - 1);
        }
    };

    // Image click handler
    const handleImageClick = (index, e) => {
        let newSelection = new Set(selectedIndices);

        if (e.shiftKey && lastSelectedIndex !== null) {
            const start = Math.min(lastSelectedIndex, index);
            const end = Math.max(lastSelectedIndex, index);

            if (!e.ctrlKey) {
                newSelection = new Set();
            }

            for (let i = start; i <= end; i++) {
                newSelection.add(i);
            }
        } else if (e.metaKey || e.ctrlKey) {
            if (newSelection.has(index)) {
                newSelection.delete(index);
            } else {
                newSelection.add(index);
            }
            setLastSelectedIndex(index);
        } else {
            newSelection = new Set([index]);
            setLastSelectedIndex(index);
        }

        setSelectedIndices(newSelection);
    };

    const handleSelectionChange = (newSelection) => {
        setSelectedIndices(newSelection);
    };

    const handleImageDoubleClick = (index) => {
        setViewingIndex(index);
    };

    return {
        // State
        currentFolder,
        images,
        loading,
        selectedIndices,
        lastSelectedIndex,
        viewingIndex,
        aspectRatio,
        sortConfig,

        // Setters
        setImages,
        setSelectedIndices,
        setLastSelectedIndex,
        setViewingIndex,
        setAspectRatio,
        setCurrentFolder,

        // Handlers
        handleFolderSelect,
        handleTagSelect,
        handleNext,
        handlePrev,
        handleImageClick,
        handleSelectionChange,
        handleImageDoubleClick,
        handleSortChange,
    };
};

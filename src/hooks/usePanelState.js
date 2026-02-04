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

    // Folder change listener (Auto-refresh)
    useEffect(() => {
        if (!currentFolder || currentFolder.startsWith('Tag: ') || currentFolder.startsWith('Tags (')) return;

        const handleFolderChange = async ({ type, path: changedPath }) => {
            // Check if context is the current folder
            const changedDir = await window.electron.getDirname(changedPath);

            if (changedDir === currentFolder) {
                // Refresh folder content
                const updatedImages = await FileSystem.scanFolder(currentFolder, panelId);
                setImages(updatedImages);
            }
        };

        const removeListener = window.electron.onFolderChange((event, data) => handleFolderChange(data));

        return () => {
            if (removeListener) removeListener();
        };
    }, [currentFolder]);

    // Handle folder selection
    const handleFolderSelect = async (folderPath) => {
        setCurrentFolder(folderPath);
        setLoading(true);
        const imgs = await FileSystem.scanFolder(folderPath, panelId);
        setImages(imgs);
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
        setImages(files);
        setLoading(false);
        setSelectedIndices(new Set());
        setLastSelectedIndex(null);
        setViewingIndex(null);

        const modeStr = mode === 'intersection' ? 'AND' : 'OR';
        const displayStr = tagList.length === 1 ? `Tag: ${tagList[0]}` : `Tags (${modeStr}): ${tagList.join(', ')}`;
        setCurrentFolder(displayStr);
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
    };
};

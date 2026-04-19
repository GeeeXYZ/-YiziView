import { useState, useEffect, useCallback, useRef } from 'react';
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
    const [aspectRatio, setAspectRatio] = useState(() => localStorage.getItem(`yizi_grid_aspect_ratio_${panelId}`) || '1:1');
    const [isRecursive, setIsRecursive] = useState(() => localStorage.getItem(`yizi_panel_recursive_${panelId}`) === 'true');
    const [history, setHistory] = useState([]);

    useEffect(() => {
        localStorage.setItem(`yizi_grid_aspect_ratio_${panelId}`, aspectRatio);
    }, [aspectRatio, panelId]);

    useEffect(() => {
        localStorage.setItem(`yizi_panel_recursive_${panelId}`, isRecursive);
    }, [isRecursive, panelId]);

    const [sortConfig, setSortConfig] = useState({ type: 'date', direction: 'desc' });

    const stateRef = useRef({ images, viewingIndex, selectedIndices });
    stateRef.current = { images, viewingIndex, selectedIndices };

    // Help application sort
    const applySort = useCallback((imgs, config = sortConfig, currentRecursive = isRecursive) => {
        const { type, direction } = config;
        let processedImages = imgs.filter(img => !img.isHeaderCard);

        if (currentRecursive) {
            // First pass: Group by subDir
            processedImages.sort((a, b) => {
                const subA = a.subDir || '';
                const subB = b.subDir || '';
                if (subA !== subB) {
                    if (subA !== '' && subB === '') return -1;
                    if (subA === '' && subB !== '') return 1;
                    return subA.localeCompare(subB);
                }
                
                // Secondary pass: Original Sort Logic
                if (type === 'name') {
                    const nameA = a.name.toLowerCase();
                    const nameB = b.name.toLowerCase();
                    return direction === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
                } else if (type === 'date') {
                    return direction === 'asc' ? a.mtimeMs - b.mtimeMs : b.mtimeMs - a.mtimeMs;
                }
                return 0;
            });

            // Second pass: Inject Header Dummy objects
            const finalImages = [];
            let currentGroup = null;

            for (const img of processedImages) {
                const group = img.subDir || '';
                if (group !== currentGroup) {
                    currentGroup = group;
                    // Only inject header for ACTUAL subdirectories
                    if (group !== '') {
                        finalImages.push({
                            path: `__header__${group}`, // Unique path id for key
                            isHeaderCard: true,
                            subDir: group,
                            name: group.split('/').pop() || group
                        });
                    }
                }
                finalImages.push(img);
            }
            return finalImages;
        } else {
            // Original sorting
            return processedImages.sort((a, b) => {
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
        }
    }, [sortConfig, isRecursive]);

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
                    const updatedImages = await FileSystem.scanFolder(currentFolder, panelId, isRecursive);
                    const sortedImages = applySort(updatedImages);
                    
                    const state = stateRef.current;
                    let newViewingIndex = state.viewingIndex;
                    let newSelectedIndices = new Set();
                    let newLastSelectedIndex = null;

                    if (state.viewingIndex !== null && state.images[state.viewingIndex]) {
                        const currentPath = state.images[state.viewingIndex].path;
                        newViewingIndex = sortedImages.findIndex(img => img.path === currentPath);
                        if (newViewingIndex === -1) {
                            // If original image deleted or renamed, try to fallback or clear
                            newViewingIndex = null;
                        } else {
                            newSelectedIndices = new Set([newViewingIndex]);
                            newLastSelectedIndex = newViewingIndex;
                        }
                    }

                    if (newViewingIndex === null) {
                        state.selectedIndices.forEach(idx => {
                            if (state.images[idx]) {
                                const path = state.images[idx].path;
                                const nIdx = sortedImages.findIndex(img => img.path === path);
                                if (nIdx !== -1) {
                                    newSelectedIndices.add(nIdx);
                                    newLastSelectedIndex = nIdx;
                                }
                            }
                        });
                    }

                    setImages(sortedImages);
                    setViewingIndex(newViewingIndex);
                    setSelectedIndices(newSelectedIndices);
                    setLastSelectedIndex(newLastSelectedIndex);
                    
                    debounceTimer = null;
                }, 200);
            }
        };

        const removeListener = window.electron.onFolderChange((event, data) => handleFolderChange(data));
        return () => {
            if (removeListener) removeListener();
            if (debounceTimer) clearTimeout(debounceTimer);
        };
    }, [currentFolder, panelId, applySort]); // Fixed dependencies

    // Handle folder selection
    const handleFolderSelect = async (folderPath, forcedRecursive = isRecursive, isBackNavigation = false) => {
        if (!isBackNavigation && currentFolder && folderPath !== currentFolder) {
            setHistory(prev => [...prev, currentFolder]);
        }
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
            imgs = await FileSystem.scanFolder(folderPath, panelId, forcedRecursive);
        }

        setImages(applySort(imgs, sortConfig, forcedRecursive));
        setLoading(false);
        setSelectedIndices(new Set());
        setLastSelectedIndex(null);
        setViewingIndex(null);
    };

    const handleBack = useCallback(() => {
        if (history.length > 0) {
            const prevFolder = history[history.length - 1];
            setHistory(prev => prev.slice(0, -1));
            handleFolderSelect(prevFolder, isRecursive, true);
        }
    }, [history, isRecursive]);

    // Trigger re-scan when isRecursive toggles
    useEffect(() => {
        if (currentFolder && !currentFolder.startsWith('Tag:') && currentFolder !== 'Favorites') {
            handleFolderSelect(currentFolder, isRecursive);
        }
    }, [isRecursive]);

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
            const nextIdx = viewingIndex + 1;
            setViewingIndex(nextIdx);
            setSelectedIndices(new Set([nextIdx]));
            setLastSelectedIndex(nextIdx);
        }
    };

    const handlePrev = () => {
        if (viewingIndex !== null && viewingIndex > 0) {
            const prevIdx = viewingIndex - 1;
            setViewingIndex(prevIdx);
            setSelectedIndices(new Set([prevIdx]));
            setLastSelectedIndex(prevIdx);
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
                if (images[i] && !images[i].isHeaderCard) {
                    newSelection.add(i);
                }
            }
        } else if (e.metaKey || e.ctrlKey) {
            if (newSelection.has(index)) {
                newSelection.delete(index);
            } else {
                if (images[index] && !images[index].isHeaderCard) newSelection.add(index);
            }
            if (images[index] && !images[index].isHeaderCard) setLastSelectedIndex(index);
        } else {
            if (images[index] && !images[index].isHeaderCard) {
                newSelection = new Set([index]);
                setLastSelectedIndex(index);
            } else {
                newSelection = new Set();
            }
        }

        setSelectedIndices(newSelection);
    };

    const handleSelectionChange = (newSelection) => {
        setSelectedIndices(newSelection);
    };

    const handleImageDoubleClick = (index) => {
        setViewingIndex(index);
        setSelectedIndices(new Set([index]));
        setLastSelectedIndex(index);
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
        isRecursive,

        // Setters
        setImages,
        setSelectedIndices,
        setLastSelectedIndex,
        setViewingIndex,
        setAspectRatio,
        setCurrentFolder,
        setIsRecursive,
        history,
        canGoBack: history.length > 0,
        handleBack,

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

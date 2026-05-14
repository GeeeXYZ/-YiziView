
import React, { useState, useEffect } from 'react'
import { FileSystem } from '@/managers/FileSystem'
import { PluginEngine } from '@/managers/PluginEngine'
import ContextMenu from '@/components/ui/ContextMenu';
import {
    Image as ImageIcon,
    Copy,
    Truck,
    Trash2,
    Folder,
    FileText,
    Check,
    Scissors,
    Clipboard,
    Heart,
    Edit2,
    RefreshCw,
    Wand2
} from 'lucide-react';
import Thumbnail from './Thumbnail';
import InputModal from '@/components/ui/InputModal';

const ImageGrid = ({ images = [], onImageClick, onImageDoubleClick, selectedIndices = new Set(), onBatchSelect, currentFolder, aspectRatio = '1:1', isActive = false, onRefresh, setConfirmModal }) => {
    // Existing states
    const [isDragSelecting, setIsDragSelecting] = useState(false);
    const [selectionBox, setSelectionBox] = useState(null);

    const isRealPath = currentFolder &&
        !currentFolder.startsWith('Tag: ') &&
        !currentFolder.startsWith('Tags (') &&
        currentFolder !== 'Favorites';
    const [contextMenu, setContextMenu] = useState(null);
    const [renameModal, setRenameModal] = useState({ isOpen: false, filePath: '', initialName: '', ext: '' });
    const containerRef = React.useRef(null);
    const dragStartPos = React.useRef(null);

    // Favorites Tracking
    const [favSet, setFavSet] = useState(() => new Set(JSON.parse(localStorage.getItem('yizi_fav_images') || '[]')));

    useEffect(() => {
        const updateFavs = () => {
            setFavSet(new Set(JSON.parse(localStorage.getItem('yizi_fav_images') || '[]')));
        };
        window.addEventListener('fav-images-updated', updateFavs);
        return () => window.removeEventListener('fav-images-updated', updateFavs);
    }, []);

    // Color Tags Tracking
    const [imageColors, setImageColors] = useState(() => JSON.parse(localStorage.getItem('yizi_image_colors') || '{}'));
    const [showColorTag, setShowColorTag] = useState(() => localStorage.getItem('yizi_show_color_tag') === 'true');

    useEffect(() => {
        const updateColors = () => setImageColors(JSON.parse(localStorage.getItem('yizi_image_colors') || '{}'));
        const updateToggle = () => setShowColorTag(localStorage.getItem('yizi_show_color_tag') === 'true');
        
        window.addEventListener('image-colors-updated', updateColors);
        window.addEventListener('color-tag-toggled', updateToggle);
        return () => {
            window.removeEventListener('image-colors-updated', updateColors);
            window.removeEventListener('color-tag-toggled', updateToggle);
        }
    }, []);

    const toggleFavorite = (e, path) => {
        e.stopPropagation();
        const favs = JSON.parse(localStorage.getItem('yizi_fav_images') || '[]');
        const isFav = favs.includes(path);
        let newFavs;
        if (isFav) {
            newFavs = favs.filter(p => p !== path);
        } else {
            newFavs = [...favs, path];
        }
        localStorage.setItem('yizi_fav_images', JSON.stringify(newFavs));
        window.dispatchEvent(new Event('fav-images-updated'));

        // Let App handle "Favorites" virtual folder refresh if necessary
        // Or user can just reload the category. For now this updates UI dynamically!
    };

    // New states from instruction
    const gridItemSizeRef = React.useRef(200); // Zoom state ref for performance

    const selectedIndicesRef = React.useRef(selectedIndices);
    selectedIndicesRef.current = selectedIndices;

    // --- Zoom Logic ---
    // Add non-passive listener to prevent browser zoom
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        // Init CSS var
        container.style.setProperty('--grid-item-size', `${gridItemSizeRef.current}px`);

        const wheelHandler = (e) => {
            if (e.ctrlKey) {
                e.preventDefault();
                const delta = e.deltaY * -0.5; // Sensitivity

                const current = gridItemSizeRef.current;
                const newSize = Math.max(100, Math.min(600, current + delta));

                if (newSize !== current) {
                    gridItemSizeRef.current = newSize;
                    container.style.setProperty('--grid-item-size', `${newSize}px`);

                    // Try focusing on the most recently selected image
                    let targetIndex = null;
                    const currentSelection = selectedIndicesRef.current;
                    if (currentSelection && currentSelection.size > 0) {
                        targetIndex = Array.from(currentSelection).pop();
                    }

                    if (targetIndex !== null) {
                        const width = container.clientWidth - 32; // padding px-4 * 2 = 32
                        const gridGap = 16;
                        const cols = Math.max(1, Math.floor((width + gridGap) / (newSize + gridGap)));
                        
                        const ratioParts = aspectRatio.split(':');
                        const hRatio = parseFloat(ratioParts[1]) / parseFloat(ratioParts[0]);
                        const calculatedItemHeight = newSize * hRatio + gridGap;
                        
                        const row = Math.floor(targetIndex / cols);
                        const targetY = row * calculatedItemHeight;
                        
                        // Center the item vertically in the viewport
                        container.scrollTop = targetY - (container.clientHeight / 2) + (calculatedItemHeight / 2);
                    }
                }
            }
        };

        container.addEventListener('wheel', wheelHandler, { passive: false });

        return () => {
            container.removeEventListener('wheel', wheelHandler);
        };
    }, [aspectRatio]);

    // Keyboard shortcuts moved to App.jsx for centralized management
    // Removed local useEffect for Ctrl+X/C/V

    // --- Native Drag (Output) ---
    const handleDragStart = (e, index) => {
        let paths = [];
        if (selectedIndices.has(index)) {
            // Dragging a selected item -> Drag all selected
            selectedIndices.forEach(idx => {
                if (images[idx] && !images[idx].isHeaderCard) paths.push(images[idx].path);
            });
        } else {
            // Dragging unselected item -> Drag only this one
            if (images[index] && !images[index].isHeaderCard) paths.push(images[index].path);
        }

        if (paths.length > 0) {
            e.preventDefault();
            FileSystem.startDrag(paths);
        }
    };

    // --- Drop Handling (Input) ---
    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'copy';
    };

    const handleDrop = async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (!currentFolder) return;

        let files = [];
        // Support Native File Drops
        if (e.dataTransfer.files.length > 0) {
            files = Array.from(e.dataTransfer.files)
                .map(f => window.electron.getFilePath(f))
                .filter(p => p);
        }

        if (files.length > 0) {
            // Prevent accidental "drop-in-place" flattening when dragging items within the same grid
            const isSelfDrop = files.every(p => images.some(img => img.path === p));
            if (isSelfDrop) return;

            const isCopy = e.ctrlKey;
            const collisions = await FileSystem.checkCollisions(files, currentFolder);

            const performDrop = async (overwrite = false, forceCopy = false) => {
                const actuallyIsCopy = isCopy || forceCopy;
                if (actuallyIsCopy) {
                    await FileSystem.copyItems(files, currentFolder, overwrite);
                } else {
                    await FileSystem.moveItems(files, currentFolder);
                }

                // Force thumbnail cache clear to show new image previews immediately
                await FileSystem.clearThumbnailsForFolder(currentFolder);
                window.dispatchEvent(new CustomEvent('folder-thumbnails-cleared', { detail: { folder: currentFolder, timestamp: Date.now() } }));

                if (onRefresh) onRefresh();
            };

            if (collisions.length > 0 && setConfirmModal) {
                setConfirmModal({
                    title: 'File Conflict',
                    message: `${collisions.length} file(s) already exist. What would you like to do?`,
                    confirmText: 'Overwrite',
                    confirmKind: 'danger',
                    secondaryText: 'Create Copy',
                    secondaryKind: 'primary',
                    cancelText: 'Cancel',
                    onConfirm: () => {
                        setConfirmModal(null);
                        performDrop(true);
                    },
                    onSecondary: () => {
                        setConfirmModal(null);
                        // If move conflict, convert to copy during 'Create Copies'
                        performDrop(false, !isCopy);
                    },
                    onCancel: () => setConfirmModal(null)
                });
            } else {
                await performDrop(false);
            }
        }
    };

    const handleContextMenu = (e, filePath) => {
        e.preventDefault();
        e.stopPropagation();

        // Snapshot the affected paths RIGHT NOW before any re-renders can change selectedIndices
        let affectedPaths = [];
        if (filePath) {
            const imgIndex = images.findIndex(img => img.path === filePath);
            const isSelected = imgIndex !== -1 && selectedIndices.has(imgIndex);

            if (isSelected && selectedIndices.size > 0) {
                // Right-clicked on a selected item -> affect ALL selected items
                selectedIndices.forEach(idx => {
                    if (images[idx] && !images[idx].isHeaderCard) affectedPaths.push(images[idx].path);
                });
            } else {
                // Right-clicked on an unselected item → affect only this one
                affectedPaths = [filePath];
                // Also select this image visually
                if (imgIndex !== -1) {
                    onImageClick(imgIndex, { ctrlKey: false, shiftKey: false, metaKey: false });
                }
            }
        }

        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            filePath,
            affectedPaths, // snapshot of paths to operate on
        });
    };

    const handleContextOption = async (action) => {
        const targetPath = contextMenu.filePath;
        const affectedPaths = contextMenu.affectedPaths || (targetPath ? [targetPath] : []);
        setContextMenu(null);

        if (action === 'cut') {
            await FileSystem.cutToClipboard(affectedPaths.length > 0 ? affectedPaths : [targetPath]);
        } else if (action === 'paste') {
            const internalState = FileSystem._clipboardState;
            let sources = [];
            let isCut = false;

            if (internalState && internalState.paths && internalState.paths.length > 0) {
                sources = internalState.paths;
                isCut = internalState.action === 'cut';
            } else {
                sources = await FileSystem.readClipboard();
            }

            if (sources.length > 0) {
                const collisions = await FileSystem.checkCollisions(sources, currentFolder);

                const performPaste = async (overwrite = false, forceCopy = false) => {
                    const actuallyIsCopy = !isCut || forceCopy;
                    if (!actuallyIsCopy) {
                        await FileSystem.moveItems(sources, currentFolder);
                        FileSystem._updateClipboard('copy', []);
                    } else {
                        await FileSystem.copyItems(sources, currentFolder, overwrite);
                    }

                    // Force thumbnail cache clear to show new image previews immediately
                    await FileSystem.clearThumbnailsForFolder(currentFolder);
                    window.dispatchEvent(new CustomEvent('folder-thumbnails-cleared', { detail: { folder: currentFolder, timestamp: Date.now() } }));

                    if (onRefresh) onRefresh();
                };

                if (collisions.length > 0 && setConfirmModal) {
                    setConfirmModal({
                        title: 'File Conflict',
                        message: `${collisions.length} file(s) already exist. What would you like to do?`,
                        confirmText: 'Overwrite',
                        confirmKind: 'danger',
                        secondaryText: 'Create Copy',
                        secondaryKind: 'primary',
                        cancelText: 'Cancel',
                        onConfirm: () => {
                            setConfirmModal(null);
                            performPaste(true);
                        },
                        onSecondary: () => {
                            setConfirmModal(null);
                            performPaste(false, isCut);
                        },
                        onCancel: () => setConfirmModal(null)
                    });
                } else {
                    await performPaste(false);
                }
            }
        } else if (action === 'copy') {
            await FileSystem.copyToClipboard(affectedPaths.length > 0 ? affectedPaths : [targetPath]);
        } else if (action === 'move_to' || action === 'copy_to') {
            const paths = affectedPaths.length > 0 ? affectedPaths : [targetPath];

            const destPath = await FileSystem.selectFolder();
            if (!destPath) return;

            if (action === 'move_to') {
                await FileSystem.moveItems(paths, destPath);
            } else {
                await FileSystem.copyItems(paths, destPath);
            }
        } else if (action === 'delete') {
            const pathsToDelete = affectedPaths.length > 0 ? affectedPaths : (targetPath ? [targetPath] : []);

            if (pathsToDelete.length === 0) return;

            const executeDelete = async () => {
                for (const p of pathsToDelete) {
                    await FileSystem.deleteFile(p);
                }
                if (onRefresh) onRefresh();
            };

            if (setConfirmModal && localStorage.getItem('settings_confirm_delete') !== 'false') {
                setConfirmModal({
                    title: 'Delete Items',
                    message: `Are you sure you want to move ${pathsToDelete.length} item(s) to the Recycle Bin?`,
                    confirmText: 'Move to Recycle Bin',
                    confirmKind: 'danger',
                    onConfirm: async () => {
                        setConfirmModal(null);
                        await executeDelete();
                    },
                    onCancel: () => setConfirmModal(null)
                });
            } else {
                executeDelete();
            }
        } else if (action === 'refresh') {
            if (isRealPath) {
                await FileSystem.clearThumbnailsForFolder(currentFolder);
                window.dispatchEvent(new CustomEvent('folder-thumbnails-cleared', { detail: { folder: currentFolder, timestamp: Date.now() } }));
            }
            if (onRefresh) onRefresh();
        } else if (action === 'rename') {
            const fileName = targetPath.split(/[/\\]/).pop();
            const lastDotIndex = fileName.lastIndexOf('.');
            const baseName = lastDotIndex !== -1 ? fileName.substring(0, lastDotIndex) : fileName;
            const ext = lastDotIndex !== -1 ? fileName.substring(lastDotIndex) : '';
            setRenameModal({ isOpen: true, filePath: targetPath, initialName: baseName, ext: ext });
        } else if (action === 'reveal') {
            FileSystem.showInFolder(targetPath || currentFolder);
        }
    };

    // --- Drag Selection Logic ---
    const handleMouseDown = (e) => {
        // Only start if left click and target is the container (or grid gap), not an image
        if (e.button !== 0) return;
        if (e.target.closest('.image-card')) return;
        // Don't start drag select when clicking inside context menu or modals
        if (contextMenu || e.target.closest('[class*="z-[1000]"]') || e.target.closest('[role="dialog"]')) return;

        e.stopPropagation(); // Prevent App from handling background click (which clears selection)

        setIsDragSelecting(true);
        const rect = containerRef.current.getBoundingClientRect();
        const startX = e.clientX - rect.left + containerRef.current.scrollLeft;
        const startY = e.clientY - rect.top + containerRef.current.scrollTop;

        dragStartPos.current = { x: startX, y: startY };
        setSelectionBox({ startX, startY, endX: startX, endY: startY });
    };

    const handleMouseMove = (e) => {
        if (!isDragSelecting) return;

        const rect = containerRef.current.getBoundingClientRect();
        const currentX = e.clientX - rect.left + containerRef.current.scrollLeft;
        const currentY = e.clientY - rect.top + containerRef.current.scrollTop;

        setSelectionBox({
            startX: dragStartPos.current.x,
            startY: dragStartPos.current.y,
            endX: currentX,
            endY: currentY
        });
    };

    const handleMouseUp = (e) => {
        if (!isDragSelecting) return;

        // Finalize Selection
        // Calculate collision with all children
        const box = getNormalizedBox(selectionBox);
        const newSelectedIndices = new Set(e.ctrlKey ? selectedIndices : []);

        const items = containerRef.current.querySelectorAll('[data-grid-item="true"]');
        items.forEach((item) => {
            const index = parseInt(item.getAttribute('data-original-index'), 10);
            if (isNaN(index)) return;

            const itemRect = item.getBoundingClientRect();
            const containerRect = containerRef.current.getBoundingClientRect();

            const itemLeft = itemRect.left - containerRect.left + containerRef.current.scrollLeft;
            const itemTop = itemRect.top - containerRect.top + containerRef.current.scrollTop;
            const itemRight = itemLeft + itemRect.width;
            const itemBottom = itemTop + itemRect.height;

            if (
                itemLeft < box.x + box.w &&
                itemRight > box.x &&
                itemTop < box.y + box.h &&
                itemBottom > box.y
            ) {
                if (images[index] && !images[index].isHeaderCard) {
                    newSelectedIndices.add(index);
                }
            }
        });

        // Communicate batch selection result to parent
        if (onBatchSelect) {
            onBatchSelect(newSelectedIndices);
        }

        setIsDragSelecting(false);
        setSelectionBox(null);
    };

    // Using a props proxy to avoid destructuring error if I use props.onBatchSelect inside function but destruction above
    // Let's just destructure it.

    // Helper
    const getNormalizedBox = (box) => {
        if (!box) return { x: 0, y: 0, w: 0, h: 0 };
        const x = Math.min(box.startX, box.endX);
        const y = Math.min(box.startY, box.endY);
        const w = Math.abs(box.endX - box.startX);
        const h = Math.abs(box.endY - box.startY);
        return { x, y, w, h };
    };

    const boxStyle = selectionBox ? {
        left: Math.min(selectionBox.startX, selectionBox.endX),
        top: Math.min(selectionBox.startY, selectionBox.endY),
        width: Math.abs(selectionBox.endX - selectionBox.startX),
        height: Math.abs(selectionBox.endY - selectionBox.startY),
        opacity: 1
    } : {};

    // We need to attach event listeners to window for mouse up/move to allow dragging outside container
    React.useEffect(() => {
        if (isDragSelecting) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragSelecting, selectionBox]); // Add selectionBox dependency for current pos updates? No, refs or state.

    // --- Virtualization Logic ---
    const [scrollTop, setScrollTop] = useState(0);
    const [containerHeight, setContainerHeight] = useState(0);
    const [containerWidth, setContainerWidth] = useState(0);
    const [columns, setColumns] = useState(1);
    const gridGap = 16; // 4 * gap-4 (1rem = 16px)

    useEffect(() => {
        const updateLayout = () => {
            if (!containerRef.current) return;
            const width = containerRef.current.clientWidth - 32; // px-4 * 2
            const currentItemWidth = gridItemSizeRef.current;
            const cols = Math.max(1, Math.floor((width + gridGap) / (currentItemWidth + gridGap)));
            setColumns(cols);
            setContainerWidth(width); // Store width for precise math math
            setContainerHeight(containerRef.current.clientHeight);
        };

        const resizeObserver = new ResizeObserver(updateLayout);
        if (containerRef.current) resizeObserver.observe(containerRef.current);
        updateLayout();

        // Also update when zoom changes
        const container = containerRef.current;
        const observer = new MutationObserver(updateLayout);
        observer.observe(container, { attributes: true, attributeFilter: ['style'] });

        return () => {
            resizeObserver.disconnect();
            observer.disconnect();
        };
    }, []);

    const handleScroll = (e) => {
        setScrollTop(e.target.scrollTop);
    };

    // --- Dynamic Padding Logic for Multiple Groups ---
    const paddedImages = React.useMemo(() => {
        if (!images || images.length === 0) return [];
        const hasHeaders = images.some(img => img.isHeaderCard);
        if (!hasHeaders) {
            return images.map((img, idx) => ({ ...img, originalIndex: idx }));
        }

        const result = [];
        let currentGroup = [];
        for (let i = 0; i < images.length; i++) {
            if (images[i].isHeaderCard && currentGroup.length > 0) {
                result.push(...currentGroup);
                const remainder = result.length % columns;
                if (remainder !== 0) {
                    const padCount = columns - remainder;
                    for (let p = 0; p < padCount; p++) {
                        result.push({ isSpacer: true, path: `spacer_${images[i].subDir}_${p}` });
                    }
                }
                currentGroup = [];
            }
            currentGroup.push({ ...images[i], originalIndex: i });
        }
        if (currentGroup.length > 0) {
            result.push(...currentGroup);
        }
        return result;
    }, [images, columns]);

    // Calculate virtual items using precise mathematically stretched 1fr widths
    const ratioValue = aspectRatio.split(':');
    const hRatio = parseFloat(ratioValue[1]) / parseFloat(ratioValue[0]);
    // The CSS grid is 1fr bounded, so real items dynamically stretch.
    const actualItemWidth = columns > 0 && containerWidth > 0 
        ? (containerWidth - (columns - 1) * gridGap) / columns 
        : gridItemSizeRef.current;
    
    const calculatedItemHeight = actualItemWidth * hRatio + gridGap;

    const totalRows = Math.ceil(paddedImages.length / columns);
    const startIndex = Math.max(0, Math.floor(scrollTop / calculatedItemHeight) * columns);
    const endIndex = Math.min(paddedImages.length, Math.ceil((scrollTop + containerHeight) / calculatedItemHeight) * columns + columns); // Extra row for safety

    const visibleImages = paddedImages.slice(startIndex, endIndex);
    const offsetY = Math.floor(startIndex / columns) * calculatedItemHeight;

    // Calculate Group Backgrounds dynamically based on Math Rows
    const groupMath = React.useMemo(() => {
        if (!paddedImages || paddedImages.length === 0) return [];
        const groups = [];
        let currentGroup = null;

        for (let i = 0; i < paddedImages.length; i++) {
            if (paddedImages[i].isHeaderCard) {
                if (currentGroup) {
                    currentGroup.end = i - 1;
                    groups.push(currentGroup);
                }
                currentGroup = {
                    subDir: paddedImages[i].subDir,
                    start: i,
                    end: i
                };
            } else if (currentGroup && paddedImages[i].subDir !== currentGroup.subDir && !paddedImages[i].isSpacer) {
                // If we hit an image that doesn't match our group (e.g. root images), close the box!
                currentGroup.end = i - 1;
                groups.push(currentGroup);
                currentGroup = null;
            }
        }
        if (currentGroup) {
            currentGroup.end = paddedImages.length - 1;
            groups.push(currentGroup);
        }

        // Convert array indices to physical bounding rects
        return groups.map(g => {
            const startRow = Math.floor(g.start / columns);
            const MathEndRow = Math.floor(g.end / columns);
            
            return {
                ...g,
                top: startRow * calculatedItemHeight,
                height: (MathEndRow - startRow + 1) * calculatedItemHeight
            };
        });
    }, [paddedImages, columns, calculatedItemHeight]);

    return (
        <div
            ref={containerRef}
            className="flex-1 bg-neutral-900 overflow-y-auto relative select-none"
            onMouseDown={handleMouseDown}
            onContextMenu={(e) => handleContextMenu(e, null)}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onScroll={handleScroll}
        >
            <div className="p-4 relative" style={{ height: totalRows * calculatedItemHeight }}>
                {/* Background Group Math Layers */}
                {groupMath.length > 0 && (
                    <div className="absolute top-4 left-4 right-4 pointer-events-none z-0">
                        {groupMath.map(g => (
                            <div key={g.subDir}
                                className="absolute bg-white/[0.02] border border-white/5 rounded-xl"
                                style={{
                                    top: g.top - 6,
                                    left: -6,
                                    right: -6,
                                    height: g.height - gridGap + 12
                                }}
                            />
                        ))}
                    </div>
                )}

                {/* Selection Box */}
                {isDragSelecting && (
                    <div
                        className="absolute bg-blue-500/30 border border-blue-400 z-50 pointer-events-none"
                        style={boxStyle}
                    />
                )}

                {paddedImages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                        <ImageIcon size={64} className="mb-4 opacity-20" />
                        <p>Select a folder to view images</p>
                    </div>
                ) : (
                    <div
                        className="grid gap-4"
                        style={{
                            gridTemplateColumns: `repeat(auto-fill, minmax(var(--grid-item-size, 200px), 1fr))`,
                            transform: `translateY(${offsetY}px)`
                        }}
                    >
                        {visibleImages.map((img, relativeIndex) => {
                            const i = startIndex + relativeIndex;
                            const realIndex = img.originalIndex;

                            if (img.isSpacer) {
                                return <div key={img.path} className="pointer-events-none" />;
                            }

                            if (img.isHeaderCard) {
                                return (
                                    <div key={img.path} 
                                         data-grid-item="true"
                                         data-original-index={realIndex}
                                         className="relative rounded-lg flex flex-col items-center justify-center p-4 transition-all select-none z-10 group bg-transparent"
                                         style={{ aspectRatio: aspectRatio.replace(':', '/') }}>
                                        {/* Inner dashed stroke */}
                                        <div className="absolute inset-[4px] rounded-[calc(0.5rem-4px)] border-2 border-dashed border-neutral-700/40 pointer-events-none transition-colors group-hover:border-neutral-600/50"></div>
                                        
                                        <div className="bg-neutral-950/20 p-4 rounded-full border border-neutral-800 mb-3 shadow-[0_4px_12px_rgba(0,0,0,0.4)] text-neutral-400 z-10">
                                            <Folder size={28} strokeWidth={1} />
                                        </div>
                                        <span className="text-xs font-medium text-center uppercase tracking-[0.2em] break-all w-full leading-relaxed text-neutral-500 z-10">{img.name}</span>
                                    </div>
                                );
                            }

                            return (
                                <div
                                    key={img.path} // Use path as key for better stability
                                    data-grid-item="true"
                                    data-original-index={realIndex}
                                    onClick={(e) => onImageClick(realIndex, e)}
                                    // Make sure we pass the correct index up
                                    onDoubleClick={() => onImageDoubleClick(realIndex)}
                                    onContextMenu={(e) => handleContextMenu(e, img.path)}
                                    draggable="true"
                                    onDragStart={(e) => handleDragStart(e, realIndex)}
                                    className={`
                                        relative group cursor-pointer bg-neutral-800 rounded-lg overflow-hidden border-2 transition-all duration-200 image-card
                                        ${selectedIndices.has(realIndex) 
                                            ? (isActive 
                                                ? 'border-blue-500 shadow-[0_0_0_2px_rgba(59,130,246,0.3)]' 
                                                : 'border-neutral-500 shadow-[0_0_0_2px_rgba(115,115,115,0.3)]') 
                                            : 'border-transparent hover:border-neutral-600'}
                                    `}
                                    style={{
                                        aspectRatio: aspectRatio.replace(':', '/')
                                    }}
                                >
                                    <div className="w-full h-full bg-neutral-900 flex items-center justify-center">
                                        <Thumbnail
                                            src={img.url}
                                            path={img.path}
                                            alt={img.name}
                                            className="transition-transform duration-300 group-hover:scale-105"
                                            draggable="false"
                                        />
                                    </div>
                                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-1 text-xs text-white truncate opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none">
                                        {img.name}
                                    </div>

                                    {/* Top Left Indicators (Color Tag & Favorite) */}
                                    <div className="absolute top-2 left-2 flex items-center gap-2 z-30 pointer-events-none">
                                        {/* Color Tag Dot */}
                                        {showColorTag && imageColors && imageColors[img.path] && (
                                            <div 
                                                className="w-4 h-4 rounded-full pointer-events-none shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)] border-[1.5px] border-white/90"
                                                style={{ backgroundColor: imageColors[img.path] }}
                                            />
                                        )}
                                        
                                        {/* Favorite Heart */}
                                        <button
                                            onClick={(e) => toggleFavorite(e, img.path)}
                                            className={`pointer-events-auto transition-all drop-shadow-md ${favSet.has(img.path) ? 'text-[#A61616] opacity-100' : 'text-white/70 opacity-0 group-hover:opacity-100 hover:text-white'}`}
                                            title={favSet.has(img.path) ? "Unfavorite" : "Favorite"}
                                        >
                                            <Heart size={18} fill={favSet.has(img.path) ? "currentColor" : "none"} strokeWidth={1.5} />
                                        </button>
                                    </div>

                                    {/* Selection Check Circle */}
                                    {selectedIndices.has(realIndex) && (
                                        <div className={`absolute top-2 right-2 rounded-full p-0.5 shadow-sm z-20 ${isActive ? 'bg-blue-500' : 'bg-neutral-500'}`}>
                                            <Check size={12} className={isActive ? "text-white" : "text-neutral-200"} strokeWidth={3} />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {contextMenu && (
                (() => {
                    const pluginContextActions = PluginEngine.getActions()
                        .filter(a => a.showInContextMenu)
                        .map(a => ({
                            label: a.name,
                            icon: <Wand2 size={14} className="text-blue-400" />,
                            onClick: () => {
                                const targetPath = contextMenu.filePath;
                                const affectedPaths = contextMenu.affectedPaths || (targetPath ? [targetPath] : []);
                                setContextMenu(null);
                                a.onExecute(affectedPaths);
                            },
                            disabled: !contextMenu.filePath
                        }));

                    const baseOptions = [
                        { label: 'Cut', icon: <Scissors size={14} />, onClick: () => handleContextOption('cut'), disabled: !contextMenu.filePath },
                        { label: 'Copy', icon: <Copy size={14} />, onClick: () => handleContextOption('copy'), disabled: !contextMenu.filePath },
                        { label: 'Paste', icon: <Clipboard size={14} />, onClick: () => handleContextOption('paste'), disabled: !isRealPath },
                        { type: 'divider' },
                        { label: 'Rename', icon: <Edit2 size={14} />, onClick: () => handleContextOption('rename'), disabled: !contextMenu.filePath },
                        { type: 'divider' },
                        { label: 'Copy File Path', icon: <FileText size={14} />, onClick: () => { navigator.clipboard.writeText(contextMenu.filePath); setContextMenu(null); }, disabled: !contextMenu.filePath },
                        { label: 'Copy to...', icon: <Copy size={14} />, onClick: () => handleContextOption('copy_to'), disabled: !contextMenu.filePath },
                        { label: 'Move to...', icon: <Truck size={14} />, onClick: () => handleContextOption('move_to'), disabled: !contextMenu.filePath },
                        { label: 'Refresh', icon: <RefreshCw size={14} />, onClick: () => handleContextOption('refresh') },
                        { label: 'Show in Explorer', icon: <Folder size={14} />, onClick: () => handleContextOption('reveal'), disabled: !contextMenu.filePath && !isRealPath },
                        { type: 'divider' },
                        { label: 'Delete', icon: <Trash2 size={14} />, onClick: () => handleContextOption('delete'), danger: true, disabled: !contextMenu.filePath }
                    ];

                    const finalOptions = pluginContextActions.length > 0 
                        ? [...pluginContextActions, { type: 'divider' }, ...baseOptions]
                        : baseOptions;

                    return (
                        <ContextMenu
                            x={contextMenu.x}
                            y={contextMenu.y}
                            onClose={() => setContextMenu(null)}
                            options={finalOptions}
                        />
                    );
                })()
            )}

            {renameModal.isOpen && (
                <InputModal
                    isOpen={true}
                    title="Rename File"
                    initialValue={renameModal.initialName}
                    placeholder="Enter new file name"
                    onConfirm={async (newName) => {
                        if (newName && newName !== renameModal.initialName) {
                            const fullNewName = newName + renameModal.ext;
                            const success = await FileSystem.renameItem(renameModal.filePath, fullNewName);
                            if (success !== false) {
                                window.dispatchEvent(new CustomEvent('folder-tree-refresh')); // trigger refresh
                            }
                        }
                        setRenameModal({ isOpen: false, filePath: '', initialName: '', ext: '' });
                    }}
                    onCancel={() => setRenameModal({ isOpen: false, filePath: '', initialName: '', ext: '' })}
                />
            )}
        </div>
    )
}

export default ImageGrid

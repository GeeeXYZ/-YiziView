
import React, { useState, useEffect } from 'react'
import { FileSystem } from '@/managers/FileSystem'
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
    Clipboard
} from 'lucide-react';
import Thumbnail from './Thumbnail';

const ImageGrid = ({ images = [], onImageClick, onImageDoubleClick, selectedIndices = new Set(), onBatchSelect, currentFolder, aspectRatio = '1:1', isActive = false }) => {
    // Existing states
    const [isDragSelecting, setIsDragSelecting] = useState(false);
    const [selectionBox, setSelectionBox] = useState(null);
    const [contextMenu, setContextMenu] = useState(null);
    const containerRef = React.useRef(null);
    const dragStartPos = React.useRef(null);

    // New states from instruction
    const gridItemSizeRef = React.useRef(200); // Zoom state ref for performance

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
                }
            }
        };

        container.addEventListener('wheel', wheelHandler, { passive: false });

        return () => {
            container.removeEventListener('wheel', wheelHandler);
        };
    }, []); // Empty dependency array means this runs once on mount

    // Keyboard shortcuts moved to App.jsx for centralized management
    // Removed local useEffect for Ctrl+X/C/V

    // --- Native Drag (Output) ---
    // --- Native Drag (Output) ---
    const handleDragStart = (e, index) => {
        let paths = [];
        if (selectedIndices.has(index)) {
            // Dragging a selected item -> Drag all selected
            selectedIndices.forEach(idx => {
                if (images[idx]) paths.push(images[idx].path);
            });
        } else {
            // Dragging unselected item -> Drag only this one
            if (images[index]) paths.push(images[index].path);
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
            // Ctrl -> Copy, Default -> Move
            if (e.ctrlKey) {
                await FileSystem.copyItems(files, currentFolder);
            } else {
                await FileSystem.moveItems(files, currentFolder);
            }
        }
    };

    const handleContextMenu = (e, filePath) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            filePath,
            selected: selectedIndices.has(images.findIndex(img => img.path === filePath))
        });
    };

    const handleContextOption = async (action) => {
        const targetPath = contextMenu.filePath;
        setContextMenu(null);

        if (action === 'cut') {
            let paths = [targetPath];
            if (contextMenu.selected && selectedIndices.size > 1) {
                paths = [];
                selectedIndices.forEach(idx => {
                    if (images[idx]) paths.push(images[idx].path);
                });
            }
            await FileSystem.cutToClipboard(paths);
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
                if (isCut) {
                    await FileSystem.moveItems(sources, currentFolder);
                    FileSystem._updateClipboard('copy', []);
                } else {
                    await FileSystem.copyItems(sources, currentFolder);
                }
            }
        } else if (action === 'copy') {
            // If target is in selection, copy all selection. Else copy target only.
            let paths = [targetPath];
            if (contextMenu.selected && selectedIndices.size > 1) {
                paths = [];
                selectedIndices.forEach(idx => {
                    if (images[idx]) paths.push(images[idx].path);
                });
            }
            await FileSystem.copyToClipboard(paths);
        } else if (action === 'move_to' || action === 'copy_to') {
            // 1. Determine items
            let paths = [targetPath];
            if (contextMenu.selected && selectedIndices.size > 1) {
                paths = [];
                selectedIndices.forEach(idx => {
                    if (images[idx]) paths.push(images[idx].path);
                });
            }

            // 2. Select Destination
            const destPath = await FileSystem.selectFolder();
            if (!destPath) return; // Cancelled

            // 3. Execute
            if (action === 'move_to') {
                await FileSystem.moveItems(paths, destPath);
            } else {
                await FileSystem.copyItems(paths, destPath);
            }
        } else if (action === 'delete') {
            let paths = [targetPath];
            if (contextMenu.selected && selectedIndices.size > 1) {
                paths = [];
                selectedIndices.forEach(idx => {
                    if (images[idx]) paths.push(images[idx].path);
                });
            }

            for (const p of paths) {
                await FileSystem.deleteFile(p);
            }
        } else if (action === 'reveal') {
            FileSystem.showInFolder(targetPath);
        }
    };

    // --- Drag Selection Logic ---
    const handleMouseDown = (e) => {
        // Only start if left click and target is the container (or grid gap), not an image
        if (e.button !== 0) return;
        if (e.target.closest('.image-card')) return;

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
        const newSelectedIndices = new Set(e.ctrlKey ? selectedIndices : []); // Keep existing if Ctrl held

        // Use robust querySelector instead of children navigation
        // const gridChildren = containerRef.current.children[0].children; // Unsafe, Removed
        const items = containerRef.current.querySelectorAll('.image-card');

        items.forEach((item, index) => {
            const itemRect = item.getBoundingClientRect();
            const containerRect = containerRef.current.getBoundingClientRect();

            // Item position relative to container (scrolled)
            const itemLeft = itemRect.left - containerRect.left + containerRef.current.scrollLeft;
            const itemTop = itemRect.top - containerRect.top + containerRef.current.scrollTop;
            const itemRight = itemLeft + itemRect.width;
            const itemBottom = itemTop + itemRect.height;

            // Check intersection
            if (
                itemLeft < box.x + box.w &&
                itemRight > box.x &&
                itemTop < box.y + box.h &&
                itemBottom > box.y
            ) {
                newSelectedIndices.add(index);
            }
        });

        // We need to communicate this batch result up to App.
        // Since onImageClick handles single toggles, we need a new prop onBatchSelect?
        // Or we just synthesize calls? No batch is better.
        // But App doesn't have onBatchSelect. 
        // Let's HACK for now: Iterate and call? No, too many renders.
        // Ideally we refactor App to accept `setSelectedIndices` directly or `onSelectionChange`.
        // BUT, I can't change App prop signature easily without another rewrite.
        // Wait, onImageClick(index, e).

        // Let's just update selectedIndices directly via a new prop `onSelectionChange`?
        // Or change `onImageClick` to handle a Set? No.

        // I'll update App interaction in a second, but let's stick to modifying ImageGrid first. 
        // I will assume `onSelectionChange` exists? No, I must modify App again if I add it.
        // LIMITATION: I can only edit one file per tool use if strict. 
        // But I know I can modify App next step.
        // Whatever, I'll pass a special event to onImageClick? 
        // `onImageClick(newSet)`?

        // Let's add `onBatchSelect` prop to ImageGrid now, and allow it to be undefined, then update App.
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
    const [columns, setColumns] = useState(1);
    const gridGap = 16; // 4 * gap-4 (1rem = 16px)

    useEffect(() => {
        const updateLayout = () => {
            if (!containerRef.current) return;
            const width = containerRef.current.clientWidth - 32; // px-4 * 2
            const currentItemWidth = gridItemSizeRef.current;
            const cols = Math.max(1, Math.floor((width + gridGap) / (currentItemWidth + gridGap)));
            setColumns(cols);
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

    // Calculate virtual items
    const itemHeight = Math.floor(gridItemSizeRef.current * (aspectRatio === '1:1' ? 1 : (aspectRatio === '3:4' ? 1.33 : 0.75))) + gridGap;
    // Note: This matches the aspectRatio calculation in the grid.
    // For simplicity, let's use a more robust way to get height
    const ratioValue = aspectRatio.split(':');
    const hRatio = parseFloat(ratioValue[1]) / parseFloat(ratioValue[0]);
    const calculatedItemHeight = gridItemSizeRef.current * hRatio + gridGap;

    const totalRows = Math.ceil(images.length / columns);
    const startIndex = Math.max(0, Math.floor(scrollTop / calculatedItemHeight) * columns);
    const endIndex = Math.min(images.length, Math.ceil((scrollTop + containerHeight) / calculatedItemHeight) * columns + columns); // Extra row for safety

    const visibleImages = images.slice(startIndex, endIndex);
    const offsetY = Math.floor(startIndex / columns) * calculatedItemHeight;

    return (
        <div
            ref={containerRef}
            className="flex-1 bg-neutral-900 overflow-y-auto relative select-none"
            onMouseDown={handleMouseDown}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onScroll={handleScroll}
        >
            <div className="p-4 relative" style={{ height: totalRows * calculatedItemHeight }}>
                {/* Selection Box */}
                {isDragSelecting && (
                    <div
                        className="absolute bg-blue-500/30 border border-blue-400 z-50 pointer-events-none"
                        style={boxStyle}
                    />
                )}

                {images.length === 0 ? (
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
                            return (
                                <div
                                    key={img.path} // Use path as key for better stability
                                    onClick={(e) => onImageClick(i, e)}
                                    onDoubleClick={() => onImageDoubleClick(i)}
                                    onContextMenu={(e) => handleContextMenu(e, img.path)}
                                    draggable="true"
                                    onDragStart={(e) => handleDragStart(e, i)}
                                    className={`
                                        relative group cursor-pointer bg-neutral-800 rounded-lg overflow-hidden border-2 transition-all duration-200 image-card
                                        ${selectedIndices.has(i) ? 'border-blue-500 shadow-[0_0_0_2px_rgba(59,130,246,0.3)]' : 'border-transparent hover:border-neutral-600'}
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
                                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-1 text-xs text-white truncate opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                        {img.name}
                                    </div>

                                    {/* Selection Check Circle */}
                                    {selectedIndices.has(i) && (
                                        <div className="absolute top-2 right-2 bg-blue-500 rounded-full p-0.5 shadow-sm z-20">
                                            <Check size={12} className="text-white" strokeWidth={3} />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>      {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onClose={() => setContextMenu(null)}
                    options={[
                        { label: 'Cut', icon: <Scissors size={14} />, onClick: () => handleContextOption('cut') },
                        { label: 'Copy', icon: <Copy size={14} />, onClick: () => handleContextOption('copy') },
                        { label: 'Paste', icon: <Clipboard size={14} />, onClick: () => handleContextOption('paste') },
                        { type: 'divider' },
                        { label: 'Copy File Path', icon: <FileText size={14} />, onClick: () => { navigator.clipboard.writeText(contextMenu.filePath); setContextMenu(null); } },
                        { label: 'Copy to...', icon: <Copy size={14} />, onClick: () => handleContextOption('copy_to') },
                        { label: 'Move to...', icon: <Truck size={14} />, onClick: () => handleContextOption('move_to') },
                        { label: 'Delete', icon: <Trash2 size={14} />, onClick: () => handleContextOption('delete'), danger: true },
                        { label: 'Show in Explorer', icon: <Folder size={14} />, onClick: () => handleContextOption('reveal') }
                    ]}
                />
            )}
        </div>
    )
}

export default ImageGrid

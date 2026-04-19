import React, { useState } from 'react';
import { Copy, Check, Crosshair, Layers, ChevronLeft } from 'lucide-react';
import Sidebar from './Sidebar';
import ImageGrid from './ImageGrid';
import ImageViewer from './ImageViewer';
import BottomPanel from './BottomPanel';
import SortControl from './SortControl';
import { FileSystem } from '@/managers/FileSystem';

const CopyButton = ({ path }) => {
    const [copied, setCopied] = useState(false);
    return (
        <button
            onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(path);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }}
            className="text-gray-500 hover:text-white p-1 rounded transition-colors"
            title="Copy Path"
        >
            {copied ? <Check size={14} className="text-blue-400" /> : <Copy size={14} />}
        </button>
    );
};

/**
 * Panel component - represents a single view panel in split view
 * Each panel can independently browse folders and manage images
 */
const Panel = ({
    panelId,
    isActive,
    panelState,
    onActivate,
    setConfirmModal,
    hasCloseButton,
}) => {
    const [locateTrigger, setLocateTrigger] = React.useState(0);
    const [isPanelMaximized, setIsPanelMaximized] = React.useState(false);
    const [remoteImage, setRemoteImage] = React.useState(null);

    const {
        currentFolder,
        images,
        loading,
        selectedIndices,
        viewingIndex,
        aspectRatio,
        setImages,
        setSelectedIndices,
        setLastSelectedIndex,
        setViewingIndex,
        setAspectRatio,
        handleNext,
        handlePrev,
        handleImageClick,
        handleSelectionChange,
        handleImageDoubleClick,
        handleTagSelect,
        handleFolderSelect,
    } = panelState;

    // Handle delete in viewer
    const handleViewerDelete = () => {
        if (viewingIndex === null || !images[viewingIndex]) return;

        const pathToDelete = images[viewingIndex].path;

        const executeDelete = async () => {
            const success = await FileSystem.deleteFile(pathToDelete);
            if (success) {
                const newImages = images.filter((_, i) => i !== viewingIndex);
                setImages(newImages);

                if (newImages.length === 0) {
                    setViewingIndex(null);
                } else {
                    if (viewingIndex >= newImages.length) {
                        setViewingIndex(newImages.length - 1);
                    }
                }

                setSelectedIndices(new Set());
            }
        };

        if (localStorage.getItem('settings_confirm_delete') === 'false') {
            executeDelete();
        } else {
            setConfirmModal({
                title: 'Delete Image',
                message: `Are you sure you want to move "${images[viewingIndex].name}" to the Recycle Bin?`,
                confirmText: 'Move to Recycle Bin',
                confirmKind: 'danger',
                onConfirm: async () => {
                    setConfirmModal(null);
                    await executeDelete();
                },
                onCancel: () => setConfirmModal(null)
            });
        }
    };

    const handleBackgroundClick = (e) => {
        onActivate();
        if (e.target.classList.contains('image-grid-container')) {
            setSelectedIndices(new Set());
            setLastSelectedIndex(null);
        }
    };

    const [sidebarWidth, setSidebarWidth] = React.useState(() => {
        const savedWidth = localStorage.getItem(`sidebar_width_${panelId}`);
        return savedWidth ? parseInt(savedWidth) : 224; // 224px is w-56
    });

    const isResizingRef = React.useRef(false);

    const handleSidebarMouseDown = (e) => {
        e.preventDefault();
        isResizingRef.current = true;
        document.body.style.cursor = 'col-resize';

        const handleMouseMove = (mouseMoveEvent) => {
            if (!isResizingRef.current) return;
            // Calculate new width based on mouse pos. Need to factor in panel's left offset
            const panelElement = document.getElementById(`panel-container-${panelId}`);
            if (panelElement) {
                const panelRect = panelElement.getBoundingClientRect();
                let newWidth = mouseMoveEvent.clientX - panelRect.left;
                
                // Constraints
                if (newWidth < 150) newWidth = 150;
                if (newWidth > 600) newWidth = 600;
                
                setSidebarWidth(newWidth);
            }
        };

        const handleMouseUp = () => {
            isResizingRef.current = false;
            document.body.style.cursor = 'default';
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            // Save final width
            // Need latest state value, but closure has stale state. 
            // It's easier to just save it via an effect or using the ref trick, 
            // but for simplicity we'll just save it in an effect watching sidebarWidth
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    React.useEffect(() => {
        localStorage.setItem(`sidebar_width_${panelId}`, sidebarWidth.toString());
    }, [sidebarWidth, panelId]);

    // Keyboard shortcuts: Enter = fullscreen, Ctrl+Enter = panel-maximized
    React.useEffect(() => {
        if (!isActive) return; // only handle keys for the focused panel

        const handleKeyDown = (e) => {
            // Don't intercept when viewer is already open, or when typing in an input
            if (viewingIndex !== null) return;
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (selectedIndices.size !== 1) return;

            if (e.key === 'Enter') {
                e.preventDefault();
                const index = Array.from(selectedIndices)[0];
                if (e.ctrlKey || e.metaKey) {
                    // Ctrl/Cmd + Enter → panel-level view
                    setIsPanelMaximized(true);
                    setViewingIndex(index);
                } else {
                    // Enter → fullscreen view
                    setIsPanelMaximized(false);
                    setViewingIndex(index);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isActive, selectedIndices, viewingIndex]);

    // Cross-panel protocol: Allow plugins to trigger the "Maximize in Panel" native feature remotely
    React.useEffect(() => {
        const handleRemoteMaximize = (e) => {
            const { path, url, label } = e.detail || {};
            if (url) {
                // Support viewing remote images (e.g. from cloud orders in AI Studio)
                setRemoteImage({ path: url, url: url, name: label || 'Remote Image' });
                setIsPanelMaximized(true);
                return;
            }
            if (!path || !images) return;
            const index = images.findIndex(img => img.path === path);
            if (index !== -1) {
                setViewingIndex(index);
                setIsPanelMaximized(true);
                // Also update selection to visually lock onto it
                setSelectedIndices(new Set([index]));
                setLastSelectedIndex(index);
            }
        };
        window.addEventListener('maximize-in-panel', handleRemoteMaximize);
        return () => window.removeEventListener('maximize-in-panel', handleRemoteMaximize);
    }, [images, setViewingIndex, setSelectedIndices, setLastSelectedIndex]);

    return (
        <div
            id={`panel-container-${panelId}`}
            className="flex h-full overflow-hidden"
            onClick={onActivate}
        >
            {/* Sidebar - Independent for each panel */}
            <div 
                className="h-full flex flex-col bg-neutral-900/50 shrink-0 relative border-r border-neutral-800" 
                style={{ width: `${sidebarWidth}px` }}
                onMouseDown={onActivate}
            >
                <Sidebar
                    onFolderSelect={handleFolderSelect}
                    currentPath={currentFolder}
                    onTagSelect={handleTagSelect}
                    setConfirmModal={setConfirmModal}
                    locateTrigger={locateTrigger}
                />
                
                {/* Absolute Resize Handle (Zero Layout Gap) */}
                <div 
                    className="absolute right-0 top-0 bottom-0 w-[10px] translate-x-1/2 z-20 cursor-col-resize hover:bg-blue-500/20 transition-colors"
                    onMouseDown={handleSidebarMouseDown}
                    onDoubleClick={() => setSidebarWidth(224)}
                    title="Double click to reset width"
                />
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
                {/* Top Bar */}
                <div
                    className={`h-12 border-b border-neutral-800 flex items-center px-4 titlebar-drag-region shrink-0 transition-colors duration-200 ${isActive ? 'bg-blue-900/20 backdrop-blur' : 'bg-neutral-900/90 backdrop-blur'}`}
                    onMouseDown={onActivate}
                >
                    {/* Left Side Controls */}
                    <div className="flex items-center gap-1.5 mr-2 -ml-2 no-drag">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                panelState.handleBack();
                            }}
                            disabled={!panelState.canGoBack}
                            className={`px-2 rounded h-8 transition-colors flex items-center justify-center ${panelState.canGoBack ? 'text-gray-400 hover:bg-neutral-700/50 cursor-pointer' : 'text-neutral-700/50 cursor-not-allowed'}`}
                            title="Go Back"
                        >
                            <ChevronLeft size={20} strokeWidth={2.5} />
                        </button>
                    </div>

                    <div className={`flex-1 font-medium text-sm truncate text-center no-drag flex items-center justify-center gap-2 ${isActive ? 'text-blue-400' : 'text-gray-400'}`}>
                        {currentFolder && currentFolder !== 'Favorites' && !currentFolder.startsWith('Tag: ') && !currentFolder.startsWith('Tags ') && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setLocateTrigger(prev => prev + 1);
                                }}
                                className="text-gray-500 hover:text-white p-1 rounded transition-colors"
                                title="Locate in Tree"
                            >
                                <Crosshair size={14} />
                            </button>
                        )}
                        <span>{currentFolder ? (currentFolder.length > 60 ? '...' + currentFolder.slice(-60) : currentFolder) : `Panel ${panelId}`}</span>
                        {currentFolder && currentFolder !== 'Favorites' && !currentFolder.startsWith('Tag: ') && !currentFolder.startsWith('Tags ') && (
                            <CopyButton path={currentFolder} />
                        )}
                    </div>

                    {/* Right Side Controls */}
                    <div className={`flex items-center gap-1 ml-2 ${hasCloseButton ? 'mr-8' : ''}`}>
                        <button
                            onClick={() => panelState.setIsRecursive(prev => !prev)}
                            className={`px-2 rounded h-8 transition-colors flex items-center justify-center ${panelState.isRecursive ? 'bg-blue-500/20 text-blue-400' : 'hover:bg-neutral-700/50 text-gray-400'}`}
                            title="Penetration Browse (Include Subfolders)"
                        >
                            <Layers size={16} />
                        </button>
                        <SortControl
                            sortConfig={panelState.sortConfig}
                            onSortChange={panelState.handleSortChange}
                        />
                    </div>
                </div>

                {/* Content area */}
                <div className="flex-1 flex flex-col overflow-hidden relative" onMouseDown={handleBackgroundClick}>
                    {/* Grid - Scrollable */}
                    {loading ? (
                        <div className="flex items-center justify-center h-full text-gray-500">
                            Loading...
                        </div>
                    ) : (
                        <div className="absolute inset-0 flex flex-col min-w-0 bg-black/40 overflow-y-auto">
                            <ImageGrid
                                images={images}
                                selectedIndices={selectedIndices}
                                onImageClick={handleImageClick}
                                onImageDoubleClick={handleImageDoubleClick}
                                onBatchSelect={handleSelectionChange}
                                currentFolder={currentFolder}
                                aspectRatio={aspectRatio}
                                isActive={isActive}
                                onRefresh={() => handleFolderSelect(currentFolder)}
                                setConfirmModal={setConfirmModal}
                            />
                        </div>
                    )}

                    {/* Bottom Panel (Fixed Overlay) — hidden when panel is maximized */}
                    {!loading && !isPanelMaximized && (
                        <BottomPanel
                            isActive={isActive}
                            selectedIndices={selectedIndices}
                            images={images}
                            aspectRatio={aspectRatio}
                            setAspectRatio={setAspectRatio}
                            isViewing={viewingIndex !== null && !isPanelMaximized}
                            onTagsChange={() => {
                                if (currentFolder && currentFolder.startsWith('Tag: ')) {
                                    const tagName = currentFolder.replace('Tag: ', '');
                                    handleTagSelect(tagName);
                                }
                            }}
                            onPanelMaximize={(index) => {
                                setIsPanelMaximized(true);
                                setViewingIndex(index);
                            }}
                        />
                    )}

                    {/* Viewer — fullscreen when opened via double-click, panel-contained when opened via Maximize button */}
                    {viewingIndex !== null && !isPanelMaximized && !remoteImage && (
                        <div className="fixed inset-0 bg-black z-[200] flex flex-col items-center justify-center">
                            <ImageViewer
                                image={images[viewingIndex]}
                                onClose={() => setViewingIndex(null)}
                                onNext={handleNext}
                                onPrev={handlePrev}
                                onDelete={handleViewerDelete}
                                contained={false}
                            />
                        </div>
                    )}
                    {(viewingIndex !== null || remoteImage) && isPanelMaximized && (
                        <ImageViewer
                            image={remoteImage || images[viewingIndex]}
                            onClose={() => {
                                setViewingIndex(null);
                                setRemoteImage(null);
                                setIsPanelMaximized(false);
                            }}
                            onNext={remoteImage ? undefined : handleNext}
                            onPrev={remoteImage ? undefined : handlePrev}
                            onDelete={remoteImage ? undefined : handleViewerDelete}
                            contained={true}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default Panel;

import React, { useState } from 'react';
import { Copy, Check, Crosshair } from 'lucide-react';
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
    onDelete,
    onActivate,
    setConfirmModal,
    hasCloseButton,
}) => {
    const [locateTrigger, setLocateTrigger] = React.useState(0);

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

    return (
        <div
            id={`panel-container-${panelId}`}
            className="flex h-full overflow-hidden"
            onClick={onActivate}
        >
            {/* Sidebar - Independent for each panel */}
            <div 
                className="h-full flex flex-col bg-neutral-900/50 shrink-0" 
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
            </div>
            
            {/* Resize Handle */}
            <div 
                className="w-1 cursor-col-resize hover:bg-blue-500/50 bg-neutral-700/50 transition-colors shrink-0 z-10"
                onMouseDown={handleSidebarMouseDown}
                onDoubleClick={() => setSidebarWidth(224)}
                title="Double click to reset width"
            />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
                {/* Top Bar */}
                <div
                    className={`h-12 border-b border-neutral-800 flex items-center px-4 titlebar-drag-region shrink-0 transition-colors duration-200 ${isActive ? 'bg-blue-900/20 backdrop-blur' : 'bg-neutral-900/90 backdrop-blur'}`}
                    onMouseDown={onActivate}
                >
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

                    {/* Sort Controls - positioned on the right with margin to avoid close button */}
                    <div className={`ml-2 ${hasCloseButton ? 'mr-8' : ''}`}>
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

                    {/* Bottom Panel (Fixed Overlay) */}
                    {!loading && (
                        <BottomPanel
                            selectedIndices={selectedIndices}
                            images={images}
                            aspectRatio={aspectRatio}
                            setAspectRatio={setAspectRatio}
                            isViewing={viewingIndex !== null}
                            onTagsChange={() => {
                                if (currentFolder && currentFolder.startsWith('Tag: ')) {
                                    const tagName = currentFolder.replace('Tag: ', '');
                                    handleTagSelect(tagName);
                                }
                            }}
                        />
                    )}

                    {/* Viewer */}
                    {viewingIndex !== null && (
                        <div className="fixed inset-0 bg-black z-[200] flex flex-col items-center justify-center">
                            <ImageViewer
                                image={images[viewingIndex]}
                                onClose={() => setViewingIndex(null)}
                                onNext={handleNext}
                                onPrev={handlePrev}
                                onDelete={handleViewerDelete}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Panel;

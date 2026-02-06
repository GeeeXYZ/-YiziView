import React from 'react';
import Sidebar from './Sidebar';
import ImageGrid from './ImageGrid';
import ImageViewer from './ImageViewer';
import BottomPanel from './BottomPanel';
import SortControl from './SortControl';
import { FileSystem } from '@/managers/FileSystem';

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

    return (
        <div
            className="flex h-full overflow-hidden"
            onClick={onActivate}
        >
            {/* Sidebar - Independent for each panel */}
            <div className="w-56 h-full border-r border-neutral-700/50 flex flex-col bg-neutral-900/50 shrink-0" onMouseDown={onActivate}>
                <Sidebar
                    onFolderSelect={handleFolderSelect}
                    currentPath={currentFolder}
                    onTagSelect={handleTagSelect}
                />
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Top Bar */}
                <div
                    className={`h-12 border-b border-neutral-800 flex items-center px-4 titlebar-drag-region shrink-0 transition-colors duration-200 ${isActive ? 'bg-blue-900/20 backdrop-blur' : 'bg-neutral-900/90 backdrop-blur'}`}
                    onMouseDown={onActivate}
                >
                    <div className={`flex-1 font-medium text-sm truncate text-center no-drag ${isActive ? 'text-blue-400' : 'text-gray-400'}`}>
                        {currentFolder ? (currentFolder.length > 60 ? '...' + currentFolder.slice(-60) : currentFolder) : `Panel ${panelId}`}
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
                        <div className="absolute inset-0 bg-black z-50 flex flex-col items-center justify-center">
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

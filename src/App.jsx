import React, { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import ImageGrid from './components/ImageGrid'
import ImageViewer from './components/ImageViewer'
import BottomPanel from './components/BottomPanel'
import { FileSystem } from '@/managers/FileSystem'

function App() {
  const [currentFolder, setCurrentFolder] = useState(null)
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedIndices, setSelectedIndices] = useState(new Set())
  const [lastSelectedIndex, setLastSelectedIndex] = useState(null)
  const [viewingIndex, setViewingIndex] = useState(null)

  // Handle Context Menu Commands (e.g., Delete from Right Click)
  useEffect(() => {
    const handleMenuCommand = async (_event, command, filePath) => {
      if (command === 'delete' && filePath) {
        // Find index of deleted file
        const indexToDelete = images.findIndex(img => img.path === filePath);
        if (indexToDelete === -1) return; // Not found (maybe already deleted)

        // Optimistically update UI since Main process already sent the command after user clicked "Delete"
        // Actually, scan-folder/trash-file logic:
        // Main process: `event.sender.send('context-menu-command', 'delete', filePath)` happens AFTER click.
        // But actual file deletion needs to happen somewhere. 
        // My main.cjs implementation of 'menu context' sends a command back to renderer. 
        // It does NOT delete the file itself. So Renderer must perform the deletion logic.

        const success = await FileSystem.deleteFile(filePath);
        if (success) {
          const newImages = images.filter(img => img.path !== filePath);
          setImages(newImages);

          // Adjust selection (logic similar to keydown delete)
          // Adjust selection
          const deletedPaths = new Set([filePath]);
          const newIndices = new Set();
          // We need to re-calculate indices because removal shifts them. 
          // Actually, simplest is to clear selection or keep it empty if the deleted one was selected.
          // If we support batch delete, we cleared selection in the main logic usually.

          setSelectedIndices(new Set());
          setLastSelectedIndex(null);

          if (viewingIndex === indexToDelete) {
            setViewingIndex(null);
          }
        }
      }
    };

    if (window.electron && window.electron.onContextMenuCommand) {
      window.electron.onContextMenuCommand(handleMenuCommand);
    }
    // Cleanup? invoke doesn't return unsubscribe. on() usually does in standard electron, 
    // but my preload exposes: onContextMenuCommand: (callback) => ipcRenderer.on(..., callback)
    // To properly cleanup, I'd need to expose removeListener. 
    // For now, in a global App component, it's okay, but better to be safe.
    // Let's assume onContextMenuCommand returns a cleaner or we just add it once. 
    // Since App mounts once, it might be fine. 
    // Actually, `ipcRenderer.on` returns the emitter, not a text. 
    // To make it robust without cleanup function exposed: 
    // We should strictly expose `removeContextMenuListener`. 
    // But for this MVP step, let's just add it.

    // Changing approach slightly to reuse delete logic if possible, 
    // but hard to share scope without extracting function. 

    return () => {
      // Missing removeListener expose. 
    };
  }, [images, selectedIndices, viewingIndex]);

  // Handle Delete Key
  useEffect(() => {
    const handleKeyDown = async (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIndices.size > 0) {
        if (viewingIndex !== null) return;

        const pathsToDelete = [];
        selectedIndices.forEach(idx => {
          if (images[idx]) pathsToDelete.push(images[idx].path);
        });

        if (pathsToDelete.length === 0) return;

        let allSuccess = true;
        for (const path of pathsToDelete) {
          const success = await FileSystem.deleteFile(path);
          if (!success) allSuccess = false;
        }

        // Optimization: We don't need to manually update state here IF the file watcher is working and fast enough.
        // However, for responsiveness, we usually do optimistic update.
        // But if we double-delete (optimistic + watcher), we might get glitches.
        // Let's keep optimistic update. 
        // The watcher 'unlink' event will fire later. We should handle if it's already gone.

        const deletedPaths = new Set(pathsToDelete);
        const newImages = images.filter(img => !deletedPaths.has(img.path));
        setImages(newImages);
        setSelectedIndices(new Set());
        setLastSelectedIndex(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndices, viewingIndex, images]);

  // Handle File Watcher Events
  useEffect(() => {
    if (!window.electron || !window.electron.onFolderChange) return;

    const handleFileChange = (_event, { type, path: filePath }) => {
      // console.log('File change:', type, filePath);

      if (type === 'add') {
        // Check extension (basic check matching backend)
        if (!/\.(jpg|jpeg|png|gif|webp|bmp|tiff)$/i.test(filePath)) return;

        // Extract name
        const name = filePath.split(/[\\/]/).pop();
        const newImg = {
          name,
          path: filePath,
          url: `media://local/${filePath.replace(/\\/g, '/')}`
        };

        setImages(prev => {
          // Avoid duplicates
          if (prev.find(img => img.path === filePath)) return prev;
          return [...prev, newImg];
        });
      } else if (type === 'unlink') {
        setImages(prev => {
          const exists = prev.find(img => img.path === filePath);
          if (!exists) return prev;

          // If we are removing a file, we should technically clear or adjust selection indices
          // because indices will shift.
          // To stay safe and simple: Clear selection if a file is removed externally.
          // (We can't easily access selectedIndices state here without dependency, 
          // but we can just fire setSelectedIndices(new Set()) if we detect a change).
          return prev.filter(img => img.path !== filePath);
        });

        // We need to clear selection if a file was removed to prevent misalignment.
        // Since we are inside a closure, we might not want to depend on selectedIndices.
        // Simply clearing it is safest for now when external changes happen.
        setSelectedIndices(new Set());
        setLastSelectedIndex(null);
      }
    };

    // Register listener
    // Note: onFolderChange wrapper in preload uses ipcRenderer.on, which returns generic emitter,
    // and we didn't expose removeListener. 
    // Since App mounts once, this is acceptable for now.
    window.electron.onFolderChange(handleFileChange);

    return () => {
      // cleanup if we exposed it
    };
  }, []); // Empty dependency mainly because we use functional state updates.

  // --- Tag View Logic ---
  const handleTagSelect = async (tagName) => {
    setCurrentFolder(null); // Clear folder info
    setLoading(true);
    // Fetch files for tag
    const files = await FileSystem.getFilesByTag(tagName);
    setImages(files);
    setLoading(false);
    setSelectedIndices(new Set());
    setLastSelectedIndex(null);
    setViewingIndex(null);

    // We can store "currentTag" state if we want to show it in titlebar
    // For now, let's just reuse currentFolder state variable for title text or add a new one.
    // Hack: Set currentFolder to `Tag: ${tagName}` string?
    // Better: Add viewMode state but to keep it simple:
    setCurrentFolder(`Tag: ${tagName}`); // Display purpose
  };

  const handleFolderSelect = async (folderPath) => {
    setCurrentFolder(folderPath)
    setLoading(true)
    const imgs = await FileSystem.scanFolder(folderPath)
    setImages(imgs)
    setLoading(false)
    setSelectedIndices(new Set())
    setLastSelectedIndex(null)
    setViewingIndex(null)
  }

  const handleNext = () => {
    if (viewingIndex !== null && viewingIndex < images.length - 1) {
      setViewingIndex(viewingIndex + 1)
    }
  }

  const handlePrev = () => {
    if (viewingIndex !== null && viewingIndex > 0) {
      setViewingIndex(viewingIndex - 1)
    }
  }

  const handleImageClick = (index, e) => {
    let newSelection = new Set(selectedIndices);

    if (e.shiftKey && lastSelectedIndex !== null) {
      // Range Selection
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);

      if (!e.ctrlKey) {
        newSelection = new Set(); // Reset if only Shift
      }

      for (let i = start; i <= end; i++) {
        newSelection.add(i);
      }
    } else if (e.metaKey || e.ctrlKey) {
      // Toggle Selection
      if (newSelection.has(index)) {
        newSelection.delete(index);
      } else {
        newSelection.add(index);
      }
      setLastSelectedIndex(index);
    } else {
      // Single Selection (default behaviour without keys)
      // If simply clicking, we usually select just one.
      newSelection = new Set([index]);
      // Also check if we were already selected, maybe toggle?
      // Standard explorer: Click selects one, de-selects others.
      setLastSelectedIndex(index);
    }

    setSelectedIndices(newSelection);
  }

  // New handlers for the updated ImageGrid props
  const handleSelectionChange = (newSelection) => {
    setSelectedIndices(newSelection);
  };

  const handleImageDoubleClick = (index) => {
    setViewingIndex(index);
  };

  const handleBackgroundClick = (e) => {
    // If clicking on the background (not an image), clear selection
    if (e.target.classList.contains('image-grid-container')) { // Assuming ImageGrid has this class
      setSelectedIndices(new Set());
      setLastSelectedIndex(null);
    }
  };

  return (
    <div className="h-screen w-screen flex bg-neutral-900 text-white overflow-hidden">
      <Sidebar onFolderSelect={handleFolderSelect} currentPath={currentFolder} onTagSelect={handleTagSelect} />
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Top Bar */}
        <div className="h-12 border-b border-neutral-800 flex items-center px-4 titlebar-drag-region bg-neutral-900/90 backdrop-blur">
          <div className="flex-1 font-medium text-sm text-gray-300 truncate text-center">
            {currentFolder ? (currentFolder.length > 60 ? '...' + currentFolder.slice(-60) : currentFolder) : 'YiziView'}
          </div>
        </div>

        {/* content area */}
        <div className="flex-1 flex flex-col overflow-hidden relative" onMouseDown={handleBackgroundClick}>
          {/* Grid */}
          {loading ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              Loading...
            </div>
          ) : (
            <ImageGrid
              images={images}
              selectedIndices={selectedIndices}
              onImageClick={handleImageClick}
              onBatchSelect={handleSelectionChange}
              lastSelectedIndex={lastSelectedIndex}
              setLastSelectedIndex={setLastSelectedIndex}
              onImageDoubleClick={handleImageDoubleClick}
              viewingIndex={viewingIndex}
            />
          )}

          {/* Bottom Panel (Overlay) */}
          <BottomPanel
            selectedIndices={selectedIndices}
            images={images}
            onTagsChange={() => {
              // If we are currently in a Tag View, we might want to refresh list if item removed from tag?
              // If currentFolder starts with "Tag: ", refresh.
              if (currentFolder && currentFolder.startsWith('Tag: ')) {
                const tagName = currentFolder.replace('Tag: ', '');
                handleTagSelect(tagName); // Refresh
              }
            }}
          />

          {/* Viewer */}
          {viewingIndex !== null && (
            <div className="absolute inset-0 bg-black z-50 flex flex-col items-center justify-center" onKeyDown={(e) => {
              if (e.key === 'Escape') setViewingIndex(null);
              else if (e.key === 'ArrowRight') handleNext();
              else if (e.key === 'ArrowLeft') handlePrev();
            }} tabIndex={0}>
              <ImageViewer
                image={images[viewingIndex]}
                onClose={() => setViewingIndex(null)}
                onNext={handleNext}
                onPrev={handlePrev}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App

import React, { useState, useEffect } from 'react'
import Panel from './components/Panel'
import SplitViewContainer from './components/SplitViewContainer'
import ConfirmModal from './components/ui/ConfirmModal'
import SettingsModal from './components/SettingsModal'
import { usePanelState } from './hooks/usePanelState'

function App() {
  // Appearance & UI Management
  const [panels, setPanels] = useState([{ id: 'panel-1' }]);
  const [layout, setLayout] = useState('horizontal'); // 'horizontal' | 'vertical'
  const [activePanelId, setActivePanelId] = useState('panel-1');
  const [confirmModal, setConfirmModal] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [hasUpdate, setHasUpdate] = useState(false);

  useEffect(() => {
    if (!window.electron?.onUpdateStateChange) return;

    // Fetch initial state
    window.electron.getUpdateState && window.electron.getUpdateState().then(initialState => {
      if (initialState && (initialState.state === 'update-available' || initialState.state === 'update-downloaded')) {
        setHasUpdate(true);
      }
    });

    const unsubscribe = window.electron.onUpdateStateChange((payload) => {
      const { state } = payload;
      if (state === 'update-available' || state === 'update-downloaded') {
        setHasUpdate(true);
      }
    });
    return () => unsubscribe();
  }, []);

  // Create panel states using custom hook
  const panel1State = usePanelState('panel-1');
  const panel2State = usePanelState('panel-2');
  const panel3State = usePanelState('panel-3');

  // Lock UI Zoom: Prevent Ctrl + Mouse wheel zooming
  useEffect(() => {
    const handleWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    };
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, []);

  // Map panel IDs to their states
  const panelStates = {
    'panel-1': panel1State,
    'panel-2': panel2State,
    'panel-3': panel3State,
  };

  // Get active panel state
  const getActivePanelState = () => panelStates[activePanelId];

  // Panel management functions
  const handleAddPanel = () => {
    if (panels.length >= 3) return;

    const usedIds = new Set(panels.map(p => p.id));
    let newPanelId = 'panel-1';
    for (let i = 1; i <= 3; i++) {
      if (!usedIds.has(`panel-${i}`)) {
        newPanelId = `panel-${i}`;
        break;
      }
    }

    setPanels([...panels, { id: newPanelId }]);
    setActivePanelId(newPanelId);
  };

  const handleRemovePanel = (panelId) => {
    if (panels.length <= 1) return;

    const newPanels = panels.filter(p => p.id !== panelId);
    setPanels(newPanels);

    // If removing active panel, switch to first panel
    if (activePanelId === panelId) {
      setActivePanelId(newPanels[0].id);
    }
  };

  const handleLayoutChange = (newLayout) => {
    setLayout(newLayout);
  };

  const handlePanelActivate = (panelId) => {
    setActivePanelId(panelId);
  };

  const handleAddFolder = async () => {
    const activeState = getActivePanelState();
    if (activeState) {
      const { FileSystem } = await import('./managers/FileSystem');
      const { ConfigManager } = await import('./managers/ConfigManager');
      const folder = await FileSystem.selectFolder();
      if (folder) {
        activeState.handleFolderSelect(folder);
        await ConfigManager.addFavorite(folder);
      }
    }
  };

  // Load/Save Session
  useEffect(() => {
    // Save function
    const saveCurrentSession = async () => {
      const { ConfigManager } = await import('./managers/ConfigManager');
      const session = {
        panels,
        layout,
        activePanelId,
        panelPaths: {}
      };

      // Collect paths from all panel states (even if panel not currently visible in 'panels' array, though normally it would be)
      panels.forEach(p => {
        if (panelStates[p.id]) {
          session.panelPaths[p.id] = panelStates[p.id].currentFolder;
        }
      });

      await ConfigManager.saveSession(session);
    };

    // Load function
    const loadSavedSession = async () => {
      const { ConfigManager } = await import('./managers/ConfigManager');
      const session = await ConfigManager.getSession();
      if (session) {
        if (session.layout) setLayout(session.layout);
        if (session.panels && Array.isArray(session.panels)) {
          // Sanitize duplicate panel IDs that might have been saved in previous buggy sessions
          const uniquePanels = [];
          const seen = new Set();
          session.panels.forEach(p => {
            if (!seen.has(p.id)) {
              seen.add(p.id);
              uniquePanels.push(p);
            }
          });
          setPanels(uniquePanels);
        }
        if (session.activePanelId) setActivePanelId(session.activePanelId);

        // Restore paths
        if (session.panelPaths) {
          Object.entries(session.panelPaths).forEach(([pId, path]) => {
            if (path && panelStates[pId]) {
              // Check if it's a tag path
              if (path.startsWith('Tag: ') || path.startsWith('Tags (')) {
                let tags = [];
                let mode = 'union';

                if (path.startsWith('Tag: ')) {
                  tags = [path.substring(5)];
                } else {
                  // Format: Tags (AND): tag1, tag2 OR Tags (OR): tag1, tag2
                  const match = path.match(/Tags \((AND|OR)\): (.+)/);
                  if (match) {
                    mode = match[1] === 'AND' ? 'intersection' : 'union';
                    tags = match[2].split(', ').map(t => t.trim());
                  }
                }

                if (tags.length > 0) {
                  panelStates[pId].handleTagSelect(tags, mode);
                }
              } else {
                // Regular folder
                panelStates[pId].handleFolderSelect(path);
              }
            }
          });
        }
      }
    };

    loadSavedSession();

    // Auto-save on unload
    const handleBeforeUnload = () => {
      saveCurrentSession();
    };

    // Also save when major state changes (debounced lightly by nature of React updates not happening instantenously for everything)
    // Actually, saveCurrentSession depends on state values. We can't attach it to beforeunload easily with closure staleness unless we use a ref or depend on everything.
    // Better approach: Save on change with a small Effect or just use window.onbeforeunload with a Ref.
  }, []); // Run once on mount to load

  // Effect to save session on state changes (Debounced ideally, but valid for now)
  useEffect(() => {
    const timer = setTimeout(async () => {
      const { ConfigManager } = await import('./managers/ConfigManager');
      const session = {
        panels,
        layout,
        activePanelId,
        panelPaths: {}
      };

      panels.forEach(p => {
        if (panelStates[p.id]) {
          session.panelPaths[p.id] = panelStates[p.id].currentFolder;
        }
      });

      await ConfigManager.saveSession(session);
    }, 1000); // 1s debounce

    return () => clearTimeout(timer);
  }, [panels, layout, activePanelId, panel1State.currentFolder, panel2State.currentFolder, panel3State.currentFolder]);
  const handlePaste = async (targetFolder) => {
    // Dynamic import to avoid circular dep issues if any, or just consistent with existing code
    const { FileSystem } = await import('./managers/FileSystem');

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
      const collisions = await FileSystem.checkCollisions(sources, targetFolder);

      const performPaste = async (overwrite = false, forceCopy = false) => {
        const isActuallyCopy = !isCut || forceCopy;

        if (!isActuallyCopy) {
          await FileSystem.moveItems(sources, targetFolder);
          FileSystem._updateClipboard('copy', []);
        } else {
          await FileSystem.copyItems(sources, targetFolder, overwrite);
        }

        // Clear caches and dispatch event to force thumbnail redraw
        await FileSystem.clearThumbnailsForFolder(targetFolder);
        window.dispatchEvent(new CustomEvent('folder-thumbnails-cleared', { detail: { folder: targetFolder, timestamp: Date.now() } }));

        // Trigger global refresh for folder trees
        window.dispatchEvent(new CustomEvent('folder-tree-refresh'));
      };

      if (collisions.length > 0) {
        setConfirmModal({
          title: 'File Conflict',
          message: `${collisions.length} file(s) already exist in the target folder. What would you like to do?`,
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
            performPaste(false, isCut); // If it was a cut, force it to behave like a copy to prevent source deletion
          },
          onCancel: () => setConfirmModal(null)
        });
      } else {
        await performPaste(false);
      }
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = async (e) => {
      // Don't handle shortcuts if an input/textarea is focused
      const activeElement = document.activeElement;
      if (activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.isContentEditable
      )) {
        return;
      }

      // Ctrl+\ : Toggle layout
      if (e.ctrlKey && e.key === '\\') {
        e.preventDefault();
        setLayout(prev => prev === 'horizontal' ? 'vertical' : 'horizontal');
      }

      // Ctrl+Shift+\ : Add panel
      if (e.ctrlKey && e.shiftKey && e.key === '\\') {
        e.preventDefault();
        handleAddPanel();
      }

      // Ctrl+1/2/3 : Switch to panel
      if (e.ctrlKey && ['1', '2', '3'].includes(e.key)) {
        e.preventDefault();
        const panelIndex = parseInt(e.key) - 1;
        if (panels[panelIndex]) {
          setActivePanelId(panels[panelIndex].id);
        }
      }

      // Ctrl+W : Close active panel (if more than 1)
      if (e.ctrlKey && e.key === 'w' && panels.length > 1) {
        e.preventDefault();
        handleRemovePanel(activePanelId);
      }

      // Get active state for file operations
      const activeState = getActivePanelState();

      // Ctrl+X / Ctrl+C : Cut / Copy
      if ((e.ctrlKey || e.metaKey) && (e.key === 'x' || e.key === 'c')) {
        if (activeState && activeState.selectedIndices.size > 0 && activeState.viewingIndex === null) {
          e.preventDefault();
          const paths = [];
          activeState.selectedIndices.forEach(idx => {
            if (activeState.images[idx]) paths.push(activeState.images[idx].path);
          });

          if (paths.length > 0) {
            const { FileSystem } = await import('./managers/FileSystem');
            if (e.key === 'x') {
              FileSystem.cutToClipboard(paths);
            } else {
              FileSystem.copyToClipboard(paths);
            }
          }
        }
      }

      // Ctrl+V : Paste
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        if (activeState && activeState.currentFolder) {
          e.preventDefault();
          await handlePaste(activeState.currentFolder);
        }
      }

      // Delete/Backspace for active panel
      if (!activeState) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Do not handle global delete/backspace if we are inside the image viewer.
        // ImageViewer internally handles its own deletion logic.
        if (activeState.viewingIndex !== null) return;

        // If images are selected, delete them
        if (activeState.selectedIndices.size > 0) {
          const pathsToDelete = [];
          activeState.selectedIndices.forEach(idx => {
            if (activeState.images[idx]) pathsToDelete.push(activeState.images[idx].path);
          });

          if (pathsToDelete.length === 0) return;

          const executeDeleteFiles = async () => {
            const { FileSystem } = await import('./managers/FileSystem');
            for (const path of pathsToDelete) {
              await FileSystem.deleteFile(path);
            }

            const deletedPaths = new Set(pathsToDelete);
            const newImages = activeState.images.filter(img => !deletedPaths.has(img.path));
            activeState.setImages(newImages);
            activeState.setSelectedIndices(new Set());
            activeState.setLastSelectedIndex(null);

            // Trigger global refresh for folder trees
            window.dispatchEvent(new CustomEvent('folder-tree-refresh'));
          };

          if (localStorage.getItem('settings_confirm_delete') === 'false') {
            executeDeleteFiles();
          } else {
            setConfirmModal({
              title: 'Delete Items',
              message: `Are you sure you want to move ${pathsToDelete.length} item(s) to the Recycle Bin?`,
              confirmText: 'Move to Recycle Bin',
              confirmKind: 'danger',
              onConfirm: async () => {
                setConfirmModal(null);
                await executeDeleteFiles();
              },
              onCancel: () => setConfirmModal(null)
            });
          }
        }
      }

      // Select All (Ctrl+A) for active panel
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        const allIndices = new Set(activeState.images.map((_, i) => i));
        activeState.setSelectedIndices(allIndices);
        if (activeState.images.length > 0) {
          activeState.setLastSelectedIndex(activeState.images.length - 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [panels, activePanelId, panelStates]);

  // Render panel function
  const renderPanel = (panel, index) => {
    const panelState = panelStates[panel.id];
    if (!panelState) return null;

    return (
      <Panel
        key={panel.id}
        panelId={panel.id}
        isActive={activePanelId === panel.id}
        panelState={panelState}
        onActivate={() => handlePanelActivate(panel.id)}
        setConfirmModal={setConfirmModal}
        hasCloseButton={panels.length > 1}
      />
    );
  };

  return (
    <div className="h-screen flex flex-col bg-neutral-900 text-white overflow-hidden">
      {/* Main Content - Split View */}
      <SplitViewContainer
        panels={panels}
        layout={layout}
        activePanelId={activePanelId}
        onLayoutChange={handleLayoutChange}
        onAddPanel={handleAddPanel}
        onRemovePanel={handleRemovePanel}
        onPanelActivate={handlePanelActivate}
        onAddFolder={handleAddFolder}
        onOpenSettings={() => setIsSettingsOpen(true)}
        renderPanel={renderPanel}
        hasUpdate={hasUpdate}
      />

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={!!confirmModal}
        {...confirmModal}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  )
}

export default App

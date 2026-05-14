import React, { useState, useEffect } from 'react'
// Delta Update Test Marker - v0.9.4
import Panel from './components/Panel'
import SplitViewContainer from './components/SplitViewContainer'
import ConfirmModal from './components/ui/ConfirmModal'
import SettingsModal from './components/SettingsModal'
import { usePanelState } from './hooks/usePanelState'
import { PluginEngine } from './managers/PluginEngine'
import DynamicBottomDock from './components/DynamicBottomDock'
import DynamicRightDock from './components/DynamicRightDock'
import ImageViewer from './components/ImageViewer'
import { Columns, Rows, Plus, FolderPlus } from 'lucide-react'
import logo from './assets/logo.svg'
import ExtensionSlot from './components/ExtensionSlot'
import PluginMenuDropdown from './components/PluginMenuDropdown'
import { useTranslation } from './hooks/useTranslation'

function App() {
  const { t } = useTranslation();
  // Appearance & UI Management
  const [panels, setPanels] = useState([{ id: 'panel-1' }]);
  const [layout, setLayout] = useState('horizontal'); // 'horizontal' | 'vertical'
  const [activePanelId, setActivePanelId] = useState('panel-1');
  const [confirmModal, setConfirmModal] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [hasUpdate, setHasUpdate] = useState(false);
  const [globalViewerImage, setGlobalViewerImage] = useState(null);

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

  // Initialize System Proxy Behavior on Boot
  useEffect(() => {
    if (window.electron?.setNetworkMode) {
      // Default to "direct" mode to bypass proxy for OSS integration
      const proxyMode = localStorage.getItem('settings_network_mode') || 'direct';
      window.electron.setNetworkMode(proxyMode);
    }
  }, []);

  // Create panel states using custom hook
  const panel1State = usePanelState('panel-1');
  const panel2State = usePanelState('panel-2');
  const panel3State = usePanelState('panel-3');

  // Map panel IDs to their states
  const panelStates = {
    'panel-1': panel1State,
    'panel-2': panel2State,
    'panel-3': panel3State,
  };

  // Get active panel state
  const getActivePanelState = () => panelStates[activePanelId];

  const stateRef = React.useRef({ panels, activePanelId, panelStates });
  stateRef.current = { panels, activePanelId, panelStates };

  // Plugin Engine Registration
  useEffect(() => {
    PluginEngine.setAppHooks({
      addCustomPanel: (id, Component, title) => {
        const { panels } = stateRef.current;
        if (panels.length >= 3) return; // limit to 3 max for now
        
        let finalId = id;
        let counter = 1;
        while (panels.some(p => p.id === finalId)) {
          finalId = `${id}-${counter}`;
          counter++;
        }

        setPanels(prev => [...prev, { id: finalId, type: 'custom', component: Component, title }]);
        setActivePanelId(finalId);
      },
      getCurrentFolder: () => {
        const { activePanelId, panelStates } = stateRef.current;
        const activeState = panelStates[activePanelId];
        return activeState ? activeState.currentFolder : null;
      }
    });

    PluginEngine.initialize();
  }, []);

  // Events & Hot Reload
  useEffect(() => {
        const handleContextMenuMsg = (e, msg) => {
            if (msg === 'reload') window.location.reload();
            if (msg === 'toggle-devtools' && window.electron) window.electron.ipcRenderer.send('toggle-devtools');
            if (msg === 'quit' && window.electron) window.electron.ipcRenderer.send('quit');
        };
        const handleShowSettings = () => setIsSettingsOpen(true);
        const handlePluginChanged = () => {
            console.log('[Plugin HotReload] Plugin code changed. Reloading app...');
            window.location.reload();
        };

        const handleOpenGlobalViewer = (e) => {
            if (e.detail && e.detail.image) {
                setGlobalViewerImage(e.detail.image);
            }
        };

        const handlePluginOpenFolder = (e) => {
            if (e.detail && e.detail.path) {
                const { panelStates } = stateRef.current;
                // Force panel-1 (the primary UI image grid) to navigate.
                // If it was triggering on activeState (the plugin panel itself), it wouldn't be visibly rendered.
                const targetState = panelStates['panel-1'];
                if (targetState) {
                    targetState.handleFolderSelect(e.detail.path);
                }
            }
        };

        window.addEventListener('context-menu-action', handleContextMenuMsg);
        window.addEventListener('open-global-viewer', handleOpenGlobalViewer);
        window.addEventListener('plugin-open-folder', handlePluginOpenFolder);
        
        let stopPluginWatcher = null;
        if (window.electron && window.electron.onPluginChanged) {
            stopPluginWatcher = window.electron.onPluginChanged(handlePluginChanged);
        }

        return () => {
            window.removeEventListener('context-menu-action', handleContextMenuMsg);
            window.removeEventListener('open-global-viewer', handleOpenGlobalViewer);
            window.removeEventListener('plugin-open-folder', handlePluginOpenFolder);
            if (stopPluginWatcher) stopPluginWatcher();
        };
    }, []);

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
              title: t('deleteItems'),
              message: t('deleteItemsMsg', { count: pathsToDelete.length }),
              confirmText: t('moveToBin'),
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

      // Toggle Favorite (F) for active panel
      if (e.key.toLowerCase() === 'f') {
        if (activeState.viewingIndex !== null) return; // Handled by ImageViewer
        if (activeState.selectedIndices.size > 0) {
          e.preventDefault();
          const favs = JSON.parse(localStorage.getItem('yizi_fav_images') || '[]');
          const currentFavsSet = new Set(favs);
          
          let allFav = true;
          const pathsToToggle = [];
          
          activeState.selectedIndices.forEach(idx => {
            if (activeState.images[idx]) {
                const path = activeState.images[idx].path;
                pathsToToggle.push(path);
                if (!currentFavsSet.has(path)) {
                    allFav = false;
                }
            }
          });
          
          if (pathsToToggle.length > 0) {
              let newFavs;
              if (allFav) {
                  // If all are already favs, remove them from favs
                  newFavs = favs.filter(p => !pathsToToggle.includes(p));
              } else {
                  // Otherwise, add any that aren't already favs
                  newFavs = [...favs];
                  pathsToToggle.forEach(p => {
                      if (!currentFavsSet.has(p)) newFavs.push(p);
                  });
              }
              localStorage.setItem('yizi_fav_images', JSON.stringify(newFavs));
              window.dispatchEvent(new Event('fav-images-updated'));
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
      {/* Global Top Bar */}
      <div className="h-12 border-b border-neutral-800 flex items-center justify-between px-4 bg-neutral-900/50 shrink-0 titlebar-drag-region">
          {/* Left: Logo and Add Folder */}
          <div className="flex items-center gap-3 no-drag">
              <div className="relative cursor-pointer" onClick={() => setIsSettingsOpen(true)} title="Settings">
                  <img
                      src={logo}
                      alt="YiziView"
                      className="h-7 w-auto opacity-90 hover:opacity-100 transition-opacity"
                  />
                  {hasUpdate && (
                      <span className="absolute top-0 -right-1 flex h-2.5 w-2.5">
                          <span className="relative inline-flex rounded-full h-full w-full bg-red-500 border border-neutral-900 shadow-sm"></span>
                      </span>
                  )}
              </div>
              <div className="h-6 w-px bg-neutral-700"></div>
              <button
                  onClick={handleAddFolder}
                  className="bg-neutral-800 hover:bg-neutral-700 text-gray-300 hover:text-white text-xs py-1.5 px-3 rounded flex items-center gap-1.5 border border-neutral-700 transition-colors h-7"
                  title={t('addFolder')}
              >
                  <FolderPlus size={14} /> {t('addFolder')}
              </button>
          </div>

          {/* Center: Combined Layout and Panel Controls */}
          <div className="flex items-center gap-3 no-drag">
              {/* Layout Switcher */}
              <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 font-medium">{t('layout')}:</span>
                  <div className="flex bg-neutral-900 rounded border border-neutral-700 p-1 gap-1">
                      <button
                          onClick={() => handleLayoutChange('horizontal')}
                          className={`p-1.5 rounded transition-colors ${layout === 'horizontal'
                              ? 'bg-neutral-700 text-white'
                              : 'text-gray-500 hover:text-gray-300'
                              }`}
                          title="Horizontal Split"
                      >
                          <Columns size={14} />
                      </button>
                      <button
                          onClick={() => handleLayoutChange('vertical')}
                          className={`p-1.5 rounded transition-colors ${layout === 'vertical'
                              ? 'bg-neutral-700 text-white'
                              : 'text-gray-500 hover:text-gray-300'
                              }`}
                          title="Vertical Split"
                      >
                          <Rows size={14} />
                      </button>
                  </div>
              </div>

              <div className="h-6 w-px bg-neutral-700"></div>

              {/* Panel Controls */}
              <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 font-medium">{t('panels')}:</span>
                  <div className="flex items-center gap-2 bg-neutral-900 rounded border border-neutral-700 px-2 py-1">
                      <span className="text-xs text-gray-400">
                          {panels.length}
                      </span>
                      {panels.length < 3 && (
                          <>
                              <div className="h-3 w-px bg-neutral-700"></div>
                              <button
                                  onClick={handleAddPanel}
                                  className="p-0.5 rounded hover:bg-neutral-700 text-blue-400 hover:text-blue-300 transition-colors"
                                  title={t('addPanel')}
                              >
                                  <Plus size={14} />
                              </button>
                          </>
                      )}
                  </div>
              </div>
          </div>

          {/* Right: Plugin UI actions & Spacer for OS window controls */}
          <div className="flex items-center justify-end h-full">
              <div className="flex items-center gap-2 no-drag pr-2">
                  <ExtensionSlot name="topbar-actions" />
                  <PluginMenuDropdown />
              </div>
              <div className="w-[138px] shrink-0" />
          </div>
      </div>

      {/* Main Content - Dock Layout Support */}
      <div className="flex flex-1 overflow-hidden relative">
        <div className="flex-1 flex flex-col relative overflow-hidden">
          <SplitViewContainer
            panels={panels}
            layout={layout}
            onRemovePanel={handleRemovePanel}
            renderPanel={renderPanel}
          />
          <DynamicBottomDock />
          <ExtensionSlot name="global-overlay" className="absolute top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none" />
        </div>
        <DynamicRightDock />
      </div>

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

      {/* Global Image Viewer for Plugins */}
      {globalViewerImage && (
        <div className="fixed inset-0 bg-black z-[300] flex flex-col items-center justify-center">
          <ImageViewer
            image={globalViewerImage}
            onClose={() => setGlobalViewerImage(null)}
            contained={false}
          />
        </div>
      )}
    </div>
  )
}

export default App

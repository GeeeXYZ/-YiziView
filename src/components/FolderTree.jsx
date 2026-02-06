import React, { useState, useEffect } from 'react';
import { FileSystem } from '@/managers/FileSystem';
import ContextMenu from '@/components/ui/ContextMenu';
import InputModal from '@/components/ui/InputModal';
import { useExpandedFolders } from '../contexts/ExpandedFoldersContext';
import {
    ChevronRight,
    Folder,
    FolderOpen,
    Plus,
    Edit2,
    Trash2,
    Copy,
    Scissors,
    Clipboard,
    FileInput
} from 'lucide-react';

const FolderTree = ({ name, path, onSelect, level = 0, currentPath, initialHasChildren = null, onRefresh, onConfirmDelete, refreshTrigger, searchQuery = '' }) => {
    const { expandedSet, setFolderExpanded } = useExpandedFolders() || {};
    const [isExpanded, setIsExpanded] = useState(() => {
        if (searchQuery) return false;
        return expandedSet?.has(path) || false;
    });

    // Sync with global expanded state
    useEffect(() => {
        if (!searchQuery && expandedSet && expandedSet.has(path) !== isExpanded) {
            setIsExpanded(expandedSet.has(path));
        }
    }, [expandedSet, path, searchQuery]);
    const [subfolders, setSubfolders] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [hasChildren, setHasChildren] = useState(initialHasChildren);

    // UI States
    const [contextMenu, setContextMenu] = useState(null); // { x, y }
    const [modalConfig, setModalConfig] = useState(null); // { type: 'create'|'rename', ... }
    const [isDragOver, setIsDragOver] = useState(false);
    const [isCut, setIsCut] = useState(false);

    useEffect(() => {
        const checkCutState = (clipboard) => {
            const state = clipboard || FileSystem._clipboardState;
            setIsCut(state.action === 'cut' && state.paths.includes(path));
        };

        const handleClipboardChange = (e) => checkCutState(e.detail);

        checkCutState();
        window.addEventListener('clipboard-changed', handleClipboardChange);
        return () => window.removeEventListener('clipboard-changed', handleClipboardChange);
    }, [path]);

    useEffect(() => {
        if (initialHasChildren === null) {
            checkChildren();
        }
    }, [path]);

    // Refresh when refreshTrigger changes
    useEffect(() => {
        if (refreshTrigger !== undefined) {
            // Always refresh when trigger changes, even if collapsed
            // This ensures deleted folders are removed from the list
            if (isExpanded) {
                refreshSubfolders();
            } else if (hasLoaded) {
                // If we had loaded before but are now collapsed, still refresh the list
                // so deleted items don't show up when we expand again
                refreshSubfolders();
            }
        }
    }, [refreshTrigger]);

    const checkChildren = async () => {
        const has = await FileSystem.checkHasSubdirectories(path);
        setHasChildren(has);
    };

    const refreshSubfolders = async () => {
        setIsLoading(true);
        const folders = await FileSystem.getSubdirectories(path);
        setSubfolders(folders);
        setHasLoaded(true);
        setIsLoading(false);
        if (folders.length === 0) setHasChildren(false);
        else setHasChildren(true);
    };

    const handleToggle = async (e) => {
        e && e.stopPropagation();

        const newState = !isExpanded;
        setIsExpanded(newState);

        if (!searchQuery && setFolderExpanded) {
            setFolderExpanded(path, newState);
        }

        if (newState && !hasLoaded) {
            await refreshSubfolders();
        }
    };

    // Auto-expand when searching
    useEffect(() => {
        const MAX_SEARCH_DEPTH = 10;
        if (searchQuery && level < MAX_SEARCH_DEPTH) {
            // Auto-expand if not expanded
            if (!isExpanded) setIsExpanded(true);

            // Only load if not loaded yet (avoids refreshing already loaded folders)
            if (!hasLoaded) {
                refreshSubfolders();
            }
        }
    }, [searchQuery]);

    const handleSelect = (e) => {
        e.stopPropagation();
        onSelect(path);
    };



    // --- Context Menu Logic ---
    const handleRightClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY });
    };

    const handleMenuOption = async (action) => {
        setContextMenu(null);
        if (action === 'create') {
            setModalConfig({ type: 'create', title: 'New Folder', initialValue: 'New Folder' });
        } else if (action === 'rename') {
            setModalConfig({ type: 'rename', title: 'Rename Folder', initialValue: name });
        } else if (action === 'delete') {
            const performDelete = async () => {
                const success = await FileSystem.deleteFile(path);
                if (success && onRefresh) onRefresh();
                if (success) {
                    window.dispatchEvent(new CustomEvent('folder-tree-refresh'));
                }
            };

            if (onConfirmDelete) {
                onConfirmDelete({
                    title: 'Delete Folder',
                    message: `Are you sure you want to move "${name}" to the Recycle Bin?`,
                    onConfirm: performDelete
                });
            } else {
                // Fallback to native confirm
                if (confirm(`Are you sure you want to delete "${name}"? This will move it to trash.`)) {
                    performDelete();
                }
            }
        } else if (action === 'cut') {
            FileSystem.cutToClipboard([path]);
        } else if (action === 'copy') {
            FileSystem.copyToClipboard([path]);
        } else if (action === 'paste') {
            const successCount = await FileSystem.pasteFromClipboard(path);
            if (successCount > 0) {
                // Refresh if expanded
                if (isExpanded) refreshSubfolders();
                if (onRefresh) onRefresh();
                window.dispatchEvent(new CustomEvent('folder-tree-refresh'));
            }
        }
    };

    const handleKeyDown = async (e) => {
        // Don't handle shortcuts if modal is open
        if (modalConfig) return;

        if (!e.ctrlKey && !e.metaKey) return;

        if (e.key === 'x') {
            e.preventDefault();
            FileSystem.cutToClipboard([path]);
        } else if (e.key === 'c') {
            e.preventDefault();
            FileSystem.copyToClipboard([path]);
        } else if (e.key === 'v') {
            e.preventDefault();
            handleMenuOption('paste');
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
            handleMenuOption('delete');
        }
    };

    // --- Modal Logic ---
    const handleModalConfirm = async (val) => {
        if (!val.trim()) return;

        if (modalConfig.type === 'create') {
            const success = await FileSystem.createFolder(path, val);
            if (success) {
                // Expand and refresh
                if (!isExpanded) handleToggle(null);
                else refreshSubfolders();
                window.dispatchEvent(new CustomEvent('folder-tree-refresh'));
            }
        } else if (modalConfig.type === 'rename') {
            const success = await FileSystem.renameItem(path, val);
            if (success) {
                // Rename successful
                if (onRefresh) onRefresh();
                window.dispatchEvent(new CustomEvent('folder-tree-refresh'));
            }
        }
        setModalConfig(null);
    };

    // --- Drag and Drop Logic ---
    const handleDragStart = (e) => {
        e.preventDefault();
        FileSystem.startDrag([path]);
    };

    const handleDragEnter = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Always set to 'copy' to allow drop (actual operation determined in handleDrop)
        e.dataTransfer.dropEffect = 'copy';
        setIsDragOver(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    };

    const handleDrop = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        let files = [];

        // Support Native File Drops (Electron native drag & OS files)
        if (e.dataTransfer.files.length > 0) {
            files = Array.from(e.dataTransfer.files)
                .map(f => window.electron.getFilePath(f))
                .filter(p => p);
        }

        if (files.length > 0) {
            // Check if we are trying to drop a folder into its own subfolder
            if (files.some(f => path.startsWith(f + '\\') || path.startsWith(f + '/'))) {
                console.warn('Cannot move a folder into its own subdirectories');
                return;
            }

            let successCount = 0;
            // Ctrl Key -> Copy, Otherwise -> Move
            if (e.ctrlKey) {
                successCount = await FileSystem.copyItems(files, path);
            } else {
                successCount = await FileSystem.moveItems(files, path);
            }

            if (successCount > 0) {
                // Refresh current folder if expanded
                if (isExpanded) {
                    await refreshSubfolders();
                }
                // Trigger global refresh for all folder trees
                window.dispatchEvent(new CustomEvent('folder-tree-refresh'));
            }
        }
    };

    const isSelected = currentPath === path;
    const paddingLeft = `${level * 12 + 8}px`;
    const isMatchingSearch = searchQuery && name.toLowerCase().includes(searchQuery.toLowerCase());

    // Scroll into view if matching
    const itemRef = React.useRef(null);
    useEffect(() => {
        if (isMatchingSearch && itemRef.current) {
            setTimeout(() => {
                itemRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }
    }, [isMatchingSearch]);

    return (
        <div className="select-none relative">

            <div
                ref={itemRef}
                tabIndex={0}
                className={`flex items-center py-1 pr-2 cursor-pointer transition-all text-sm border border-transparent outline-none ${isSelected ? 'bg-blue-600/30 text-blue-300 focus:bg-blue-600/40' : 'hover:bg-neutral-800 text-gray-300 focus:bg-neutral-800'
                    } ${isDragOver ? '!border-blue-500 !bg-blue-900/40' : ''} ${isCut ? 'opacity-40 grayscale-[0.5]' : ''} ${isMatchingSearch ? '!bg-yellow-900/30 !text-yellow-200' : ''} ${searchQuery && !isMatchingSearch ? 'opacity-40 hover:opacity-100' : ''}`}
                style={{ paddingLeft }}
                onClick={handleSelect}
                onKeyDown={handleKeyDown}
                onContextMenu={handleRightClick}
                draggable="true"
                onDragStart={handleDragStart}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {/* Arrow / Expander */}
                <div
                    onClick={hasChildren ? handleToggle : undefined}
                    className={`p-0.5 mr-1 rounded hover:bg-white/10 text-gray-400 group flex items-center justify-center ${!hasChildren ? 'invisible pointer-events-none' : 'cursor-pointer'}`}
                >
                    <ChevronRight
                        size={14}
                        className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                    />
                </div>

                {/* Icon */}
                <span className={`mr-2 ${isSelected ? 'text-blue-400' : 'text-yellow-500/80'}`}>
                    {isExpanded ? <FolderOpen size={16} fill="currentColor" fillOpacity={0.2} /> : <Folder size={16} fill="currentColor" fillOpacity={0.2} />}
                </span>

                {/* Name */}
                <span className="truncate flex-1 min-w-0" title={name}>{name}</span>
            </div>

            {/* Subfolders */}
            {isExpanded && (
                <div>
                    {isLoading && subfolders.length === 0 ? (
                        <div className="text-xs text-gray-600 py-1" style={{ paddingLeft: `${(level + 1) * 12 + 24}px` }}>
                            Loading...
                        </div>
                    ) : (
                        subfolders.map((folder) => (
                            <FolderTree
                                key={folder.path}
                                name={folder.name}
                                path={folder.path}
                                onSelect={onSelect}
                                level={level + 1}
                                currentPath={currentPath}
                                initialHasChildren={folder.hasChildren}
                                onRefresh={refreshSubfolders}
                                onConfirmDelete={onConfirmDelete}
                                refreshTrigger={refreshTrigger}
                                searchQuery={searchQuery}
                            />
                        ))
                    )}
                </div>
            )}

            {/* Context Menu */}
            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onClose={() => setContextMenu(null)}
                    options={[
                        { label: 'New Subfolder', icon: <Plus size={14} />, onClick: () => handleMenuOption('create') },
                        { label: 'Cut', icon: <Scissors size={14} />, onClick: () => handleMenuOption('cut') },
                        { label: 'Copy', icon: <Copy size={14} />, onClick: () => handleMenuOption('copy') },
                        { label: 'Paste', icon: <Clipboard size={14} />, onClick: () => handleMenuOption('paste') },
                        { type: 'divider' },
                        { label: 'Copy Folder Path', icon: <FileInput size={14} />, onClick: () => { navigator.clipboard.writeText(path); setContextMenu(null); } },
                        { label: 'Rename', icon: <Edit2 size={14} />, onClick: () => handleMenuOption('rename') },
                        { label: 'Delete', icon: <Trash2 size={14} />, onClick: () => handleMenuOption('delete'), danger: true },
                    ]}
                />
            )}

            {/* Input Modal */}
            <InputModal
                isOpen={!!modalConfig}
                title={modalConfig?.title}
                initialValue={modalConfig?.initialValue}
                placeholder="Folder Name"
                onConfirm={handleModalConfirm}
                onCancel={() => setModalConfig(null)}
            />
        </div>
    );
};

export default FolderTree;

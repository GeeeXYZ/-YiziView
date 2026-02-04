import React, { useState, useEffect } from 'react';
import { FileSystem } from '@/managers/FileSystem';
import ContextMenu from '@/components/ui/ContextMenu';
import InputModal from '@/components/ui/InputModal';
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

const FolderTree = ({ name, path, onSelect, level = 0, currentPath, initialHasChildren = null, onRefresh, onConfirmDelete }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [subfolders, setSubfolders] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [hasChildren, setHasChildren] = useState(initialHasChildren);

    // UI States
    const [contextMenu, setContextMenu] = useState(null); // { x, y }
    const [modalConfig, setModalConfig] = useState(null); // { type: 'create'|'rename', ... }
    const [isDragOver, setIsDragOver] = useState(false);

    useEffect(() => {
        if (initialHasChildren === null) {
            checkChildren();
        }
    }, [path]);

    const checkChildren = async () => {
        const has = await FileSystem.checkHasSubdirectories(path);
        setHasChildren(has);
    };

    const refreshSubfolders = async () => {
        if (!isExpanded) return; // If collapsed, next expand will fetch
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

        if (isExpanded) {
            setIsExpanded(false);
            return;
        }

        setIsExpanded(true);
        // Always fetch to ensure fresh data
        setIsLoading(true);
        const folders = await FileSystem.getSubdirectories(path);
        setSubfolders(folders);
        setHasLoaded(true);
        setIsLoading(false);
        if (folders.length === 0) setHasChildren(false);
    };

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
            }
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
            }
        } else if (modalConfig.type === 'rename') {
            const success = await FileSystem.renameItem(path, val);
            if (success) {
                // Rename successful
                if (onRefresh) onRefresh();
            }
        }
        setModalConfig(null);
    };

    // --- Drag and Drop Logic ---
    const handleDragEnter = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Force 'copy' visual to ensure drop is allowed by OS/Electron
        // Actual operation (Move vs Copy) is determined in handleDrop by Ctrl key
        e.dataTransfer.dropEffect = 'copy';
        setIsDragOver(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Prevent flickering if leaving to a child node
        // But here we are on the specific row div.
        setIsDragOver(false);
    };

    const handleDrop = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        setIsDragOver(false);

        let files = [];

        // Support Native File Drops (OS files)
        if (e.dataTransfer.files.length > 0) {
            files = Array.from(e.dataTransfer.files)
                .map(f => window.electron.getFilePath(f))
                .filter(p => p);
        }

        if (files.length > 0) {
            let successCount = 0;
            // Ctrl Key -> Copy, Otherwise -> Move
            if (e.ctrlKey) {
                successCount = await FileSystem.copyItems(files, path);
            } else {
                successCount = await FileSystem.moveItems(files, path);
            }

            if (successCount > 0) {
                // Refresh if expanded
                if (isExpanded) refreshSubfolders();
            }
        }
    };

    const isSelected = currentPath === path;
    const paddingLeft = `${level * 12 + 8}px`;

    return (
        <div className="select-none relative">
            <div
                className={`flex items-center py-1 pr-2 cursor-pointer transition-colors text-sm border border-transparent ${isSelected ? 'bg-blue-600/30 text-blue-300' : 'hover:bg-neutral-800 text-gray-300'
                    } ${isDragOver ? '!border-blue-500 !bg-blue-900/40' : ''}`}
                style={{ paddingLeft }}
                onClick={handleSelect}
                onContextMenu={handleRightClick}
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
                    {isLoading ? (
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

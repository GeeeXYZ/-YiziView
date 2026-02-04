
import React, { useState, useEffect } from 'react'
import { FileSystem } from '@/managers/FileSystem'
import { ConfigManager } from '@/managers/ConfigManager'
import FolderTree from './FolderTree'
import ConfirmModal from './ui/ConfirmModal'
import {
    File,
    FolderOpen,
    Tag,
    Tags,
    Star,
    X,
    Grid,
    Filter,
    Trash2,
    Search,
    Plus,
    Minus
} from 'lucide-react';

// Helper to get basename (simple version since we don't have node path in renderer directly standardly unless verified, 
// actually we can use a simple split. Windows uses \, but let's handle / too just in case)
const getBasename = (path) => {
    if (!path) return '';
    const separator = path.includes('\\') ? '\\' : '/';
    return path.split(separator).pop();
};

const Sidebar = ({ onFolderSelect, currentPath, onTagSelect }) => {
    // State
    const [tags, setTags] = useState([]);
    const [favorites, setFavorites] = useState([]);
    const [selectedTags, setSelectedTags] = useState(new Set()); // Changed to Set
    const [filterMode, setFilterMode] = useState('union'); // 'union' | 'intersection'
    const [tagSearch, setTagSearch] = useState('');
    const [editingTag, setEditingTag] = useState(null); // { name, newName }
    const [inputModal, setInputModal] = useState(null); // { type: 'rename'|'create', target, value }
    const [confirmModal, setConfirmModal] = useState(null);
    const [dragOverTag, setDragOverTag] = useState(null);

    // Resize State
    const [foldersHeight, setFoldersHeight] = useState(200); // Initial height for folders section
    const [isResizing, setIsResizing] = useState(false);

    useEffect(() => {
        loadFavorites();
        loadTags();

        const handleFavoritesUpdate = (e) => {
            if (e.detail) {
                setFavorites(e.detail);
            } else {
                loadFavorites();
            }
        };

        window.addEventListener('favorites-updated', handleFavoritesUpdate);
        return () => window.removeEventListener('favorites-updated', handleFavoritesUpdate);
    }, []);

    // Resize Logic
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isResizing) return;
            // Calculate new height based on mouse Y relative to sidebar top
            // Simplify: just use e.clientY minus header offset (roughly 50px)
            const newHeight = Math.max(100, Math.min(e.clientY - 50, window.innerHeight - 200));
            setFoldersHeight(newHeight);
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            document.body.style.cursor = 'default';
        };

        if (isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'row-resize';
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing]);

    const loadFavorites = async () => {
        const favs = await ConfigManager.loadFavorites();
        setFavorites(favs);
    };

    const handleOpenFolder = async () => {
        const folder = await FileSystem.selectFolder();
        if (folder) {
            onFolderSelect(folder);
            // Auto add to favorites
            const newFavs = await ConfigManager.addFavorite(folder);
            setFavorites(newFavs);
        }
    };

    const handleRemoveFavorite = async (e, path) => {
        e.preventDefault();
        e.stopPropagation();
        setConfirmModal({
            title: 'Remove from Quick Access',
            message: `Remove "${getBasename(path)}" from Quick Access?`,
            confirmText: 'Remove',
            confirmKind: 'primary',
            onConfirm: async () => {
                setConfirmModal(null);
                const newFavs = await ConfigManager.removeFavorite(path);
                setFavorites(newFavs);
            },
            onCancel: () => setConfirmModal(null)
        });
    };

    // --- Tag Logic ---
    const loadTags = async () => {
        try {
            const t = await ConfigManager.getTags();
            if (Array.isArray(t)) {
                setTags(t);
            } else {
                console.warn('Loaded tags is not an array, resetting:', t);
                setTags([]);
            }
        } catch (e) {
            console.error('Failed to load tags:', e);
            setTags([]);
        }
    };

    const handleTagInputKeyDown = async (e) => {
        if (e.key === 'Enter' && tagSearch.trim()) {
            const newTagName = tagSearch.trim();
            // Check existence
            if (Array.isArray(tags) && tags.find(t => t.name.toLowerCase() === newTagName.toLowerCase())) {
                // Already exists, just clear search or highlight?
                setTagSearch('');
                return;
            }
            try {
                const newTags = await ConfigManager.createTag(newTagName);
                if (Array.isArray(newTags)) {
                    setTags(newTags);
                }
                setTagSearch('');
            } catch (e) {
                console.error('Failed to create tag:', e);
            }
        }
    };

    const handleDeleteTag = async (e, tagName) => {
        e.preventDefault();
        e.stopPropagation();
        setConfirmModal({
            title: 'Delete Tag',
            message: `Delete tag "${tagName}"? This will remove the tag from all files.`,
            confirmText: 'Delete',
            confirmKind: 'danger',
            onConfirm: async () => {
                setConfirmModal(null);
                try {
                    const newTags = await ConfigManager.deleteTag(tagName);
                    if (Array.isArray(newTags)) {
                        setTags(newTags);
                    }
                } catch (e) {
                    console.error('Failed to delete tag:', e);
                }
            },
            onCancel: () => setConfirmModal(null)
        });
    };

    const handleTagClick = (tagName, e) => {
        const newSelection = new Set(e.ctrlKey || e.metaKey ? selectedTags : []);

        if (newSelection.has(tagName)) {
            newSelection.delete(tagName);
        } else {
            newSelection.add(tagName);
        }

        setSelectedTags(newSelection);

        // Convert to array for parent
        if (onTagSelect) onTagSelect(Array.from(newSelection), filterMode);
    };

    const handleStartRename = (e, tag) => {
        e.preventDefault();
        e.stopPropagation();
        setEditingTag({ name: tag.name, newName: tag.name });
    };

    const handleRenameKeyDown = async (e) => {
        if (e.key === 'Enter') {
            await handleRenameSubmit();
        } else if (e.key === 'Escape') {
            setEditingTag(null);
        }
    };

    const handleRenameSubmit = async () => {
        if (!editingTag) return;
        const { name, newName } = editingTag;
        const trimmedNewName = newName.trim();
        if (!trimmedNewName || name === trimmedNewName) {
            setEditingTag(null);
            return;
        }

        try {
            const newTags = await ConfigManager.renameTag(name, trimmedNewName);
            if (Array.isArray(newTags)) {
                setTags(newTags);

                // Update selectedTags if the renamed tag was selected
                if (selectedTags.has(name)) {
                    const newSelected = new Set(selectedTags);
                    newSelected.delete(name);
                    newSelected.add(trimmedNewName);
                    setSelectedTags(newSelected);
                    if (onTagSelect) onTagSelect(Array.from(newSelected), filterMode);
                }
            }
            setEditingTag(null);
        } catch (e) {
            console.error('Failed to rename tag:', e);
            setEditingTag(null);
        }
    };

    const handleModeChange = (mode) => {
        setFilterMode(mode);
        if (onTagSelect) onTagSelect(Array.from(selectedTags), mode);
    };

    const handleTagDrop = async (e, tagName) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOverTag(null);

        // Try to get data
        try {
            const yiziData = e.dataTransfer.getData('yizi/files');
            let files = [];

            if (yiziData) {
                files = JSON.parse(yiziData);
            } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                // Handle native file drop
                // Ensure f.path exists (Electron specific)
                files = Array.from(e.dataTransfer.files)
                    .map(f => window.electron.getFilePath(f))
                    .filter(p => p); // Remove undefined/null/empty
            }

            if (Array.isArray(files) && files.length > 0) {
                await ConfigManager.addFilesToTag(files, tagName);
            }
        } catch (err) {
            console.error('Tag Drop Error:', err);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault(); // Allow drop
        e.dataTransfer.dropEffect = 'copy';
    };

    const filteredTags = Array.isArray(tags)
        ? tags
            .filter(t => t.name.toLowerCase().includes(tagSearch.toLowerCase()))
            .sort((a, b) => a.name.localeCompare(b.name))
        : [];



    // ...

    return (
        <div className="flex flex-col h-full bg-neutral-800">
            {/* Split Container */}
            <div className="flex-1 flex flex-col min-h-0">

                {/* Top Section: Folders (Quick Access) */}
                <div
                    className="overflow-y-auto px-2 scrollbar-thin scrollbar-thumb-neutral-700"
                    style={{ height: foldersHeight, minHeight: 100 }}
                >
                    <div className="mt-4 mb-2 px-2 text-xs font-bold text-gray-500 uppercase tracking-wider flex justify-between group items-center">
                        <span className="flex items-center gap-1"><Star size={12} className="text-yellow-500" /> Quick Access</span>
                    </div>

                    <div className="space-y-0.5 pb-2">
                        {favorites.map(path => (
                            <div key={path} className="group relative">
                                <FolderTree
                                    name={getBasename(path)}
                                    path={path}
                                    onSelect={(p) => {
                                        setSelectedTags(new Set());
                                        onFolderSelect(p);
                                    }}
                                    currentPath={currentPath}
                                    onConfirmDelete={(config) => setConfirmModal({
                                        ...config,
                                        confirmKind: 'danger',
                                        confirmText: 'Delete',
                                        onCancel: () => setConfirmModal(null),
                                        onConfirm: async () => {
                                            setConfirmModal(null);
                                            await config.onConfirm();
                                        }
                                    })}
                                />
                                <button
                                    onClick={(e) => handleRemoveFavorite(e, path)}
                                    className="absolute right-1 top-1.5 opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 p-0.5 rounded transition-opacity"
                                    title="Remove from Quick Access"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        ))}
                        {favorites.length === 0 && (
                            <div className="px-4 py-8 text-center text-gray-600 text-sm italic">
                                No folders pinned
                            </div>
                        )}
                    </div>
                </div>

                {/* Resizer Handle */}
                <div
                    className="h-4 -my-2 flex items-center justify-center cursor-row-resize shrink-0 z-10 hover:bg-neutral-700/30 transition-colors mx-2"
                    onMouseDown={(e) => { e.preventDefault(); setIsResizing(true); }}
                >
                    <div className="w-full h-[1px] bg-neutral-700" />
                </div>

                {/* Bottom Section: Tags */}
                <div className="flex-1 overflow-y-auto px-2 pt-2 scrollbar-thin scrollbar-thumb-neutral-700 min-h-0 bg-neutral-800/50">
                    <div className="px-2 mb-2">
                        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex justify-between items-center h-6">
                            <span className="flex items-center gap-1"><Tags size={12} /> Tags</span>

                            {/* Filter Mode Toggle */}
                            {selectedTags.size > 1 && (
                                <div className="flex bg-neutral-900 rounded border border-neutral-700 p-1 gap-1">
                                    <button
                                        onClick={() => handleModeChange('union')}
                                        className={`p-1.5 rounded transition-colors ${filterMode === 'union' ? 'bg-neutral-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                                        title="Union (OR): Match any selected tag"
                                    >
                                        <Plus size={14} />
                                    </button>
                                    <button
                                        onClick={() => handleModeChange('intersection')}
                                        className={`p-1.5 rounded transition-colors ${filterMode === 'intersection' ? 'bg-neutral-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                                        title="Intersection (AND): Match all selected tags"
                                    >
                                        <Minus size={14} />
                                    </button>
                                </div>
                            )}
                        </div>
                        {/* Search / Add Tag Input */}
                        <div className="relative mb-2">
                            <input
                                type="text"
                                placeholder="Search or Create Tag..."
                                className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 pl-7 text-xs text-gray-300 focus:border-blue-500 focus:outline-none transition-colors"
                                value={tagSearch}
                                onChange={(e) => setTagSearch(e.target.value)}
                                onKeyDown={handleTagInputKeyDown}
                            />
                            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500" />
                        </div>

                        {/* Tag List */}
                        <div className="space-y-1 pb-4">
                            {filteredTags.length === 0 && tagSearch && (
                                <div className="text-gray-500 text-xs px-2 py-1 italic flex items-center gap-1">
                                    <Plus size={10} /> Press Enter to create "{tagSearch}"
                                </div>
                            )}
                            {filteredTags.length === 0 && !tagSearch && (
                                <div className="text-gray-500 text-xs px-2 py-1 italic">
                                    No tags
                                </div>
                            )}

                            {filteredTags.map(tag => (
                                <div
                                    key={tag.name}
                                    onClick={(e) => handleTagClick(tag.name, e)}
                                    onDoubleClick={(e) => handleStartRename(e, tag)}
                                    // 
                                    onDrop={(e) => handleTagDrop(e, tag.name)}
                                    onDragOver={handleDragOver}
                                    onDragEnter={() => setDragOverTag(tag.name)}
                                    onDragLeave={(e) => {
                                        if (!e.currentTarget.contains(e.relatedTarget)) {
                                            setDragOverTag(null);
                                        }
                                    }}
                                    className={`
                                            group flex items-center justify-between px-3 py-1.5 rounded-md cursor-pointer transition-all text-xs border border-transparent
                                            ${selectedTags.has(tag.name) ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:bg-neutral-700 hover:text-gray-200'}
                                            ${dragOverTag === tag.name ? '!border-blue-500 !bg-blue-900/40' : ''}
                                        `}
                                >
                                    <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                                        <Tag size={13} className="shrink-0" />
                                        {editingTag?.name === tag.name ? (
                                            <input
                                                autoFocus
                                                type="text"
                                                className="bg-neutral-900 border border-blue-500 rounded px-1 py-0 w-full text-xs text-white focus:outline-none"
                                                value={editingTag.newName}
                                                onChange={(e) => setEditingTag({ ...editingTag, newName: e.target.value })}
                                                onKeyDown={handleRenameKeyDown}
                                                onBlur={handleRenameSubmit}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        ) : (
                                            <span className="truncate" title={tag.name}>{tag.name}</span>
                                        )}
                                    </div>
                                    <button
                                        onClick={(e) => handleDeleteTag(e, tag.name)}
                                        className={`opacity-0 group-hover:opacity-100 transition-opacity p-0.5 ${selectedTags.has(tag.name) ? 'text-white hover:text-red-200' : 'text-gray-600 hover:text-red-400'}`}
                                        title="Delete Tag"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Confirm Modal */}
            <ConfirmModal
                isOpen={!!confirmModal}
                title={confirmModal?.title}
                message={confirmModal?.message}
                onConfirm={confirmModal?.onConfirm}
                onCancel={confirmModal?.onCancel}
                confirmText={confirmModal?.confirmText}
                confirmKind={confirmModal?.confirmKind}
            />
        </div>
    );
}

export default Sidebar

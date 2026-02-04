import React, { useState, useEffect } from 'react'
import { FileSystem } from '@/managers/FileSystem'
import { ConfigManager } from '@/managers/ConfigManager'
import FolderTree from './FolderTree'
import logo from '@/assets/logo.svg';
import {
    Plus,
    FolderOpen,
    Star,
    Tags,
    Tag,
    Trash2,
    X,
    Search
} from 'lucide-react';

// Helper to get basename (simple version since we don't have node path in renderer directly standardly unless verified, 
// actually we can use a simple split. Windows uses \, but let's handle / too just in case)
const getBasename = (path) => {
    if (!path) return '';
    const separator = path.includes('\\') ? '\\' : '/';
    return path.split(separator).pop();
};

const Sidebar = ({ onFolderSelect, currentPath, onTagSelect }) => {
    const [favorites, setFavorites] = useState([]);
    const [tags, setTags] = useState([]);
    const [tagSearch, setTagSearch] = useState('');
    const [selectedTag, setSelectedTag] = useState(null);

    useEffect(() => {
        loadFavorites();
        loadTags();
    }, []);

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
        if (confirm(`Remove "${getBasename(path)}" from Quick Access?`)) {
            const newFavs = await ConfigManager.removeFavorite(path);
            setFavorites(newFavs);
        }
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
        if (confirm(`Delete tag "${tagName}"?`)) {
            try {
                const newTags = await ConfigManager.deleteTag(tagName);
                if (Array.isArray(newTags)) {
                    setTags(newTags);
                }
            } catch (e) {
                console.error('Failed to delete tag:', e);
            }
        }
    };

    const handleTagClick = (tagName) => {
        setSelectedTag(tagName);
        if (onTagSelect) onTagSelect(tagName);
    };

    const handleTagDrop = async (e, tagName) => {
        e.preventDefault();
        e.stopPropagation();

        // Try to get data
        try {
            const data = e.dataTransfer.getData('yizi/files');
            if (data) {
                const files = JSON.parse(data);
                if (Array.isArray(files) && files.length > 0) {
                    await ConfigManager.addFilesToTag(files, tagName);
                    // Feedback? Access Main Process via FileSystem to maybe trigger toast or just log
                    console.log(`Added ${files.length} files to tag ${tagName}`);
                }
            }
        } catch (err) {
            console.error('Tag Drop Error:', err);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault(); // Allow drop
        e.dataTransfer.dropEffect = 'copy';
    };

    const filteredTags = Array.isArray(tags) ? tags.filter(t => t.name.toLowerCase().includes(tagSearch.toLowerCase())) : [];



    // ...

    return (
        <div className="w-64 bg-neutral-800 h-full flex flex-col border-r border-neutral-700 select-none">
            <div className="p-4 border-b border-neutral-700 flex justify-between items-center bg-neutral-900/50">
                <img src={logo} alt="YiziView" className="h-6 w-auto opacity-90" />
                <button
                    onClick={handleOpenFolder}
                    className="bg-neutral-800 hover:bg-neutral-700 text-gray-300 hover:text-white text-xs py-1.5 px-3 rounded flex items-center gap-1.5 border border-neutral-700 transition-colors"
                >
                    <Plus size={14} /> Add Folder
                </button>
            </div>

            <div className="flex-1 overflow-y-auto px-2 pb-2 scrollbar-thin scrollbar-thumb-neutral-700">

                {/* Quick Access Section */}
                <div className="mt-4 mb-2 px-2 text-xs font-bold text-gray-500 uppercase tracking-wider flex justify-between group items-center">
                    <span className="flex items-center gap-1"><Star size={12} className="text-yellow-500" /> Quick Access</span>
                </div>

                <div className="space-y-0.5">
                    {favorites.map(path => (
                        <div key={path} className="group relative">
                            <FolderTree
                                name={getBasename(path)}
                                path={path}
                                onSelect={(p) => {
                                    setSelectedTag(null); // Clear tag selection when folder selected
                                    onFolderSelect(p);
                                }}
                                currentPath={currentPath}
                            />
                            {/* Simple remove X button on hover, or contextual menu later. Let's do a subtle X */}
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

                <div className="border-t border-neutral-700 my-4 mx-2"></div>

                <div className="px-2 mb-2">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex justify-between items-center">
                        <span className="flex items-center gap-1"><Tags size={12} /> Tags</span>
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
                    <div className="space-y-1">
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
                                key={tag.id}
                                onClick={() => handleTagClick(tag.name)}
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleTagDrop(e, tag.name)}
                                className={`group flex items-center justify-between text-sm p-1.5 rounded cursor-pointer transition-colors ${selectedTag === tag.name ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-neutral-700'}`}
                            >
                                <div className="flex items-center gap-2 truncate">
                                    <Tag size={13} />
                                    <span className="truncate">{tag.name}</span>
                                </div>
                                <button
                                    onClick={(e) => handleDeleteTag(e, tag.name)}
                                    className={`opacity-0 group-hover:opacity-100 transition-opacity p-0.5 ${selectedTag === tag.name ? 'text-white hover:text-red-200' : 'text-gray-600 hover:text-red-400'}`}
                                    title="Delete Tag"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Sidebar

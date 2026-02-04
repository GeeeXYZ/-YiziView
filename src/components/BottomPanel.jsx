import React, { useState, useEffect } from 'react';
import { ConfigManager } from '../managers/ConfigManager';
import { X } from 'lucide-react';

const BottomPanel = ({ selectedIndices, images, onTagsChange }) => {
    const [commonTags, setCommonTags] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadTags();
    }, [selectedIndices, images]);

    const loadTags = async () => {
        if (!selectedIndices || selectedIndices.size === 0) {
            setCommonTags([]);
            return;
        }

        setLoading(true);
        try {
            const selectedFiles = [];
            selectedIndices.forEach(index => {
                if (images[index]) selectedFiles.push(images[index].path);
            });

            if (selectedFiles.length === 0) {
                setCommonTags([]);
                setLoading(false);
                return;
            }

            const tagsMap = await ConfigManager.getTagsForFiles(selectedFiles);

            // Logic: Show ALL tags that appear in ANY of the selected files (Union)
            const allTags = new Set();
            Object.values(tagsMap).forEach(tags => {
                if (Array.isArray(tags)) {
                    tags.forEach(t => allTags.add(t));
                }
            });

            setCommonTags(Array.from(allTags));
        } catch (error) {
            console.error('Failed to load tags for selection:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveTag = async (tagName) => {
        const selectedFiles = [];
        selectedIndices.forEach(index => {
            if (images[index]) selectedFiles.push(images[index].path);
        });

        await ConfigManager.removeFilesFromTag(selectedFiles, tagName);
        // Refresh tags
        await loadTags();
        // Notify parent to refresh if needed (e.g. if we are in Tag View, removing tag might remove image from view)
        if (onTagsChange) onTagsChange();
    };

    if (!selectedIndices || selectedIndices.size === 0) return null;

    return (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-neutral-900/90 backdrop-blur border border-neutral-700 rounded-full px-6 py-2 shadow-2xl flex items-center gap-4 z-50 transition-all">
            <div className="text-gray-400 text-xs font-medium border-r border-neutral-700 pr-4">
                {selectedIndices.size} Selected
            </div>

            {loading ? (
                <div className="text-gray-500 text-xs">Loading tags...</div>
            ) : commonTags.length === 0 ? (
                <div className="text-gray-500 text-xs italic">No tags</div>
            ) : (
                <div className="flex items-center gap-2">
                    {commonTags.slice(0, 5).map(tag => (
                        <div key={tag} className="flex items-center gap-1.5 bg-neutral-800 hover:bg-neutral-700 text-gray-300 text-xs px-2 py-1 rounded-full transition-colors">
                            <span>{tag}</span>
                            <button
                                onClick={() => handleRemoveTag(tag)}
                                className="text-gray-500 hover:text-red-400 focus:outline-none flex items-center"
                                title="Remove Tag"
                            >
                                <X size={10} />
                            </button>
                        </div>
                    ))}
                    {commonTags.length > 5 && (
                        <span className="text-gray-500 text-xs">+{commonTags.length - 5} more</span>
                    )}
                </div>
            )}
        </div>
    );
};

export default BottomPanel;

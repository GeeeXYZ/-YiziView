import React, { useState } from 'react';
import { X, Trash2, Download, Upload, Settings as SettingsIcon } from 'lucide-react';

const SettingsModal = ({ isOpen, onClose }) => {
    const [clearing, setClearing] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [importing, setImporting] = useState(false);

    if (!isOpen) return null;

    const handleClearThumbnails = async () => {
        setClearing(true);
        try {
            await window.electron.clearThumbnailCache();
            alert('Thumbnail cache cleared successfully!');
        } catch (error) {
            console.error('Failed to clear thumbnails:', error);
            alert('Failed to clear thumbnail cache.');
        } finally {
            setClearing(false);
        }
    };

    const handleExportTags = async () => {
        setExporting(true);
        try {
            const result = await window.electron.exportTags();
            if (result.success) {
                alert(`Tags exported successfully to:\n${result.path}`);
            } else {
                alert('Export cancelled or failed.');
            }
        } catch (error) {
            console.error('Failed to export tags:', error);
            alert('Failed to export tags.');
        } finally {
            setExporting(false);
        }
    };

    const handleImportTags = async () => {
        setImporting(true);
        try {
            const result = await window.electron.importTags();
            if (result.success) {
                alert(`Tags imported successfully!\n${result.count} tag(s) imported.`);
                // Optionally reload the app or refresh tags
                window.location.reload();
            } else {
                alert('Import cancelled or failed.');
            }
        } catch (error) {
            console.error('Failed to import tags:', error);
            alert('Failed to import tags.');
        } finally {
            setImporting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200]">
            <div className="bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl w-[500px] max-w-[90vw] max-h-[80vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-neutral-700">
                    <div className="flex items-center gap-2">
                        <SettingsIcon size={20} className="text-blue-400" />
                        <h2 className="text-lg font-semibold text-white">Settings</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-neutral-800 rounded transition-colors text-gray-400 hover:text-white"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Cache Management */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Cache Management</h3>
                        <div className="bg-neutral-800/50 rounded-lg p-4 border border-neutral-700">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                    <h4 className="text-white font-medium mb-1">Clear Thumbnail Cache</h4>
                                    <p className="text-sm text-gray-400">
                                        Remove all cached thumbnails. New thumbnails will be generated when needed.
                                    </p>
                                </div>
                                <button
                                    onClick={handleClearThumbnails}
                                    disabled={clearing}
                                    className="h-9 px-4 bg-rose-500/10 hover:bg-rose-500/20 disabled:opacity-50 text-rose-400 border border-rose-500/20 rounded-lg flex items-center justify-center gap-2 transition-all shrink-0 min-w-[100px] text-sm font-medium"
                                >
                                    <Trash2 size={14} />
                                    {clearing ? 'Clearing...' : 'Clear Cache'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Tag Management */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Tag Management</h3>

                        {/* Export Tags */}
                        <div className="bg-neutral-800/50 rounded-lg p-4 border border-neutral-700">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                    <h4 className="text-white font-medium mb-1">Export Tags</h4>
                                    <p className="text-sm text-gray-400">
                                        Export all tags and file associations to a JSON file for backup or sharing.
                                    </p>
                                </div>
                                <button
                                    onClick={handleExportTags}
                                    disabled={exporting}
                                    className="h-9 px-4 bg-blue-500/10 hover:bg-blue-500/20 disabled:opacity-50 text-blue-400 border border-blue-500/20 rounded-lg flex items-center justify-center gap-2 transition-all shrink-0 min-w-[100px] text-sm font-medium"
                                >
                                    <Download size={14} />
                                    {exporting ? 'Exporting...' : 'Export JSON'}
                                </button>
                            </div>
                        </div>

                        {/* Import Tags */}
                        <div className="bg-neutral-800/50 rounded-lg p-4 border border-neutral-700">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                    <h4 className="text-white font-medium mb-1">Import Tags</h4>
                                    <p className="text-sm text-gray-400">
                                        Import tags from a previously exported JSON file. This will merge with existing tags.
                                    </p>
                                </div>
                                <button
                                    onClick={handleImportTags}
                                    disabled={importing}
                                    className="h-9 px-4 bg-emerald-500/10 hover:bg-emerald-500/20 disabled:opacity-50 text-emerald-400 border border-emerald-500/20 rounded-lg flex items-center justify-center gap-2 transition-all shrink-0 min-w-[100px] text-sm font-medium"
                                >
                                    <Upload size={14} />
                                    {importing ? 'Importing...' : 'Import JSON'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* App Info */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">About</h3>
                        <div className="bg-neutral-800/50 rounded-lg p-4 border border-neutral-700">
                            <div className="text-sm text-gray-400 space-y-1">
                                <p><span className="text-gray-300 font-medium">App Name:</span> YiziView</p>
                                <p><span className="text-gray-300 font-medium">Version:</span> 0.2.0</p>
                                <p><span className="text-gray-300 font-medium">Description:</span> Multi-panel image viewer with tag management</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-neutral-700 flex justify-end">
                    <button
                        onClick={onClose}
                        className="h-9 px-6 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-all text-sm font-medium border border-neutral-700"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;

import React, { useState, useEffect } from 'react';
import { X, Trash2, Download, Upload, Settings as SettingsIcon } from 'lucide-react';

const SettingsModal = ({ isOpen, onClose }) => {
    const [clearing, setClearing] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [importing, setImporting] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(() => localStorage.getItem('settings_confirm_delete') !== 'false');
    const [cropOverwrite, setCropOverwrite] = useState(() => localStorage.getItem('settings_crop_overwrite') === 'true');

    // Auto-update state
    const [updateStatus, setUpdateStatus] = useState('idle'); // idle, checking, available, downloading, downloaded, error
    const [updateMessage, setUpdateMessage] = useState('');
    const [downloadProgress, setDownloadProgress] = useState(0);

    useEffect(() => {
        if (!window.electron?.onUpdateStateChange) return;

        const updateStateFromPayload = (payload) => {
            const { state, data } = payload;
            if (state === 'checking-for-update') {
                setUpdateStatus('checking');
                setUpdateMessage('Checking for updates...');
            } else if (state === 'update-available') {
                setUpdateStatus('available');
                setUpdateMessage('Update available! Downloading...');
            } else if (state === 'update-not-available') {
                setUpdateStatus('idle');
                setUpdateMessage('You are on the latest version.');
                setTimeout(() => setUpdateMessage(''), 3000);
            } else if (state === 'error') {
                setUpdateStatus('error');
                setUpdateMessage(`Update error: ${data[0]}`);
            } else if (state === 'download-progress') {
                setUpdateStatus('downloading');
                if (data[0] && data[0].percent) {
                    setDownloadProgress(Math.round(data[0].percent));
                }
            } else if (state === 'update-downloaded') {
                setUpdateStatus('downloaded');
                setUpdateMessage('Update ready to install!');
            }
        };

        // Fetch initial state
        window.electron.getUpdateState && window.electron.getUpdateState().then(initialState => {
            if (initialState && initialState.state !== 'idle') {
                updateStateFromPayload(initialState);
            }
        });

        const unsubscribe = window.electron.onUpdateStateChange(updateStateFromPayload);

        return () => unsubscribe();
    }, []);

    const handleCheckUpdate = async () => {
        if (updateStatus === 'checking' || updateStatus === 'downloading') return;
        setUpdateStatus('checking');
        setUpdateMessage('Checking for updates...');
        try {
            const result = await window.electron.checkForUpdates();
            // If result is null, either it was already up to date, or already downloaded.
            // If it returns, the events might not fire if it's cached, so we'll check the global state.
            if (window.electron.getUpdateState) {
                const currentState = await window.electron.getUpdateState();
                // Only reset if it's not a terminal active state
                if (currentState && currentState.state === 'idle') {
                    setUpdateStatus('idle');
                    setUpdateMessage(result ? 'Finished check.' : 'No update needed right now.');
                    setTimeout(() => setUpdateMessage(''), 3000);
                }
            }
        } catch (e) {
            setUpdateStatus('error');
            setUpdateMessage('Failed to check for updates. Make sure you are connected or running the packaged app.');
        }
    };

    const handleInstallUpdate = () => {
        window.electron.installUpdate();
    };

    if (!isOpen) return null;

    const handleToggleConfirmDelete = () => {
        const newValue = !confirmDelete;
        setConfirmDelete(newValue);
        localStorage.setItem('settings_confirm_delete', newValue);
    };

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
                    {/* General Settings */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">General</h3>
                        <div className="bg-neutral-800/50 rounded-lg p-4 border border-neutral-700">
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex-1">
                                    <h4 className="text-white font-medium mb-1">Confirm before deletion</h4>
                                    <p className="text-sm text-gray-400">
                                        Show a confirmation dialog when deleting files or folders.
                                    </p>
                                </div>
                                <button
                                    onClick={handleToggleConfirmDelete}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${confirmDelete ? 'bg-blue-600' : 'bg-neutral-600'}`}
                                >
                                    <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${confirmDelete ? 'translate-x-6' : 'translate-x-1'}`}
                                    />
                                </button>
                            </div>

                            <hr className="border-neutral-700/50" />

                            <div className="flex items-center justify-between gap-4">
                                <div className="flex-1">
                                    <h4 className="text-white font-medium mb-1">Default Crop Save Action</h4>
                                    <p className="text-sm text-gray-400">
                                        Select the default behavior when pressing Enter to save a crop.
                                    </p>
                                </div>
                                <div className="flex bg-neutral-900 rounded border border-neutral-700 p-1 gap-1">
                                    <button
                                        onClick={() => { setCropOverwrite(false); localStorage.setItem('settings_crop_overwrite', 'false'); }}
                                        className={`px-3 py-1.5 rounded transition-colors text-sm font-medium ${!cropOverwrite ? 'bg-neutral-700 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                                    >
                                        Save as Copy
                                    </button>
                                    <button
                                        onClick={() => { setCropOverwrite(true); localStorage.setItem('settings_crop_overwrite', 'true'); }}
                                        className={`px-3 py-1.5 rounded transition-colors text-sm font-medium ${cropOverwrite ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                                    >
                                        Overwrite
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

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

                    {/* Performance Settings */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Performance</h3>
                        <div className="bg-neutral-800/50 rounded-lg p-4 border border-neutral-700">
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex-1">
                                    <h4 className="text-white font-medium mb-1">Thumbnail Quality (Size)</h4>
                                    <p className="text-sm text-gray-400">
                                        Choose target resolution. Lower size saves RAM/VRAM.
                                    </p>
                                </div>
                                <select
                                    value={localStorage.getItem('settings_thumb_size') || '600'}
                                    onChange={(e) => {
                                        localStorage.setItem('settings_thumb_size', e.target.value);
                                        window.location.reload(); // Reload to apply to all panels
                                    }}
                                    className="bg-neutral-700 text-white text-sm rounded-lg border border-neutral-600 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="256">256px (Fastest)</option>
                                    <option value="400">400px (Light)</option>
                                    <option value="600">600px (Standard)</option>
                                    <option value="800">800px (High)</option>
                                    <option value="1024">1024px (Ultra)</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* App Info & Updates */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">About & Updates</h3>
                        <div className="bg-neutral-800/50 rounded-lg p-4 border border-neutral-700">
                            <div className="flex items-start justify-between gap-4">
                                <div className="text-sm text-gray-400 space-y-1 flex-1">
                                    <p><span className="text-gray-300 font-medium">App Name:</span> YiziView</p>
                                    <p><span className="text-gray-300 font-medium">Version:</span> 0.7.2</p>

                                    {updateMessage && (
                                        <p className={`mt-2 text-xs font-medium ${updateStatus === 'error' ? 'text-red-400' : 'text-blue-400'}`}>
                                            {updateMessage} {updateStatus === 'downloading' && `(${downloadProgress}%)`}
                                        </p>
                                    )}
                                </div>
                                <div className="flex flex-col gap-2 shrink-0 min-w-[120px]">
                                    {updateStatus === 'downloaded' ? (
                                        <button
                                            onClick={handleInstallUpdate}
                                            className="h-9 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center justify-center transition-all text-sm font-medium"
                                        >
                                            Restart to Install
                                        </button>
                                    ) : (
                                        <button
                                            onClick={handleCheckUpdate}
                                            disabled={updateStatus === 'checking' || updateStatus === 'downloading' || updateStatus === 'available'}
                                            className="h-9 px-4 bg-blue-500/10 hover:bg-blue-500/20 disabled:opacity-50 text-blue-400 border border-blue-500/20 rounded-lg flex items-center justify-center transition-all text-sm font-medium"
                                        >
                                            {updateStatus === 'checking' ? 'Checking...' :
                                                updateStatus === 'downloading' || updateStatus === 'available' ? 'Downloading...' :
                                                    'Check for Updates'}
                                        </button>
                                    )}
                                </div>
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

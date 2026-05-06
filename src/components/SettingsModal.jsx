import React, { useState, useEffect } from 'react';
import { X, Trash2, Download, Upload, Settings as SettingsIcon, Keyboard, Blocks, Sliders, Zap, Database, Info, FolderOpen, Puzzle } from 'lucide-react';
import ConfirmModal from './ui/ConfirmModal';
import { useTranslation } from '../hooks/useTranslation';
import { setLanguage } from '../locales/i18n';

// ─── Keyboard Shortcut Data ────────────────────────────────────────────────
const getShortcutGroups = (t) => [
    {
        label: t('shortcutGridBrowse'),
        color: 'text-blue-400',
        items: [
            { keys: ['Enter'], desc: t('shortcutOpenFullscreen') },
            { keys: ['Ctrl', 'Enter'], desc: t('shortcutOpenPanel') },
            { keys: ['Shift', 'Click'], desc: t('shortcutRangeSelect') },
            { keys: ['Delete'], desc: t('shortcutDelete') },
            { keys: ['F'], desc: t('shortcutToggleFav') },
            { keys: ['P'], desc: t('shortcutTogglePrompt') },
        ],
    },
    {
        label: t('shortcutViewerNav'),
        color: 'text-emerald-400',
        items: [
            { keys: ['←', '→'], desc: t('shortcutPrevNext') },
            { keys: ['Esc'], desc: t('shortcutCloseViewer') },
            { keys: ['Space'], desc: t('shortcutToggleSlideshow') },
            { keys: ['Scroll'], desc: t('shortcutZoomInout') },
            { keys: ['Middle drag'], desc: t('shortcutPanImage') },
        ],
    },
    {
        label: t('shortcutViewerEdit'),
        color: 'text-violet-400',
        items: [
            { keys: ['C'], desc: t('shortcutCrop') },
            { keys: ['B'], desc: t('shortcutBrush') },
            { keys: ['A'], desc: t('shortcutAdjust') },
            { keys: ['Enter'], desc: t('shortcutConfirmSave') },
            { keys: ['Ctrl', 'Z'], desc: t('shortcutUndoBrush') },
            { keys: ['[', ']'], desc: t('shortcutBrushSize') },
            { keys: ['F'], desc: t('shortcutToggleFav') },
            { keys: ['T'], desc: t('shortcutToggleToolbar') },
        ],
    },
];

const Kbd = ({ children }) => (
    <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-neutral-700 border border-neutral-600 rounded shadow-sm text-gray-200 min-w-[22px]">
        {children}
    </span>
);

const PluginShortcutRow = ({ action, customShortcuts, onSave }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [currentKey, setCurrentKey] = useState(
        customShortcuts[action.id] !== undefined 
            ? customShortcuts[action.id] 
            : action.defaultShortcut || ''
    );

    useEffect(() => {
        if (!isRecording) return;
        const handleKeyDown = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.key === 'Escape') {
                setIsRecording(false);
                return;
            }
            if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

            const keys = [];
            if (e.ctrlKey || e.metaKey) keys.push('Ctrl');
            if (e.shiftKey) keys.push('Shift');
            if (e.altKey) keys.push('Alt');
            
            let keyName = e.key;
            if (keyName === ' ') keyName = 'Space';
            if (keyName.length === 1) keyName = keyName.toUpperCase();
            keys.push(keyName);
            
            const newShortcut = keys.join('+');
            setCurrentKey(newShortcut);
            setIsRecording(false);
            onSave(action.id, newShortcut);
        };
        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [isRecording, action.id, onSave]);

    const { t } = useTranslation();
    return (
         <div className="flex items-center justify-between pr-4 py-2.5 gap-4">
             <span className="text-sm text-gray-300">{action.name}</span>
             <button 
                 onClick={() => setIsRecording(true)}
                 className={`flex items-center gap-1 shrink-0 px-2 py-1 rounded border min-w-[80px] justify-end focus:outline-none transition-all ${isRecording ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-transparent hover:border-neutral-700 bg-neutral-800/40'}`}
             >
                 {isRecording ? <span className="text-xs animate-pulse text-blue-400">{t('pressKeys')}</span> : (
                     currentKey ? currentKey.split('+').map((k, ki) => (
                         <React.Fragment key={ki}>
                             {ki > 0 && <span className="text-neutral-600 text-[10px] mx-0.5">+</span>}
                             <Kbd>{k}</Kbd>
                         </React.Fragment>
                     )) : <span className="text-xs text-neutral-600">{t('unbound')}</span>
                 )}
             </button>
         </div>
    );
};

const SectionBlock = ({ children }) => (
    <div className="bg-neutral-900/40 rounded-xl p-5 border border-neutral-800/80 shadow-md">
        {children}
    </div>
);

const SettingRow = ({ title, desc, action }) => (
    <div className="flex items-center justify-between gap-6">
        <div className="flex-1 pr-4">
            <h4 className="text-white font-medium mb-1">{title}</h4>
            <p className="text-sm text-gray-400/80 leading-snug">{desc}</p>
        </div>
        <div className="shrink-0">{action}</div>
    </div>
);


const SettingsModal = ({ isOpen, onClose }) => {
    const { t, lang } = useTranslation();
    const [activeTab, setActiveTab] = useState('general');
    const [pluginsList, setPluginsList] = useState([]);
    const [loadingPlugins, setLoadingPlugins] = useState(true);

    const [pluginActions, setPluginActions] = useState([]);
    const [pluginShortcuts, setPluginShortcuts] = useState({});

    const [clearing, setClearing] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [importing, setImporting] = useState(false);

    const [confirmDelete, setConfirmDelete] = useState(() => localStorage.getItem('settings_confirm_delete') !== 'false');
    const [cropOverwrite, setCropOverwrite] = useState(() => localStorage.getItem('settings_crop_overwrite') === 'true');
    const [thumbFit, setThumbFit] = useState(() => localStorage.getItem('settings_thumb_fit') || 'cover');
    const [gradingIntensity, setGradingIntensity] = useState(() => localStorage.getItem('settings_grading_intensity') || '36');
    const [networkMode, setNetworkMode] = useState(() => localStorage.getItem('settings_network_mode') || 'direct');

    // UI State for Modals
    const [confirmState, setConfirmState] = useState({
        isOpen: false,
        title: '',
        message: '',
        confirmText: 'Confirm',
        confirmKind: 'primary',
        onConfirm: () => {}
    });

    const closeConfirm = () => setConfirmState(prev => ({ ...prev, isOpen: false }));

    // Auto-update state
    const [updateStatus, setUpdateStatus] = useState('idle');
    const [updateMessage, setUpdateMessage] = useState('');
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [isAutoUpdateEnabled, setIsAutoUpdateEnabled] = useState(false);

    useEffect(() => {
        if (!isOpen) return;

        // Fetch Plugins
        if (window.electron?.pluginAPI?.getAllPlugins) {
            setLoadingPlugins(true);
            window.electron.pluginAPI.getAllPlugins().then(plugins => {
                setPluginsList(plugins || []);
            }).catch(e => {
                console.error('Failed to load plugins in settings', e);
            }).finally(() => {
                setLoadingPlugins(false);
            });
        }

        // Fetch Plugin Actions for Shortcuts Tab
        const updateActions = () => {
            if (window.YiziAPI && window.YiziAPI.getActions) {
                setPluginActions(window.YiziAPI.getActions());
            }
        };
        try {
            setPluginShortcuts(JSON.parse(localStorage.getItem('yizi_plugin_shortcuts') || '{}'));
        } catch(e){}
        updateActions();
        
        let unsubActions;
        if (window.YiziAPI && window.YiziAPI.subscribe) {
            unsubActions = window.YiziAPI.subscribe('plugin-actions', updateActions);
        }

        // Fetch Update Setting
        if (window.electron?.getAutoUpdateSetting) {
            window.electron.getAutoUpdateSetting().then(setIsAutoUpdateEnabled);
        }

        // Setup Update Events
        if (!window.electron?.onUpdateStateChange) return;
        const updateStateFromPayload = (payload) => {
            const { state, data } = payload;
            if (state === 'checking-for-update') {
                setUpdateStatus('checking');
                setUpdateMessage('Checking for updates...');
            } else if (state === 'update-available') {
                setUpdateStatus('available');
                setUpdateMessage('New update is available!');
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

        window.electron.getUpdateState && window.electron.getUpdateState().then(initialState => {
            if (initialState && initialState.state !== 'idle') {
                updateStateFromPayload(initialState);
            }
        });

        const unsubscribe = window.electron.onUpdateStateChange(updateStateFromPayload);
        const unsubscribeLog = window.electron.onUpdaterLog ? window.electron.onUpdaterLog((msg) => console.log('[Updater]', msg)) : () => { };

        return () => {
            unsubscribe();
            unsubscribeLog();
            if (unsubActions) unsubActions();
        };
    }, [isOpen]);

    const handleSavePluginShortcut = (id, newKey) => {
        const newMap = { ...pluginShortcuts, [id]: newKey };
        setPluginShortcuts(newMap);
        localStorage.setItem('yizi_plugin_shortcuts', JSON.stringify(newMap));
        window.dispatchEvent(new Event('plugin-shortcuts-updated'));
    };

    const handleCheckUpdate = async () => {
        if (updateStatus === 'checking' || updateStatus === 'downloading') return;
        setUpdateStatus('checking');
        setUpdateMessage('Checking for updates...');
        try {
            const result = await window.electron.checkForUpdates();
            if (window.electron.getUpdateState) {
                const currentState = await window.electron.getUpdateState();
                if (currentState && currentState.state === 'idle') {
                    setUpdateStatus('idle');
                    setUpdateMessage(result ? 'Finished check.' : 'No update needed right now.');
                    setTimeout(() => setUpdateMessage(''), 3000);
                }
            }
        } catch (e) {
            setUpdateStatus('error');
            setUpdateMessage('Failed to check for updates. Make sure you are connected.');
        }
    };

    const handleInstallUpdate = () => window.electron.installUpdate();

    const handleCancelUpdate = async () => {
        if (window.electron?.cancelUpdate) {
            await window.electron.cancelUpdate();
            setUpdateStatus('idle');
            setUpdateMessage('Update cancelled.');
            setTimeout(() => setUpdateMessage(''), 3000);
        }
    };

    const handleDownloadUpdate = async () => {
        setUpdateStatus('downloading');
        setDownloadProgress(0);
        setUpdateMessage('Downloading manual update...');
        try {
            await window.electron.downloadUpdate();
        } catch (e) {
            setUpdateStatus('error');
            setUpdateMessage(`Download error: ${e.message}`);
        }
    };

    const handleToggleAutoUpdate = async () => {
        const newValue = !isAutoUpdateEnabled;
        if (window.electron?.setAutoUpdateSetting) {
            const success = await window.electron.setAutoUpdateSetting(newValue);
            if (success) setIsAutoUpdateEnabled(newValue);
        }
    };

    const handleToggleConfirmDelete = () => {
        const newValue = !confirmDelete;
        setConfirmDelete(newValue);
        localStorage.setItem('settings_confirm_delete', newValue);
    };

    const handleToggleNetworkMode = async () => {
        const newMode = networkMode === 'direct' ? 'system' : 'direct';
        setNetworkMode(newMode);
        localStorage.setItem('settings_network_mode', newMode);
        if (window.electron?.setNetworkMode) {
            await window.electron.setNetworkMode(newMode);
        }
    };

    const handleClearThumbnails = async () => {
        setClearing(true);
        try {
            await window.electron.clearThumbnailCache();
            alert('Thumbnail cache cleared successfully!');
        } catch (error) {
            alert('Failed to clear thumbnail cache.');
        } finally {
            setClearing(false);
        }
    };

    const handleExportSettings = async () => {
        setExporting(true);
        try {
            const frontendSettings = {};
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith('settings_') || key.startsWith('yizi_') || 
                    key.startsWith('last_') || key.startsWith('viewer_') || key.startsWith('sidebar_')) {
                    frontendSettings[key] = localStorage.getItem(key);
                }
            }
            const result = await window.electron.exportSettings(frontendSettings);
            if (result.success) alert(`Settings exported successfully to:\n${result.path}`);
        } catch (error) {
            alert('Failed to export settings.');
        } finally {
            setExporting(false);
        }
    };

    const handleImportSettings = async () => {
        setImporting(true);
        try {
            const result = await window.electron.importSettings();
            if (result.success) {
                if (result.frontendSettings) {
                    for (const [key, value] of Object.entries(result.frontendSettings)) {
                        localStorage.setItem(key, value);
                    }
                }
                alert(`Settings imported successfully!`);
                window.location.reload();
            }
        } catch (error) {
            alert('Failed to import settings.');
        } finally {
            setImporting(false);
        }
    };

    const handleTogglePlugin = async (id, currentDisabled) => {
        if (window.electron?.pluginAPI?.togglePlugin) {
            await window.electron.pluginAPI.togglePlugin(id, currentDisabled);
            setPluginsList(prev => prev.map(p => p.id === id ? { ...p, disabled: !currentDisabled } : p));
            
            setConfirmState({
                isOpen: true,
                title: 'Restart Needed',
                message: 'Extension status changed. A restart is required to apply the new state safely.',
                confirmText: 'Restart Now',
                confirmKind: 'primary',
                onConfirm: () => {
                    closeConfirm();
                    window.location.reload();
                }
            });
        }
    };

    const handleDeletePlugin = async (id) => {
        setConfirmState({
            isOpen: true,
            title: 'Delete Plugin',
            message: `Delete extension folder '${id}'? This action cannot be undone.`,
            confirmText: 'Delete',
            confirmKind: 'danger',
            onConfirm: async () => {
                closeConfirm();
                if (window.electron?.pluginAPI?.deletePlugin) {
                    const success = await window.electron.pluginAPI.deletePlugin(id);
                    if (success) {
                        setPluginsList(prev => prev.filter(p => p.id !== id));
                        setTimeout(() => {
                            setConfirmState({
                                isOpen: true,
                                title: 'Restart Needed',
                                message: 'Extension deleted successfully. Restart to clear remaining active memory.',
                                confirmText: 'Restart Now',
                                confirmKind: 'primary',
                                onConfirm: () => {
                                    closeConfirm();
                                    window.location.reload();
                                }
                            });
                        }, 250); // slight delay after close
                    } else {
                        alert('Failed to delete plugin folder.');
                    }
                }
            }
        });
    };

    const handleOpenPluginDir = () => {
        if (window.electron?.pluginAPI?.openPluginDir) {
            window.electron.pluginAPI.openPluginDir();
        }
    };

    if (!isOpen) return null;

    const renderTabButton = (id, icon, label) => {
        const isActive = activeTab === id;
        return (
            <button
                onClick={() => setActiveTab(id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-all text-sm font-medium border border-transparent ${
                    isActive 
                        ? 'bg-blue-600/10 text-blue-400 border-blue-500/20 shadow-inner' 
                        : 'text-gray-400 hover:bg-neutral-800/80 hover:text-gray-200 hover:border-neutral-700/50'
                }`}
            >
                {icon}
                {label}
            </button>
        );
    };



    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200]" onClick={onClose}>
            <div 
                className="bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl w-[900px] max-w-[95vw] h-[650px] max-h-[90vh] flex flex-row overflow-hidden relative" 
                onClick={e => e.stopPropagation()}
            >
                {/* ─── Sidebar ─── */}
                <div className="w-[240px] bg-neutral-950/40 border-r border-neutral-800 flex flex-col shrink-0">
                    <div className="flex items-center gap-3 p-6 pb-6">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                            <SettingsIcon size={20} className="text-blue-400" />
                        </div>
                        <h2 className="text-lg font-semibold text-white tracking-wide">{t('settings')}</h2>
                    </div>
                    
                    <nav className="flex-1 px-3 space-y-1 overflow-y-auto custom-scrollbar pb-6">
                        <div className="text-[11px] font-bold tracking-widest text-neutral-500/80 mb-2 mt-2 px-3 uppercase">{t('preferences')}</div>
                        {renderTabButton('general', <Sliders size={16} />, t('general'))}
                        {renderTabButton('performance', <Zap size={16} />, t('performance'))}
                        {renderTabButton('backup', <Database size={16} />, t('backupRestore'))}
                        
                        <div className="text-[11px] font-bold tracking-widest text-neutral-500/80 mb-2 mt-8 px-3 uppercase">{t('extensions')}</div>
                        {renderTabButton('plugins', <Blocks size={16} />, t('pluginsCenter'))}
                        
                        <div className="text-[11px] font-bold tracking-widest text-neutral-500/80 mb-2 mt-8 px-3 uppercase">{t('system')}</div>
                        {renderTabButton('shortcuts', <Keyboard size={16} />, t('shortcuts'))}
                        {renderTabButton('about', <Info size={16} />, t('updatesAbout'))}
                    </nav>
                </div>

                {/* ─── Content Pane ─── */}
                <div className="flex-1 flex flex-col bg-[#141414] relative">
                    <button
                        onClick={onClose}
                        className="absolute top-5 right-5 p-2 bg-neutral-800/80 hover:bg-neutral-700 rounded-full transition-colors text-gray-400 hover:text-white z-10 shadow-sm"
                        title="Close Settings"
                    >
                        <X size={16} />
                    </button>

                    <div className="flex-1 overflow-y-auto px-10 py-10 custom-scrollbar">
                        <div className="max-w-2xl mx-auto space-y-8 pb-10">
                            
                            {/* GENERAL TAB */}
                            {activeTab === 'general' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <h3 className="text-2xl font-semibold text-white mb-6">{t('general')}</h3>
                                    
                                    <SectionBlock>
                                        <SettingRow 
                                            title={t('language')}
                                            desc={t('languageDesc')}
                                            action={
                                                <div className="flex bg-neutral-950 rounded border border-neutral-700/50 p-1 gap-1">
                                                    <button
                                                        onClick={() => setLanguage('en')}
                                                        className={`px-4 py-1.5 rounded transition-colors text-sm font-medium ${lang === 'en' ? 'bg-neutral-700 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                                                    >
                                                        En
                                                    </button>
                                                    <button
                                                        onClick={() => setLanguage('zh')}
                                                        className={`px-4 py-1.5 rounded transition-colors text-sm font-medium ${lang === 'zh' ? 'bg-neutral-700 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                                                    >
                                                        中文
                                                    </button>
                                                </div>
                                            }
                                        />
                                    </SectionBlock>

                                    <SectionBlock>
                                        <SettingRow 
                                            title={t('confirmDelete')}
                                            desc={t('confirmDeleteDesc')}
                                            action={
                                                <button
                                                    onClick={handleToggleConfirmDelete}
                                                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none ${confirmDelete ? 'bg-blue-600' : 'bg-neutral-600'}`}
                                                >
                                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${confirmDelete ? 'translate-x-6' : 'translate-x-1'}`} />
                                                </button>
                                            }
                                        />
                                    </SectionBlock>

                                    <SectionBlock>
                                        <SettingRow 
                                            title={t('bypassProxy')}
                                            desc={t('bypassProxyDesc')}
                                            action={
                                                <button
                                                    onClick={handleToggleNetworkMode}
                                                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none ${networkMode === 'direct' ? 'bg-blue-600' : 'bg-neutral-600'}`}
                                                >
                                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${networkMode === 'direct' ? 'translate-x-6' : 'translate-x-1'}`} />
                                                </button>
                                            }
                                        />
                                    </SectionBlock>

                                    <SectionBlock>
                                        <SettingRow 
                                            title={t('defaultSaveAction')}
                                            desc={t('defaultSaveActionDesc')}
                                            action={
                                                <div className="flex bg-neutral-950 rounded border border-neutral-700/50 p-1 gap-1">
                                                    <button
                                                        onClick={() => { setCropOverwrite(false); localStorage.setItem('settings_crop_overwrite', 'false'); }}
                                                        className={`px-3 py-1.5 rounded transition-colors text-sm font-medium ${!cropOverwrite ? 'bg-neutral-800 text-white shadow-sm ring-1 ring-neutral-700' : 'text-gray-500 hover:text-gray-300'}`}
                                                    >
                                                        {t('saveCopy')}
                                                    </button>
                                                    <button
                                                        onClick={() => { setCropOverwrite(true); localStorage.setItem('settings_crop_overwrite', 'true'); }}
                                                        className={`px-4 py-1.5 rounded transition-colors text-sm font-medium ${cropOverwrite ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                                                    >
                                                        {t('overwrite')}
                                                    </button>
                                                </div>
                                            }
                                        />
                                    </SectionBlock>

                                    <SectionBlock>
                                        <SettingRow 
                                            title={t('colorGradingIntensity')}
                                            desc={t('colorGradingIntensityDesc')}
                                            action={
                                                <div className="flex items-center gap-3">
                                                    <input
                                                        type="range" min="1" max="100" value={gradingIntensity}
                                                        onChange={(e) => {
                                                            setGradingIntensity(e.target.value);
                                                            localStorage.setItem('settings_grading_intensity', e.target.value);
                                                            window.dispatchEvent(new CustomEvent('settings-updated'));
                                                        }}
                                                        className="w-24 h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                                    />
                                                    <span className="w-10 text-right text-sm text-gray-300 font-mono tracking-tighter">{gradingIntensity}%</span>
                                                </div>
                                            }
                                        />
                                    </SectionBlock>
                                </div>
                            )}

                            {/* PERFORMANCE TAB */}
                            {activeTab === 'performance' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <h3 className="text-2xl font-semibold text-white mb-6">{t('performance')}</h3>
                                    
                                    <SectionBlock>
                                        <div className="space-y-6">
                                            <SettingRow 
                                                title={t('thumbQuality')}
                                                desc={t('thumbQualityDesc')}
                                                action={
                                                    <select
                                                        value={localStorage.getItem('settings_thumb_size') || '600'}
                                                        onChange={(e) => { localStorage.setItem('settings_thumb_size', e.target.value); window.location.reload(); }}
                                                        className="bg-neutral-950 text-white text-sm rounded-lg border border-neutral-700 px-3 py-2 outline-none focus:border-blue-500 transition-colors cursor-pointer w-40"
                                                    >
                                                        <option value="256">{t('fastest')}</option>
                                                        <option value="400">{t('light')}</option>
                                                        <option value="600">{t('standard')}</option>
                                                        <option value="800">{t('high')}</option>
                                                        <option value="1024">{t('ultra')}</option>
                                                    </select>
                                                }
                                            />
                                            <div className="h-px bg-neutral-800/50 w-full"></div>
                                            <SettingRow 
                                                title={t('thumbFitMode')}
                                                desc={t('thumbFitModeDesc')}
                                                action={
                                                    <div className="flex bg-neutral-950 rounded border border-neutral-700/50 p-1 gap-1">
                                                        <button
                                                            onClick={() => { setThumbFit('cover'); localStorage.setItem('settings_thumb_fit', 'cover'); window.dispatchEvent(new CustomEvent('settings-updated')); }}
                                                            className={`px-4 py-1.5 rounded transition-colors text-sm font-medium ${thumbFit === 'cover' ? 'bg-neutral-800 text-white shadow-sm ring-1 ring-neutral-700' : 'text-gray-500 hover:text-gray-300'}`}
                                                        >
                                                            {t('fillCover')}
                                                        </button>
                                                        <button
                                                            onClick={() => { setThumbFit('contain'); localStorage.setItem('settings_thumb_fit', 'contain'); window.dispatchEvent(new CustomEvent('settings-updated')); }}
                                                            className={`px-4 py-1.5 rounded transition-colors text-sm font-medium ${thumbFit === 'contain' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                                                        >
                                                            {t('fitContain')}
                                                        </button>
                                                    </div>
                                                }
                                            />
                                        </div>
                                    </SectionBlock>

                                    <SectionBlock>
                                        <SettingRow 
                                            title={t('clearCachedData')}
                                            desc={t('clearCachedDataDesc')}
                                            action={
                                                <button
                                                    onClick={handleClearThumbnails} disabled={clearing}
                                                    className="h-9 px-5 bg-rose-500/10 hover:bg-rose-500/20 disabled:opacity-50 text-rose-400 border border-rose-500/20 rounded-lg flex items-center justify-center gap-2 transition-all text-sm font-medium whitespace-nowrap"
                                                >
                                                    <Trash2 size={14} />
                                                    {clearing ? t('clearing') : t('clearThumbnails')}
                                                </button>
                                            }
                                        />
                                    </SectionBlock>
                                </div>
                            )}

                            {/* BACKUP TAB */}
                            {activeTab === 'backup' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <h3 className="text-2xl font-semibold text-white mb-6">{t('backupRestore')}</h3>
                                    
                                    <SectionBlock>
                                        <SettingRow 
                                            title={t('configPortableBackup')}
                                            desc={t('configPortableBackupDesc')}
                                            action={
                                                <div className="flex items-center gap-3">
                                                    <button
                                                        onClick={handleExportSettings} disabled={exporting}
                                                        className="h-9 px-4 bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-600/50 rounded-lg flex items-center gap-2 transition-all text-sm font-medium shadow-sm"
                                                    >
                                                        <Download size={14} className="text-blue-400" /> {t('export')}
                                                    </button>
                                                    <button
                                                        onClick={handleImportSettings} disabled={importing}
                                                        className="h-9 px-4 bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-600/50 rounded-lg flex items-center gap-2 transition-all text-sm font-medium shadow-sm"
                                                    >
                                                        <Upload size={14} className="text-emerald-400" /> {t('restore')}
                                                    </button>
                                                </div>
                                            }
                                        />
                                    </SectionBlock>
                                </div>
                            )}

                            {/* PLUGINS TAB */}
                            {activeTab === 'plugins' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="text-2xl font-semibold text-white">{t('pluginsCenter')}</h3>
                                    </div>
                                    
                                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-5 mb-6">
                                        <div className="flex gap-4 items-start">
                                            <div className="p-2 bg-blue-500/20 rounded-lg shrink-0 mt-0.5">
                                                <Blocks size={18} className="text-blue-400" />
                                            </div>
                                            <div>
                                                <h4 className="text-blue-100 font-medium mb-1">{t('extensibleArchitecture')}</h4>
                                                <p className="text-sm text-blue-200/70 leading-relaxed mb-4">
                                                    {t('pluginsDesc')}
                                                </p>
                                                <button 
                                                    onClick={handleOpenPluginDir}
                                                    className="text-sm bg-blue-600/80 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2 font-medium border border-blue-500/50 shadow-sm"
                                                >
                                                    <FolderOpen size={16}/> {t('openPluginFolder')}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-widest px-1 mb-3">{t('installedExtensions')}</h4>
                                    
                                    {loadingPlugins ? (
                                        <div className="p-8 text-center text-gray-400">{t('scanningPlugins')}</div>
                                    ) : pluginsList.length === 0 ? (
                                        <div className="border border-dashed border-neutral-700 rounded-xl p-10 flex flex-col items-center justify-center text-center">
                                            <FolderOpen size={32} className="text-neutral-500 mb-3" />
                                            <h4 className="text-white font-medium mb-1">{t('noPluginsFound')}</h4>
                                            <p className="text-sm text-gray-400">{t('noPluginsDesc')}</p>
                                        </div>
                                    ) : (
                                        <div className="grid gap-3">
                                            {pluginsList.map(plugin => (
                                                <div key={plugin.id} className="bg-neutral-800/40 border border-neutral-700/60 rounded-xl p-4 flex gap-4 transition-colors hover:bg-neutral-800/60 items-center">
                                                    <div className={`h-12 w-12 rounded-lg flex items-center justify-center shrink-0 border transition-colors ${plugin.disabled ? 'bg-neutral-800/50 border-neutral-700/30' : 'bg-neutral-700/50 border-neutral-600/30'}`}>
                                                        <Puzzle size={24} className={plugin.disabled ? "text-neutral-600" : "text-neutral-400"} />
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <h4 className={`font-semibold ${plugin.disabled ? 'text-gray-500' : 'text-white'}`}>{plugin.name || plugin.id}</h4>
                                                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-950 text-neutral-400 border border-neutral-800">
                                                                {t('local')}
                                                            </span>
                                                            <span className="text-[10px] text-neutral-500">v{plugin.version || '1.0.0'}</span>
                                                        </div>
                                                        <p className="text-sm text-gray-500 line-clamp-1">{plugin.description || t('loadedCleanly')}</p>
                                                    </div>
                                                    <div className="flex items-center gap-3 shrink-0">
                                                        <span className={`inline-flex w-16 items-center justify-center gap-1.5 px-2 py-1 rounded text-xs font-medium border ${!plugin.disabled ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-neutral-800 text-neutral-500 border-neutral-700'}`}>
                                                            <span className={`w-1.5 h-1.5 rounded-full ${!plugin.disabled ? 'bg-emerald-400' : 'bg-neutral-500'}`}></span> {!plugin.disabled ? t('active') : t('off')}
                                                        </span>
                                                        
                                                        {/* Toggle Switch */}
                                                        <button
                                                            onClick={() => handleTogglePlugin(plugin.id, plugin.disabled)}
                                                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors focus:outline-none ${!plugin.disabled ? 'bg-blue-600' : 'bg-neutral-600'}`}
                                                        >
                                                            <span className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${!plugin.disabled ? 'translate-x-2' : '-translate-x-2'}`} />
                                                        </button>

                                                        {/* Delete Button */}
                                                        <button 
                                                            onClick={() => handleDeletePlugin(plugin.id)}
                                                            className="p-1.5 text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors ml-1"
                                                            title={t('deletePlugin')}
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* UPDATES TAB */}
                            {activeTab === 'about' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <h3 className="text-2xl font-semibold text-white mb-6">{t('aboutYiziView')}</h3>
                                    
                                    <SectionBlock>
                                        <div className="flex items-center justify-between gap-6 pb-6 border-b border-neutral-800/80 mb-6">
                                            <div>
                                                <h4 className="text-lg font-semibold text-white flex items-center gap-2">
                                                    YiziView <span className="text-sm font-mono text-gray-500 font-normal">v{__APP_VERSION__}</span>
                                                </h4>
                                                <p className="text-sm text-gray-400 mt-1">{t('appDescription')}</p>
                                            </div>
                                            
                                            <div className="shrink-0 w-[180px] flex justify-end">
                                                {updateStatus === 'downloaded' ? (
                                                    <button onClick={handleInstallUpdate} className="h-9 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-all text-sm font-medium shadow-md w-full"> {t('restartToInstall')} </button>
                                                ) : updateStatus === 'downloading' ? (
                                                    <button onClick={handleCancelUpdate} className="h-9 px-4 bg-rose-500/10 text-rose-400 rounded-lg transition-all text-sm font-medium w-full"> {t('cancelDownload')} </button>
                                                ) : updateStatus === 'available' ? (
                                                    <button onClick={handleDownloadUpdate} disabled={isAutoUpdateEnabled} className="h-9 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all text-sm font-medium w-full"> {t('downloadUpdate')} </button>
                                                ) : (
                                                    <button onClick={handleCheckUpdate} disabled={updateStatus === 'checking'} className="h-9 px-4 bg-neutral-800 hover:bg-neutral-700 text-gray-200 border border-neutral-600/50 rounded-lg transition-all text-sm font-medium w-full">
                                                        {updateStatus === 'checking' ? t('checking') : t('checkForUpdates')}
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {updateMessage && (
                                            <div className={`p-3 rounded-lg mb-6 text-sm font-medium border ${updateStatus === 'error' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                                                {updateMessage}
                                            </div>
                                        )}

                                        {updateStatus === 'downloading' && (
                                            <div className="w-full bg-neutral-950 rounded-full h-1.5 mb-6 overflow-hidden shadow-inner border border-neutral-800">
                                                <div className="bg-blue-500 h-1.5 rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(59,130,246,0.6)]" style={{ width: `${downloadProgress}%` }} />
                                            </div>
                                        )}

                                        <SettingRow 
                                            title={t('autoDownloadUpdates')}
                                            desc={t('autoDownloadUpdatesDesc')}
                                            action={
                                                <button
                                                    onClick={handleToggleAutoUpdate}
                                                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none ${isAutoUpdateEnabled ? 'bg-blue-600' : 'bg-neutral-600'}`}
                                                >
                                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isAutoUpdateEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                                </button>
                                            }
                                        />
                                    </SectionBlock>
                                </div>
                            )}

                            {/* SHORTCUTS TAB */}
                            {activeTab === 'shortcuts' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <h3 className="text-2xl font-semibold text-white mb-6">{t('keyboardShortcuts')}</h3>
                                    <div className="space-y-6">
                                        {getShortcutGroups(t).map(group => (
                                            <div key={group.label} className="bg-neutral-900/40 rounded-xl overflow-hidden border border-neutral-800/80 shadow-sm">
                                                <div className="bg-neutral-800/40 px-4 py-2 border-b border-neutral-800/80">
                                                    <p className={`text-[10px] font-bold uppercase tracking-widest ${group.color}`}>
                                                        {group.label}
                                                    </p>
                                                </div>
                                                <div className="divide-y divide-neutral-800/60 pl-4 py-1">
                                                    {group.items.map((item, i) => (
                                                        <div key={i} className="flex items-center justify-between pr-4 py-2.5 gap-4">
                                                            <span className="text-sm text-gray-300">{item.desc}</span>
                                                            <div className="flex items-center gap-1 shrink-0">
                                                                {item.keys.map((k, ki) => (
                                                                    <React.Fragment key={ki}>
                                                                        {ki > 0 && <span className="text-neutral-600 text-[10px] mx-0.5">+</span>}
                                                                        <Kbd>{k}</Kbd>
                                                                    </React.Fragment>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                        
                                        {/* EXTENSION SHORTCUTS */}
                                        <div className="bg-neutral-900/40 rounded-xl overflow-hidden border border-neutral-800/80 shadow-sm mt-6">
                                            <div className="bg-neutral-800/40 px-4 py-2 border-b border-neutral-800/80 flex justify-between items-center">
                                                <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">
                                                    {t('extensionsPlugins')}
                                                </p>
                                                <span className="text-[10px] text-gray-500 font-medium">{t('clickToChange')}</span>
                                            </div>
                                            <div className="divide-y divide-neutral-800/60 pl-4 py-1">
                                                {pluginActions.length === 0 ? (
                                                    <div className="text-sm text-neutral-600 py-3 pr-4">{t('noPluginActions')}</div>
                                                ) : pluginActions.map(action => (
                                                    <PluginShortcutRow 
                                                        key={action.id} 
                                                        action={action} 
                                                        customShortcuts={pluginShortcuts} 
                                                        onSave={handleSavePluginShortcut} 
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                            
                        </div>
                    </div>
                </div>
                
                <ConfirmModal 
                    isOpen={confirmState.isOpen}
                    title={confirmState.title}
                    message={confirmState.message}
                    confirmText={confirmState.confirmText}
                    confirmKind={confirmState.confirmKind}
                    onConfirm={confirmState.onConfirm}
                    onCancel={closeConfirm}
                />
            </div>
        </div>
    );
};

export default SettingsModal;

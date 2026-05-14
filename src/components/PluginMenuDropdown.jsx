import React, { useState, useEffect, useRef } from 'react';
import { Puzzle, ChevronDown, MonitorPlay } from 'lucide-react';
import { PluginEngine } from '@/managers/PluginEngine';

export default function PluginMenuDropdown() {
    const [isOpen, setIsOpen] = useState(false);
    const [actions, setActions] = useState([]);
    const [customShortcuts, setCustomShortcuts] = useState({});
    const dropdownRef = useRef(null);

    // Fetch actions and custom shortcuts on mount & subscribe to changes
    useEffect(() => {
        const updateActions = () => {
            setActions(PluginEngine.getActions().filter(a => !a.showInContextMenu));
            try {
                const stored = localStorage.getItem('yizi_plugin_shortcuts');
                if (stored) setCustomShortcuts(JSON.parse(stored));
            } catch (e) {}
        };
        updateActions();
        
        const unsubPlugin = PluginEngine.subscribe('plugin-actions', updateActions);
        
        // Listen to custom global event when shortcuts are updated in settings
        const handleSettingsUpdate = () => updateActions();
        window.addEventListener('plugin-shortcuts-updated', handleSettingsUpdate);
        
        return () => {
            unsubPlugin();
            window.removeEventListener('plugin-shortcuts-updated', handleSettingsUpdate);
        };
    }, []);

    // Handle outside click to close dropdown
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    if (actions.length === 0) return null;

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`p-1.5 rounded transition-colors flex items-center gap-1 min-w-max border ${
                    isOpen 
                        ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' 
                        : 'bg-neutral-800 text-gray-400 border-neutral-700 hover:bg-neutral-700 hover:text-white'
                }`}
                title="Plugin Actions"
            >
                <Puzzle size={14} className={isOpen ? "text-indigo-400" : ""} />
                <ChevronDown size={12} className="opacity-50" />
            </button>

            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-56 bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-3 py-2 border-b border-neutral-800 bg-neutral-950/50">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Extensions</span>
                    </div>
                    <div className="py-1 max-h-64 overflow-y-auto">
                        {actions.map(action => {
                            const shortcut = customShortcuts[action.id] !== undefined 
                                ? customShortcuts[action.id] 
                                : action.defaultShortcut;
                                
                            return (
                                <button
                                    key={action.id}
                                    onClick={() => {
                                        action.onExecute();
                                        setIsOpen(false);
                                    }}
                                    className="w-full text-left px-3 py-2 flex items-center justify-between hover:bg-indigo-500/10 hover:text-indigo-300 text-sm text-gray-300 transition-colors group"
                                >
                                    <span className="flex items-center gap-2 truncate">
                                        <MonitorPlay size={14} className="text-neutral-500 group-hover:text-indigo-400 shrink-0" />
                                        <span className="truncate">{action.name}</span>
                                    </span>
                                    
                                    {shortcut && (
                                        <span className="shrink-0 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-neutral-800 border border-neutral-700 rounded text-neutral-400 ml-3">
                                            {shortcut}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

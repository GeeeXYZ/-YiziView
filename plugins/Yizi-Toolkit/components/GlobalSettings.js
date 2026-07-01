import { React, el, ChevronDown, Trash2, Plus, Server, FolderOpen, Save, Scissors, Image as ImageIcon } from '../core/globals.js';
import { useSettings } from '../core/useSettings.js';
import { getTheme } from './theme.js';

export default function GlobalSettings() {
    const [settings, setSettings] = useSettings();
    const [expandedServer, setExpandedServer] = React.useState(null);
    const theme = getTheme(settings.theme || 'dark');

    const updateSettings = (key, value) => {
        setSettings({ [key]: value });
    };

    const addServer = () => {
        const newServer = { id: Date.now().toString(), name: '新服务器', url: 'http://127.0.0.1:8188', headers: [] };
        const newServers = [...settings.servers, newServer];
        setSettings({ 
            servers: newServers,
            activeServerId: settings.activeServerId || newServer.id
        });
        setExpandedServer(newServer.id);
    };

    const removeServer = (id) => {
        const newServers = settings.servers.filter(s => s.id !== id);
        setSettings({ 
            servers: newServers,
            activeServerId: settings.activeServerId === id ? (newServers[0]?.id || null) : settings.activeServerId
        });
    };

    const updateServer = (id, key, value) => {
        const newServers = settings.servers.map(s => s.id === id ? { ...s, [key]: value } : s);
        setSettings({ servers: newServers });
    };

    const addHeader = (serverId) => {
        const newServers = settings.servers.map(s => {
            if (s.id === serverId) {
                return { ...s, headers: [...(s.headers || []), { key: '', value: '' }] };
            }
            return s;
        });
        setSettings({ servers: newServers });
    };

    const updateHeader = (serverId, index, keyOrValue, val) => {
        const newServers = settings.servers.map(s => {
            if (s.id === serverId) {
                const newHeaders = [...s.headers];
                newHeaders[index][keyOrValue] = val;
                return { ...s, headers: newHeaders };
            }
            return s;
        });
        setSettings({ servers: newServers });
    };

    const removeHeader = (serverId, index) => {
        const newServers = settings.servers.map(s => {
            if (s.id === serverId) {
                const newHeaders = s.headers.filter((_, i) => i !== index);
                return { ...s, headers: newHeaders };
            }
            return s;
        });
        setSettings({ servers: newServers });
    };

    const selectFolder = async (settingKey) => {
        try {
            if (window.electron && window.electron.showOpenDialog) {
                const result = await window.electron.showOpenDialog({ properties: ['openDirectory'] });
                if (result && result.filePaths && result.filePaths.length > 0) {
                    updateSettings(settingKey, result.filePaths[0]);
                }
            } else {
                const input = document.createElement('input');
                input.type = 'file';
                input.webkitdirectory = true;
                input.onchange = (e) => {
                    if (e.target.files.length > 0) {
                        const path = window.electron?.getFilePath ? window.electron.getFilePath(e.target.files[0]) : e.target.files[0].path;
                        const dir = path.substring(0, Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')));
                        updateSettings(settingKey, dir);
                    }
                };
                input.click();
            }
        } catch (e) {
            console.error("Failed to select folder", e);
        }
    };

    // Update the window variable so right-click can access latest settings synchronously
    React.useEffect(() => {
        window.__YiziToolkitSettings = settings;
    }, [settings]);

    return el('div', { className: "flex flex-col pb-12 text-black" },


        // 0.5 Module Custom Colors
        el('div', { className: "flex flex-col gap-4 px-4 py-6 border-b border-black" },
            el('div', { className: "text-xs font-black tracking-widest uppercase flex items-center justify-between" }, 
                "MODULE THEMES"
            ),
            el('div', { className: "grid grid-cols-4 gap-4 mt-2" },
                // ComfyUI Color
                el('div', { className: "flex flex-col gap-2 items-center" },
                    el('div', { className: "w-12 h-12 rounded-full border border-black/80 shadow-[4px_4px_0px_#000] relative overflow-hidden cursor-pointer", style: { backgroundColor: settings.themeComfyUI || '#34d399' } },
                        el('input', { type: 'color', value: settings.themeComfyUI || '#34d399', onChange: e => updateSettings('themeComfyUI', e.target.value), className: "absolute -inset-2 w-[200%] h-[200%] cursor-pointer opacity-0" })
                    ),
                    el('span', { className: "text-[10px] font-black uppercase tracking-widest" }, "COMFYUI")
                ),
                // AI Gen Color
                el('div', { className: "flex flex-col gap-2 items-center" },
                    el('div', { className: "w-12 h-12 rounded-full border border-black/80 shadow-[4px_4px_0px_#000] relative overflow-hidden cursor-pointer", style: { backgroundColor: settings.themeGrsai || '#a78bfa' } },
                        el('input', { type: 'color', value: settings.themeGrsai || '#a78bfa', onChange: e => updateSettings('themeGrsai', e.target.value), className: "absolute -inset-2 w-[200%] h-[200%] cursor-pointer opacity-0" })
                    ),
                    el('span', { className: "text-[10px] font-black uppercase tracking-widest" }, "AI ENGINE")
                ),
                // Card Layout Color
                el('div', { className: "flex flex-col gap-2 items-center" },
                    el('div', { className: "w-12 h-12 rounded-full border border-black/80 shadow-[4px_4px_0px_#000] relative overflow-hidden cursor-pointer", style: { backgroundColor: settings.themeCard || '#fbbf24' } },
                        el('input', { type: 'color', value: settings.themeCard || '#fbbf24', onChange: e => updateSettings('themeCard', e.target.value), className: "absolute -inset-2 w-[200%] h-[200%] cursor-pointer opacity-0" })
                    ),
                    el('span', { className: "text-[10px] font-black uppercase tracking-widest" }, "LAYOUT")
                ),
                // System Settings Color
                el('div', { className: "flex flex-col gap-2 items-center" },
                    el('div', { className: "w-12 h-12 rounded-full border border-black/80 shadow-[4px_4px_0px_#000] relative overflow-hidden cursor-pointer", style: { backgroundColor: settings.themeSystem || '#ffffff' } },
                        el('input', { type: 'color', value: settings.themeSystem || '#ffffff', onChange: e => updateSettings('themeSystem', e.target.value), className: "absolute -inset-2 w-[200%] h-[200%] cursor-pointer opacity-0" })
                    ),
                    el('span', { className: "text-[10px] font-black uppercase tracking-widest" }, "SYSTEM")
                )
            )
        ),

        // Auto Save Path
        el('div', { className: "flex flex-col gap-4 px-4 py-6 border-b border-black text-black" },
            el('div', { className: "text-xs font-black tracking-widest uppercase flex items-center gap-2" }, 
                Save ? el(Save, { size: 16 }) : null,
                "AUTO-SAVE PATH"
            ),
            el('div', { className: "flex gap-2 items-stretch" },
                el('input', {
                    type: "text",
                    value: settings.autoSavePath || '',
                    onChange: e => updateSettings('autoSavePath', e.target.value),
                    placeholder: "E.g. D:\\AI_Outputs",
                    className: "flex-1 rounded-full border border-black/80 bg-white px-4 py-2 text-[11px] font-mono font-bold outline-none text-black transition-all focus:shadow-[4px_4px_0px_#000]"
                }),
                el('button', {
                    onClick: () => selectFolder('autoSavePath'),
                    className: "shrink-0 rounded-full border border-black/80 bg-black text-white px-4 py-2 text-[10px] uppercase tracking-wider font-black transition-all hover:bg-white hover:text-black active:scale-95 flex items-center justify-center whitespace-nowrap shadow-[4px_4px_0px_#000]"
                }, FolderOpen ? el(FolderOpen, { size: 14, className: "mr-1" }) : null, "BROWSE")
            )
        ),

        // Workflow Path
        el('div', { className: "flex flex-col gap-4 px-4 py-6 border-b border-black text-black" },
            el('div', { className: "text-xs font-black tracking-widest uppercase flex items-center gap-2" }, 
                FolderOpen ? el(FolderOpen, { size: 16 }) : null,
                "COMFYUI WORKFLOWS DIR"
            ),
            el('div', { className: "flex gap-2 items-stretch" },
                el('input', {
                    type: "text",
                    value: settings.workflowPath || '',
                    onChange: e => updateSettings('workflowPath', e.target.value),
                    placeholder: "E.g. D:\\Workflows",
                    className: "flex-1 rounded-full border border-black/80 bg-white px-4 py-2 text-[11px] font-mono font-bold outline-none text-black transition-all focus:shadow-[4px_4px_0px_#000]"
                }),
                el('button', {
                    onClick: () => selectFolder('workflowPath'),
                    className: "shrink-0 rounded-full border border-black/80 bg-black text-white px-4 py-2 text-[10px] uppercase tracking-wider font-black transition-all hover:bg-white hover:text-black active:scale-95 flex items-center justify-center whitespace-nowrap shadow-[4px_4px_0px_#000]"
                }, FolderOpen ? el(FolderOpen, { size: 14, className: "mr-1" }) : null, "BROWSE")
            )
        ),

        // Background Removal Settings
        el('div', { className: "flex flex-col gap-4 px-4 py-6 border-b border-black text-black" },
            el('div', { className: "text-xs font-black tracking-widest uppercase flex items-center gap-2" }, 
                Scissors ? el(Scissors, { size: 16 }) : null,
                "BG REMOVAL & SVG"
            ),
            
            el('div', { className: "flex flex-col gap-2" },
                el('label', { className: "text-[10px] uppercase tracking-widest font-black" }, "MODEL"),
                el('select', {
                    value: settings.bgActiveModelId || 'rmbg-1.4',
                    onChange: e => updateSettings('bgActiveModelId', e.target.value),
                    className: "w-full rounded-full border border-black/80 bg-white px-4 py-2 text-[11px] font-black outline-none text-black transition-all focus:shadow-[4px_4px_0px_#000]"
                }, 
                    el('option', { value: "rmbg-1.4" }, "BRIA RMBG-1.4 (RECOMMENDED)"),
                    el('option', { value: "isnet" }, "ISNet (GENERAL)")
                )
            ),
            
            el('label', { className: "flex items-center gap-2 cursor-pointer mt-1" },
                el('input', {
                    type: "checkbox",
                    checked: settings.bgUseGPU !== false,
                    onChange: e => updateSettings('bgUseGPU', e.target.checked),
                    className: "accent-black w-4 h-4 border border-black/80"
                }),
                el('span', { className: "text-[10px] uppercase tracking-widest font-black" }, "ENABLE WEBGPU ACCELERATION")
            ),

            el('div', { className: "flex gap-4 mt-2" },
                el('div', { className: "flex-1 flex flex-col gap-2" },
                    el('label', { className: "text-[10px] uppercase tracking-widest font-black" }, "FEATHER (0-10)"),
                    el('input', { 
                        type: "number", min: "0", max: "10",
                        value: settings.bgEdgeFeather || 0, 
                        onChange: e => updateSettings('bgEdgeFeather', Number(e.target.value)), 
                        className: "w-full rounded-full border border-black/80 bg-white px-4 py-2 text-[11px] font-mono font-black outline-none text-black transition-all focus:shadow-[4px_4px_0px_#000]" 
                    })
                ),
                el('div', { className: "flex-1 flex flex-col gap-2" },
                    el('label', { className: "text-[10px] uppercase tracking-widest font-black" }, "THRESHOLD (0-255)"),
                    el('input', { 
                        type: "number", min: "0", max: "255",
                        value: settings.bgAlphaThreshold || 0, 
                        onChange: e => updateSettings('bgAlphaThreshold', Number(e.target.value)), 
                        className: "w-full rounded-full border border-black/80 bg-white px-4 py-2 text-[11px] font-mono font-black outline-none text-black transition-all focus:shadow-[4px_4px_0px_#000]" 
                    })
                )
            )
        ),

        // ComfyUI Servers
        el('div', { className: "flex flex-col gap-4 px-4 py-6 border-b border-black text-black" },
            el('div', { className: "flex items-center justify-between" },
                el('div', { className: "text-xs font-black tracking-widest uppercase flex items-center gap-2" }, 
                    Server ? el(Server, { size: 16 }) : null,
                    "COMFYUI SERVERS"
                ),
                el('button', {
                    onClick: addServer,
                    className: "text-[10px] uppercase font-black tracking-widest flex items-center gap-1 border border-black/80 rounded-full px-3 py-1 hover:bg-black hover:text-white transition-all active:scale-95"
                }, Plus ? el(Plus, { size: 12 }) : null, "ADD")
            ),
            
            settings.servers.length === 0 ? el('div', { className: "text-xs uppercase tracking-widest text-center py-4 font-black opacity-80" }, "NO SERVERS CONFIGURED") :
            el('div', { className: "flex flex-col gap-2" },
                settings.servers.map((srv, idx) => el('div', { key: srv.id, className: "flex flex-col border border-black/80 rounded-2xl overflow-hidden bg-white" },
                    el('div', { 
                        onClick: () => setExpandedServer(expandedServer === srv.id ? null : srv.id),
                        className: "flex items-center justify-between p-3 cursor-pointer hover:bg-black/5 transition-colors border-b border-transparent"
                    },
                        el('div', { className: "flex items-center gap-3" },
                            el('div', { className: `w-3 h-3 rounded-full border border-black/80 ${settings.activeServerId === srv.id ? 'bg-[#34d399]' : 'bg-transparent'}` }),
                            el('span', { className: "text-[11px] font-black uppercase tracking-wider" }, srv.name || `SERVER ${idx + 1}`),
                            el('span', { className: "text-[10px] opacity-60 font-mono font-bold" }, srv.url)
                        ),
                        el('div', { className: "flex items-center gap-2" },
                            el('button', {
                                onClick: (e) => { e.stopPropagation(); updateSettings('activeServerId', srv.id); },
                                className: `text-[9px] uppercase tracking-widest px-2 py-1 rounded-full font-black border border-black/80 transition-all ${settings.activeServerId === srv.id ? 'bg-black text-white' : 'bg-transparent hover:bg-black/10 text-black'}`
                            }, settings.activeServerId === srv.id ? "ACTIVE" : "USE"),
                            el('button', {
                                onClick: (e) => { e.stopPropagation(); removeServer(srv.id); },
                                className: "hover:bg-[#ef4444] hover:text-white border border-transparent hover:border-black/80 p-1 rounded-full transition-all active:scale-90"
                            }, Trash2 ? el(Trash2, { size: 14 }) : "X")
                        )
                    ),
                    
                    expandedServer === srv.id && el('div', { className: "p-4 flex flex-col gap-4 border-t-2 border-black bg-white" },
                        el('div', { className: "flex flex-col gap-2" },
                            el('label', { className: "text-[10px] uppercase tracking-widest font-black" }, "DISPLAY NAME"),
                            el('input', { type: "text", value: srv.name, onChange: e => updateServer(srv.id, 'name', e.target.value), className: "w-full rounded-full border border-black/80 bg-white px-4 py-2 text-[11px] font-black outline-none text-black transition-all focus:shadow-[4px_4px_0px_#000]" })
                        ),
                        el('div', { className: "flex flex-col gap-2" },
                            el('label', { className: "text-[10px] uppercase tracking-widest font-black" }, "ENDPOINT URL"),
                            el('input', { type: "text", value: srv.url, onChange: e => updateServer(srv.id, 'url', e.target.value), className: "w-full rounded-full border border-black/80 bg-white px-4 py-2 text-[11px] font-mono font-black outline-none text-black transition-all focus:shadow-[4px_4px_0px_#000]" })
                        ),
                        el('div', { className: "flex flex-col gap-2" },
                            el('label', { className: "text-[10px] uppercase tracking-widest font-black" }, "HEADERS"),
                            el('div', { className: "flex flex-col gap-2" },
                                (srv.headers || []).map((h, i) => el('div', { key: i, className: "flex gap-2 items-center" },
                                    el('input', { type: "text", placeholder: "Key", value: h.key, onChange: e => updateHeader(srv.id, i, 'key', e.target.value), className: "flex-1 rounded-full border border-black/80 bg-white px-4 py-1.5 text-[11px] font-mono font-black outline-none text-black focus:shadow-[4px_4px_0px_#000]" }),
                                    el('input', { type: "text", placeholder: "Value", value: h.value, onChange: e => updateHeader(srv.id, i, 'value', e.target.value), className: "flex-[2] rounded-full border border-black/80 bg-white px-4 py-1.5 text-[11px] font-mono font-black outline-none text-black focus:shadow-[4px_4px_0px_#000]" }),
                                    el('button', { onClick: () => removeHeader(srv.id, i), className: "hover:bg-[#ef4444] hover:text-white border border-transparent hover:border-black/80 p-1.5 rounded-full transition-all active:scale-90" }, Trash2 ? el(Trash2, { size: 14 }) : "X")
                                )),
                                el('button', { onClick: () => addHeader(srv.id), className: "text-[10px] font-black uppercase tracking-widest border border-black/80 rounded-full px-3 py-1.5 self-start mt-1 hover:bg-black hover:text-white transition-all active:scale-95" }, "+ ADD HEADER")
                            )
                        )
                    )
                ))
            ),

            // Upload Strategy
            el('div', { className: "mt-4 p-4 border border-black/80 rounded-2xl flex flex-col gap-3 bg-white" },
                el('div', { className: "text-[10px] uppercase tracking-widest font-black" }, "UPLOAD STRATEGY"),
                el('div', { className: "flex bg-black p-1 rounded-full" },
                    el('button', {
                        onClick: () => updateSettings('comfyUploadStrategy', 'direct'),
                        className: `flex-1 py-2 text-[10px] uppercase tracking-widest font-black rounded-full transition-all active:scale-95 ${settings.comfyUploadStrategy === 'direct' ? 'bg-white text-black' : 'text-white/60 hover:text-white'}`
                    }, "DIRECT (/upload/image)"),
                    el('button', {
                        onClick: () => updateSettings('comfyUploadStrategy', 'oss'),
                        className: `flex-1 py-2 text-[10px] uppercase tracking-widest font-black rounded-full transition-all active:scale-95 ${settings.comfyUploadStrategy === 'oss' ? 'bg-white text-black' : 'text-white/60 hover:text-white'}`
                    }, "ALIYUN OSS")
                ),
                settings.comfyUploadStrategy === 'oss' && el('div', { className: "flex flex-col gap-2 mt-2" },
                    el('input', { type: "text", value: settings.ossApiUrl, onChange: e => updateSettings('ossApiUrl', e.target.value), placeholder: "OSS API URL", className: "w-full rounded-full border border-black/80 bg-white px-4 py-2 text-[11px] font-mono font-black outline-none text-black focus:shadow-[4px_4px_0px_#000]" }),
                    el('input', { type: "text", value: settings.ossApiToken, onChange: e => updateSettings('ossApiToken', e.target.value), placeholder: "OSS API TOKEN", className: "w-full rounded-full border border-black/80 bg-white px-4 py-2 text-[11px] font-mono font-black outline-none text-black focus:shadow-[4px_4px_0px_#000]" })
                )
            )
        ),

        // 3. Grsai Generation API
        el('div', { className: "flex flex-col gap-4 py-6 border-b border-black" },
            el('div', { className: "text-xs font-black tracking-widest uppercase flex items-center gap-2" }, "🎨 GRSAI ENGINE API"),
            el('div', { className: "flex flex-col gap-2" },
                el('label', { className: "text-[10px] uppercase tracking-widest font-black" }, "API ENDPOINT"),
                el('input', { type: "text", value: settings.grsaiEndpoint, onChange: e => updateSettings('grsaiEndpoint', e.target.value), className: "w-full rounded-full border border-black/80 bg-white px-4 py-2 text-[11px] font-mono font-black outline-none text-black transition-all focus:shadow-[4px_4px_0px_#000]" })
            ),
            el('div', { className: "flex flex-col gap-2" },
                el('label', { className: "text-[10px] uppercase tracking-widest font-black" }, "API KEY (BEARER TOKEN)"),
                el('input', { type: "password", value: settings.grsaiApiKey || '', onChange: e => updateSettings('grsaiApiKey', e.target.value), placeholder: "sk-...", className: "w-full rounded-full border border-black/80 bg-white px-4 py-2 text-[11px] font-mono font-black outline-none text-black transition-all focus:shadow-[4px_4px_0px_#000]" })
            ),
            el('div', { className: "flex flex-col gap-2" },
                el('label', { className: "text-[10px] uppercase tracking-widest font-black flex items-center justify-between" }, 
                    "CREDIT TOKEN (OPTIONAL)"
                ),
                el('input', { type: "password", value: settings.grsaiCreditToken || '', onChange: e => updateSettings('grsaiCreditToken', e.target.value), placeholder: "FALLBACKS TO API KEY IF EMPTY", className: "w-full rounded-full border border-black/80 bg-white px-4 py-2 text-[11px] font-mono font-black outline-none text-black transition-all focus:shadow-[4px_4px_0px_#000]" })
            )
        )
    );
}

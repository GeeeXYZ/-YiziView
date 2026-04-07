const { React, YiziAPI, lucide } = window;
const createElement = React.createElement;
const el = (tag, props = {}, ...children) => createElement(tag, props, ...children);
const { Image: ImageIcon, Sparkles, X, LayoutDashboard, Settings, ChevronDown, Check, Loader2, Save, FileText, Trash2, Shuffle } = lucide;

const SIZE_PRESETS = [
    "2k (Origin)", "4k (Origin)", "2048x2048 (1:1)", "4096x4096 (1:1)",
    "2496x1664 (3:2)", "1664x2496 (2:3)", "2304x1728 (4:3)", "1728x2304 (3:4)",
    "2560x1440 (16:9)", "1440x2560 (9:16)", "3024x1296 (21:9)", "1296x3024 (9:21)"
];

const getApiSize = (preset) => {
    if (preset.includes("1k (Origin)")) return "1k";
    if (preset.includes("2k (Origin)")) return "2k";
    if (preset.includes("4k (Origin)")) return "4k";
    return preset.split(' ')[0]; // e.g. "2048x2048"
};

const getBase64 = async (filePath) => {
    try {
        const response = await fetch(`media://local/${encodeURIComponent(filePath)}`);
        const blob = await response.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.error("Failed to load image as base64", e);
        return null;
    }
};

const SeedreamWidget = () => {
    const [imagePath, setImagePath] = React.useState(null);
    const [isGenerating, setIsGenerating] = React.useState(false);
    const [generationProgress, setGenerationProgress] = React.useState({ current: 0, total: 0 });
    const [generatedImages, setGeneratedImages] = React.useState([]);
    const [position, setPosition] = React.useState(() => localStorage.getItem('yizi_seedream_dock') || 'right');
    const [showSettings, setShowSettings] = React.useState(false);

    // Form states
    const [apiKey, setApiKey] = React.useState(() => localStorage.getItem('yizi_seedream_api_key') || '');
    const [endpointId, setEndpointId] = React.useState(() => localStorage.getItem('yizi_seedream_endpoint') || '');
    const [libraryDir, setLibraryDir] = React.useState(() => localStorage.getItem('yizi_seedream_library_dir') || 'E:\\ComfyUI_windows_portable\\ComfyUI\\custom_nodes\\ComfyUI-YiziStudio\\library');
    
    const [libraryFiles, setLibraryFiles] = React.useState([]);
    const [selectedLibraryFile, setSelectedLibraryFile] = React.useState('');
    const [libraryItems, setLibraryItems] = React.useState([]);

    React.useEffect(() => {
        // Auto scan the designated folder through bridging IPC
        if (window.electron && window.electron.readLibraryFiles) {
            window.electron.readLibraryFiles(libraryDir).then(files => {
                setLibraryFiles(files || []);
                // If the selected one doesn't exist anymore, reset it
                if (selectedLibraryFile && !(files || []).some(f => f.path === selectedLibraryFile)) {
                    setSelectedLibraryFile('');
                    setLibraryItems([]);
                }
            }).catch(e => console.error("Library Scan failed:", e));
        }
    }, [libraryDir, showSettings]);

    React.useEffect(() => {
        if (!selectedLibraryFile) {
            setLibraryItems([]);
            return;
        }
        // Load contents of selected library natively via secure file mapping
        fetch(`media://local/${encodeURIComponent(selectedLibraryFile)}`)
            .then(res => res.text())
            .then(text => {
                const rawParts = text.split('---').map(s => s.trim()).filter(Boolean);
                const parsed = rawParts.map(item => {
                    if (item.includes(':::')) {
                        return item.split(':::').slice(1).join(':::').trim();
                    }
                    return item;
                }).filter(Boolean);
                setLibraryItems(parsed);
                console.log(`Loaded ${parsed.length} prompts from ${selectedLibraryFile}`);
            }).catch(e => {
                console.error("Failed to load library file content:", e);
                setLibraryItems([]);
            });
    }, [selectedLibraryFile]);

    const [prompt, setPrompt] = React.useState('');
    const [sizePreset, setSizePreset] = React.useState("2k (Origin)");
    const [batchSize, setBatchSize] = React.useState(1);

    const fileInputRef = React.useRef(null);

    const saveSettings = () => {
        localStorage.setItem('yizi_seedream_api_key', apiKey);
        localStorage.setItem('yizi_seedream_endpoint', endpointId);
        localStorage.setItem('yizi_seedream_library_dir', libraryDir);
        setShowSettings(false);
    };

    const executeSingleRequest = async (apiSize, imageBase64, reqPrompt) => {
        const payload = {
            model: endpointId.trim(),
            prompt: reqPrompt,
            size: apiSize,
            sequential_image_generation: "disabled",
            watermark: false // Forced disable
        };

        if (imageBase64) {
            payload.image = [imageBase64];
        }

        const result = await fetch("https://ark.cn-beijing.volces.com/api/v3/images/generations", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey.trim()}`
            },
            body: JSON.stringify(payload)
        });

        if (!result.ok) {
            const errText = await result.text();
            throw new Error(errText);
        }
        return await result.json();
    };

    const handleGenerate = async () => {
        // Validation passes
        const targetFolder = YiziAPI.getCurrentFolder();
        if (!targetFolder) {
            alert("No target folder identified. Please ensure you have opened a folder in YiziView to save generated results.");
            return;
        }

        if (!apiKey || !endpointId) {
            alert("API Key and Endpoint ID are required.");
            setShowSettings(true);
            return;
        }

        if (!prompt && libraryItems.length === 0) {
            alert("Please enter a base prompt or load a Prompt Library.");
            return;
        }

        const count = parseInt(batchSize, 10);
        if (isNaN(count) || count < 1) {
            alert("Invalid Batch Size");
            return;
        }

        setIsGenerating(true);
        setGenerationProgress({ current: 0, total: count });

        const apiSize = getApiSize(sizePreset);
        let imageBase64 = null;
        if (imagePath) {
            imageBase64 = await getBase64(imagePath);
        }

        let completed = 0;
        let errors = [];
        
        // Execute concurrently
        const promises = Array.from({ length: count }).map(async () => {
            let finalPrompt = prompt;
            if (libraryItems.length > 0) {
                finalPrompt = libraryItems[Math.floor(Math.random() * libraryItems.length)];
            }

            try {
                const data = await executeSingleRequest(apiSize, imageBase64, finalPrompt);
                console.log("Seedream Result Payload:", data);
                
                if (data && data.data && Array.isArray(data.data)) {
                    for (const item of data.data) {
                        let resultB64 = "";
                        if (item.b64_json) {
                            resultB64 = `data:image/jpeg;base64,${item.b64_json}`;
                        } else if (item.url) {
                            // Fetch URL and convert to blob string
                            const res = await fetch(item.url);
                            const blob = await res.blob();
                            resultB64 = await new Promise((resolve) => {
                                const reader = new FileReader();
                                reader.onloadend = () => resolve(reader.result);
                                reader.readAsDataURL(blob);
                            });
                        }

                        if (resultB64) {
                            const rId = Math.random().toString(36).substring(2, 8).toUpperCase();
                            const outputName = `Seedream_${apiSize}_${rId}.jpg`;
                            const fullTargetPath = targetFolder.replace(/\\/g, '/') + '/' + outputName;
                            
                            // Ask backend to physically write the file (overwrite=true bypasses renaming suffixes)
                            if (window.electron && window.electron.saveEditedImage) {
                                await window.electron.saveEditedImage(fullTargetPath, resultB64, true);
                            }

                            // Add to preview array
                            setGeneratedImages(prev => [{ b64: resultB64, path: fullTargetPath, name: outputName }, ...prev].slice(0, 50));
                        }
                    }
                }
            } catch (err) {
                console.error("Batch Request Error:", err);
                errors.push(err.message);
            } finally {
                completed++;
                setGenerationProgress(prev => ({ ...prev, current: completed }));
            }
        });

        await Promise.all(promises);
        
        setIsGenerating(false);
        setGenerationProgress({ current: 0, total: 0 });

        if (errors.length > 0) {
            console.error(`Generation Finished with ${errors.length} errors.`, errors);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            const file = files[0];
            // Rescue path from Electron's secure webUtils wrapper if available
            const realPath = window.electron?.getFilePath ? window.electron.getFilePath(file) : file.path;
            if (realPath) {
                console.log("[Seedream] Dropped image real path:", realPath);
                setImagePath(realPath);
            }
        }
    };

    const switchPosition = () => {
        const newPos = position === 'right' ? 'bottom' : 'right';
        YiziAPI.unregisterComponent(`${position}-dock`, SeedreamWidget);
        localStorage.setItem('yizi_seedream_dock', newPos);
        YiziAPI.registerComponent(`${newPos}-dock`, SeedreamWidget);
        setPosition(newPos);
    };

    const closePlugin = () => {
        YiziAPI.unregisterComponent('bottom-dock', SeedreamWidget);
        YiziAPI.unregisterComponent('right-dock', SeedreamWidget);
    };

    const previewUrl = imagePath ? `media://local/${encodeURIComponent(imagePath)}` : null;

    // UI
    const renderSettings = () => {
        const isH = position === 'bottom';
        return el('div', { className: `space-y-4 p-3 bg-neutral-900 rounded-lg border border-purple-500/20 shadow-xl ${isH ? 'w-[250px] shrink-0 h-full overflow-y-auto custom-scrollbar' : 'mb-4'}` },
            el('div', { className: "space-y-1" },
                el('label', { className: "block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1 flex justify-between" }, 
                    "Volcengine API Key"
                ),
                el('input', {
                    type: "password",
                    value: apiKey,
                    onChange: e => setApiKey(e.target.value),
                    placeholder: "Enter Volcengine API Key",
                    className: "w-full bg-black/50 border border-neutral-700 rounded text-xs px-2 py-1.5 focus:border-purple-500 focus:outline-none"
                })
            ),
            el('div', { className: "space-y-1" },
                el('label', { className: "block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1" }, "Endpoint ID"),
                el('input', {
                    type: "text",
                    value: endpointId,
                    onChange: e => setEndpointId(e.target.value),
                    placeholder: "ep-202xxxxxxxx-xxxxx",
                    className: "w-full bg-black/50 border border-neutral-700 rounded text-xs px-2 py-1.5 focus:border-purple-500 focus:outline-none font-mono"
                })
            ),
            
            el('div', { className: "space-y-1" },
                el('label', { className: "block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1" }, "Library Target Folder"),
                el('input', {
                    type: "text",
                    value: libraryDir,
                    onChange: e => setLibraryDir(e.target.value),
                    placeholder: "E:\\ComfyUI...",
                    className: "w-full bg-black/50 border border-neutral-700 rounded text-xs px-2 py-1.5 focus:border-purple-500 focus:outline-none"
                })
            ),

            el('button', {
                onClick: saveSettings,
                className: "w-full flex items-center justify-center gap-1 bg-neutral-800 hover:bg-neutral-700 text-white text-xs px-2 py-1.5 shrink-0 rounded transition-colors mt-2"
            }, el(Save, { size: 12 }), "Save Configuration")
        );
    };

    const renderForm = () => {
        const isH = position === 'bottom';

        return el('div', { className: isH ? "flex gap-4 h-full items-stretch py-2" : "space-y-4" },
            
            // --- Column 1: Config ---
            el('div', { className: isH ? "flex flex-col w-[200px] shrink-0 space-y-3 overflow-y-auto custom-scrollbar" : "space-y-4" },
                // Prompt Library
                el('div', { className: "space-y-1" },
                    el('label', { className: "text-[10px] font-bold text-neutral-500 uppercase tracking-widest flex items-center justify-between" }, 
                        "Local Library",
                        libraryItems.length > 0 && el('span', { className: "text-neutral-500 text-[10px]" }, `[ ${libraryItems.length} ]`)
                    ),
                    el('div', { className: "relative" },
                        el('select', {
                            value: selectedLibraryFile,
                            onChange: e => setSelectedLibraryFile(e.target.value),
                            className: "w-full appearance-none bg-neutral-900 border border-neutral-700 rounded text-xs px-2 py-1.5 focus:border-neutral-500 focus:outline-none pr-6 cursor-pointer"
                        }, 
                            el('option', { value: '' }, "-- None --"),
                            libraryFiles.map(f => el('option', { key: f.path, value: f.path }, f.name))
                        ),
                        el('div', { className: "absolute inset-y-0 right-2 flex items-center pointer-events-none" },
                            el(ChevronDown, { size: 12, className: "text-neutral-500" })
                        )
                    )
                ),
                // Stack Size & Batch
                el('div', { className: isH ? "space-y-2" : "grid grid-cols-2 gap-3" },
                    el('div', { className: "space-y-1" },
                        el('label', { className: "text-[10px] font-bold text-neutral-500 uppercase tracking-widest" }, "Size Preset"),
                        el('div', { className: "relative" },
                            el('select', {
                                value: sizePreset,
                                onChange: e => setSizePreset(e.target.value),
                                className: "w-full appearance-none bg-neutral-900 border border-neutral-700 rounded text-xs px-2 py-1.5 focus:border-neutral-500 focus:outline-none pr-6 cursor-pointer"
                            }, SIZE_PRESETS.map(p => el('option', { key: p, value: p }, p))),
                            el('div', { className: "absolute inset-y-0 right-2 flex items-center pointer-events-none" },
                                el(ChevronDown, { size: 12, className: "text-neutral-500" })
                            )
                        )
                    ),
                    el('div', { className: "space-y-1" },
                        el('label', { className: "text-[10px] font-bold text-neutral-500 uppercase tracking-widest" }, "Batch Count"),
                        el('input', {
                            type: "number",
                            min: 1,
                            max: 20,
                            value: batchSize,
                            onChange: e => setBatchSize(e.target.value),
                            title: "Generate multiple parallel requests",
                            className: "w-full bg-neutral-900 border border-neutral-700 rounded text-xs px-2 py-1.5 focus:border-neutral-500 focus:outline-none"
                        })
                    )
                )
            ),

            // --- Column 2: Prompt ---
            el('div', { className: isH ? "w-[300px] flex flex-col shrink-0" : "space-y-1" },
                el('label', { className: `text-[10px] font-bold text-neutral-500 uppercase tracking-widest flex justify-between ${isH ? 'mb-1' : ''}` }, 
                    "Base Prompt",
                    libraryItems.length > 0 && el('span', { className: "text-purple-400 capitalize" }, "Library Mode")
                ),
                libraryItems.length > 0
                    ? el('div', { className: `w-full bg-neutral-900 border border-neutral-700/50 rounded-lg flex flex-col items-center justify-center opacity-70 select-none ${isH ? 'flex-1 h-full' : 'h-24'}` },
                        el(Shuffle, { size: 24, className: "text-neutral-500 mb-2" }),
                        el('span', { className: "text-neutral-400 tracking-[0.2em] font-bold uppercase text-xs" }, "RANDOM")
                      )
                    : el('textarea', {
                        value: prompt,
                        onChange: e => setPrompt(e.target.value),
                        placeholder: "Describe the image...",
                        className: `w-full bg-neutral-900 border border-neutral-700 rounded-lg text-sm px-3 py-2 resize-none transition-colors focus:border-neutral-500 focus:outline-none placeholder:text-neutral-600 custom-scrollbar ${isH ? 'flex-1 h-full' : 'h-24'}`
                    })
            ),

            // --- Column 3: Image Drop & Button (Stacked) ---
            el('div', { className: isH ? "flex flex-col gap-2 shrink-0 h-full min-w-[120px]" : "space-y-4" },
                // File Drop (Square when empty, fits otherwise)
                el('div', { className: "flex flex-col flex-1 min-h-0 min-w-0 items-center w-full" },
                    el('div', { className: `flex items-center justify-between w-full ${isH ? 'mb-1 shrink-0' : ''}` },
                        el('label', { className: "text-[10px] font-bold text-neutral-500 uppercase tracking-widest" }, "I2I Ref"),
                        imagePath && el('button', {
                            onClick: () => setImagePath(null),
                            className: "text-[9px] uppercase tracking-widest text-neutral-500 hover:text-red-400"
                        }, "Clear")
                    ),
                    el('div', { 
                        className: `border-2 border-dashed rounded-xl flex items-center justify-center transition-colors relative overflow-hidden group min-w-0 w-full ${imagePath ? 'border-purple-500/50 bg-neutral-900/50' : 'border-neutral-700 bg-neutral-900 hover:border-neutral-500 hover:bg-neutral-800 cursor-pointer'} ${isH && !imagePath ? 'flex-1 aspect-square' : isH && imagePath ? 'flex-1 w-auto max-w-[250px]' : 'w-full aspect-square max-h-[200px]'}`,
                        onDragOver: handleDragOver,
                        onDrop: handleDrop
                    },
                        imagePath ? [
                            el('img', { 
                                key: 'img', 
                                src: previewUrl, 
                                className: `w-full h-full object-contain pointer-events-none` 
                            }),
                            el('div', { key: 'overlay', className: "absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10" },
                                el('span', { className: "text-xs font-bold text-white uppercase tracking-widest" }, "Replace")
                            )
                        ] : [
                            el('div', { key: 'placeholder', className: "absolute inset-0 flex flex-col items-center justify-center pointer-events-none" },
                                el(ImageIcon, { size: isH ? 16 : 24, className: `text-neutral-600 ${isH ? 'mb-1' : 'mb-2'}` }),
                                el('span', { className: "text-[10px] font-bold text-neutral-500 text-center px-1 leading-tight" }, "SQUARE DROP")
                            )
                        ]
                    )
                ),
                
                // Submit Button
                el('div', { className: `flex flex-col ${isH ? 'justify-end pt-1' : 'pt-2'}` },
                    el('button', {
                        onClick: handleGenerate,
                        disabled: isGenerating,
                        className: `relative overflow-hidden w-full ${isH ? 'h-9' : 'h-11'} rounded-full flex items-center justify-center font-bold text-xs uppercase tracking-widest transition-colors duration-200 ${isGenerating 
                            ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed' 
                            : 'bg-white hover:bg-neutral-200 text-black active:bg-neutral-300'}`
                    }, 
                        isGenerating && el('div', { 
                            key: 'prog-bg',
                            className: "absolute left-0 top-0 bottom-0 bg-neutral-700 transition-all duration-300 ease-out",
                            style: { width: `${(generationProgress.current / generationProgress.total) * 100}%` }
                        }),
                        el('div', { key: 'content', className: `relative z-10 flex items-center justify-center transition-transform duration-200 ${!isGenerating && 'active:scale-[0.98]'}` }, 
                            isGenerating ? [
                                el(Loader2, { key: 'loader', size: 14, className: `mr-2 animate-spin` }), 
                                el('span', { key: 'text', className: "text-[10px]" }, `(${generationProgress.current}/${generationProgress.total})`)
                            ] : [
                                el(Sparkles, { key: 'icon', size: 14, className: `mr-2 mb-px` }), 
                                el('span', { key: 'text' }, isH ? "GENERATE" : `GENERATE`)
                            ]
                        )
                    )
                )
            ),

            // --- Column 5: Image Previews ---
            generatedImages.length > 0 && el('div', { 
                className: isH 
                    ? "flex-1 flex gap-2 h-full overflow-x-auto custom-scrollbar pl-4 border-l border-neutral-800 items-center justify-start" 
                    : "grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-neutral-800" 
            },
                generatedImages.map((imgObj, i) => 
                    el('img', { 
                        key: i, 
                        src: imgObj.b64,
                        onClick: () => {
                            window.dispatchEvent(new CustomEvent('open-global-viewer', {
                                detail: { 
                                    image: { 
                                        path: imgObj.path, 
                                        name: imgObj.name,
                                        url: `media://local/${encodeURIComponent(imgObj.path)}`
                                    } 
                                }
                            }));
                        },
                        className: `${isH ? 'h-[90%] w-auto flex-shrink-0' : 'w-full h-auto'} object-cover rounded-md border border-neutral-700 shadow-md cursor-pointer hover:border-purple-500 transition-colors`
                    })
                )
            )
        );
    }

    return el('div', { className: `flex flex-col h-full w-full bg-[#0a0a0a] text-white select-none` },
        // Header
        el('div', { className: "flex items-center justify-between px-3 h-[48px] border-b border-neutral-800 titlebar-drag-region sticky top-0 bg-[#0a0a0a] z-10 shrink-0" },
            el('div', { className: "flex items-center gap-2" },
                el(Sparkles, { size: 16, className: "text-purple-400" }),
                el('span', { className: "text-xs font-bold uppercase tracking-widest text-neutral-300 pointer-events-none" }, "Seedream Engine")
            ),
            el('div', { className: "flex items-center gap-1 no-drag" },
                el('button', {
                    onClick: () => setShowSettings(!showSettings),
                    className: `p-1.5 rounded transition-colors ${showSettings ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:bg-neutral-800 hover:text-white'}`,
                    title: "Engine Settings"
                }, el(Settings, { size: 14 })),
                el('div', { className: "w-px h-3 bg-neutral-700 mx-1" }),
                el('button', { 
                    onClick: switchPosition, 
                    className: "p-1.5 hover:bg-neutral-800 rounded transition-colors text-neutral-500 hover:text-white",
                    title: "Dock Position"
                }, el(LayoutDashboard, { size: 14 })),
                el('button', { 
                    onClick: closePlugin, 
                    className: "p-1.5 hover:bg-red-500/20 rounded transition-colors text-neutral-500 hover:text-red-400",
                    title: "Close"
                }, el(X, { size: 14 }))
            )
        ),

        // Body
        el('div', { className: `flex-1 p-4 custom-scrollbar ${position === 'bottom' ? 'flex gap-4 overflow-x-auto overflow-y-hidden' : 'overflow-y-auto'}` },
            showSettings ? renderSettings() : null,
            renderForm()
        )
    );
};

// Clean up old hook if it exists during hot reload
if (window.__SeedreamWidget) {
    YiziAPI.unregisterComponent('right-dock', window.__SeedreamWidget);
    YiziAPI.unregisterComponent('bottom-dock', window.__SeedreamWidget);
}
window.__SeedreamWidget = SeedreamWidget;

const savedDock = localStorage.getItem('yizi_seedream_dock') || 'right';
YiziAPI.registerComponent(`${savedDock}-dock`, SeedreamWidget);

YiziAPI.registerAction({
    id: 'studio-toggle',
    name: 'Seedream Studio',
    defaultShortcut: 'Ctrl+Shift+S',
    onExecute: () => {
        const isRightDock = YiziAPI.getComponents('right-dock').includes(SeedreamWidget);
        const isBottomDock = YiziAPI.getComponents('bottom-dock').includes(SeedreamWidget);
        
        if (isRightDock || isBottomDock) {
            YiziAPI.unregisterComponent('right-dock', SeedreamWidget);
            YiziAPI.unregisterComponent('bottom-dock', SeedreamWidget);
        } else {
            const dock = localStorage.getItem('yizi_seedream_dock') || 'right';
            YiziAPI.registerComponent(`${dock}-dock`, SeedreamWidget);
        }
    }
});

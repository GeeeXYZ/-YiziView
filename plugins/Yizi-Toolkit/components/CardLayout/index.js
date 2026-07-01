import { React, el, Image as ImageIcon, Settings, Download, X, Plus } from '../../core/globals.js';
import { renderCardLayout } from './LayoutEngine.js';
import { getTheme } from '../theme.js';

function usePersistentState(key, defaultValue, parser = String) {
    const [state, setState] = React.useState(() => {
        const val = localStorage.getItem(key);
        if (val !== null) {
            try { return parser(val); } catch(e) {}
        }
        return defaultValue;
    });
    React.useEffect(() => {
        localStorage.setItem(key, state);
    }, [key, state]);
    return [state, setState];
}

export default function CardLayoutWidget({ settings }) {
    const theme = getTheme(settings?.theme || 'dark');
    const [images, setImages] = React.useState([]);
    
    // Persist all settings
    const [aspectRatio, setAspectRatio] = usePersistentState('yizi_cl_aspectRatio', '3:4');
    const [columns, setColumns] = usePersistentState('yizi_cl_columns', 3, parseInt);
    const [gap, setGap] = usePersistentState('yizi_cl_gap', 20, parseInt);
    const [bgColor, setBgColor] = usePersistentState('yizi_cl_bgColor', '#222222');
    const [logoText, setLogoText] = usePersistentState('yizi_cl_logoText', 'AI MODEL CUSTOMIZATION');
    const [logoColor, setLogoColor] = usePersistentState('yizi_cl_logoColor', '#ff3333');
    const [showBadges, setShowBadges] = usePersistentState('yizi_cl_showBadges', true, val => val === 'true');
    const [cornerRadius, setCornerRadius] = usePersistentState('yizi_cl_cornerRadius', 4, parseInt);
    const [cardBaseWidth, setCardBaseWidth] = usePersistentState('yizi_cl_cardBaseWidth', 1200, parseInt);
    
    const [logoDataUrl, setLogoDataUrl] = React.useState(() => localStorage.getItem('yizi_cardlayout_logo') || '');

    const logoInputRef = React.useRef(null);
    const canvasRef = React.useRef(null);
    const widgetRootRef = React.useRef(null);
    const [sourcePath, setSourcePath] = React.useState(''); // Store the path of the first dragged image


    // Global Drop handler for saving to host
    React.useEffect(() => {
        const handleGlobalDragOver = (e) => {
            if (e.dataTransfer.types.includes('yizi-cardlayout-drag')) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
            }
        };
        const handleGlobalDrop = async (e) => {
            if (!e.dataTransfer.types.includes('yizi-cardlayout-drag')) return;
            e.preventDefault();
            e.stopPropagation();
            // Ignore drops inside the plugin itself
            if (widgetRootRef.current && widgetRootRef.current.contains(e.target)) return;
            
            if (sourcePath && window.electron && window.electron.saveEditedImage && canvasRef.current) {
                try {
                    // Generate dataURL ON DEMAND instead of on every render
                    const dataUrl = canvasRef.current.toDataURL('image/png', 1.0);
                    await window.electron.saveEditedImage(sourcePath, dataUrl, false);
                } catch (err) {
                    console.error("Failed to save layout:", err);
                }
            }
        };
        document.addEventListener('dragover', handleGlobalDragOver, true);
        document.addEventListener('drop', handleGlobalDrop, true);
        return () => {
            document.removeEventListener('dragover', handleGlobalDragOver, true);
            document.removeEventListener('drop', handleGlobalDrop, true);
        };
    }, [sourcePath]);

    const handleDrop = (e) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
        files.forEach((f, index) => {
            if (index === 0 && !sourcePath) {
                const path = window.electron && window.electron.getFilePath ? window.electron.getFilePath(f) : f.path;
                if (path) setSourcePath(path);
            }
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = new Image();
                img.onload = () => {
                    setImages(prev => [...prev, img]);
                };
                img.src = ev.target.result;
            };
            reader.readAsDataURL(f);
        });
    };

    const handleDragOver = (e) => e.preventDefault();

    const addImage = (src) => {
        const img = new Image();
        img.onload = () => {
            setImages(prev => [...prev, img]);
        };
        img.src = src;
    };

    const removeImage = (index) => {
        setImages(prev => {
            const next = prev.filter((_, idx) => idx !== index);
            if (next.length === 0) setSourcePath('');
            return next;
        });
    };

    const clearAllImages = () => {
        setImages([]);
        setSourcePath('');
    };

    const redrawCanvas = React.useCallback(async () => {
        if (!canvasRef.current) return;
        if (images.length === 0) {
            const ctx = canvasRef.current.getContext('2d');
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            return;
        }
        await renderCardLayout(canvasRef.current, {
            images,
            aspectRatio,
            columns,
            gap,
            bgColor,
            logoText,
            logoColor,
            showBadges,
            cornerRadius,
            logoDataUrl,
            cardBaseWidth
        });
        // Removed setPreviewUrl(canvasRef.current.toDataURL) to completely eliminate slider dragging lag
    }, [images, aspectRatio, columns, gap, bgColor, logoText, logoColor, showBadges, cornerRadius, logoDataUrl, cardBaseWidth]);

    React.useEffect(() => {
        // Debounce rendering by 150ms to fix color picker lag and slider lag
        const timer = setTimeout(() => {
            redrawCanvas();
        }, 150);
        return () => clearTimeout(timer);
    }, [redrawCanvas]);

    const handleExport = () => {
        if (!canvasRef.current || images.length === 0) return;
        const link = document.createElement('a');
        link.download = `card_layout_${Date.now()}.png`;
        link.href = canvasRef.current.toDataURL('image/png', 1.0);
        link.click();
    };

    return el('div', { 
        ref: widgetRootRef,
        className: "w-full h-full flex flex-col animate-in slide-in-from-right-4 duration-200" 
    },


        // Scrollable Content
        el('div', { className: "flex-1 overflow-y-auto pb-12 flex flex-col thin-scrollbar" },
            
            // Image Upload Zone
            el('div', { className: "p-4 py-6 flex flex-col gap-4 border-b border-black text-black" },
                el('div', { className: "flex items-center justify-between" },
                    el('h3', { className: "text-[10px] font-black uppercase tracking-widest" }, "1. IMAGES"),
                    images.length > 0 && el('button', { 
                        onClick: clearAllImages,
                        className: "text-[10px] font-black uppercase tracking-widest text-[#ef4444] hover:underline" 
                    }, "CLEAR ALL")
                ),
                el('div', { 
                    onDrop: handleDrop,
                    onDragOver: handleDragOver,
                    className: "min-h-[100px] border border-black/80 border-dashed hover:bg-black/5 rounded-2xl flex flex-wrap gap-3 p-3 transition-colors relative cursor-pointer bg-white"
                },
                    images.length === 0 && el('div', { className: "absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-40 font-black" },
                        el(Plus, { size: 24, className: "mb-2" }),
                        el('span', { className: "text-[10px] uppercase tracking-widest" }, "DROP IMAGES")
                    ),
                    images.map((img, i) => el('div', { key: i, className: "relative w-16 h-16 rounded-xl overflow-hidden group border border-black/80" },
                        el('img', { src: img.src, className: "w-full h-full object-cover" }),
                        el('button', { 
                            onClick: () => removeImage(i),
                            className: "absolute top-1 right-1 p-1.5 bg-black hover:bg-[#ef4444] rounded-full opacity-0 group-hover:opacity-100 transition-opacity active:scale-90"
                        }, el(X, { size: 10, className: "text-white" }))
                    ))
                )
            ),

            // Layout Settings
            el('div', { className: "p-4 py-6 flex flex-col gap-6 border-b border-black text-black" },
                el('h3', { className: "text-[10px] font-black uppercase tracking-widest" }, "2. LAYOUT OPTIONS"),
                
                // 2-column grid for options
                el('div', { className: "grid grid-cols-2 gap-4" },
                    // Aspect Ratio
                    el('div', { className: "flex flex-col gap-2" },
                        el('span', { className: "text-[10px] font-black uppercase tracking-widest" }, "RATIO"),
                        el('div', { className: "relative border border-black/80 rounded-full overflow-hidden bg-white hover:shadow-[2px_2px_0px_#000] transition-shadow" },
                            el('select', { 
                                value: aspectRatio, 
                                onChange: e => setAspectRatio(e.target.value),
                                className: "w-full appearance-none bg-transparent pl-4 pr-10 py-2 text-[11px] outline-none font-black text-black cursor-pointer"
                            }, 
                                el('option', { value: "3:4" }, "3:4"),
                                el('option', { value: "9:16" }, "9:16")
                            ),
                            el('div', { className: "absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[10px]" }, "▼")
                        )
                    ),

                    // Columns
                    el('div', { className: "flex flex-col gap-2" },
                        el('span', { className: "text-[10px] font-black uppercase tracking-widest" }, "COLUMNS"),
                        el('input', { 
                            type: "number", min: 1, max: 10, value: columns,
                            onChange: e => setColumns(parseInt(e.target.value) || 1),
                            className: "w-full rounded-full border border-black/80 bg-white px-4 py-2 text-[11px] outline-none font-black text-black transition-shadow focus:shadow-[2px_2px_0px_#000]"
                        })
                    ),

                    // Gap
                    el('div', { className: "flex flex-col gap-2 col-span-2 mt-2" },
                        el('div', { className: "flex items-center justify-between" },
                            el('span', { className: "text-[10px] font-black uppercase tracking-widest" }, "SPACING"),
                            el('span', { className: "text-[10px] font-mono font-black" }, gap)
                        ),
                        el('input', { 
                            type: "range", min: 0, max: 100, value: gap,
                            onChange: e => setGap(parseInt(e.target.value)),
                            className: "w-full appearance-none bg-transparent cursor-pointer [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:bg-white [&::-webkit-slider-runnable-track]:border [&::-webkit-slider-runnable-track]:border-black [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-black [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:-mt-1"
                        })
                    ),

                    // Corner Radius
                    el('div', { className: "flex flex-col gap-2 col-span-2 mt-2" },
                        el('div', { className: "flex items-center justify-between" },
                            el('span', { className: "text-[10px] font-black uppercase tracking-widest" }, "RADIUS"),
                            el('span', { className: "text-[10px] font-mono font-black" }, cornerRadius + '%')
                        ),
                        el('input', { 
                            type: "range", min: 0, max: 20, step: 1, value: cornerRadius,
                            onChange: e => setCornerRadius(parseInt(e.target.value)),
                            className: "w-full appearance-none bg-transparent cursor-pointer [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:bg-white [&::-webkit-slider-runnable-track]:border [&::-webkit-slider-runnable-track]:border-black [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-black [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:-mt-1"
                        })
                    ),

                    // Bg Color & Resolution
                    el('div', { className: "flex items-center justify-between col-span-2 mt-2" },
                        el('div', { className: "flex items-center gap-3" },
                            el('span', { className: "text-[10px] font-black uppercase tracking-widest" }, "BG"),
                            el('div', { className: "w-8 h-8 rounded-full border border-black/80 overflow-hidden relative cursor-pointer" },
                                el('input', { 
                                    type: "color", value: bgColor,
                                    onChange: e => setBgColor(e.target.value),
                                    className: "absolute -inset-2 w-[200%] h-[200%] cursor-pointer border-none p-0 outline-none"
                                })
                            )
                        ),
                        el('div', { className: "relative border border-black/80 rounded-full overflow-hidden bg-white hover:shadow-[2px_2px_0px_#000] transition-shadow" },
                            el('select', { 
                                value: cardBaseWidth, 
                                onChange: e => setCardBaseWidth(parseInt(e.target.value)),
                                className: "w-full appearance-none bg-transparent pl-4 pr-10 py-2 text-[11px] outline-none font-black text-black cursor-pointer"
                            }, 
                                el('option', { value: 600 }, "600PX"),
                                el('option', { value: 1200 }, "1200PX"),
                                el('option', { value: 1800 }, "1800PX")
                            ),
                            el('div', { className: "absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[10px]" }, "▼")
                        )
                    )
                )
            ),

            // Card Style
            el('div', { className: "p-4 py-6 flex flex-col gap-4 border-b border-black text-black" },
                el('h3', { className: "text-[10px] font-black uppercase tracking-widest" }, "3. HEADER & BADGES"),
                
                // Subtitle & Color inline
                el('div', { className: "flex items-center gap-3" },
                    el('div', { className: "w-10 h-10 rounded-full border border-black/80 overflow-hidden relative cursor-pointer shrink-0" },
                        el('input', { 
                            type: "color", value: logoColor,
                            onChange: e => setLogoColor(e.target.value),
                            className: "absolute -inset-2 w-[200%] h-[200%] cursor-pointer border-none p-0 outline-none"
                        })
                    ),
                    el('input', { 
                        type: "text", value: logoText,
                        onChange: e => setLogoText(e.target.value),
                        placeholder: "TAGLINE...",
                        className: "flex-1 w-full rounded-full border border-black/80 bg-white px-4 py-3 text-[11px] outline-none font-black text-black transition-shadow focus:shadow-[4px_4px_0px_#000] placeholder-black/30"
                    })
                ),

                // Custom Logo inline
                el('div', { className: "flex items-center gap-3 mt-2" },
                    el('button', {
                        onClick: () => logoInputRef.current && logoInputRef.current.click(),
                        className: "flex-1 rounded-full px-4 py-3 text-[11px] font-black uppercase tracking-widest outline-none flex items-center justify-center gap-2 border border-black/80 bg-white hover:bg-black hover:text-white transition-all active:scale-[0.98]"
                    }, 
                        logoDataUrl ? el('img', { src: logoDataUrl, className: "h-4 w-auto object-contain" }) : el(ImageIcon, { size: 14 }),
                        el('span', { className: "truncate" }, logoDataUrl ? "LOGO LOADED" : "UPLOAD LOGO")
                    ),
                    logoDataUrl && el('button', {
                        onClick: () => { setLogoDataUrl(''); localStorage.removeItem('yizi_cardlayout_logo'); },
                        className: "shrink-0 p-3 rounded-full text-[10px] font-black border border-black/80 bg-white hover:bg-[#ef4444] text-[#ef4444] hover:border-[#ef4444] hover:text-white transition-colors"
                    }, el(X, { size: 14 }))
                ),
                el('input', { type: "file", ref: logoInputRef, accept: ".svg,.png,.jpg,.jpeg", className: "hidden", onChange: (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                            setLogoDataUrl(ev.target.result);
                            try { localStorage.setItem('yizi_cardlayout_logo', ev.target.result); } catch(err) {}
                        };
                        reader.readAsDataURL(file);
                    }
                }}),

                el('label', { className: "flex items-center gap-3 cursor-pointer mt-4" },
                    el('input', { 
                        type: "checkbox", checked: showBadges,
                        onChange: e => setShowBadges(e.target.checked),
                        className: "accent-black w-4 h-4 cursor-pointer"
                    }),
                    el('span', { className: "text-[11px] font-black uppercase tracking-widest" }, "SHOW A/B/C BADGES")
                )
            ),

            // Preview Canvas Container
            images.length > 0 && el('div', { className: "p-4 py-6 flex flex-col gap-4 items-center text-black border-b border-black" },
                el('h3', { className: "text-[10px] font-black uppercase tracking-widest self-start" }, "LIVE PREVIEW"),
                el('div', { 
                    className: "w-full max-w-full rounded-2xl overflow-hidden relative flex items-center justify-center group border border-black/80 bg-white shadow-[4px_4px_0px_#000]"
                },
                    // Overlay draggable div
                    el('div', {
                        draggable: true,
                        onDragStart: (e) => {
                            e.dataTransfer.setData('yizi-cardlayout-drag', 'true');
                        },
                        className: "absolute inset-0 z-10 cursor-grab active:cursor-grabbing hover:bg-black/5 transition-colors"
                    }),
                    el('canvas', { ref: canvasRef, className: "max-w-full h-auto object-contain pointer-events-none transition-opacity duration-300" })
                )
            )
        ),

        // Footer actions
        el('div', { className: "px-4 py-6 shrink-0" },
            el('button', {
                onClick: handleExport,
                disabled: images.length === 0,
                className: `w-full py-4 rounded-full flex items-center justify-center gap-2 font-black uppercase tracking-widest text-sm border border-black/80 transition-all ${images.length > 0 ? 'bg-black text-white hover:bg-white hover:text-black hover:shadow-[4px_4px_0px_#000] active:scale-95' : 'bg-transparent text-black opacity-30 cursor-not-allowed'}`
            }, el(Download, { size: 16 }), "EXPORT HD")
        )
    );
};

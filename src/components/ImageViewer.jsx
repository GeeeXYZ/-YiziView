import React, { useEffect, useState, useRef, useCallback } from 'react'
import { Heart, Crop, Check, X as XIcon, Paintbrush, RotateCcw, RotateCw, Eraser, Minus, Plus, Eye, EyeOff, SlidersHorizontal, ArrowUpFromLine, GripHorizontal, Activity } from 'lucide-react';
import ToneCurve from './ToneCurve';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { SelectiveWebGLFilter } from '../utils/SelectiveWebGLFilter';

const rotateSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="black" stroke-width="4" d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path stroke="black" stroke-width="4" d="M21 3v5h-5"/><path stroke="white" stroke-width="2" d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path stroke="white" stroke-width="2" d="M21 3v5h-5"/></svg>';
const rotateCursorIcon = `url('data:image/svg+xml;charset=utf-8,${encodeURIComponent(rotateSvg)}') 12 12, auto`;

const BRUSH_COLORS = [
    '#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#007AFF',
    '#5856D6', '#AF52DE', '#FF2D55', '#FFFFFF', '#000000',
];

const ColorWheel = ({ label, value, onChange }) => {
    const wheelRef = useRef(null);

    const handlePointerMap = useCallback((e) => {
        if (!wheelRef.current) return;
        const rect = wheelRef.current.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const r = rect.width / 2;
        
        let dx = (e.clientX - cx) / r;
        let dy = (e.clientY - cy) / r;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist > 1) {
            dx /= dist;
            dy /= dist;
        }
        onChange({ x: dx, y: dy });
    }, [onChange]);

    const handlePointerDown = (e) => {
        e.preventDefault();
        wheelRef.current.setPointerCapture(e.pointerId);
        handlePointerMap(e);
    };

    const handlePointerMove = (e) => {
        if (e.buttons > 0) {
            handlePointerMap(e);
        }
    };

    return (
        <div className="flex flex-col items-center gap-1.5 flex-1">
            <span className="text-[10px] text-gray-400 font-medium">{label}</span>
            <div 
                ref={wheelRef}
                className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)] cursor-crosshair touch-none flex-shrink-0"
                style={{ 
                    background: 'conic-gradient(from 90deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
            >
                <div className="absolute inset-0 rounded-full" style={{ background: 'radial-gradient(circle closest-side, #222222 0%, transparent 100%)' }} />
                <div className="absolute top-1/2 left-0 w-full h-px bg-white/10 pointer-events-none" />
                <div className="absolute left-1/2 top-0 w-px h-full bg-white/10 pointer-events-none" />
                
                <div 
                    className="absolute w-3 h-3 border border-white rounded-full shadow-sm bg-black/20 pointer-events-none transform -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${50 + value.x * 50}%`, top: `${50 + value.y * 50}%` }}
                />
            </div>
        </div>
    );
};

const ImageViewer = ({ image, onClose, onNext, onPrev, onDelete, contained = false }) => {
    const [zoom, setZoom] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [isAutoPlay, setIsAutoPlay] = useState(false);
    const [isFav, setIsFav] = useState(false);
    const containerRef = useRef(null);
    const pointerDownTargetRef = useRef(null);

    // ===== Edit Mode =====
    const [showToolbar, setShowToolbar] = useState(() => {
        const s = localStorage.getItem('viewer_show_toolbar');
        return s === null ? true : s === 'true';
    });
    const [isEditing, setIsEditing] = useState(false); // Only true when brush/crop is actively selected
    const [editTool, setEditTool] = useState(null); // null | 'brush' | 'crop' | 'adjust'

    const isVideo = image?.path && /\.(mp4|webm|mov|mkv)$/i.test(image.path);

    // ===== Adjust State =====
    const [adjustBrightness, setAdjustBrightness] = useState(100);
    const [adjustContrast, setAdjustContrast] = useState(100);
    const [adjustSaturation, setAdjustSaturation] = useState(100);
    const [adjustHue, setAdjustHue] = useState(0);
    const [selectiveSat, setSelectiveSat] = useState({
        reds: 0, yellows: 0, greens: 0, cyans: 0, blues: 0, magentas: 0
    });
    const [gradingShadows, setGradingShadows] = useState({x: 0, y: 0});
    const [gradingMidtones, setGradingMidtones] = useState({x: 0, y: 0});
    const [gradingHighlights, setGradingHighlights] = useState({x: 0, y: 0});
    const [gradingIntensity, setGradingIntensity] = useState(() => localStorage.getItem('settings_grading_intensity') || '36');
    const [gradingPresets, setGradingPresets] = useState(() => JSON.parse(localStorage.getItem('settings_grading_presets') || '[null, null, null, null]'));
    const [justSavedPreset, setJustSavedPreset] = useState(null);
    const [renamingPreset, setRenamingPreset] = useState(null);
    const [renameValue, setRenameValue] = useState("");
    
    const [adjustCurve, setAdjustCurve] = useState([{x:0, y:0}, {x:255, y:255}]);
    const [showCurvePicker, setShowCurvePicker] = useState(false);
    
    const [previewObjectURL, setPreviewObjectURL] = useState(null);
    const webGLFilterRef = useRef(null);
    
    // Listen for setting changes
    useEffect(() => {
        const handleSettingsUpdate = () => {
            setGradingIntensity(localStorage.getItem('settings_grading_intensity') || '36');
        };
        window.addEventListener('settings-updated', handleSettingsUpdate);
        return () => window.removeEventListener('settings-updated', handleSettingsUpdate);
    }, []);

    // ===== Brush State =====
    const [brushColor, setBrushColor] = useState(() => localStorage.getItem('viewer_brush_color') || '#FF3B30');
    const [brushSize, setBrushSize] = useState(() => parseInt(localStorage.getItem('viewer_brush_size') || '4'));
    const [isEraser, setIsEraser] = useState(false);
    const [isDrawing, setIsDrawing] = useState(false);
    const drawCanvasRef = useRef(null);
    const drawHistoryRef = useRef([]); // undo stack
    const lastPointRef = useRef(null);

    // ===== Cropping State =====
    const [crop, setCrop] = useState();
    const [completedCrop, setCompletedCrop] = useState(null);
    const [aspect, setAspect] = useState(undefined);
    const [isSaving, setIsSaving] = useState(false);
    const [targetW, setTargetW] = useState('');
    const [targetH, setTargetH] = useState('');
    const [forceImageUrl, setForceImageUrl] = useState(null);
    const [rotation, setRotation] = useState(0);
    const [cropBgColor, setCropBgColor] = useState('#FAFAFA');
    const imgRef = useRef(null);
    const [isArbitraryRotating, setIsArbitraryRotating] = useState(false);
    const [hoverCursor, setHoverCursor] = useState('default');
    const rotationDragStartRef = useRef({ angle: 0, initialRotation: 0 });
    const percentCropRef = useRef(null);
    const baseImageRef = useRef(null);
    const saveEditRef = useRef(null);

    const dragStartRef = useRef({ x: 0, y: 0 });
    const onNextRef = useRef(onNext);

    // ===== Action Bar Drag State =====
    const [toolbarPos, setToolbarPos] = useState(() => {
        try { return JSON.parse(localStorage.getItem('viewer_toolbar_pos') || 'null') || { x: 0, y: 0 }; }
        catch { return { x: 0, y: 0 }; }
    });
    const toolbarDragStartRef = useRef(null);

    const handleToolbarPointerDown = (e) => {
        if (e.target.closest('button') || e.target.closest('input')) return;
        
        toolbarDragStartRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            initialX: toolbarPos.x,
            initialY: toolbarPos.y
        };
        window.addEventListener('pointermove', handleToolbarPointerMove);
        window.addEventListener('pointerup', handleToolbarPointerUp);
    };

    const handleToolbarPointerMove = (e) => {
        if (!toolbarDragStartRef.current) return;
        const dx = e.clientX - toolbarDragStartRef.current.startX;
        const dy = e.clientY - toolbarDragStartRef.current.startY;
        setToolbarPos({
            x: toolbarDragStartRef.current.initialX + dx,
            y: toolbarDragStartRef.current.initialY + dy
        });
    };

    const handleToolbarPointerUp = () => {
        toolbarDragStartRef.current = null;
        window.removeEventListener('pointermove', handleToolbarPointerMove);
        window.removeEventListener('pointerup', handleToolbarPointerUp);
    };

    useEffect(() => {
        return () => {
            window.removeEventListener('pointermove', handleToolbarPointerMove);
            window.removeEventListener('pointerup', handleToolbarPointerUp);
        };
    }, []);

    // ===== Native Fullscreen Lock =====
    const isEditingRef = useRef(isEditing);
    useEffect(() => { isEditingRef.current = isEditing; }, [isEditing]);
    
    const onCloseRef = useRef(onClose);
    useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
    
    useEffect(() => {
        if (!contained) {
            const enterFullscreen = async () => {
                try {
                    if (!document.fullscreenElement) {
                        await document.documentElement.requestFullscreen();
                    }
                    if (navigator.keyboard && navigator.keyboard.lock) {
                        // Prevent Escape from natively exiting fullscreen globally so JS can handle the unmount atomically
                        navigator.keyboard.lock(['Escape']).catch(e => console.warn('Keyboard lock failed:', e));
                    }
                } catch(e) {
                    if (e && e.message && !e.message.includes('Permissions check failed')) {
                        console.error('Fullscreen request failed', e);
                    }
                }
            };
            enterFullscreen();

            const handleFullscreenChange = () => {
                if (!document.fullscreenElement) {
                    // Browser native exit fullscreen (e.g. F11). 
                    if (!isEditingRef.current) {
                        onCloseRef.current();
                    }
                } else {
                    if (navigator.keyboard && navigator.keyboard.lock) {
                        navigator.keyboard.lock(['Escape']).catch(e => console.warn('Keyboard lock failed:', e));
                    }
                }
            };
            document.addEventListener('fullscreenchange', handleFullscreenChange);

            return () => {
                document.removeEventListener('fullscreenchange', handleFullscreenChange);
                if (navigator.keyboard && navigator.keyboard.unlock) {
                    navigator.keyboard.unlock();
                }
                if (document.fullscreenElement) {
                    document.exitFullscreen().catch(e => {});
                }
            };
        }
    }, [contained]);

    // ===== Persist viewer preferences =====
    useEffect(() => { localStorage.setItem('viewer_show_toolbar', showToolbar); }, [showToolbar]);
    useEffect(() => { localStorage.setItem('viewer_brush_color', brushColor); }, [brushColor]);
    useEffect(() => { localStorage.setItem('viewer_brush_size', brushSize); }, [brushSize]);
    useEffect(() => { localStorage.setItem('viewer_toolbar_pos', JSON.stringify(toolbarPos)); }, [toolbarPos]);

    const getActiveUrl = () => {
        if (forceImageUrl) return forceImageUrl;
        if (!image) return '';
        if (window.imageTimestamps && window.imageTimestamps[image.path]) {
            const base = image.url.split('?')[0];
            return `${base}?t=${window.imageTimestamps[image.path]}`;
        }
        return image.url;
    };

    // ===== Resolution Info =====
    const [resolution, setResolution] = useState(null);
    useEffect(() => {
        if (image) {
            setResolution(null);
            const imgUrl = getActiveUrl();
            if (imgUrl && !isVideo) {
                const img = new Image();
                img.onload = () => setResolution(`${img.naturalWidth} × ${img.naturalHeight}`);
                img.src = imgUrl;
            }
        }
    }, [image, forceImageUrl, isVideo]);

    // ===== Favorites =====
    useEffect(() => {
        if (image) {
            const favs = JSON.parse(localStorage.getItem('yizi_fav_images') || '[]');
            setIsFav(favs.includes(image.path));
        }
    }, [image]);

    useEffect(() => {
        const handleFavUpdate = () => {
            if (image) {
                const favs = JSON.parse(localStorage.getItem('yizi_fav_images') || '[]');
                setIsFav(favs.includes(image.path));
            }
        };
        window.addEventListener('fav-images-updated', handleFavUpdate);
        return () => window.removeEventListener('fav-images-updated', handleFavUpdate);
    }, [image]);

    const toggleFavorite = (e) => {
        e.stopPropagation();
        if (!image) return;
        const favs = JSON.parse(localStorage.getItem('yizi_fav_images') || '[]');
        const currentlyFav = favs.includes(image.path);
        let newFavs;
        if (currentlyFav) {
            newFavs = favs.filter(p => p !== image.path);
        } else {
            newFavs = [...favs, image.path];
        }
        localStorage.setItem('yizi_fav_images', JSON.stringify(newFavs));
        setIsFav(!currentlyFav);
        window.dispatchEvent(new Event('fav-images-updated'));
    };

    // ===== AutoPlay =====
    useEffect(() => { onNextRef.current = onNext; }, [onNext]);
    useEffect(() => {
        let interval;
        if (isAutoPlay) {
            setShowToolbar(false);
            interval = setInterval(() => {
                if (onNextRef.current) onNextRef.current();
            }, 3000);
        }
        return () => clearInterval(interval);
    }, [isAutoPlay]);

    // ===== Keyboard =====
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (isSaving) return;
            
            // Don't intercept keys when typing in an input/textarea
            const isTextInput = e.target.tagName === 'TEXTAREA' || 
                               (e.target.tagName === 'INPUT' && !['color', 'range', 'checkbox', 'button'].includes(e.target.type));
            
            if (isTextInput && e.key !== 'Escape') return;

            // Space → toggle autoplay (only when not editing)
            if (e.key === ' ' || e.code === 'Space') {
                if (!isEditing) {
                    e.preventDefault();
                    setIsAutoPlay(prev => !prev);
                }
                return;
            }

            if (e.key === 'Escape') {
                if (isEditing) {
                    e.preventDefault();
                    cancelEdit();
                } else {
                    onClose();
                }
                return;
            }

            // Navigation (only outside edit mode)
            if (!isEditing) {
                if (e.key === 'ArrowRight') { onNext(); return; }
                if (e.key === 'ArrowLeft') { onPrev(); return; }
                if (e.key === 'Delete' || e.key === 'Backspace') {
                    if (onDelete) onDelete();
                    return;
                }
                // F → toggle favourite
                if (e.key.toLowerCase() === 'f') {
                    e.preventDefault();
                    toggleFavorite(e);
                    return;
                }
                // T → toggle toolbar visibility
                if (e.key.toLowerCase() === 't') {
                    e.preventDefault();
                    setShowToolbar(prev => {
                        if (!prev) setToolbarPos({ x: 0, y: 0 });
                        return !prev;
                    });
                    return;
                }
            }

            // Edit tool shortcuts (when toolbar is shown)
            if (showToolbar) {
                if (e.key.toLowerCase() === 'c') { e.preventDefault(); switchTool('crop'); return; }
                if (e.key.toLowerCase() === 'b') { e.preventDefault(); switchTool('brush'); return; }
                if (e.key.toLowerCase() === 'a') { e.preventDefault(); switchTool('adjust'); return; }
            }

            // [ / ] → brush size (only in brush mode)
            if (isEditing && editTool === 'brush') {
                if (e.key === '[') { e.preventDefault(); setBrushSize(prev => Math.max(1, prev - 1)); return; }
                if (e.key === ']') { e.preventDefault(); setBrushSize(prev => Math.min(50, prev + 1)); return; }
            }

            // Undo for brush: Ctrl+Z
            if (isEditing && editTool === 'brush' && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                undoBrush();
                return;
            }

            // Enter to save edit
            if (isEditing && e.key === 'Enter') {
                e.preventDefault();
                const overwrite = localStorage.getItem('settings_crop_overwrite') === 'true';
                if (saveEditRef.current) {
                    saveEditRef.current(e, overwrite);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose, onNext, onPrev, onDelete, isEditing, editTool, isSaving, showToolbar, brushSize]);


    // ===== Reset on image change =====
    useEffect(() => {
        setZoom(1);
        setPosition({ x: 0, y: 0 });
        setEditTool(null);
        setIsEditing(false);
        setRotation(0);
        setCropBgColor('#FAFAFA');

        setAdjustBrightness(100);
        setAdjustContrast(100);
        setAdjustSaturation(100);
        setAdjustHue(0);
        setSelectiveSat({ reds: 0, yellows: 0, greens: 0, cyans: 0, blues: 0, magentas: 0 });
        setGradingShadows({x: 0, y: 0});
        setGradingMidtones({x: 0, y: 0});
        setGradingHighlights({x: 0, y: 0});
        setPreviewObjectURL(null);

        const savedAspect = localStorage.getItem('last_crop_aspect');
        const savedTargetW = localStorage.getItem('last_crop_target_w') || '';
        const savedTargetH = localStorage.getItem('last_crop_target_h') || '';
        setAspect(savedAspect ? parseFloat(savedAspect) : undefined);
        setTargetW(savedTargetW);
        setTargetH(savedTargetH);

        const initialCrop = { unit: '%', width: 100, height: 100, x: 0, y: 0 };
        setCrop(initialCrop);
        setCompletedCrop(null);
        percentCropRef.current = initialCrop;

        setForceImageUrl(null);
        drawHistoryRef.current = [];
    }, [image]);

    // ===== Unified Base Canvas Loader =====
    useEffect(() => {
        if (!isEditing) return;

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            baseImageRef.current = img;
            // Use rAF to ensure the new canvas DOM is committed after tool switch
            requestAnimationFrame(() => {
                drawRotatedCanvas();
                if (editTool === 'brush') {
                    setTimeout(setupDrawCanvas, 50);
                }
            });
        };
        img.onerror = () => console.error('Failed to load image for rotation');
        img.src = previewObjectURL || getActiveUrl();
    }, [isEditing, image, forceImageUrl, previewObjectURL, editTool]);

    // ===== Crop Box Initialization =====
    // Padding ratio for outpaint cropping: 0.5 = 50% of image size on each side
    const CROP_PAD = 0.5;
    // The padded canvas percentage for the image area:
    // padFrac = CROP_PAD / (1 + 2*CROP_PAD). For CROP_PAD=0.5: padFrac=0.25
    // So image area = x:25%, y:25%, w:50%, h:50% of the canvas.
    const PAD_FRAC = CROP_PAD / (1 + 2 * CROP_PAD);
    const IMG_PERCENT = (1 - 2 * PAD_FRAC) * 100; // 50% for CROP_PAD=0.5
    const IMG_OFFSET = PAD_FRAC * 100;              // 25% for CROP_PAD=0.5

    useEffect(() => {
        if (!isEditing || editTool !== 'crop') return;
        
        const initTimer = setTimeout(() => {
            if (!imgRef.current) return;
            const pCrop = percentCropRef.current;
            const needsInit = !pCrop || pCrop.width === 0 || (pCrop.width === 100 && pCrop.height === 100 && pCrop.x === 0 && pCrop.y === 0);
            
            if (needsInit) {
                let newPercentCrop;
                if (aspect) {
                    // For aspect ratio presets, compute within the image area
                    // The image area in percent: x=IMG_OFFSET, y=IMG_OFFSET, w=IMG_PERCENT, h=IMG_PERCENT
                    // But the canvas aspect ratio is same as image (padding is proportional),
                    // so we can use the canvas pixel dims directly.
                    const canvasW = imgRef.current.width;
                    const canvasH = imgRef.current.height;
                    const imgW = canvasW * (1 - 2 * PAD_FRAC);
                    const imgH = canvasH * (1 - 2 * PAD_FRAC);
                    let cropW = imgW * 0.9;
                    if (cropW / aspect > imgH) cropW = imgH * aspect;
                    const cropH = cropW / aspect;
                    // Center in canvas
                    const cropX = (canvasW - cropW) / 2;
                    const cropY = (canvasH - cropH) / 2;
                    newPercentCrop = {
                        unit: '%',
                        x: (cropX / canvasW) * 100,
                        y: (cropY / canvasH) * 100,
                        width: (cropW / canvasW) * 100,
                        height: (cropH / canvasH) * 100
                    };
                } else {
                    // Free mode: cover the image area exactly
                    newPercentCrop = {
                        unit: '%',
                        x: IMG_OFFSET,
                        y: IMG_OFFSET,
                        width: IMG_PERCENT,
                        height: IMG_PERCENT
                    };
                }
                setCrop(newPercentCrop);
                setCompletedCrop(null);
                percentCropRef.current = newPercentCrop;
            }
        }, 150);
        return () => clearTimeout(initTimer);
    }, [isEditing, editTool, aspect]);


    const drawRotatedCanvas = () => {
        if (!baseImageRef.current || !imgRef.current) return;
        const img = baseImageRef.current;
        const canvas = imgRef.current;
        if (typeof canvas.getContext !== 'function') return;
        const ctx = canvas.getContext('2d');

        const r = ((rotation % 360) + 360) % 360;
        const rad = (r * Math.PI) / 180;

        let cw = img.width, ch = img.height;
        if (r !== 0) {
            const absCos = Math.abs(Math.cos(rad));
            const absSin = Math.abs(Math.sin(rad));
            cw = Math.round(img.width * absCos + img.height * absSin);
            ch = Math.round(img.width * absSin + img.height * absCos);
        }

        // In crop mode, add padding around the image for outpainting
        const isCropMode = editTool === 'crop';
        const padX = isCropMode ? Math.round(cw * CROP_PAD) : 0;
        const padY = isCropMode ? Math.round(ch * CROP_PAD) : 0;
        const totalW = cw + padX * 2;
        const totalH = ch + padY * 2;

        canvas.width = totalW;
        canvas.height = totalH;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Fill padding area with checkerboard pattern to indicate outpaint zone
        if (isCropMode) {
            // Draw bg color base
            ctx.fillStyle = cropBgColor;
            ctx.fillRect(0, 0, totalW, totalH);

            // Draw subtle checkerboard in padding area only
            const gridSize = 12;
            ctx.fillStyle = 'rgba(128,128,128,0.08)';
            for (let gy = 0; gy < totalH; gy += gridSize) {
                for (let gx = 0; gx < totalW; gx += gridSize) {
                    // Skip the image area
                    if (gx >= padX && gx < padX + cw && gy >= padY && gy < padY + ch) continue;
                    if ((Math.floor(gx / gridSize) + Math.floor(gy / gridSize)) % 2 === 0) {
                        ctx.fillRect(gx, gy, gridSize, gridSize);
                    }
                }
            }
        }
        
        const hasAdjustments = adjustBrightness !== 100 || adjustContrast !== 100 || adjustSaturation !== 100 || adjustHue !== 0;
        if (hasAdjustments) {
            ctx.filter = `brightness(${adjustBrightness}%) contrast(${adjustContrast}%) saturate(${adjustSaturation}%) hue-rotate(${adjustHue}deg)`;
        }

        ctx.translate(padX + cw / 2, padY + ch / 2);
        ctx.rotate(rad);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
    };

    useEffect(() => { drawRotatedCanvas(); }, [rotation, adjustBrightness, adjustContrast, adjustSaturation, adjustHue, previewObjectURL, editTool, cropBgColor]);

    // ===== Selective Saturation Preview Generate =====
    const updateSelectivePreview = useCallback(() => {
        const hasSelective = Object.values(selectiveSat).some(v => v !== 0);
        const hasGrading = gradingShadows.x !== 0 || gradingShadows.y !== 0 || gradingMidtones.x !== 0 || gradingMidtones.y !== 0 || gradingHighlights.x !== 0 || gradingHighlights.y !== 0;
        const hasAdjustments = adjustBrightness !== 100 || adjustContrast !== 100 || adjustSaturation !== 100 || adjustHue !== 0;
        const hasCurve = adjustCurve.length !== 2 || adjustCurve[0].y !== 0 || adjustCurve[1].y !== 255 || adjustCurve[0].x !== 0 || adjustCurve[1].x !== 255;
        
        if (!hasSelective && !hasGrading && !hasAdjustments && !hasCurve) {
            setPreviewObjectURL(null);
            return;
        }
        
        if (!webGLFilterRef.current) {
            try {
                webGLFilterRef.current = new SelectiveWebGLFilter(4096, 4096);
            } catch (e) {
                console.error("WebGL Filter Error:", e);
                return;
            }
        }

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const options = {
                brightness: adjustBrightness,
                contrast: adjustContrast,
                saturation: adjustSaturation,
                hue: adjustHue,
                selectiveSat,
                gradingShadows,
                gradingMidtones,
                gradingHighlights,
                gradingIntensity,
                adjustCurve
            };
            const canvas = webGLFilterRef.current.render(img, options);
            if (!canvas) return;
            
            canvas.toBlob(blob => {
                const url = URL.createObjectURL(blob);
                setPreviewObjectURL(prev => {
                    if (prev) URL.revokeObjectURL(prev);
                    return url;
                });
            }, 'image/webp', 0.90);
        };
        img.src = getActiveUrl();
    }, [selectiveSat, gradingShadows, gradingMidtones, gradingHighlights, gradingIntensity, adjustBrightness, adjustContrast, adjustSaturation, adjustHue, adjustCurve, image]);

    useEffect(() => {
        const t = setTimeout(() => {
             updateSelectivePreview();
        }, 30);
        return () => clearTimeout(t);
    }, [selectiveSat, gradingShadows, gradingMidtones, gradingHighlights, gradingIntensity, adjustBrightness, adjustContrast, adjustSaturation, adjustHue, updateSelectivePreview]);

    useEffect(() => {
        return () => {
           if (previewObjectURL) URL.revokeObjectURL(previewObjectURL);
        }
    }, [previewObjectURL]);

    // ===== Drawing Canvas Setup =====
    const setupDrawCanvas = useCallback(() => {
        const canvas = drawCanvasRef.current;
        if (!canvas) return;
        const parent = canvas.parentElement;
        if (!parent) return;
        const imgEl = parent.querySelector('img') || parent.querySelector('canvas:not([style*="pointer-events: auto"])');
        if (!imgEl) return;

        let naturalWidth, naturalHeight;
        if (imgEl.tagName === 'IMG') {
            naturalWidth = imgEl.naturalWidth;
            naturalHeight = imgEl.naturalHeight;
        } else if (imgEl.tagName === 'CANVAS') {
            naturalWidth = imgEl.width;
            naturalHeight = imgEl.height;
        }

        // Use client width/height instead of getBoundingClientRect() to ignore CSS transform scale
        const renderWidth = imgEl.clientWidth;
        const renderHeight = imgEl.clientHeight;
        
        if (renderWidth === 0 || renderHeight === 0 || !naturalWidth) return;

        const naturalRatio = naturalWidth / naturalHeight;
        const renderRatio = renderWidth / renderHeight;

        let actualWidth, actualHeight;
        if (naturalRatio > renderRatio) {
            actualWidth = renderWidth;
            actualHeight = renderWidth / naturalRatio;
        } else {
            actualHeight = renderHeight;
            actualWidth = renderHeight * naturalRatio;
        }

        const newCanvasW = Math.round(actualWidth);
        const newCanvasH = Math.round(actualHeight);

        // Only setup if dimensions actually changed
        if (canvas.width !== newCanvasW || canvas.height !== newCanvasH) {
            canvas.width = newCanvasW;
            canvas.height = newCanvasH;
            canvas.style.width = newCanvasW + 'px';
            canvas.style.height = newCanvasH + 'px';

            canvas.style.position = 'absolute';
            canvas.style.left = '50%';
            canvas.style.top = '50%';
            canvas.style.transform = 'translate(-50%, -50%)';

            // Restore history
            restoreDrawHistory();
        }
    }, []);

    useEffect(() => {
        if (isEditing && editTool === 'brush') {
            // Small delay to ensure the image is rendered
            const timer = setTimeout(setupDrawCanvas, 100);
            window.addEventListener('resize', setupDrawCanvas);
            return () => {
                clearTimeout(timer);
                window.removeEventListener('resize', setupDrawCanvas);
            };
        }
    }, [isEditing, editTool, setupDrawCanvas]); // Removed zoom dependency

    // Restore drawing from history
    const restoreDrawHistory = () => {
        const canvas = drawCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (const imageData of drawHistoryRef.current) {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = imageData.width;
            tempCanvas.height = imageData.height;
            tempCanvas.getContext('2d').putImageData(imageData, 0, 0);
            ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);
        }
    };

    // Save current canvas state for undo
    const saveDrawState = () => {
        const canvas = drawCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        drawHistoryRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    };

    const undoBrush = () => {
        if (drawHistoryRef.current.length <= 0) return;
        drawHistoryRef.current.pop();
        const canvas = drawCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (drawHistoryRef.current.length > 0) {
            const lastState = drawHistoryRef.current[drawHistoryRef.current.length - 1];
            ctx.putImageData(lastState, 0, 0);
        }
    };

    // ===== Drawing Handlers =====
    const getDrawPos = (e) => {
        const canvas = drawCanvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        // Map screen physical coordinates to canvas intrinsic resolution
        return {
            x: ((e.clientX - rect.left) / rect.width) * canvas.width,
            y: ((e.clientY - rect.top) / rect.height) * canvas.height
        };
    };

    const handleDrawStart = (e) => {
        if (editTool !== 'brush') return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        saveDrawState();
        setIsDrawing(true);
        const pos = getDrawPos(e);
        lastPointRef.current = pos;

        const canvas = drawCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        // Draw a dot at the start position
        ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
        ctx.fillStyle = isEraser ? 'rgba(0,0,0,1)' : brushColor;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, brushSize / 2, 0, Math.PI * 2);
        ctx.fill();
    };

    const handleDrawMove = (e) => {
        if (!isDrawing || editTool !== 'brush') return;
        e.preventDefault();

        const canvas = drawCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const pos = getDrawPos(e);

        ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
        ctx.strokeStyle = isEraser ? 'rgba(0,0,0,1)' : brushColor;
        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();

        lastPointRef.current = pos;
    };

    const handleDrawEnd = () => {
        setIsDrawing(false);
        lastPointRef.current = null;
    };

    useEffect(() => {
        if (isDrawing) {
            window.addEventListener('pointermove', handleDrawMove);
            window.addEventListener('pointerup', handleDrawEnd);
        }
        return () => {
            window.removeEventListener('pointermove', handleDrawMove);
            window.removeEventListener('pointerup', handleDrawEnd);
        };
    }, [isDrawing, brushColor, brushSize, isEraser]);

    // ===== Zoom Handler =====
    useEffect(() => {
        const handleWheel = (e) => {
            if (!containerRef.current || !containerRef.current.contains(e.target)) return;
            e.preventDefault();
            const delta = e.deltaY * -0.001;
            setZoom(prev => Math.max(0.1, Math.min(10, prev + delta * 2)));
        };
        window.addEventListener('wheel', handleWheel, { passive: false });
        return () => window.removeEventListener('wheel', handleWheel);
    }, [isEditing, editTool]);

    // ===== Drag Handlers (non-edit mode) =====
    const handleMouseDown = (e) => {
        if (isEditing && (editTool === 'brush' || editTool === 'crop') && e.button !== 1) return; // Middle click to pan in brush/crop mode
        if ((!isEditing || editTool === 'adjust') && e.button !== 0 && e.button !== 1) return;
        
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
        dragStartRef.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    };

    const handleMouseMove = (e) => {
        if (!isDragging) return;
        e.preventDefault();
        setPosition({ x: e.clientX - dragStartRef.current.x, y: e.clientY - dragStartRef.current.y });
    };

    const handleMouseUp = () => { setIsDragging(false); };

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    // ===== Edit Mode Actions =====
    const toggleToolbar = (e) => {
        e.stopPropagation();
        if (showToolbar) {
            setShowToolbar(false);
            setIsEditing(false);
            setEditTool(null);
            
            // Revert adjust tools on close 
            setAdjustBrightness(100); setAdjustContrast(100); setAdjustSaturation(100); setAdjustHue(0);
            setSelectiveSat({ reds: 0, yellows: 0, greens: 0, cyans: 0, blues: 0, magentas: 0 });
            setGradingShadows({x: 0, y: 0}); setGradingMidtones({x: 0, y: 0}); setGradingHighlights({x: 0, y: 0});
            setPreviewObjectURL(null);
        } else {
            setIsAutoPlay(false);
            setShowToolbar(true);
            setZoom(1);
            setPosition({ x: 0, y: 0 });
            setRotation(0);
            setToolbarPos({ x: 0, y: 0 });
        }
    };

    const cancelEdit = (e) => {
        if (e) e.stopPropagation();
        setIsEditing(false);
        setEditTool(null);
        setRotation(0);
        drawHistoryRef.current = [];
        
        // Restore values
        setAdjustBrightness(100); setAdjustContrast(100); setAdjustSaturation(100); setAdjustHue(0);
        setSelectiveSat({ reds: 0, yellows: 0, greens: 0, cyans: 0, blues: 0, magentas: 0 });
        setGradingShadows({x: 0, y: 0}); setGradingMidtones({x: 0, y: 0}); setGradingHighlights({x: 0, y: 0});
        setPreviewObjectURL(null);
    };

    const switchTool = (tool) => {
        setIsEditing(true);
        setEditTool(tool);
        if (tool === 'crop') {
            // We defer initialization of crop sizes to the Rotation Canvas useEffect 
            // since we need the ReactCrop wrapper to be fully mounted in the DOM.
        }
    };

    // ===== Crop Aspect Handlers =====
    const handleAspectChange = (newAspect) => {
        setAspect(newAspect);
        if (newAspect) {
            localStorage.setItem('last_crop_aspect', newAspect.toString());
        } else {
            localStorage.removeItem('last_crop_aspect');
        }

        if (newAspect) {
            const w = parseInt(targetW);
            const h = parseInt(targetH);
            if (!isNaN(w) && w > 0) {
                setTargetH(Math.round(w / newAspect).toString());
            } else if (!isNaN(h) && h > 0) {
                setTargetW(Math.round(h * newAspect).toString());
            }
        } else {
            // User switched to Free mode. Clearing any previously set rigid export dimensions
            // so they do not artificially stretch the free-drawn box on export.
            setTargetW('');
            setTargetH('');
            localStorage.removeItem('last_crop_target_w');
            localStorage.removeItem('last_crop_target_h');
        }

        if (imgRef.current && editTool === 'crop') {
            if (newAspect) {
                const canvasW = imgRef.current.width;
                const canvasH = imgRef.current.height;
                const imgW = canvasW * (1 - 2 * PAD_FRAC);
                const imgH = canvasH * (1 - 2 * PAD_FRAC);
                let cropW = imgW * 0.9;
                if (cropW / newAspect > imgH) cropW = imgH * newAspect;
                const cropH = cropW / newAspect;
                const cropX = (canvasW - cropW) / 2;
                const cropY = (canvasH - cropH) / 2;
                const newPercentCrop = {
                    unit: '%',
                    x: (cropX / canvasW) * 100,
                    y: (cropY / canvasH) * 100,
                    width: (cropW / canvasW) * 100,
                    height: (cropH / canvasH) * 100
                };
                setCrop(newPercentCrop);
                setCompletedCrop(null);
                percentCropRef.current = newPercentCrop;
            }
        }
    };

    // Compute the effective aspect ratio: named preset takes priority,
    // otherwise if both W and H are filled in Free mode, derive from them.
    const freeW = parseInt(targetW);
    const freeH = parseInt(targetH);
    const effectiveAspect = aspect ? aspect
        : (!isNaN(freeW) && freeW > 0 && !isNaN(freeH) && freeH > 0) ? freeW / freeH
        : undefined;

    const applyFreeCropRatio = (w, h) => {
        // In Free mode with both dimensions set, reshape the crop box to match w:h ratio
        if (aspect || !imgRef.current) return;
        if (!w || !h || w <= 0 || h <= 0) return;
        const ratio = w / h;
        const canvasW = imgRef.current.width;
        const canvasH = imgRef.current.height;
        const imgW = canvasW * (1 - 2 * PAD_FRAC);
        const imgH = canvasH * (1 - 2 * PAD_FRAC);
        let cropW = imgW * 0.9;
        if (cropW / ratio > imgH) cropW = imgH * ratio;
        const cropH = cropW / ratio;
        const cropX = (canvasW - cropW) / 2;
        const cropY = (canvasH - cropH) / 2;
        const newPercentCrop = {
            unit: '%',
            x: (cropX / canvasW) * 100,
            y: (cropY / canvasH) * 100,
            width: (cropW / canvasW) * 100,
            height: (cropH / canvasH) * 100
        };
        setCrop(newPercentCrop);
        setCompletedCrop(null);
        percentCropRef.current = newPercentCrop;
    };

    const clearTargetDimensions = () => {
        setTargetW('');
        setTargetH('');
        localStorage.removeItem('last_crop_target_w');
        localStorage.removeItem('last_crop_target_h');
    };

    const handleTargetWChange = (e) => {
        const val = e.target.value;
        setTargetW(val);
        localStorage.setItem('last_crop_target_w', val);
        const w = parseInt(val);
        if (!isNaN(w) && w > 0) {
            if (aspect) {
                const newH = Math.round(w / aspect).toString();
                setTargetH(newH);
                localStorage.setItem('last_crop_target_h', newH);
            } else {
                // Free mode: reshape crop box if H is also filled in
                const h = parseInt(targetH);
                applyFreeCropRatio(w, h);
            }
        } else if (val === '') {
            localStorage.removeItem('last_crop_target_w');
        }
    };

    const handleTargetHChange = (e) => {
        const val = e.target.value;
        setTargetH(val);
        localStorage.setItem('last_crop_target_h', val);
        const h = parseInt(val);
        if (!isNaN(h) && h > 0) {
            if (aspect) {
                const newW = Math.round(h * aspect).toString();
                setTargetW(newW);
                localStorage.setItem('last_crop_target_w', newW);
            } else {
                // Free mode: reshape crop box if W is also filled in
                const w = parseInt(targetW);
                applyFreeCropRatio(w, h);
            }
        } else if (val === '') {
            localStorage.removeItem('last_crop_target_h');
        }
    };

    // ===== Save Edit =====
    useEffect(() => {
        saveEditRef.current = saveEdit;
    });

    const saveEdit = async (e, overwrite = false) => {
        if (e) e.stopPropagation();
        if (!image) return;

        setIsSaving(true);
        try {
            const hasDrawing = drawHistoryRef.current.length > 0;
            const hasCropParams = percentCropRef.current && (percentCropRef.current.width < 100 || percentCropRef.current.height < 100 || percentCropRef.current.x > 0 || percentCropRef.current.y > 0);
            const hasCropOrRotation = editTool === 'crop' && (rotation !== 0 || hasCropParams);
            const hasAdjustments = adjustBrightness !== 100 || adjustContrast !== 100 || adjustSaturation !== 100 || adjustHue !== 0;
            const hasSelective = Object.values(selectiveSat).some(v => v !== 0);
            const hasGrading = gradingShadows.x !== 0 || gradingShadows.y !== 0 || gradingMidtones.x !== 0 || gradingMidtones.y !== 0 || gradingHighlights.x !== 0 || gradingHighlights.y !== 0;
            const hasCurve = adjustCurve.length !== 2 || adjustCurve[0].y !== 0 || adjustCurve[1].y !== 255 || adjustCurve[0].x !== 0 || adjustCurve[1].x !== 255;

            if (!hasDrawing && !hasCropOrRotation && !hasAdjustments && !hasSelective && !hasGrading && !hasCurve) {
                cancelEdit(e);
                setIsSaving(false);
                return;
            }

            const renderBaseAndAdjustments = (canvasCtx, srcImg) => {
                if (hasSelective || hasAdjustments || hasGrading || hasCurve) {
                    if (!webGLFilterRef.current) webGLFilterRef.current = new SelectiveWebGLFilter(8192, 8192);
                    
                    const options = {
                        brightness: adjustBrightness,
                        contrast: adjustContrast,
                        saturation: adjustSaturation,
                        hue: adjustHue,
                        selectiveSat,
                        gradingShadows,
                        gradingMidtones,
                        gradingHighlights,
                        gradingIntensity,
                        adjustCurve
                    };
                    const outCanvas = webGLFilterRef.current.render(srcImg, options);
                    
                    if (outCanvas) {
                        canvasCtx.drawImage(outCanvas, 0, 0, srcImg.naturalWidth, srcImg.naturalHeight);
                    } else {
                        canvasCtx.drawImage(srcImg, 0, 0); // fallback if webgl fails
                    }
                } else {
                    canvasCtx.drawImage(srcImg, 0, 0);
                }
            };

            if ((hasDrawing || hasAdjustments || hasSelective || hasGrading || hasCurve) && !hasCropOrRotation) {
                // Drawing or adjustments only: composite onto full-res image client-side
                const fullImg = new Image();
                fullImg.crossOrigin = 'anonymous';
                await new Promise((resolve, reject) => {
                    fullImg.onload = resolve;
                    fullImg.onerror = reject;
                    fullImg.src = getActiveUrl();
                });

                const mergeCanvas = document.createElement('canvas');
                mergeCanvas.width = fullImg.naturalWidth;
                mergeCanvas.height = fullImg.naturalHeight;
                const ctx = mergeCanvas.getContext('2d');
                
                renderBaseAndAdjustments(ctx, fullImg);

                // Scale the drawing to full resolution
                if (hasDrawing) {
                    const drawCanvas = drawCanvasRef.current;
                    if (drawCanvas && drawCanvas.width > 0) {
                        ctx.drawImage(drawCanvas, 0, 0, mergeCanvas.width, mergeCanvas.height);
                    }
                }

                const dataUrl = mergeCanvas.toDataURL('image/png');
                const result = await window.electron.saveEditedImage(image.path, dataUrl, overwrite);

                if (result.success) {
                    if (overwrite) {
                        setForceImageUrl(`media://local/${encodeURIComponent(image.path)}?t=${result.timestamp || Date.now()}`);
                        window.dispatchEvent(new CustomEvent('image-updated', {
                            detail: { path: image.path, timestamp: result.timestamp || Date.now() }
                        }));
                    }
                    cancelEdit(e);
                } else {
                    alert('Save Failed: ' + result.error);
                }
            } else if (hasCropOrRotation) {
                // Calculate cx, cy, cw, ch mapped to the image's intrinsic coordinate space
                let cx = 0, cy = 0, cw = 0, ch = 0;
                let natW = 100, natH = 100;
                let isReverseCrop = false;
                
                if (imgRef.current) {
                    // Canvas includes padding. Get the actual image dimensions.
                    const canvasW = imgRef.current.width;
                    const canvasH = imgRef.current.height;
                    const padFrac = CROP_PAD / (1 + 2 * CROP_PAD);
                    const padPxW = Math.round(canvasW * padFrac);
                    const padPxH = Math.round(canvasH * padFrac);
                    
                    // Exactly reverse the padding logic to avoid 1px rounding errors
                    natW = canvasW - padPxW * 2;
                    natH = canvasH - padPxH * 2;

                    let activePercentCrop = percentCropRef.current || { x: 0, y: 0, width: 100, height: 100 };
                    
                    // percentCrop is relative to the canvas. Map directly to intrinsic canvas pixels.
                    const canvasPxX = (activePercentCrop.x / 100) * canvasW;
                    const canvasPxY = (activePercentCrop.y / 100) * canvasH;
                    const canvasPxW = (activePercentCrop.width / 100) * canvasW;
                    const canvasPxH = (activePercentCrop.height / 100) * canvasH;

                    // Subtract padding to get image-relative coords
                    cx = Math.round(canvasPxX) - padPxW;
                    cy = Math.round(canvasPxY) - padPxH;
                    cw = Math.round(canvasPxW);
                    ch = Math.round(canvasPxH);
                    
                    isReverseCrop = cx < 0 || cy < 0 || (cx + cw) > natW || (cy + ch) > natH;
                }

                if (!hasDrawing && !isReverseCrop && !hasAdjustments && !hasSelective && !hasGrading && !hasCurve) {
                    // Normal Crop/rotate only: use existing backend if within bounds
                    if (cw <= 0 || ch <= 0) {
                        cancelEdit(e);
                        return;
                    }
                    // Simple safety clamp (backend also clamps robustly)
                    if (cx < 0) { cw += cx; cx = 0; }
                    if (cy < 0) { ch += cy; cy = 0; }
                    if (cx + cw > natW) cw = natW - cx;
                    if (cy + ch > natH) ch = natH - cy;

                    let finalTargetW = parseInt(targetW) || null;
                    let finalTargetH = parseInt(targetH) || null;

                    // When both target dimensions are set, only send one to
                    // Sharp so it uses uniform (aspect-preserving) scaling
                    // instead of independent-axis fill that causes stretching.
                    if (finalTargetW && finalTargetH) {
                        finalTargetH = null;
                    }

                    const cropData = {
                        x: cx, y: cy, width: cw, height: ch,
                        targetWidth: finalTargetW,
                        targetHeight: finalTargetH,
                        overwrite,
                        rotation: ((rotation % 360) + 360) % 360
                    };

                    const result = await window.electron.cropImage(image.path, cropData);
                    if (result.success) {
                        if (overwrite) {
                            setForceImageUrl(`media://local/${encodeURIComponent(image.path)}?t=${result.timestamp || Date.now()}`);
                            window.dispatchEvent(new CustomEvent('image-updated', {
                                detail: { path: image.path, timestamp: result.timestamp || Date.now() }
                            }));
                        }
                        cancelEdit(e);
                    } else {
                        alert('Crop Failed: ' + result.error);
                    }
                } else {
                    // Client-side composite: Drawing + Crop/Rotation OR Reverse Crop Mode
                    const fullImg = new Image();
                    fullImg.crossOrigin = 'anonymous';
                    await new Promise((resolve, reject) => {
                        fullImg.onload = resolve;
                        fullImg.onerror = reject;
                        fullImg.src = getActiveUrl();
                    });

                    // Step 1: Draw original (and apply adjustments if any)
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = fullImg.naturalWidth;
                    tempCanvas.height = fullImg.naturalHeight;
                    const tmpCtx = tempCanvas.getContext('2d');
                    
                    renderBaseAndAdjustments(tmpCtx, fullImg);

                    // Step 2: Apply rotation
                    const rot = ((rotation % 360) + 360) % 360;
                    const rad = (rot * Math.PI) / 180;
                    let rw = tempCanvas.width, rh = tempCanvas.height;
                    if (rot !== 0) {
                        const ac = Math.abs(Math.cos(rad)), as = Math.abs(Math.sin(rad));
                        rw = Math.round(tempCanvas.width * ac + tempCanvas.height * as);
                        rh = Math.round(tempCanvas.width * as + tempCanvas.height * ac);
                    }
                    const rotCanvas = document.createElement('canvas');
                    rotCanvas.width = rw;
                    rotCanvas.height = rh;
                    const rCtx = rotCanvas.getContext('2d');
                    rCtx.translate(rw / 2, rh / 2);
                    rCtx.rotate(rad);
                    rCtx.drawImage(tempCanvas, -tempCanvas.width / 2, -tempCanvas.height / 2);

                    // Step 3: Composite Brush Strokes (post-rotation)
                    if (hasDrawing) {
                        const drawCanvas = drawCanvasRef.current;
                        if (drawCanvas && drawCanvas.width > 0) {
                            rCtx.drawImage(drawCanvas, 0, 0, rotCanvas.width, rotCanvas.height);
                        }
                    }

                    // Use uniform scaling: pick a single scale factor based on the
                    // requested target dimension to avoid stretching.
                    let uniformScale = 1;
                    if (targetW && parseInt(targetW) && cw > 0) {
                        uniformScale = parseInt(targetW) / cw;
                    } else if (targetH && parseInt(targetH) && ch > 0) {
                        uniformScale = parseInt(targetH) / ch;
                    }

                    const finalCanvas = document.createElement('canvas');
                    finalCanvas.width = Math.round(cw * uniformScale);
                    finalCanvas.height = Math.round(ch * uniformScale);
                    const fCtx = finalCanvas.getContext('2d');

                    // If crop expands beyond image (cx < 0, cy < 0 etc), fill with bg color
                    if (isReverseCrop) {
                        fCtx.fillStyle = cropBgColor;
                        fCtx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
                    }

                    // Scale uniformly to target size
                    fCtx.scale(uniformScale, uniformScale);
                    
                    // Draw rotCanvas shifted negatively by cx, cy so crop box aligns to corner
                    fCtx.drawImage(rotCanvas, -cx, -cy);
                    
                    fCtx.setTransform(1, 0, 0, 1, 0, 0);

                    const dataUrl = finalCanvas.toDataURL('image/png');
                    const result = await window.electron.saveEditedImage(image.path, dataUrl, overwrite);
                    if (result.success) {
                        if (overwrite) {
                            setForceImageUrl(`media://local/${encodeURIComponent(image.path)}?t=${result.timestamp || Date.now()}`);
                            window.dispatchEvent(new CustomEvent('image-updated', {
                                detail: { path: image.path, timestamp: result.timestamp || Date.now() }
                            }));
                        }
                        cancelEdit(e);
                    } else {
                        alert('Save Failed: ' + result.error);
                    }
                }
            }
        } catch (err) {
            console.error(err);
            alert('Save Failed');
        } finally {
            setIsSaving(false);
        }
    };

    // isVideo is defined above

    if (!image) return null;

    return (
        <div
            ref={containerRef}
            className={`image-viewer-container ${contained ? 'absolute' : 'fixed'} inset-0 z-[200] bg-black/95 flex items-center justify-center cursor-default overflow-hidden`}
            onClick={(e) => {
                if (e.target === e.currentTarget && pointerDownTargetRef.current === e.currentTarget) {
                    onClose();
                }
            }}
            onPointerDown={(e) => {
                pointerDownTargetRef.current = e.target;
            }}
            tabIndex={-1}
        >
            {/* Top Left Info (File Name & Resolution) */}
            <div className={`absolute top-6 left-6 flex items-center gap-3 z-[60] no-drag ${contained ? '' : 'backdrop-blur-md bg-black/30 px-4 py-1.5 rounded-full border border-white/10'}`}>
                <div className="text-gray-300 text-xs font-medium max-w-[300px] truncate" title={image.name || image.path}>
                    {image.name || (image.path ? image.path.split(/[\\/]/).pop() : 'Unknown Image')}
                </div>
                {resolution && (
                    <span className="text-[10px] text-gray-500 bg-black/50 px-2 py-0.5 rounded shadow-inner tracking-wider shrink-0 font-mono hidden sm:block">
                        {resolution}
                    </span>
                )}
            </div>

            {/* Top Bar Controls */}
            <div className={`absolute top-6 right-6 flex items-center justify-end gap-2 z-[60] no-drag ${contained ? '' : 'backdrop-blur-md bg-black/30 px-3 py-1.5 rounded-full border border-white/10'}`}>
                {/* AutoPlay */}
                <button
                    onClick={(e) => { e.stopPropagation(); setIsAutoPlay(!isAutoPlay); }}
                    className={`p-2 rounded-full hover:bg-black/50 transition-all flex items-center justify-center drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] ${isAutoPlay ? 'text-blue-400 drop-shadow-none bg-black/60' : 'text-white/80 hover:text-white'}`}
                    title={isAutoPlay ? "停止自动播放" : "自动播放"}
                >
                    {isAutoPlay ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                    )}
                </button>

                {/* Toolbar Toggle */}
                {!isVideo && (
                    <button
                        onClick={toggleToolbar}
                        className={`p-2 rounded-full hover:bg-black/50 transition-all flex items-center justify-center drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] ${!showToolbar ? 'text-gray-400' : 'text-white/80 hover:text-white'}`}
                        title={showToolbar ? "隐藏工具栏" : "显示工具栏"}
                    >
                        {showToolbar ? <Eye className="h-5 w-5" strokeWidth={2} /> : <EyeOff className="h-5 w-5" strokeWidth={2} />}
                    </button>
                )}

                {/* Favorite */}
                <button
                    onClick={toggleFavorite}
                    className={`p-2 rounded-full hover:bg-black/50 transition-all flex items-center justify-center drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] ${isFav ? 'text-[#A61616] drop-shadow-none' : 'text-white/80 hover:text-white'}`}
                    title={isFav ? "取消收藏" : "收藏"}
                >
                    <Heart className="h-5 w-5" fill={isFav ? "currentColor" : "none"} strokeWidth={2} />
                </button>

                {/* Separator */}
                <div className="w-[1px] h-5 bg-white/20 mx-1"></div>

                {/* Close */}
                <button
                    onClick={(e) => { e.stopPropagation(); onClose(); setIsAutoPlay(false); }}
                    className="text-white/80 hover:text-red-500 hover:bg-red-500/20 p-2 rounded-full transition-all drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                    title="关闭 (Esc)"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* ===== Main Content ===== */}
            <div className="w-full h-full flex items-center justify-center pointer-events-none">
                {isVideo ? (
                    <video
                        src={getActiveUrl()}
                        controls
                        autoPlay
                        className="w-full h-full object-contain pointer-events-auto"
                        onClick={(e) => e.stopPropagation()}
                    />
                ) : (
                    <div style={{
                        transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                        transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                        cursor: isDragging ? 'grabbing' : ((isEditing && editTool !== 'adjust') ? (editTool === 'brush' ? 'crosshair' : hoverCursor) : 'grab'),
                    }}
                        className="pointer-events-auto h-full w-full flex items-center justify-center"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={handleMouseDown}
                        onPointerMove={(e) => {
                            if (!isEditing || editTool !== 'crop' || isArbitraryRotating) return;
                            if (e.target.closest('.ReactCrop__crop-selection') || e.target.closest('.ReactCrop__drag-elements') || e.target.closest('.edit-action-bar')) {
                                if (hoverCursor !== 'default') setHoverCursor('default');
                            } else if (crop && crop.width > 0 && crop.height > 0) {
                                if (hoverCursor !== rotateCursorIcon) setHoverCursor(rotateCursorIcon);
                            } else {
                                if (hoverCursor !== 'default') setHoverCursor('default');
                            }
                        }}
                        onPointerLeave={() => { if (!isArbitraryRotating) setHoverCursor('default'); }}
                        onPointerDownCapture={(e) => {
                            if (!isEditing || editTool !== 'crop' || !crop || crop.width === 0 || crop.height === 0) return;
                            if (e.target.closest('.ReactCrop__crop-selection') || e.target.closest('.ReactCrop__drag-elements') || e.target.closest('.edit-action-bar')) return;

                            e.preventDefault();
                            e.stopPropagation();
                            setIsArbitraryRotating(true);
                            setHoverCursor(rotateCursorIcon);

                            const box = document.querySelector('.ReactCrop__child-wrapper').getBoundingClientRect();
                            const cx = box.left + box.width / 2;
                            const cy = box.top + box.height / 2;
                            const angle = Math.atan2(e.clientY - cy, e.clientX - cx);
                            rotationDragStartRef.current = { angle, initialRotation: rotation };

                            const handlePointerMove = (me) => {
                                const newAngle = Math.atan2(me.clientY - cy, me.clientX - cx);
                                let delta = (newAngle - rotationDragStartRef.current.angle) * (180 / Math.PI);
                                setRotation((rotationDragStartRef.current.initialRotation + delta) % 360);
                            };
                            const handlePointerUp = () => {
                                setIsArbitraryRotating(false);
                                window.removeEventListener('pointermove', handlePointerMove);
                                window.removeEventListener('pointerup', handlePointerUp);
                                setHoverCursor('default');
                            };
                            window.addEventListener('pointermove', handlePointerMove);
                            window.addEventListener('pointerup', handlePointerUp);
                        }}
                    >
                        {isEditing ? (
                            <div className="relative flex items-center justify-center pointer-events-auto" style={{
                                maxWidth: 'calc(100vw - 4rem)',
                                maxHeight: 'calc(100vh - 12rem)',
                                width: '100%',
                                height: '100%',
                                padding: '1rem'
                            }}>
                                <div style={{ position: 'relative', display: 'inline-flex', maxWidth: '100%', maxHeight: '100%' }}>
                                    <ReactCrop
                                        crop={editTool === 'crop' ? crop : undefined}
                                        onChange={(c, percentCrop) => {
                                            setCrop(percentCrop);
                                            percentCropRef.current = percentCrop;
                                        }}
                                        onComplete={(c, percentCrop) => {
                                            setCompletedCrop(c);
                                            percentCropRef.current = percentCrop || crop;
                                        }}
                                        aspect={effectiveAspect}
                                        locked={editTool !== 'crop'}
                                        style={{ 
                                            display: 'flex', 
                                            maxWidth: '100%', 
                                            maxHeight: '100%',
                                            pointerEvents: editTool === 'crop' ? 'auto' : 'none'
                                        }}
                                        className={editTool !== 'crop' ? 'react-crop-hidden' : ''}
                                    >
                                        <canvas
                                            ref={imgRef}
                                            style={{ 
                                                display: 'block', 
                                                maxWidth: '100%', 
                                                maxHeight: '100%',
                                                ...(editTool === 'adjust' || editTool === 'brush' ? { boxShadow: '0 0 20px rgba(0,0,0,0.5)' } : {})
                                            }}
                                            className="select-none"
                                        />
                                    </ReactCrop>

                                    {editTool === 'brush' && (
                                        <canvas
                                            ref={drawCanvasRef}
                                            className="absolute inset-0 pointer-events-auto"
                                            style={{ width: '100%', height: '100%', cursor: isEraser ? 'cell' : 'crosshair' }}
                                            onPointerDown={handleDrawStart}
                                        />
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="relative w-full h-full flex items-center justify-center">
                                {(() => {
                                    const hasSelectiveOn = Object.values(selectiveSat).some(v => v !== 0);
                                    const hasGradingOn = gradingShadows.x !== 0 || gradingShadows.y !== 0 || gradingMidtones.x !== 0 || gradingMidtones.y !== 0 || gradingHighlights.x !== 0 || gradingHighlights.y !== 0;
                                    const hasAdjustmentsOn = adjustBrightness !== 100 || adjustContrast !== 100 || adjustSaturation !== 100 || adjustHue !== 0;
                                    const hasAdvanced = hasSelectiveOn || hasGradingOn || hasAdjustmentsOn;
                                    
                                    return (
                                        <img
                                            ref={imgRef}
                                            src={previewObjectURL || getActiveUrl()}
                                            alt={image.name}
                                            style={{
                                                maxWidth: '100vw',
                                                maxHeight: '100vh',
                                                width: '100%',
                                                height: '100%',
                                                filter: hasAdvanced ? 'none' : `brightness(${adjustBrightness}%) contrast(${adjustContrast}%) saturate(${adjustSaturation}%) hue-rotate(${adjustHue}deg)`
                                            }}
                                            className="object-contain select-none block"
                                        />
                                    );
                                })()}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ===== Action Bar ===== */}
            {showToolbar && !isVideo && (
                <div 
                    className="edit-action-bar absolute bottom-10 left-1/2 bg-neutral-900/95 backdrop-blur border border-neutral-700 p-2 rounded-xl flex flex-col gap-2 shadow-2xl z-[80] transition-colors max-w-[98vw]" 
                    style={{ transform: `translate(calc(-50% + ${toolbarPos.x}px), ${toolbarPos.y}px)` }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Drag Handle */}
                    <div 
                        className="w-full flex justify-center py-1 cursor-move text-neutral-600 hover:text-neutral-400 transition-colors"
                        onPointerDown={handleToolbarPointerDown}
                        title="Drag to move toolbar"
                    >
                        <GripHorizontal size={16} />
                    </div>

                    {/* Tool Tabs */}
                    <div className={`flex items-center justify-center gap-1 px-2 ${editTool ? 'pb-2 border-b border-neutral-800' : ''}`} onPointerDown={(e) => { if (!e.target.closest('button')) handleToolbarPointerDown(e); }}>
                        <button
                            onClick={() => switchTool('crop')}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${editTool === 'crop' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-neutral-800 hover:text-white'}`}
                        >
                            <Crop size={14} /> 裁切 <span className="opacity-50 font-normal ml-0.5">(C)</span>
                        </button>
                        <button
                            onClick={() => switchTool('brush')}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${editTool === 'brush' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-neutral-800 hover:text-white'}`}
                        >
                            <Paintbrush size={14} /> 画笔 <span className="opacity-50 font-normal ml-0.5">(B)</span>
                        </button>
                        <button
                            onClick={() => switchTool('adjust')}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${editTool === 'adjust' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-neutral-800 hover:text-white'}`}
                        >
                            <SlidersHorizontal size={14} /> 调节 <span className="opacity-50 font-normal ml-0.5">(A)</span>
                        </button>
                    </div>

                    {/* Brush Tool Options */}
                    {editTool === 'brush' && (
                        <div className="flex flex-wrap items-center justify-center gap-3 px-2 py-1">
                            {/* Color Swatches */}
                            <div className="flex items-center gap-1">
                                {BRUSH_COLORS.map(color => (
                                    <button
                                        key={color}
                                        onClick={() => { setBrushColor(color); setIsEraser(false); }}
                                        className={`w-5 h-5 rounded-full border-2 transition-all ${brushColor === color && !isEraser ? 'border-white scale-125' : 'border-transparent hover:border-gray-500'}`}
                                        style={{ backgroundColor: color }}
                                        title={color}
                                    />
                                ))}
                                {/* Custom color input */}
                                <div className="relative ml-1">
                                    <input
                                        type="color"
                                        value={brushColor}
                                        onChange={(e) => { setBrushColor(e.target.value); setIsEraser(false); }}
                                        className="w-5 h-5 rounded-full cursor-pointer border-0 p-0 appearance-none"
                                        style={{ backgroundColor: 'transparent' }}
                                        title="自定义颜色"
                                    />
                                </div>
                            </div>

                            <div className="w-px h-5 bg-neutral-700" />

                            {/* Brush Size */}
                            <div className="flex items-center gap-1.5">
                                <button onClick={() => setBrushSize(Math.max(1, brushSize - 1))} className="text-gray-400 hover:text-white p-0.5 rounded hover:bg-neutral-800">
                                    <Minus size={12} />
                                </button>
                                <div className="flex items-center justify-center w-12">
                                    <div
                                        className="rounded-full bg-current"
                                        style={{
                                            width: Math.min(brushSize, 20) + 'px',
                                            height: Math.min(brushSize, 20) + 'px',
                                            color: isEraser ? '#888' : brushColor,
                                        }}
                                    />
                                </div>
                                <span className="text-gray-400 text-[10px] w-6 text-center">{brushSize}px</span>
                                <button onClick={() => setBrushSize(Math.min(50, brushSize + 1))} className="text-gray-400 hover:text-white p-0.5 rounded hover:bg-neutral-800">
                                    <Plus size={12} />
                                </button>
                                <input
                                    type="range"
                                    min="1"
                                    max="50"
                                    value={brushSize}
                                    onChange={(e) => setBrushSize(parseInt(e.target.value))}
                                    className="w-20 h-1 accent-blue-500 cursor-pointer"
                                />
                            </div>

                            <div className="w-px h-5 bg-neutral-700" />

                            {/* Eraser Toggle */}
                            <button
                                onClick={() => setIsEraser(!isEraser)}
                                className={`px-2 py-1 text-xs rounded flex items-center gap-1 transition-colors ${isEraser ? 'text-blue-400 bg-neutral-800 font-medium' : 'text-gray-400 hover:text-white hover:bg-neutral-800'}`}
                                title="橡皮擦"
                            >
                                <Eraser size={14} /> 橡皮擦
                            </button>

                            {/* Undo */}
                            <button
                                onClick={undoBrush}
                                className="px-2 py-1 text-xs text-gray-400 hover:text-white rounded hover:bg-neutral-800 flex items-center gap-1 transition-colors"
                                title="撤销 (Ctrl+Z)"
                                disabled={drawHistoryRef.current.length === 0}
                            >
                                <RotateCcw size={14} /> 撤销
                            </button>
                        </div>
                    )}

                    {/* Crop Tool Options */}
                    {editTool === 'crop' && (
                        <div className="flex flex-col gap-2">
                            <div className="flex flex-wrap items-center justify-center gap-2 px-2 border-b border-neutral-800 pb-2 mb-1">
                                <span className="text-gray-400 text-xs hidden md:inline">反向裁剪填充色:</span>
                                <div className="flex items-center gap-1 mx-1">
                                    <input type="color" value={cropBgColor} onChange={e => setCropBgColor(e.target.value)} className="w-[18px] h-[18px] rounded cursor-pointer border-0 p-0 appearance-none bg-transparent" title="选择超出选区后的填充色" />
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center justify-center gap-2 px-2">
                                <button onClick={() => handleAspectChange(undefined)} className={`px-2 py-1 text-xs rounded transition-colors ${effectiveAspect === undefined ? 'text-blue-400 bg-neutral-800 font-medium' : 'text-gray-400 hover:bg-neutral-800'}`}>自由</button>
                                <button onClick={() => handleAspectChange(1)} className={`px-2 py-1 text-xs rounded transition-colors ${aspect === 1 ? 'text-blue-400 bg-neutral-800 font-medium' : 'text-gray-400 hover:bg-neutral-800'}`}>1:1</button>
                                <button onClick={() => handleAspectChange(4 / 3)} className={`px-2 py-1 text-xs rounded transition-colors ${aspect === 4 / 3 ? 'text-blue-400 bg-neutral-800 font-medium' : 'text-gray-400 hover:bg-neutral-800'}`}>4:3</button>
                                <button onClick={() => handleAspectChange(16 / 9)} className={`px-2 py-1 text-xs rounded transition-colors ${aspect === 16 / 9 ? 'text-blue-400 bg-neutral-800 font-medium' : 'text-gray-400 hover:bg-neutral-800'}`}>16:9</button>
                                <button onClick={() => handleAspectChange(3 / 4)} className={`px-2 py-1 text-xs rounded transition-colors ${aspect === 3 / 4 ? 'text-blue-400 bg-neutral-800 font-medium' : 'text-gray-400 hover:bg-neutral-800'}`}>3:4</button>
                                <button onClick={() => handleAspectChange(9 / 16)} className={`px-2 py-1 text-xs rounded transition-colors ${aspect === 9 / 16 ? 'text-blue-400 bg-neutral-800 font-medium' : 'text-gray-400 hover:bg-neutral-800'}`}>9:16</button>

                                <div className="w-px h-4 bg-neutral-700 mx-1 hidden md:block" />
                                <div className="flex items-center gap-1">
                                    <input type="number" value={targetW} onChange={handleTargetWChange} className="w-16 bg-neutral-800 text-gray-300 text-xs px-1.5 py-1 rounded border border-neutral-700 focus:outline-none focus:border-blue-500" placeholder="W" />
                                    <span className="text-gray-500 text-xs">x</span>
                                    <input type="number" value={targetH} onChange={handleTargetHChange} disabled={!!aspect} className={`w-16 bg-neutral-800 text-xs px-1.5 py-1 rounded border border-neutral-700 focus:outline-none focus:border-blue-500 ${aspect ? 'text-gray-500 opacity-70 cursor-not-allowed' : 'text-gray-300'}`} placeholder="H" />
                                    <span className="text-gray-500 text-xs">px</span>
                                    {(targetW || targetH) && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); clearTargetDimensions(); }}
                                            className="p-0.5 rounded hover:bg-neutral-700 text-gray-500 hover:text-red-400 transition-colors ml-0.5"
                                            title="清除尺寸"
                                        >
                                            <XIcon size={12} />
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center justify-center gap-2 px-2">
                                <button onClick={(e) => { e.stopPropagation(); setRotation(r => r - 90); }} className="px-2 py-1 rounded hover:bg-neutral-800 text-gray-400 hover:text-white transition-colors flex items-center gap-1 text-sm" title="向左旋转">
                                    <RotateCcw size={16} />
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); setRotation(r => r + 90); }} className="px-2 py-1 rounded hover:bg-neutral-800 text-gray-400 hover:text-white transition-colors flex items-center gap-1 text-sm" title="向右旋转">
                                    <RotateCw size={16} />
                                </button>
                                <span className="text-gray-500 text-xs px-2 whitespace-nowrap hidden md:inline">在选区外拖拽可自由旋转</span>
                            </div>
                        </div>
                    )}

                    {/* Adjust Tool Options */}
                    {editTool === 'adjust' && (
                        <div className="flex gap-6 px-4 py-4 mx-auto justify-center w-max max-w-[98vw] overflow-x-auto overflow-y-hidden">
                            
                            {/* Left Column (Basic & Selective) */}
                            <div className="flex flex-col gap-3 w-[400px] sm:w-[460px] flex-shrink-0">
                                {/* Brightness */}
                                <div className="flex items-center gap-3">
                                    <span className="text-gray-400 text-xs w-16">亮度</span>
                                    <input
                                        type="range" min="0" max="200"
                                        value={adjustBrightness} onChange={(e) => setAdjustBrightness(Number(e.target.value))}
                                        className="flex-1 h-1 accent-blue-500 cursor-pointer"
                                    />
                                    <input
                                        type="number" min="0" max="200"
                                        value={adjustBrightness} onChange={(e) => setAdjustBrightness(Number(e.target.value))}
                                        className="w-12 bg-neutral-800 text-gray-300 text-xs px-1 rounded border border-neutral-700 text-center focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                                
                                {/* Contrast */}
                                <div className="flex items-center gap-3">
                                    <span className="text-gray-400 text-xs w-16">对比度</span>
                                    <input
                                        type="range" min="0" max="200"
                                        value={adjustContrast} onChange={(e) => setAdjustContrast(Number(e.target.value))}
                                        className="flex-1 h-1 accent-blue-500 cursor-pointer"
                                    />
                                    <input
                                        type="number" min="0" max="200"
                                        value={adjustContrast} onChange={(e) => setAdjustContrast(Number(e.target.value))}
                                        className="w-12 bg-neutral-800 text-gray-300 text-xs px-1 rounded border border-neutral-700 text-center focus:outline-none focus:border-blue-500"
                                    />
                                </div>

                                {/* Saturation */}
                                <div className="flex items-center gap-3">
                                    <span className="text-gray-400 text-xs w-16">饱和度</span>
                                    <input
                                        type="range" min="0" max="200"
                                        value={adjustSaturation} onChange={(e) => setAdjustSaturation(Number(e.target.value))}
                                        className="flex-1 h-1 accent-blue-500 cursor-pointer"
                                    />
                                    <input
                                        type="number" min="0" max="200"
                                        value={adjustSaturation} onChange={(e) => setAdjustSaturation(Number(e.target.value))}
                                        className="w-12 bg-neutral-800 text-gray-300 text-xs px-1 rounded border border-neutral-700 text-center focus:outline-none focus:border-blue-500"
                                    />
                                </div>

                                {/* Hue */}
                                <div className="flex items-center gap-3">
                                    <span className="text-gray-400 text-xs w-16">色相</span>
                                    <input
                                        type="range" min="-180" max="180"
                                        value={adjustHue} onChange={(e) => setAdjustHue(Number(e.target.value))}
                                        className="flex-1 h-1 accent-blue-500 cursor-pointer"
                                    />
                                    <input
                                        type="number" min="-180" max="180"
                                        value={adjustHue} onChange={(e) => setAdjustHue(Number(e.target.value))}
                                        className="w-12 bg-neutral-800 text-gray-300 text-xs px-1 rounded border border-neutral-700 text-center focus:outline-none focus:border-blue-500"
                                    />
                                </div>

                                {/* Basic Reset */}
                                <div className="flex justify-between items-center relative mt-1 gap-2">
                                    <button
                                        onClick={() => setShowCurvePicker(!showCurvePicker)}
                                        className={`text-xs flex items-center gap-1.5 transition-colors px-3 py-1.5 rounded-md border flex-shrink-0 ${showCurvePicker ? 'bg-blue-600 border-blue-500 text-white shadow-[0_0_12px_rgba(59,130,246,0.3)]' : 'bg-neutral-800 border-neutral-700 text-gray-300 hover:text-blue-400 hover:border-blue-500/50'}`}
                                    >
                                        <Activity size={14} className={showCurvePicker ? "text-blue-200" : "text-blue-500"} /> 
                                        {showCurvePicker ? "关闭曲线" : "色调曲线"}
                                    </button>
                                    
                                    {showCurvePicker && (
                                        <div className="fixed bottom-[140px] left-[50%] -translate-x-1/2 md:-translate-x-0 md:left-6 w-[300px] bg-neutral-900/95 backdrop-blur-md border border-neutral-700 shadow-[0_0_40px_rgba(0,0,0,0.8)] rounded-xl p-4 z-[200]">
                                            <div className="flex justify-between items-center mb-3">
                                                <h3 className="text-white text-sm font-medium flex items-center gap-2"><Activity size={14} className="text-blue-400" /> 色调曲线</h3>
                                                <button onClick={() => setShowCurvePicker(false)} className="text-gray-400 hover:text-white transition-colors hover:bg-neutral-800 p-1 rounded-md"><XIcon size={14}/></button>
                                            </div>
                                            <ToneCurve 
                                                value={adjustCurve} 
                                                onChange={setAdjustCurve} 
                                                onReset={() => setAdjustCurve([{x:0, y:0}, {x:255, y:255}])} 
                                            />
                                        </div>
                                    )}

                                    <button
                                        onClick={() => { setAdjustBrightness(100); setAdjustContrast(100); setAdjustSaturation(100); setAdjustHue(0); setAdjustCurve([{x:0, y:0}, {x:255, y:255}]); }}
                                        className="text-[10px] text-gray-500 hover:text-blue-400 flex items-center gap-1 transition-colors"
                                    >
                                        <RotateCcw size={10} /> 重置基础调节
                                    </button>
                                </div>

                                <div className="w-full h-px bg-neutral-800 my-1" />
                                
                                <div className="flex items-center justify-between mb-1">
                                    <div className="text-gray-400 text-xs font-medium">选色滤镜</div>
                                    <button
                                        onClick={() => setSelectiveSat({ reds: 0, yellows: 0, greens: 0, cyans: 0, blues: 0, magentas: 0 })}
                                        className="text-[10px] text-gray-500 hover:text-blue-400 flex items-center gap-1 transition-colors"
                                    >
                                        <RotateCcw size={10} /> 重置选色
                                    </button>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-x-4 gap-y-3 px-2">
                                    {[{key: 'reds', bg: 'bg-red-500'}, 
                                      {key: 'yellows', bg: 'bg-yellow-500'}, 
                                      {key: 'greens', bg: 'bg-green-500'}, 
                                      {key: 'cyans', bg: 'bg-cyan-400'}, 
                                      {key: 'blues', bg: 'bg-blue-500'}, 
                                      {key: 'magentas', bg: 'bg-fuchsia-500'}].map(c => (
                                        <div key={c.key} className="flex items-center gap-2.5 min-w-0">
                                            <div 
                                                className={`w-3 h-3 rounded-full flex-shrink-0 ${c.bg} shadow-[0_0_2px_rgba(0,0,0,0.5)]`} 
                                                title={{reds: '红色', yellows: '黄色', greens: '绿色', cyans: '青色', blues: '蓝色', magentas: '洋红'}[c.key]} 
                                            />
                                            <input
                                                type="range" min="-100" max="100"
                                                value={selectiveSat[c.key]} onChange={(e) => setSelectiveSat(s => ({...s, [c.key]: Number(e.target.value)}))}
                                                className="flex-1 min-w-0 w-full h-1 accent-blue-500 cursor-pointer"
                                            />
                                            <input
                                                type="number" min="-100" max="100"
                                                value={selectiveSat[c.key]} onChange={(e) => setSelectiveSat(s => ({...s, [c.key]: Number(e.target.value)}))}
                                                className="w-10 bg-neutral-800 text-gray-300 text-[10px] px-0.5 rounded border border-neutral-700 text-center focus:outline-none focus:border-blue-500"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            {/* Divider */}
                            <div className="w-px bg-neutral-800 self-stretch my-2 hidden sm:block" />

                            {/* Right Column (Three-Way Grading) */}
                            <div className="flex flex-col w-[280px] sm:w-[340px] justify-center flex-shrink-0">
                                <div className="flex items-center justify-between mb-3 px-1">
                                    <div className="text-gray-400 text-xs font-medium">色彩分级</div>
                                    <button
                                        onClick={() => { setGradingShadows({x: 0, y: 0}); setGradingMidtones({x: 0, y: 0}); setGradingHighlights({x: 0, y: 0}); }}
                                        className="text-[10px] text-gray-500 hover:text-blue-400 flex items-center gap-1 transition-colors"
                                    >
                                        <RotateCcw size={10} /> 重置分级
                                    </button>
                                </div>
                                
                                <div className="flex items-center justify-between gap-1 sm:gap-2 px-1 w-full relative h-[120px]">
                                    <ColorWheel label="阴影" value={gradingShadows} onChange={setGradingShadows} />
                                    <ColorWheel label="中间调" value={gradingMidtones} onChange={setGradingMidtones} />
                                    <ColorWheel label="高光" value={gradingHighlights} onChange={setGradingHighlights} />
                                </div>

                                {/* Preset Slots */}
                                <div className="flex flex-col gap-1.5 px-3 mt-4 mb-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] text-gray-500 font-medium tracking-wide">预设</span>
                                        <span className="text-[9px] text-gray-600">左键:加载 | 右键:保存 | 双击:重命名</span>
                                    </div>
                                    <div className="flex gap-2">
                                        {[0, 1, 2, 3].map(index => {
                                            const isSaved = gradingPresets[index] !== null;
                                            const displayName = isSaved && gradingPresets[index].name ? gradingPresets[index].name : (index + 1).toString();
                                            
                                            if (renamingPreset === index) {
                                                return (
                                                    <input
                                                        key={index}
                                                        autoFocus
                                                        value={renameValue}
                                                        onChange={(e) => setRenameValue(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                const newPresets = [...gradingPresets];
                                                                if (newPresets[index]) {
                                                                    newPresets[index].name = renameValue.trim();
                                                                    setGradingPresets(newPresets);
                                                                    localStorage.setItem('settings_grading_presets', JSON.stringify(newPresets));
                                                                }
                                                                setRenamingPreset(null);
                                                            } else if (e.key === 'Escape') {
                                                                setRenamingPreset(null);
                                                            }
                                                            e.stopPropagation();
                                                        }}
                                                        onBlur={() => {
                                                            const newPresets = [...gradingPresets];
                                                            if (newPresets[index]) {
                                                                newPresets[index].name = renameValue.trim();
                                                                setGradingPresets(newPresets);
                                                                localStorage.setItem('settings_grading_presets', JSON.stringify(newPresets));
                                                            }
                                                            setRenamingPreset(null);
                                                        }}
                                                        className="flex-1 w-0 h-7 rounded text-[10px] font-medium transition-all duration-200 border bg-neutral-800 text-white border-blue-500 text-center focus:outline-none"
                                                    />
                                                );
                                            }

                                            return (
                                                <button
                                                    key={index}
                                                    onClick={() => {
                                                        if (isSaved) {
                                                            const preset = gradingPresets[index];
                                                            setGradingShadows(preset.shadows);
                                                            setGradingMidtones(preset.midtones);
                                                            setGradingHighlights(preset.highlights);
                                                            if (preset.curve) {
                                                                setAdjustCurve(preset.curve);
                                                            }
                                                        }
                                                    }}
                                                    onDoubleClick={() => {
                                                        if (isSaved) {
                                                            setRenameValue(gradingPresets[index].name || "");
                                                            setRenamingPreset(index);
                                                        }
                                                    }}
                                                    onContextMenu={(e) => {
                                                        e.preventDefault();
                                                        const newPresets = [...gradingPresets];
                                                        newPresets[index] = {
                                                            shadows: gradingShadows,
                                                            midtones: gradingMidtones,
                                                            highlights: gradingHighlights,
                                                            curve: adjustCurve,
                                                            name: isSaved ? gradingPresets[index].name : ""
                                                        };
                                                        setGradingPresets(newPresets);
                                                        localStorage.setItem('settings_grading_presets', JSON.stringify(newPresets));
                                                        
                                                        setJustSavedPreset(index);
                                                        setTimeout(() => setJustSavedPreset(null), 1000);
                                                    }}
                                                    className={`flex-1 flex items-center justify-center h-7 rounded text-[10px] font-medium transition-all duration-200 border overflow-hidden whitespace-nowrap px-1 ${
                                                        justSavedPreset === index
                                                            ? 'bg-green-500/20 text-green-400 border-green-500/50 scale-95'
                                                            : isSaved 
                                                                ? 'bg-neutral-800 text-blue-400 border-blue-500/30 hover:bg-neutral-700 hover:border-blue-400 cursor-pointer shadow-[0_0_8px_rgba(59,130,246,0.1)]' 
                                                                : 'bg-neutral-900 text-gray-600 border-neutral-800 hover:bg-neutral-800 hover:border-neutral-700 cursor-pointer border-dashed'
                                                    }`}
                                                    title={isSaved ? "左键: 加载\n右键: 覆盖\n双击: 重命名" : "右键: 保存当前设置"}
                                                >
                                                    {justSavedPreset === index ? <Check size={14} className="animate-in zoom-in duration-200 flex-shrink-0" /> : <span className="truncate w-full text-center">{displayName}</span>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="flex justify-center mt-3 pt-2 border-t border-neutral-800/50">
                                    <button
                                        onClick={() => { 
                                            setAdjustBrightness(100); setAdjustContrast(100); setAdjustSaturation(100); setAdjustHue(0); 
                                            setAdjustCurve([{x:0, y:0}, {x:255, y:255}]);
                                            setSelectiveSat({ reds: 0, yellows: 0, greens: 0, cyans: 0, blues: 0, magentas: 0 });
                                            setGradingShadows({x: 0, y: 0});
                                            setGradingMidtones({x: 0, y: 0});
                                            setGradingHighlights({x: 0, y: 0});
                                        }}
                                        className="text-[11px] text-red-500 hover:bg-red-500/10 hover:text-red-400 flex items-center gap-1.5 transition-colors px-3 py-1.5 rounded-md"
                                    >
                                        <RotateCcw size={11} /> 重置所有调节
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Action Row (shared) */}
                    {isEditing && (
                        <div className="flex items-center justify-center gap-2 pt-1 px-2 border-t border-neutral-800">
                            <button onClick={cancelEdit} disabled={isSaving} className="px-3 py-1.5 rounded hover:bg-neutral-800 text-gray-400 hover:text-white transition-colors flex items-center gap-1 text-sm">
                                <XIcon size={14} /> 取消
                            </button>
                            <button onClick={(e) => saveEdit(e, false)} disabled={isSaving} className={`px-3 py-1.5 rounded ${localStorage.getItem('settings_crop_overwrite') !== 'true' ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-neutral-800 hover:bg-neutral-700 text-gray-300 hover:text-white'} disabled:opacity-50 transition-colors flex items-center gap-1 text-sm`}>
                                <Check size={14} /> {isSaving && localStorage.getItem('settings_crop_overwrite') !== 'true' ? '保存中...' : '另存为'}
                            </button>
                            <button onClick={(e) => saveEdit(e, true)} disabled={isSaving} className={`px-3 py-1.5 rounded ${localStorage.getItem('settings_crop_overwrite') === 'true' ? 'bg-rose-600 hover:bg-rose-500 text-white' : 'bg-neutral-800 hover:bg-neutral-700 text-gray-300 hover:text-white'} disabled:opacity-50 transition-colors flex items-center gap-1 text-sm`}>
                                <Check size={14} /> {isSaving && localStorage.getItem('settings_crop_overwrite') === 'true' ? '保存中...' : '覆盖原图'}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Navigation Areas (hidden during edit) */}
            {!isEditing && (
                <>
                    <div
                        className={`absolute left-0 top-0 ${isVideo ? 'bottom-24' : 'bottom-0'} w-24 hover:bg-white/5 flex items-center justify-center cursor-pointer group transition-colors`}
                        onClick={(e) => { e.stopPropagation(); onPrev(); }}
                    >
                        <div className="opacity-0 group-hover:opacity-100 text-white text-4xl">‹</div>
                    </div>
                    <div
                        className={`absolute right-0 top-0 ${isVideo ? 'bottom-24' : 'bottom-0'} w-24 hover:bg-white/5 flex items-center justify-center cursor-pointer group transition-colors z-[55]`}
                        onClick={(e) => { e.stopPropagation(); onNext(); }}
                    >
                        <div className="opacity-0 group-hover:opacity-100 text-white text-4xl">›</div>
                    </div>
                </>
            )}

        </div>
    )
}

export default ImageViewer

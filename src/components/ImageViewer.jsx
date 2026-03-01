import React, { useEffect, useState, useRef, useCallback } from 'react'
import { Heart, Crop, Check, X as XIcon, Paintbrush, RotateCcw, RotateCw, Eraser, Minus, Plus, Pen } from 'lucide-react';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

const rotateCursorIcon = `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="black" stroke-width="4" d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path stroke="black" stroke-width="4" d="M21 3v5h-5"/><path stroke="white" stroke-width="2" d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path stroke="white" stroke-width="2" d="M21 3v5h-5"/></svg>') 12 12, auto`;

const BRUSH_COLORS = [
    '#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#007AFF',
    '#5856D6', '#AF52DE', '#FF2D55', '#FFFFFF', '#000000',
];

const ImageViewer = ({ image, onClose, onNext, onPrev, onDelete }) => {
    const [zoom, setZoom] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [isAutoPlay, setIsAutoPlay] = useState(false);
    const [isFav, setIsFav] = useState(false);

    // ===== Edit Mode =====
    const [isEditing, setIsEditing] = useState(false);
    const [editTool, setEditTool] = useState('brush'); // 'brush' | 'crop'

    // ===== Brush State =====
    const [brushColor, setBrushColor] = useState('#FF3B30');
    const [brushSize, setBrushSize] = useState(4);
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
    const imgRef = useRef(null);
    const [isArbitraryRotating, setIsArbitraryRotating] = useState(false);
    const [hoverCursor, setHoverCursor] = useState('default');
    const rotationDragStartRef = useRef({ angle: 0, initialRotation: 0 });
    const percentCropRef = useRef(null);
    const baseImageRef = useRef(null);

    const dragStartRef = useRef({ x: 0, y: 0 });
    const onNextRef = useRef(onNext);

    const getActiveUrl = () => {
        if (forceImageUrl) return forceImageUrl;
        if (!image) return '';
        if (window.imageTimestamps && window.imageTimestamps[image.path]) {
            const base = image.url.split('?')[0];
            return `${base}?t=${window.imageTimestamps[image.path]}`;
        }
        return image.url;
    };

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
            if (e.key === 'Escape') {
                if (isEditing) {
                    cancelEdit();
                } else {
                    onClose();
                }
            }
            if (!isEditing) {
                if (e.key === 'ArrowRight') onNext();
                if (e.key === 'ArrowLeft') onPrev();
                if (e.key === 'Delete' || e.key === 'Backspace') {
                    if (onDelete) onDelete();
                }
            }
            // Undo for brush: Ctrl+Z
            if (isEditing && editTool === 'brush' && (e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                undoBrush();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose, onNext, onPrev, onDelete, isEditing, editTool, isSaving]);

    // ===== Reset on image change =====
    useEffect(() => {
        setZoom(1);
        setPosition({ x: 0, y: 0 });
        setIsEditing(false);
        setEditTool('brush');
        setRotation(0);
        setCrop(undefined);
        setCompletedCrop(null);
        setTargetW('');
        setTargetH('');
        setForceImageUrl(null);
        drawHistoryRef.current = [];
    }, [image]);

    // ===== Rotation Canvas (for crop tool) =====
    useEffect(() => {
        if (!isEditing || editTool !== 'crop') return;

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            baseImageRef.current = img;
            drawRotatedCanvas();
            if (!percentCropRef.current || percentCropRef.current.width === 0) {
                const initialCrop = { unit: '%', width: 100, height: 100, x: 0, y: 0 };
                setCrop(initialCrop);
                percentCropRef.current = initialCrop;
            }
        };
        img.onerror = () => console.error('Failed to load image for rotation');
        img.src = getActiveUrl();
    }, [isEditing, editTool, image, forceImageUrl]);

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

        canvas.width = cw;
        canvas.height = ch;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.translate(cw / 2, ch / 2);
        ctx.rotate(rad);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
    };

    useEffect(() => { drawRotatedCanvas(); }, [rotation]);

    // ===== Drawing Canvas Setup =====
    const setupDrawCanvas = useCallback(() => {
        const canvas = drawCanvasRef.current;
        if (!canvas) return;
        // Match the size of the displayed image
        const parent = canvas.parentElement;
        if (!parent) return;
        const imgEl = parent.querySelector('img');
        if (!imgEl) return;

        const rect = imgEl.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';

        // Restore history
        restoreDrawHistory();
    }, []);

    useEffect(() => {
        if (isEditing && editTool === 'brush') {
            // Small delay to ensure the image is rendered
            const timer = setTimeout(setupDrawCanvas, 100);
            return () => clearTimeout(timer);
        }
    }, [isEditing, editTool, setupDrawCanvas]);

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
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    };

    const handleDrawStart = (e) => {
        if (editTool !== 'brush') return;
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
            if (isEditing) return;
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const delta = e.deltaY * -0.001;
                setZoom(prev => Math.max(0.1, Math.min(10, prev + delta * 2)));
            }
        };
        window.addEventListener('wheel', handleWheel, { passive: false });
        return () => window.removeEventListener('wheel', handleWheel);
    }, [isEditing]);

    // ===== Drag Handlers (non-edit mode) =====
    const handleMouseDown = (e) => {
        if (isEditing) return;
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
        dragStartRef.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    };

    const handleMouseMove = (e) => {
        if (!isDragging || isEditing) return;
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
    const startEditing = (e) => {
        e.stopPropagation();
        setIsAutoPlay(false);
        setIsEditing(true);
        setEditTool('brush');
        setZoom(1);
        setPosition({ x: 0, y: 0 });
        setRotation(0);

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
        drawHistoryRef.current = [];
    };

    const cancelEdit = (e) => {
        if (e) e.stopPropagation();
        setIsEditing(false);
        setRotation(0);
        setEditTool('brush');
        drawHistoryRef.current = [];
    };

    const switchTool = (tool) => {
        setEditTool(tool);
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
        }

        if (imgRef.current && editTool === 'crop') {
            const { width, height } = imgRef.current;
            if (newAspect) {
                let initWidth = completedCrop ? completedCrop.width : (width * 0.9);
                if (initWidth / newAspect > height) initWidth = height * newAspect;
                const newCrop = centerCrop(
                    makeAspectCrop({ unit: 'px', width: initWidth }, newAspect, width, height),
                    width, height
                );
                const newPercentCrop = {
                    unit: '%',
                    x: (newCrop.x / width) * 100,
                    y: (newCrop.y / height) * 100,
                    width: (newCrop.width / width) * 100,
                    height: (newCrop.height / height) * 100
                };
                setCrop(newPercentCrop);
                setCompletedCrop(newCrop);
                percentCropRef.current = newPercentCrop;
            }
        }
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
            }
        } else if (val === '') {
            localStorage.removeItem('last_crop_target_h');
        }
    };

    const handleCropKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const overwrite = localStorage.getItem('settings_crop_overwrite') === 'true';
            saveEdit(e, overwrite);
        }
    };

    // ===== Save Edit =====
    const saveEdit = async (e, overwrite = false) => {
        e.stopPropagation();
        if (!image) return;

        setIsSaving(true);
        try {
            const hasDrawing = drawHistoryRef.current.length > 0;
            const hasCropOrRotation = editTool === 'crop' && (rotation !== 0 || (percentCropRef.current && (percentCropRef.current.width < 100 || percentCropRef.current.height < 100 || percentCropRef.current.x > 0 || percentCropRef.current.y > 0)));

            if (hasDrawing && !hasCropOrRotation) {
                // Drawing only: composite drawing onto full-res image client-side
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
                ctx.drawImage(fullImg, 0, 0);

                // Scale the drawing to full resolution
                const drawCanvas = drawCanvasRef.current;
                if (drawCanvas && drawCanvas.width > 0) {
                    ctx.drawImage(drawCanvas, 0, 0, mergeCanvas.width, mergeCanvas.height);
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
            } else if (hasCropOrRotation && !hasDrawing) {
                // Crop/rotate only: use existing backend
                let activePercentCrop = percentCropRef.current || { x: 0, y: 0, width: 100, height: 100 };
                if (activePercentCrop.width <= 0 || activePercentCrop.height <= 0) {
                    cancelEdit(e);
                    return;
                }
                const natW = imgRef.current.naturalWidth ?? imgRef.current.width;
                const natH = imgRef.current.naturalHeight ?? imgRef.current.height;

                let cx = Math.max(0, Math.round((activePercentCrop.x / 100) * natW));
                let cy = Math.max(0, Math.round((activePercentCrop.y / 100) * natH));
                let cw = Math.round((activePercentCrop.width / 100) * natW);
                let ch = Math.round((activePercentCrop.height / 100) * natH);
                if (cx + cw > natW) cw = natW - cx;
                if (cy + ch > natH) ch = natH - cy;

                const cropData = {
                    x: cx, y: cy, width: cw, height: ch,
                    targetWidth: parseInt(targetW) || null,
                    targetHeight: parseInt(targetH) || null,
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
            } else if (hasDrawing && hasCropOrRotation) {
                // Both drawing + crop/rotation: composite all client-side
                const fullImg = new Image();
                fullImg.crossOrigin = 'anonymous';
                await new Promise((resolve, reject) => {
                    fullImg.onload = resolve;
                    fullImg.onerror = reject;
                    fullImg.src = getActiveUrl();
                });

                // Step 1: Draw original + brush strokes
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = fullImg.naturalWidth;
                tempCanvas.height = fullImg.naturalHeight;
                const tmpCtx = tempCanvas.getContext('2d');
                tmpCtx.drawImage(fullImg, 0, 0);
                const drawCanvas = drawCanvasRef.current;
                if (drawCanvas && drawCanvas.width > 0) {
                    tmpCtx.drawImage(drawCanvas, 0, 0, tempCanvas.width, tempCanvas.height);
                }

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

                // Step 3: Apply crop
                let activePercentCrop = percentCropRef.current || { x: 0, y: 0, width: 100, height: 100 };
                let cx = Math.max(0, Math.round((activePercentCrop.x / 100) * rw));
                let cy = Math.max(0, Math.round((activePercentCrop.y / 100) * rh));
                let cw = Math.round((activePercentCrop.width / 100) * rw);
                let ch = Math.round((activePercentCrop.height / 100) * rh);
                if (cx + cw > rw) cw = rw - cx;
                if (cy + ch > rh) ch = rh - cy;

                const finalCanvas = document.createElement('canvas');
                const tw = parseInt(targetW) || cw;
                const th = parseInt(targetH) || ch;
                finalCanvas.width = tw;
                finalCanvas.height = th;
                const fCtx = finalCanvas.getContext('2d');
                fCtx.drawImage(rotCanvas, cx, cy, cw, ch, 0, 0, tw, th);

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
            } else {
                // No changes, just close
                cancelEdit(e);
            }
        } catch (err) {
            console.error(err);
            alert('Save Failed');
        } finally {
            setIsSaving(false);
        }
    };

    const isVideo = image?.path && /\.(mp4|webm|mov|mkv)$/i.test(image.path);

    if (!image) return null;

    return (
        <div
            className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center cursor-default overflow-hidden"
            onClick={onClose}
            onKeyDown={isEditing && editTool === 'crop' ? handleCropKeyDown : undefined}
            tabIndex={-1}
        >
            {/* Top Bar Controls */}
            <div className="absolute top-6 left-6 flex gap-2 z-[60] no-drag">
                {/* Close */}
                <button
                    onClick={(e) => { e.stopPropagation(); onClose(); setIsAutoPlay(false); }}
                    className="text-white/80 hover:text-white p-2.5 rounded-full hover:bg-black/20 transition-all drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                    title="Close (Esc)"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                {/* Favorite */}
                <button
                    onClick={toggleFavorite}
                    className={`p-2.5 rounded-full hover:bg-black/20 transition-all flex items-center justify-center drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] ${isFav ? 'text-[#A61616] drop-shadow-none' : 'text-white/80 hover:text-white'}`}
                    title={isFav ? "Unfavorite" : "Favorite"}
                >
                    <Heart className="h-6 w-6" fill={isFav ? "currentColor" : "none"} strokeWidth={2} />
                </button>

                {/* Edit Button */}
                {!isVideo && (
                    <button
                        onClick={startEditing}
                        className={`p-2.5 rounded-full hover:bg-black/20 transition-all flex items-center justify-center drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] ${isEditing ? 'text-blue-400 drop-shadow-none bg-black/40' : 'text-white/80 hover:text-white'}`}
                        title="Edit Image"
                    >
                        <Pen className="h-6 w-6" strokeWidth={2} />
                    </button>
                )}

                {/* AutoPlay */}
                <button
                    onClick={(e) => { e.stopPropagation(); setIsAutoPlay(!isAutoPlay); }}
                    className={`p-2.5 rounded-full hover:bg-black/20 transition-all flex items-center justify-center drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] ${isAutoPlay ? 'text-blue-400 drop-shadow-none bg-black/40' : 'text-white/80 hover:text-white'}`}
                    title={isAutoPlay ? "Stop AutoPlay" : "Start AutoPlay"}
                >
                    {isAutoPlay ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                    )}
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
                        transform: !isEditing ? `translate(${position.x}px, ${position.y}px) scale(${zoom})` : 'none',
                        transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                        cursor: isDragging ? 'grabbing' : (isEditing ? (editTool === 'brush' ? 'crosshair' : hoverCursor) : 'grab'),
                    }}
                        className={`pointer-events-auto h-full w-full flex items-center justify-center ${isEditing ? 'px-16 py-16' : ''}`}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={!isEditing ? handleMouseDown : undefined}
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
                        {isEditing && editTool === 'crop' ? (
                            <ReactCrop
                                crop={crop}
                                onChange={(c) => setCrop(c)}
                                onComplete={(c, percentCrop) => {
                                    setCompletedCrop(c);
                                    percentCropRef.current = percentCrop;
                                }}
                                aspect={aspect}
                                style={{ display: 'flex', maxWidth: '100%', maxHeight: '100%' }}
                            >
                                <canvas
                                    ref={imgRef}
                                    style={{ maxHeight: 'calc(100vh - 12rem)', maxWidth: 'calc(100vw - 4rem)' }}
                                    className="select-none block"
                                />
                            </ReactCrop>
                        ) : (
                            <div className="relative inline-flex items-center justify-center" style={{ maxWidth: '100%', maxHeight: '100%' }}>
                                <img
                                    ref={imgRef}
                                    src={getActiveUrl()}
                                    alt={image.name}
                                    className={`${isEditing ? 'max-h-[calc(100vh-12rem)] max-w-[calc(100vw-4rem)]' : 'w-full h-full'} object-contain select-none block`}
                                    onLoad={isEditing && editTool === 'brush' ? setupDrawCanvas : undefined}
                                />
                                {/* Drawing Canvas Overlay - matches image exactly */}
                                {isEditing && editTool === 'brush' && (
                                    <canvas
                                        ref={drawCanvasRef}
                                        className="absolute inset-0"
                                        style={{ cursor: isEraser ? 'cell' : 'crosshair', pointerEvents: 'auto' }}
                                        onPointerDown={handleDrawStart}
                                    />
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ===== Edit Action Bar ===== */}
            {isEditing && (
                <div className="edit-action-bar absolute bottom-10 left-1/2 -translate-x-1/2 bg-neutral-900/95 backdrop-blur border border-neutral-700 p-2 rounded-xl flex flex-col gap-2 shadow-2xl z-[80] transition-colors max-w-[95vw]" onClick={(e) => e.stopPropagation()}>
                    {/* Tool Tabs */}
                    <div className="flex items-center justify-center gap-1 pb-2 border-b border-neutral-800 px-2">
                        <button
                            onClick={() => switchTool('brush')}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${editTool === 'brush' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-neutral-800 hover:text-white'}`}
                        >
                            <Paintbrush size={14} /> Brush
                        </button>
                        <button
                            onClick={() => switchTool('crop')}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${editTool === 'crop' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-neutral-800 hover:text-white'}`}
                        >
                            <Crop size={14} /> Crop
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
                                        title="Custom Color"
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
                                title="Eraser"
                            >
                                <Eraser size={14} /> Eraser
                            </button>

                            {/* Undo */}
                            <button
                                onClick={undoBrush}
                                className="px-2 py-1 text-xs text-gray-400 hover:text-white rounded hover:bg-neutral-800 flex items-center gap-1 transition-colors"
                                title="Undo (Ctrl+Z)"
                                disabled={drawHistoryRef.current.length === 0}
                            >
                                <RotateCcw size={14} /> Undo
                            </button>
                        </div>
                    )}

                    {/* Crop Tool Options */}
                    {editTool === 'crop' && (
                        <div className="flex flex-col gap-2">
                            <div className="flex flex-wrap items-center justify-center gap-2 px-2">
                                <button onClick={() => handleAspectChange(undefined)} className={`px-2 py-1 text-xs rounded transition-colors ${aspect === undefined ? 'text-blue-400 bg-neutral-800 font-medium' : 'text-gray-400 hover:bg-neutral-800'}`}>Free</button>
                                <button onClick={() => handleAspectChange(1)} className={`px-2 py-1 text-xs rounded transition-colors ${aspect === 1 ? 'text-blue-400 bg-neutral-800 font-medium' : 'text-gray-400 hover:bg-neutral-800'}`}>1:1</button>
                                <button onClick={() => handleAspectChange(4 / 3)} className={`px-2 py-1 text-xs rounded transition-colors ${aspect === 4 / 3 ? 'text-blue-400 bg-neutral-800 font-medium' : 'text-gray-400 hover:bg-neutral-800'}`}>4:3</button>
                                <button onClick={() => handleAspectChange(16 / 9)} className={`px-2 py-1 text-xs rounded transition-colors ${aspect === 16 / 9 ? 'text-blue-400 bg-neutral-800 font-medium' : 'text-gray-400 hover:bg-neutral-800'}`}>16:9</button>
                                <button onClick={() => handleAspectChange(3 / 4)} className={`px-2 py-1 text-xs rounded transition-colors ${aspect === 3 / 4 ? 'text-blue-400 bg-neutral-800 font-medium' : 'text-gray-400 hover:bg-neutral-800'}`}>3:4</button>
                                <button onClick={() => handleAspectChange(9 / 16)} className={`px-2 py-1 text-xs rounded transition-colors ${aspect === 9 / 16 ? 'text-blue-400 bg-neutral-800 font-medium' : 'text-gray-400 hover:bg-neutral-800'}`}>9:16</button>

                                <div className="w-px h-4 bg-neutral-700 mx-1 hidden md:block" />
                                <div className="flex items-center gap-1">
                                    <span className="text-gray-400 text-xs hidden md:inline ml-1">Export:</span>
                                    <input type="number" value={targetW} onChange={handleTargetWChange} onKeyDown={handleCropKeyDown} className="w-16 bg-neutral-800 text-gray-300 text-xs px-1.5 py-1 rounded border border-neutral-700 focus:outline-none focus:border-blue-500" placeholder="Auto" />
                                    <span className="text-gray-500 text-xs">x</span>
                                    <input type="number" value={targetH} onChange={handleTargetHChange} onKeyDown={handleCropKeyDown} disabled={!!aspect} className={`w-16 bg-neutral-800 text-xs px-1.5 py-1 rounded border border-neutral-700 focus:outline-none focus:border-blue-500 ${aspect ? 'text-gray-500 opacity-70 cursor-not-allowed' : 'text-gray-300'}`} placeholder="Auto" />
                                    <span className="text-gray-500 text-xs ml-1">px</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-center gap-2 px-2">
                                <button onClick={(e) => { e.stopPropagation(); setRotation(r => r - 90); }} className="px-2 py-1 rounded hover:bg-neutral-800 text-gray-400 hover:text-white transition-colors flex items-center gap-1 text-sm" title="Rotate Left">
                                    <RotateCcw size={16} />
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); setRotation(r => r + 90); }} className="px-2 py-1 rounded hover:bg-neutral-800 text-gray-400 hover:text-white transition-colors flex items-center gap-1 text-sm" title="Rotate Right">
                                    <RotateCw size={16} />
                                </button>
                                <span className="text-gray-500 text-xs px-2 whitespace-nowrap hidden md:inline">Drag outside to rotate freely</span>
                            </div>
                        </div>
                    )}

                    {/* Action Row (shared) */}
                    <div className="flex items-center justify-center gap-2 pt-1 px-2 border-t border-neutral-800">
                        <button onClick={cancelEdit} disabled={isSaving} className="px-3 py-1.5 rounded hover:bg-neutral-800 text-gray-400 hover:text-white transition-colors flex items-center gap-1 text-sm">
                            <XIcon size={14} /> Cancel
                        </button>
                        <button onClick={(e) => saveEdit(e, false)} disabled={isSaving} className={`px-3 py-1.5 rounded ${localStorage.getItem('settings_crop_overwrite') !== 'true' ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-neutral-800 hover:bg-neutral-700 text-gray-300 hover:text-white'} disabled:opacity-50 transition-colors flex items-center gap-1 text-sm`}>
                            <Check size={14} /> {isSaving && localStorage.getItem('settings_crop_overwrite') !== 'true' ? 'Saving...' : 'Save Copy'}
                        </button>
                        <button onClick={(e) => saveEdit(e, true)} disabled={isSaving} className={`px-3 py-1.5 rounded ${localStorage.getItem('settings_crop_overwrite') === 'true' ? 'bg-rose-600 hover:bg-rose-500 text-white' : 'bg-neutral-800 hover:bg-neutral-700 text-gray-300 hover:text-white'} disabled:opacity-50 transition-colors flex items-center gap-1 text-sm`}>
                            <Check size={14} /> {isSaving && localStorage.getItem('settings_crop_overwrite') === 'true' ? 'Saving...' : 'Overwrite'}
                        </button>
                    </div>
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

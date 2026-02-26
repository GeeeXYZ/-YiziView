import React, { useEffect, useState, useRef } from 'react'
import { Heart, Crop, Check, X as XIcon, Settings2, RectangleHorizontal, RectangleVertical, Square } from 'lucide-react';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css'; // Don't forget the CSS for the crop to work

const ImageViewer = ({ image, onClose, onNext, onPrev, onDelete }) => {
    const [zoom, setZoom] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [isAutoPlay, setIsAutoPlay] = useState(false);
    const [isFav, setIsFav] = useState(false);

    // Cropping states
    const [isCropping, setIsCropping] = useState(false);
    const [crop, setCrop] = useState();
    const [completedCrop, setCompletedCrop] = useState(null);
    const [aspect, setAspect] = useState(undefined);
    const [isSavingCrop, setIsSavingCrop] = useState(false);
    const [targetW, setTargetW] = useState('');
    const [targetH, setTargetH] = useState('');
    const imgRef = useRef(null);

    const dragStartRef = useRef({ x: 0, y: 0 });
    const onNextRef = useRef(onNext);

    useEffect(() => {
        if (image) {
            const favs = JSON.parse(localStorage.getItem('yizi_fav_images') || '[]');
            setIsFav(favs.includes(image.path));
        }
    }, [image]);

    // Listen to external favorite updates
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

    useEffect(() => {
        onNextRef.current = onNext;
    }, [onNext]);

    useEffect(() => {
        let interval;
        if (isAutoPlay) {
            interval = setInterval(() => {
                if (onNextRef.current) onNextRef.current();
            }, 3000);
        }
        return () => clearInterval(interval);
    }, [isAutoPlay]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (isSavingCrop) return;
            if (e.key === 'Escape') {
                if (isCropping) {
                    setIsCropping(false);
                } else {
                    onClose();
                }
            }
            if (!isCropping) {
                if (e.key === 'ArrowRight') onNext();
                if (e.key === 'ArrowLeft') onPrev();
                if (e.key === 'Delete' || e.key === 'Backspace') {
                    if (onDelete) onDelete();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose, onNext, onPrev, onDelete, isCropping, isSavingCrop]);

    // Reset zoom and position and crop when image changes
    useEffect(() => {
        setZoom(1);
        setPosition({ x: 0, y: 0 });
        setIsCropping(false);
        setCrop(undefined);
        setCompletedCrop(null);
        setTargetW('');
        setTargetH('');
    }, [image]);

    // Zoom Handler
    useEffect(() => {
        const handleWheel = (e) => {
            if (isCropping) return; // disable zoom while cropping
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const delta = e.deltaY * -0.001;
                setZoom(prev => {
                    return Math.max(0.1, Math.min(10, prev + delta * 2));
                });
            }
        };
        // Bind to window to capture all events in modal
        window.addEventListener('wheel', handleWheel, { passive: false });
        // Cleanup
        return () => window.removeEventListener('wheel', handleWheel);
    }, [isCropping]);

    // --- Drag Handlers ---
    const handleMouseDown = (e) => {
        if (isCropping) return;
        // Only allow left click drag
        if (e.button !== 0) return;

        e.preventDefault();
        e.stopPropagation();

        setIsDragging(true);
        dragStartRef.current = {
            x: e.clientX - position.x,
            y: e.clientY - position.y
        };
    };

    const handleMouseMove = (e) => {
        if (!isDragging || isCropping) return;
        e.preventDefault();

        setPosition({
            x: e.clientX - dragStartRef.current.x,
            y: e.clientY - dragStartRef.current.y
        });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    // Global listener for Drag
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

    // --- Crop Action Handlers ---
    const startCropping = (e) => {
        e.stopPropagation();
        setIsAutoPlay(false);
        setIsCropping(true);
        setZoom(1);
        setPosition({ x: 0, y: 0 });
        setAspect(undefined);
        setCrop({
            unit: '%',
            width: 100,
            height: 100,
            x: 0,
            y: 0
        });
        setCompletedCrop(null);
    };

    const handleAspectChange = (newAspect) => {
        setAspect(newAspect);

        if (newAspect) {
            const w = parseInt(targetW);
            const h = parseInt(targetH);
            if (!isNaN(w) && w > 0) {
                setTargetH(Math.round(w / newAspect).toString());
            } else if (!isNaN(h) && h > 0) {
                setTargetW(Math.round(h * newAspect).toString());
            }
        }

        if (imgRef.current) {
            const { width, height } = imgRef.current;
            if (newAspect) {
                // If we have an existing crop, try to center a new aspect crop of similar size (by width)
                // Otherwise use 90%
                let initWidth = completedCrop ? completedCrop.width : (width * 0.9);
                // Ensure the crop width doesn't cause the height to exceed the image height
                if (initWidth / newAspect > height) {
                    initWidth = height * newAspect;
                }
                const newCrop = centerCrop(
                    makeAspectCrop({ unit: 'px', width: initWidth }, newAspect, width, height),
                    width,
                    height
                );
                setCrop(newCrop);
                setCompletedCrop(newCrop); // immediately update completed crop so inputs sync
            }
            // If newAspect is undefined, we simply unlock, leaving current crop as is.
        }
    };

    const handleTargetWChange = (e) => {
        const val = e.target.value;
        setTargetW(val);
        const w = parseInt(val);
        if (!isNaN(w) && w > 0) {
            if (aspect) {
                setTargetH(Math.round(w / aspect).toString());
            } else {
                const h = parseInt(targetH);
                if (!isNaN(h) && h > 0) {
                    handleAspectChange(w / h);
                }
            }
        }
    };

    const handleTargetHChange = (e) => {
        const val = e.target.value;
        setTargetH(val);
        const h = parseInt(val);
        if (!isNaN(h) && h > 0) {
            if (aspect) {
                setTargetW(Math.round(h * aspect).toString());
            } else {
                const w = parseInt(targetW);
                if (!isNaN(w) && w > 0) {
                    handleAspectChange(w / h);
                }
            }
        }
    };

    const cancelCrop = (e) => {
        if (e) e.stopPropagation();
        setIsCropping(false);
    };

    const saveCrop = async (e) => {
        e.stopPropagation();
        if (!completedCrop || completedCrop.width <= 0 || completedCrop.height <= 0) {
            cancelCrop();
            return;
        }

        if (!imgRef.current) return;

        // the crop library gives us completedCrop in absolute pixel values that relative to the scaled CSS display size.
        // We must map these CSS pixels to the natural native pixels of the original image to send to backend.
        const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
        const scaleY = imgRef.current.naturalHeight / imgRef.current.height;

        const cropData = {
            x: Math.round(completedCrop.x * scaleX),
            y: Math.round(completedCrop.y * scaleY),
            width: Math.round(completedCrop.width * scaleX),
            height: Math.round(completedCrop.height * scaleY),
            targetWidth: parseInt(targetW) || null,
            targetHeight: parseInt(targetH) || null
        };

        setIsSavingCrop(true);
        try {
            const result = await window.electron.cropImage(image.path, cropData);
            if (result.success) {
                cancelCrop(e);
            } else {
                alert('Crop Failed: ' + result.error);
            }
        } catch (err) {
            console.error(err);
            alert('Crop Failed');
        } finally {
            setIsSavingCrop(false);
        }
    };

    const isVideo = image?.path && /\.(mp4|webm|mov|mkv)$/i.test(image.path);

    if (!image) return null;

    return (
        <div
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center cursor-default overflow-hidden"
            onClick={onClose} // Click backdrop to close
        >
            {/* Top Bar Controls */}
            <div className="absolute top-6 left-6 flex gap-2 z-[60] no-drag">
                {/* Close Button */}
                <button
                    onClick={(e) => { e.stopPropagation(); onClose(); setIsAutoPlay(false); }}
                    className="text-white/80 hover:text-white p-2.5 rounded-full hover:bg-black/20 transition-all drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                    title="Close (Esc)"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                {/* Favorite Button */}
                <button
                    onClick={toggleFavorite}
                    className={`p-2.5 rounded-full hover:bg-black/20 transition-all flex items-center justify-center drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] ${isFav ? 'text-[#A61616] drop-shadow-none' : 'text-white/80 hover:text-white'}`}
                    title={isFav ? "Unfavorite" : "Favorite"}
                >
                    <Heart className="h-6 w-6" fill={isFav ? "currentColor" : "none"} strokeWidth={2} />
                </button>

                {/* Crop Button */}
                {!isVideo && (
                    <button
                        onClick={startCropping}
                        className={`p-2.5 rounded-full hover:bg-black/20 transition-all flex items-center justify-center drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] ${isCropping ? 'text-blue-400 drop-shadow-none bg-black/40' : 'text-white/80 hover:text-white'}`}
                        title="Crop Image"
                    >
                        <Crop className="h-6 w-6" strokeWidth={2} />
                    </button>
                )}

                {/* Auto Play Button */}
                <button
                    onClick={(e) => { e.stopPropagation(); setIsAutoPlay(!isAutoPlay); }}
                    className={`p-2.5 rounded-full hover:bg-black/20 transition-all flex items-center justify-center drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] ${isAutoPlay ? 'text-blue-400 drop-shadow-none bg-black/40' : 'text-white/80 hover:text-white'}`}
                    title={isAutoPlay ? "Stop AutoPlay" : "Start AutoPlay"}
                >
                    {isAutoPlay ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                        </svg>
                    )}
                </button>
            </div>

            {/* Main Content (Image or Video) */}
            <div
                className="w-full h-full flex items-center justify-center pointer-events-none"
            >
                {isVideo ? (
                    <video
                        src={image.url}
                        controls
                        autoPlay
                        className="w-full h-full object-contain pointer-events-auto"
                        onClick={(e) => e.stopPropagation()}
                    />
                ) : (
                    <div style={{
                        transform: !isCropping ? `translate(${position.x}px, ${position.y}px) scale(${zoom})` : 'none',
                        transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                        cursor: isDragging ? 'grabbing' : (isCropping ? 'default' : 'grab'),
                    }}
                        className={`pointer-events-auto h-full w-full flex items-center justify-center ${isCropping ? 'px-16 py-16' : ''}`}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={!isCropping ? handleMouseDown : undefined}>
                        {isCropping ? (
                            <ReactCrop
                                crop={crop}
                                onChange={(_, percentCrop) => setCrop(percentCrop)}
                                onComplete={(c) => setCompletedCrop(c)}
                                aspect={aspect}
                                style={{ display: 'flex' }}
                            >
                                <img
                                    ref={imgRef}
                                    src={image.url}
                                    alt={image.name}
                                    style={{ maxHeight: 'calc(100vh - 8rem)', maxWidth: 'calc(100vw - 8rem)', objectFit: 'contain' }}
                                    className="select-none"
                                    onLoad={(e) => {
                                        // Auto-generate full-size bounding box initially 
                                        setCrop({
                                            unit: '%',
                                            width: 100,
                                            height: 100,
                                            x: 0,
                                            y: 0
                                        });
                                    }}
                                />
                            </ReactCrop>
                        ) : (
                            <img
                                ref={imgRef}
                                src={image.url}
                                alt={image.name}
                                className="w-full h-full object-contain select-none"
                            />
                        )}
                    </div>
                )}
            </div>

            {/* Action bar for crop - placed at bottom center (floating over) */}
            {isCropping && (
                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-neutral-900 border border-neutral-700 p-2 rounded-lg flex flex-col gap-2 shadow-xl z-[80] transition-colors" onClick={(e) => e.stopPropagation()}>
                    {/* Aspect Ratios Row */}
                    <div className="flex flex-wrap items-center justify-center gap-2 pb-2 border-b border-neutral-800 px-2">
                        <button onClick={() => handleAspectChange(undefined)} className={`px-2 py-1 text-xs rounded transition-colors ${aspect === undefined ? 'text-blue-400 bg-neutral-800 font-medium' : 'text-gray-400 hover:bg-neutral-800'}`}>Free</button>
                        <button onClick={() => handleAspectChange(1)} className={`px-2 py-1 text-xs rounded transition-colors ${aspect === 1 ? 'text-blue-400 bg-neutral-800 font-medium' : 'text-gray-400 hover:bg-neutral-800'}`}>1:1</button>
                        <button onClick={() => handleAspectChange(4 / 3)} className={`px-2 py-1 text-xs rounded transition-colors ${aspect === 4 / 3 ? 'text-blue-400 bg-neutral-800 font-medium' : 'text-gray-400 hover:bg-neutral-800'}`}>4:3</button>
                        <button onClick={() => handleAspectChange(16 / 9)} className={`px-2 py-1 text-xs rounded transition-colors ${aspect === 16 / 9 ? 'text-blue-400 bg-neutral-800 font-medium' : 'text-gray-400 hover:bg-neutral-800'}`}>16:9</button>
                        <button onClick={() => handleAspectChange(3 / 4)} className={`px-2 py-1 text-xs rounded transition-colors ${aspect === 3 / 4 ? 'text-blue-400 bg-neutral-800 font-medium' : 'text-gray-400 hover:bg-neutral-800'}`}>3:4</button>
                        <button onClick={() => handleAspectChange(9 / 16)} className={`px-2 py-1 text-xs rounded transition-colors ${aspect === 9 / 16 ? 'text-blue-400 bg-neutral-800 font-medium' : 'text-gray-400 hover:bg-neutral-800'}`}>9:16</button>

                        <div className="w-px h-4 bg-neutral-700 mx-1 hidden md:block"></div>
                        <div className="flex items-center gap-1">
                            <span className="text-gray-400 text-xs hidden md:inline ml-1">Export Size:</span>
                            <input type="number" value={targetW} onChange={handleTargetWChange} className="w-16 bg-neutral-800 text-gray-300 text-xs px-1.5 py-1 rounded border border-neutral-700 focus:outline-none focus:border-blue-500" placeholder="Auto" />
                            <span className="text-gray-500 text-xs">x</span>
                            <input type="number" value={targetH} onChange={handleTargetHChange} disabled={!!aspect} className={`w-16 bg-neutral-800 text-xs px-1.5 py-1 rounded border border-neutral-700 focus:outline-none focus:border-blue-500 ${aspect ? 'text-gray-500 opacity-70 cursor-not-allowed' : 'text-gray-300'}`} placeholder="Auto" title={aspect ? "Height is locked by Aspect Ratio" : "Height"} />
                            <span className="text-gray-500 text-xs ml-1">px</span>
                        </div>
                    </div>
                    {/* Action Row */}
                    <div className="flex items-center justify-center gap-3 pt-1 px-2">
                        <span className="text-gray-400 text-xs px-2 whitespace-nowrap hidden md:inline">Drag inwards to crop</span>
                        <div className="w-px h-4 bg-neutral-700 hidden md:block"></div>
                        <button onClick={cancelCrop} disabled={isSavingCrop} className="px-3 py-1.5 rounded hover:bg-neutral-800 text-gray-400 hover:text-white transition-colors flex items-center gap-1 text-sm">
                            <XIcon size={14} /> Cancel
                        </button>
                        <button onClick={saveCrop} disabled={isSavingCrop || !completedCrop} className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-800 disabled:text-gray-500 text-white transition-colors flex items-center gap-1 text-sm">
                            <Check size={14} /> {isSavingCrop ? 'Saving...' : 'Save Crop'}
                        </button>
                    </div>
                </div>
            )}

            {/* Navigation Areas (hidden during crop) */}
            {!isCropping && (
                <>
                    <div
                        className="absolute left-0 top-0 bottom-0 w-24 hover:bg-white/5 flex items-center justify-center cursor-pointer group transition-colors"
                        onClick={(e) => { e.stopPropagation(); onPrev(); }}
                    >
                        <div className="opacity-0 group-hover:opacity-100 text-white text-4xl">‹</div>
                    </div>
                    <div
                        className="absolute right-0 top-0 bottom-0 w-24 hover:bg-white/5 flex items-center justify-center cursor-pointer group transition-colors z-[55]"
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

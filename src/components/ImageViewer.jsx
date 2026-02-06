import React, { useEffect, useState, useRef } from 'react'

const ImageViewer = ({ image, onClose, onNext, onPrev, onDelete }) => {
    const [zoom, setZoom] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef({ x: 0, y: 0 });

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowRight') onNext();
            if (e.key === 'ArrowLeft') onPrev();
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (onDelete) onDelete();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose, onNext, onPrev, onDelete]);

    // Reset zoom and position when image changes
    useEffect(() => {
        setZoom(1);
        setPosition({ x: 0, y: 0 });
    }, [image]);

    // Zoom Handler
    useEffect(() => {
        const handleWheel = (e) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const delta = e.deltaY * -0.001;
                setZoom(prev => {
                    // Zoom logic
                    const newZoom = Math.max(0.1, Math.min(10, prev + delta * 2));

                    // Optional: If zooming out to near 1, we could center?
                    // For now, let's just let it be. behavior similar to windows photos:
                    // If zoom goes < 1, it allows it.
                    return newZoom;
                });
            }
        };
        // Bind to window to capture all events in modal
        window.addEventListener('wheel', handleWheel, { passive: false });
        // Cleanup
        return () => window.removeEventListener('wheel', handleWheel);
    }, []);

    // --- Drag Handlers ---
    const handleMouseDown = (e) => {
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
        if (!isDragging) return;
        e.preventDefault();

        setPosition({
            x: e.clientX - dragStartRef.current.x,
            y: e.clientY - dragStartRef.current.y
        });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    // Global listener for Drag (to handle drag outside image bounds)
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

    const isVideo = image?.path && /\.(mp4|webm|mov|mkv)$/i.test(image.path);

    if (!image) return null;

    return (
        <div
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center cursor-default overflow-hidden"
            onClick={onClose} // Click backdrop to close
        >
            {/* Close Button - Moved to LEFT to avoid conflict with native window controls (TitleBarOverlay) */}
            <button
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                className="absolute top-4 left-4 text-white/70 hover:text-white z-[60] p-2"
                title="Close (Esc)"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>

            {/* Main Content (Image or Video) */}
            <div
                className="w-full h-full flex items-center justify-center pointer-events-none"
            >
                {isVideo ? (
                    <video
                        src={image.url}
                        controls
                        autoPlay
                        className="max-h-screen max-w-screen object-contain pointer-events-auto"
                        onClick={(e) => e.stopPropagation()}
                    />
                ) : (
                    <img
                        src={image.url}
                        alt={image.name}
                        style={{
                            transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                            cursor: isDragging ? 'grabbing' : 'grab' // Always show grab
                        }}
                        className="max-h-screen max-w-screen object-contain select-none pointer-events-auto"
                        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking image
                        onMouseDown={handleMouseDown}
                    />
                )}
            </div>

            {/* Navigation Areas */}
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


        </div>
    )
}

export default ImageViewer

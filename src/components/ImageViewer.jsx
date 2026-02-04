import React, { useEffect } from 'react'

const ImageViewer = ({ image, onClose, onNext, onPrev }) => {
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowRight') onNext();
            if (e.key === 'ArrowLeft') onPrev();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose, onNext, onPrev]);

    const [zoom, setZoom] = React.useState(1);

    // Reset zoom when image changes
    useEffect(() => {
        setZoom(1);
    }, [image]);

    // Zoom Handler
    useEffect(() => {
        const handleWheel = (e) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const delta = e.deltaY * -0.001;
                setZoom(prev => Math.max(0.1, Math.min(10, prev + delta * 2))); // Faster zoom
            }
        };
        // Bind to window to capture all events in modal
        window.addEventListener('wheel', handleWheel, { passive: false });
        // Cleanup
        return () => window.removeEventListener('wheel', handleWheel);
    }, []);

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

            {/* Main Image */}
            <div
                className="w-full h-full flex items-center justify-center pointer-events-none" // pointer-events-none on wrapper to pass clicks to backdrop? No, image might need interactions. 
            // Actually if we want to drag later we need interactions. The img has stopPropagation on click anyway.
            >
                <img
                    src={image.url}
                    alt={image.name}
                    style={{ transform: `scale(${zoom})`, transition: 'transform 0.1s ease-out' }}
                    className="max-h-screen max-w-screen object-contain select-none pointer-events-auto"
                    onClick={(e) => e.stopPropagation()} // Prevent closing when clicking image
                />
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
                // Right nav might overlap close button if not careful, but close button is z-[60] now.
                onClick={(e) => { e.stopPropagation(); onNext(); }}
            >
                <div className="opacity-0 group-hover:opacity-100 text-white text-4xl">›</div>
            </div>

            {/* Footer Info & Zoom Level */}
            <div
                className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 px-4 py-2 rounded-full text-white text-sm flex gap-4"
                onClick={(e) => e.stopPropagation()}
            >
                <span>{image.name}</span>
                <span className="text-gray-400">{(zoom * 100).toFixed(0)}%</span>
            </div>
        </div>
    )
}

export default ImageViewer


import React, { useState, useEffect, useRef } from 'react';
import { FileSystem } from '../managers/FileSystem';

const Thumbnail = ({ src, path, alt, className, style, draggable, onDragStart }) => {
    const [thumbSrc, setThumbSrc] = useState(null); // Null means not loaded yet
    const [isVisible, setIsVisible] = useState(false);
    const [thumbFit, setThumbFit] = useState(() => localStorage.getItem('settings_thumb_fit') || 'cover');
    const imgRef = useRef(null);
    const videoRef = useRef(null);

    const isVideo = path && /\.(mp4|webm|mov|mkv)$/i.test(path);

    useEffect(() => {
        const handleSettingsUpdate = () => {
            setThumbFit(localStorage.getItem('settings_thumb_fit') || 'cover');
        };
        window.addEventListener('settings-updated', handleSettingsUpdate);
        return () => window.removeEventListener('settings-updated', handleSettingsUpdate);
    }, []);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                setIsVisible(entry.isIntersecting);
            },
            { rootMargin: '400px' } // Preload buffer
        );

        if (imgRef.current) {
            observer.observe(imgRef.current);
        }

        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const reloadThumbnail = async (timestamp) => {
            window.imageTimestamps = window.imageTimestamps || {};
            window.imageTimestamps[path] = timestamp;

            if (thumbSrc) {
                try {
                    const preferredSize = parseInt(localStorage.getItem('settings_thumb_size')) || 600;
                    const t = await FileSystem.getThumbnail(path, preferredSize);
                    const base = t.split('?')[0];
                    setThumbSrc(`${base}?t=${timestamp}`);
                } catch (err) {
                    const base = src.split('?')[0];
                    setThumbSrc(`${base}?t=${timestamp}`);
                }
            }
        };

        const handleImageUpdated = (e) => {
            if (e.detail && e.detail.path === path) {
                reloadThumbnail(e.detail.timestamp);
            }
        };

        const handleFolderCleared = (e) => {
            if (e.detail && path && path.startsWith(e.detail.folder)) {
                reloadThumbnail(e.detail.timestamp);
            }
        };

        window.addEventListener('image-updated', handleImageUpdated);
        window.addEventListener('folder-thumbnails-cleared', handleFolderCleared);

        return () => {
            window.removeEventListener('image-updated', handleImageUpdated);
            window.removeEventListener('folder-thumbnails-cleared', handleFolderCleared);
        };
    }, [path, thumbSrc, src]);

    useEffect(() => {
        if (!isVisible) {
            // Unload to save VRAM when out of view
            setThumbSrc(null);
            return;
        }

        if (!path || isVideo) return;

        let active = true;

        const load = async () => {
            try {
                // Request thumbnail from backend
                const preferredSize = parseInt(localStorage.getItem('settings_thumb_size')) || 600;
                let t = await FileSystem.getThumbnail(path, preferredSize);

                // Append global timestamp if available
                if (window.imageTimestamps && window.imageTimestamps[path]) {
                    const base = t.split('?')[0];
                    t = `${base}?t=${window.imageTimestamps[path]}`;
                }

                if (active) setThumbSrc(t);
            } catch (e) {
                // Fallback to original
                let fallback = src;
                if (window.imageTimestamps && window.imageTimestamps[path]) {
                    const base = src.split('?')[0];
                    fallback = `${base}?t=${window.imageTimestamps[path]}`;
                }
                if (active) setThumbSrc(fallback);
            }
        };

        load();

        return () => { active = false; };
    }, [isVisible, path, src, isVideo]);

    const handleMouseEnter = () => {
        if (isVideo && videoRef.current) {
            videoRef.current.play().catch(e => {/* Auto-play prevented */ });
        }
    };

    const handleMouseLeave = () => {
        if (isVideo && videoRef.current) {
            videoRef.current.pause();
            videoRef.current.currentTime = 0;
        }
    };

    if (isVideo) {
        return (
            <div
                ref={imgRef}
                className={`relative w-full h-full bg-black ${className}`}
                style={style}
                draggable={draggable}
                onDragStart={onDragStart}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                {isVisible ? (
                    <video
                        ref={videoRef}
                        src={src}
                        className={`w-full h-full ${thumbFit === 'contain' ? 'object-contain' : 'object-cover'}`}
                        preload="metadata"
                        muted
                        playsInline
                        loop
                    />
                ) : null}

                {/* Play Icon Overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-white/70">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 opacity-50">
                        <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
                    </svg>
                </div>
            </div>
        );
    }

    return (
        <img
            ref={imgRef}
            src={isVisible && thumbSrc ? thumbSrc : 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'}
            alt={alt}
            className={`${thumbFit === 'contain' ? 'object-contain' : 'object-cover'} w-full h-full transition-opacity duration-300 ${className} ${!thumbSrc && isVisible ? 'opacity-0' : 'opacity-100'}`}
            style={style}
            draggable={draggable}
            onDragStart={onDragStart}
        />
    );
};

export default Thumbnail;

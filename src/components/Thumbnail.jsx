
import React, { useState, useEffect, useRef } from 'react';
import { FileSystem } from '../managers/FileSystem';

const Thumbnail = ({ src, path, alt, className, style, draggable, onDragStart }) => {
    const [thumbSrc, setThumbSrc] = useState(null); // Null means not loaded yet
    const [isVisible, setIsVisible] = useState(false);
    const imgRef = useRef(null);
    const videoRef = useRef(null);

    const isVideo = path && /\.(mp4|webm|mov|mkv)$/i.test(path);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.disconnect();
                }
            },
            { rootMargin: '200px' } // Preload when close
        );

        if (imgRef.current) {
            observer.observe(imgRef.current);
        }

        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!isVisible || !path || isVideo) return; // Skip thumbnail fetch for videos (they use src directly)

        let active = true;

        const load = async () => {
            try {
                // Request thumbnail from backend
                const t = await FileSystem.getThumbnail(path);
                if (active) setThumbSrc(t);
            } catch (e) {
                // Fallback to original
                if (active) setThumbSrc(src);
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
                        className="w-full h-full object-cover"
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
            src={isVisible ? (thumbSrc || src) : 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'}
            alt={alt}
            className={`object-cover w-full h-full ${className} ${!thumbSrc && isVisible ? 'opacity-50 blur-sm' : ''}`}
            style={style}
            draggable={draggable}
            onDragStart={onDragStart}
            loading="lazy"
        />
    );
};

export default Thumbnail;


import React, { useState, useEffect, useRef } from 'react';
import { FileSystem } from '../managers/FileSystem';

const Thumbnail = ({ src, path, alt, className, style, draggable, onDragStart }) => {
    const [thumbSrc, setThumbSrc] = useState(null); // Null means not loaded yet
    const [isVisible, setIsVisible] = useState(false);
    const imgRef = useRef(null);

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
        if (!isVisible || !path) return;

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
    }, [isVisible, path, src]);

    return (
        <img
            ref={imgRef}


            // Revised Logic for src:
            // If not visible: blank/placeholder.
            // If visible & thumbSrc: thumbSrc.
            // If visible & !thumbSrc: loading... then thumbSrc.

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

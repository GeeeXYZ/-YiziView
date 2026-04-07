import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PluginEngine } from '@/managers/PluginEngine';

export default function DynamicBottomDock() {
    const [components, setComponents] = useState([]);
    const [height, setHeight] = useState(() => {
        return parseInt(localStorage.getItem('yizi_bottom_dock_height')) || 300;
    });
    const [isResizing, setIsResizing] = useState(false);
    const containerRef = useRef(null);

    // Subscribe to PluginEngine for bottom-dock components
    useEffect(() => {
        const updateComponents = () => {
            setComponents(PluginEngine.getComponents('bottom-dock'));
        };
        updateComponents();
        return PluginEngine.subscribe('bottom-dock', updateComponents);
    }, []);

    const handleMouseDown = useCallback((e) => {
        e.preventDefault();
        setIsResizing(true);
        document.body.style.cursor = 'row-resize';
    }, []);

    const handleMouseMove = useCallback((e) => {
        if (!isResizing) return;
        
        // Calculate new height from the bottom of the window
        // e.clientY is relative to the top of the viewport
        const newHeight = window.innerHeight - e.clientY;
        
        // Constrain height between 50px and 80% of window height
        if (newHeight >= 50 && newHeight <= window.innerHeight * 0.8) {
            setHeight(newHeight);
        }
    }, [isResizing]);

    const handleMouseUp = useCallback(() => {
        if (!isResizing) return;
        setIsResizing(false);
        document.body.style.cursor = 'default';
        // Persist the user's preferred dock height
        localStorage.setItem('yizi_bottom_dock_height', height.toString());
    }, [isResizing, height]);

    useEffect(() => {
        if (isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing, handleMouseMove, handleMouseUp]);

    // If no plugins register to this dock, fully collapse and hide it
    if (components.length === 0) return null;

    return (
        <div 
            ref={containerRef}
            className="flex flex-col relative shrink-0 bg-[#0a0a0a] border-t-2 border-neutral-700 z-40 transition-[height] duration-0"
            style={{ height: `${height}px` }}
        >
            {/* 隐形 Resize Handle (靠容器自身的 border 提供 1px 视觉) */}
            <div 
                className="absolute top-0 left-0 w-full h-1.5 cursor-row-resize bg-transparent hover:bg-blue-500/80 transition-colors z-50 no-drag -translate-y-1/2"
                onMouseDown={handleMouseDown}
                title="Drag to resize pane"
            />

            {/* 容器网格，当存在多个停靠项时均分横向空间 */}
            <div className="flex-1 w-full h-full overflow-hidden relative flex flex-row">
                {components.map((Comp, idx) => (
                    <div key={idx} className="flex-1 h-full relative overflow-hidden border-r border-neutral-800/50 last:border-r-0">
                        <Comp />
                    </div>
                ))}
            </div>
        </div>
    );
}

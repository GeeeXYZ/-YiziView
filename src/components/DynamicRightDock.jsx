import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PluginEngine } from '@/managers/PluginEngine';

export default function DynamicRightDock() {
    const [components, setComponents] = useState([]);
    const [isResizing, setIsResizing] = useState(false);
    const containerRef = useRef(null);

    // Get the currently active component (should be only one now)
    const activeComponent = components.length > 0 ? components[components.length - 1] : null;
    const activeName = activeComponent ? (activeComponent.displayName || activeComponent.name || 'default') : 'default';

    const [width, setWidth] = useState(350);

    // Subscribe to PluginEngine for right-dock components
    useEffect(() => {
        const updateComponents = () => {
            setComponents(PluginEngine.getComponents('right-dock'));
        };
        updateComponents();
        return PluginEngine.subscribe('right-dock', updateComponents);
    }, []);

    // Load independent width when the active component changes
    useEffect(() => {
        if (activeComponent) {
            const savedWidth = parseInt(localStorage.getItem(`yizi_right_dock_width_${activeName}`));
            if (savedWidth) {
                setWidth(savedWidth);
            } else if (activeName === 'BgRemoverWidget') {
                setWidth(Math.round(window.innerWidth * 0.16));
            } else {
                setWidth(350);
            }
        }
    }, [activeName, activeComponent]);

    const handleMouseDown = useCallback((e) => {
        e.preventDefault();
        setIsResizing(true);
        document.body.style.cursor = 'col-resize';
    }, []);

    const handleMouseMove = useCallback((e) => {
        if (!isResizing) return;
        
        // Calculate new width from the right of the window
        // e.clientX is relative to the left of the viewport
        const newWidth = window.innerWidth - e.clientX;
        
        // Constrain width between 150px and 60% of window width
        if (newWidth >= 150 && newWidth <= window.innerWidth * 0.6) {
            setWidth(newWidth);
        }
    }, [isResizing]);

    const handleMouseUp = useCallback(() => {
        if (!isResizing) return;
        setIsResizing(false);
        document.body.style.cursor = 'default';
        // Persist the user's preferred dock width for this specific plugin
        if (activeName) {
            localStorage.setItem(`yizi_right_dock_width_${activeName}`, width.toString());
        }
    }, [isResizing, width, activeName]);

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
            className="flex flex-col relative shrink-0 z-40 transition-[width] duration-0"
            style={{ width: `${width}px` }}
        >
            {/* 隐形 Resize Handle (依然覆盖全局) */}
            <div 
                className="absolute top-0 left-0 w-1.5 h-full cursor-col-resize bg-transparent hover:bg-blue-500/80 transition-colors z-50 no-drag -translate-x-1/2"
                onMouseDown={handleMouseDown}
                title="Drag to resize right pane"
            />

            {/* 容器网格，当存在多个停靠项时均分纵向空间，分离线从这里开始 */}
            <div className="flex-1 w-full h-full overflow-hidden relative flex flex-col border-l-2 border-neutral-700 bg-[#0a0a0a]">
                {components.map((Comp, idx) => (
                    <div key={idx} className="flex-1 w-full relative overflow-hidden border-b border-neutral-800/50 last:border-b-0">
                        <Comp />
                    </div>
                ))}
            </div>
        </div>
    );
}

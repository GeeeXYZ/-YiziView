import { React, el, Sparkles, Wand2, Workflow, LayoutTemplate, Settings, ChevronLeft, X } from '../core/globals.js';
import { useSettings } from '../core/useSettings.js';
import { getTheme } from './theme.js';

export const FloatingToolkit = () => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [isAnimatingIn, setIsAnimatingIn] = React.useState(false);
    const [activeTool, setActiveTool] = React.useState(null);
    const [LoadedComponent, setLoadedComponent] = React.useState(null);
    const [pos, setPos] = React.useState({ x: 0, y: 0 });
    const [height, setHeight] = React.useState(640);
    
    // Performance Optimization: Direct DOM refs for 60fps drag/resize
    const outerRef = React.useRef(null);
    const innerRef = React.useRef(null);
    const posRef = React.useRef({ x: 0, y: 0 });
    const heightRef = React.useRef(640);
    
    // Sync React state to Refs on mount/update
    React.useEffect(() => { posRef.current = pos; }, [pos]);
    React.useEffect(() => { heightRef.current = height; }, [height]);

    const draggingRef = React.useRef({ isDragging: false, startX: 0, startY: 0, initialPos: { x: 0, y: 0 } });
    const resizingRef = React.useRef({ isResizing: false, startY: 0, initialHeight: 0 });
    const resizingBottomRef = React.useRef({ isResizing: false, startY: 0, initialHeight: 0, initialPos: { x: 0, y: 0 } });
    const [settings] = useSettings();
    const theme = getTheme(settings?.theme || 'dark');

    // Trigger animation when radial menu opens
    React.useEffect(() => {
        if (isOpen && !activeTool) {
            const frameId = requestAnimationFrame(() => {
                setIsAnimatingIn(true);
            });
            return () => cancelAnimationFrame(frameId);
        } else {
            setIsAnimatingIn(false);
        }
    }, [isOpen, activeTool]);

    // Tools definition mapping to settings keys for custom colors
    const TOOLS = [
        { id: 'run', title: 'COMFYUI', desc: 'ComfyUI Workflow', icon: Workflow, settingKey: 'themeComfyUI', fallbackColor: '#34d399' },
        { id: 'gen', title: 'AI ENGINE', desc: 'Grsai Generation', icon: Sparkles, settingKey: 'themeGrsai', fallbackColor: '#a78bfa' },
        { id: 'card', title: 'CARD LAYOUT', desc: 'Poster Layout', icon: LayoutTemplate, settingKey: 'themeCard', fallbackColor: '#fbbf24' },
        { id: 'settings', title: 'SETTINGS', desc: 'Global Settings', icon: Settings, settingKey: 'themeSystem', fallbackColor: '#ffffff' }
    ];

    // Lazy load specific tools
    React.useEffect(() => {
        let isMounted = true;
        if (!activeTool) {
            setLoadedComponent(null);
            return;
        }

        const load = async () => {
            try {
                let mod;
                if (activeTool === 'run') mod = await import('./AIToolkit/ComfyUITab.js');
                else if (activeTool === 'gen') mod = await import('./AIToolkit/GrsaiTab.js');
                else if (activeTool === 'card') mod = await import('./CardLayout/index.js');
                else if (activeTool === 'settings') mod = await import('./GlobalSettings.js');

                if (isMounted && mod) {
                    // Provide a wrapper if it's not default exported
                    const Comp = mod.default || mod[Object.keys(mod)[0]];
                    setLoadedComponent(() => Comp);
                }
            } catch (e) {
                console.error("Failed to load tool", e);
                if (isMounted) setLoadedComponent(() => () => el('div', { className: 'p-4 text-[#ef4444]' }, '加载失败'));
            }
        };
        load();
        return () => { isMounted = false; };
    }, [activeTool]);

    // FAB (Floating Action Button) State
    if (!isOpen) {
        return el('button', {
            onClick: () => setIsOpen(true),
            className: `fixed bottom-8 right-8 w-14 h-14 rounded-full text-black flex items-center justify-center transition-transform hover:scale-110 active:scale-95 z-[9999] pointer-events-auto`,
            style: { backgroundColor: settings?.themeSystem || '#ffffff' },
            title: "Yizi Toolkit"
        }, 
            el(Sparkles, { size: 24, fill: "currentColor", strokeWidth: 0 })
        );
    }

    // Radial Menu State
    if (isOpen && !activeTool) {
        const RADIUS = 85; // px radius for the fan-out
        return el('div', {
            className: "fixed bottom-8 right-8 w-14 h-14 z-[9999] pointer-events-none"
        },
            // Main Close Button
            el('button', {
                onClick: () => setIsOpen(false),
                className: "absolute inset-0 w-full h-full rounded-full bg-black text-white flex items-center justify-center transition-transform hover:scale-110 active:scale-95 pointer-events-auto z-50",
                title: "关闭"
            }, el(X, { size: 24, strokeWidth: 1.2 })),
            
            // Radial Items
            TOOLS.map((tool, idx) => {
                const angleDeg = 90 + (90 / (TOOLS.length - 1)) * idx; // Arc from 90 to 180 degrees
                const angleRad = (angleDeg * Math.PI) / 180;
                
                // Final positions
                const targetX = Math.cos(angleRad) * RADIUS; // Negative X (left)
                const targetY = -Math.sin(angleRad) * RADIUS; // Negative Y (up)
                
                // Current animated positions
                const currentX = isAnimatingIn ? targetX : 0;
                const currentY = isAnimatingIn ? targetY : 0;
                const opacity = isAnimatingIn ? 1 : 0;
                const scale = isAnimatingIn ? 1 : 0;
                
                const toolBgColor = tool.settingKey ? (settings[tool.settingKey] || tool.fallbackColor) : '#ffffff';
                const toolThemeClass = 'text-black';

                return el('div', {
                    key: tool.id,
                    className: "absolute top-1 left-1 w-12 h-12 pointer-events-none transition-all duration-300 ease-out",
                    style: {
                        transform: `translate(${currentX}px, ${currentY}px) scale(${scale})`,
                        opacity: opacity,
                        transitionDelay: `${idx * 0.04}s`
                    }
                },
                    el('button', {
                        onClick: () => setActiveTool(tool.id),
                        className: `w-full h-full rounded-full shadow-lg flex items-center justify-center pointer-events-auto transition-transform hover:scale-110 active:scale-95 ${toolThemeClass}`,
                        style: toolBgColor ? { backgroundColor: toolBgColor } : {},
                        title: tool.title
                    }, tool.icon ? el(tool.icon, { size: 20 }) : null)
                );
            })
        );
    }

    // Tool Interface State (Expanded App Mode)
    const activeData = TOOLS.find(t => t.id === activeTool);
    const activeBgColor = activeData.settingKey ? (settings[activeData.settingKey] || activeData.fallbackColor) : '#ffffff';

    // Dragging Logic
    const handleDragStart = (e) => {
        if (e.button !== 0 || e.target.closest('button')) return;
        e.stopPropagation();
        e.preventDefault();
        draggingRef.current = { isDragging: true, startX: e.clientX, startY: e.clientY, initialPos: { ...posRef.current } };
        
        const handleDragMove = (moveEvent) => {
            if (!draggingRef.current.isDragging) return;
            moveEvent.stopPropagation();
            moveEvent.preventDefault();
            const newX = draggingRef.current.initialPos.x + (moveEvent.clientX - draggingRef.current.startX);
            const newY = draggingRef.current.initialPos.y + (moveEvent.clientY - draggingRef.current.startY);
            posRef.current = { x: newX, y: newY };
            if (outerRef.current) outerRef.current.style.transform = `translate(${newX}px, ${newY}px)`;
        };
        const handleDragEnd = (upEvent) => {
            if (!draggingRef.current.isDragging) return;
            draggingRef.current.isDragging = false;
            upEvent.stopPropagation();
            setPos(posRef.current); // Persist state
            window.removeEventListener('mousemove', handleDragMove, { capture: true });
            window.removeEventListener('mouseup', handleDragEnd, { capture: true });
        };
        window.addEventListener('mousemove', handleDragMove, { capture: true });
        window.addEventListener('mouseup', handleDragEnd, { capture: true });
    };

    // Resizing Logic (Top Edge)
    const handleResizeStart = (e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        e.preventDefault();
        resizingRef.current = { isResizing: true, startY: e.clientY, initialHeight: heightRef.current };
        
        const handleResizeMove = (moveEvent) => {
            if (!resizingRef.current.isResizing) return;
            moveEvent.stopPropagation();
            moveEvent.preventDefault();
            const dy = moveEvent.clientY - resizingRef.current.startY;
            const newHeight = Math.max(400, Math.min(window.innerHeight - 40, resizingRef.current.initialHeight - dy));
            heightRef.current = newHeight;
            if (innerRef.current) innerRef.current.style.height = `${newHeight}px`;
        };
        const handleResizeEnd = (upEvent) => {
            if (!resizingRef.current.isResizing) return;
            resizingRef.current.isResizing = false;
            upEvent.stopPropagation();
            setHeight(heightRef.current); // Persist state
            window.removeEventListener('mousemove', handleResizeMove, { capture: true });
            window.removeEventListener('mouseup', handleResizeEnd, { capture: true });
        };
        window.addEventListener('mousemove', handleResizeMove, { capture: true });
        window.addEventListener('mouseup', handleResizeEnd, { capture: true });
    };

    // Resizing Logic (Bottom Edge)
    const handleResizeBottomStart = (e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        e.preventDefault();
        resizingBottomRef.current = { isResizing: true, startY: e.clientY, initialHeight: heightRef.current, initialPos: { ...posRef.current } };
        
        const handleResizeBottomMove = (moveEvent) => {
            if (!resizingBottomRef.current.isResizing) return;
            moveEvent.stopPropagation();
            moveEvent.preventDefault();
            const dy = moveEvent.clientY - resizingBottomRef.current.startY;
            // When anchored to bottom, increasing height moves the top edge up. 
            // To stretch the bottom edge down, we increase height AND move the container down by the same amount.
            let newHeight = resizingBottomRef.current.initialHeight + dy;
            newHeight = Math.max(400, Math.min(window.innerHeight - 40, newHeight));
            const actualDy = newHeight - resizingBottomRef.current.initialHeight;
            const newY = resizingBottomRef.current.initialPos.y + actualDy;
            
            heightRef.current = newHeight;
            posRef.current = { x: posRef.current.x, y: newY };
            
            if (innerRef.current) innerRef.current.style.height = `${newHeight}px`;
            if (outerRef.current) outerRef.current.style.transform = `translate(${posRef.current.x}px, ${newY}px)`;
        };
        const handleResizeBottomEnd = (upEvent) => {
            if (!resizingBottomRef.current.isResizing) return;
            resizingBottomRef.current.isResizing = false;
            upEvent.stopPropagation();
            setHeight(heightRef.current);
            setPos(posRef.current);
            window.removeEventListener('mousemove', handleResizeBottomMove, { capture: true });
            window.removeEventListener('mouseup', handleResizeBottomEnd, { capture: true });
        };
        window.addEventListener('mousemove', handleResizeBottomMove, { capture: true });
        window.addEventListener('mouseup', handleResizeBottomEnd, { capture: true });
    };

    return el('div', {
        ref: outerRef,
        className: `fixed bottom-8 right-8 z-[9999] pointer-events-none origin-bottom-right`,
        style: { transform: `translate(${pos.x}px, ${pos.y}px)` }
    },
        el('div', {
            ref: innerRef,
            className: `w-[420px] rounded-[32px] shadow-[0_20px_60px_rgba(0,0,0,0.6)] flex flex-col pointer-events-auto animate-yizi-toolkit-pop origin-bottom-right overflow-hidden text-black relative`,
            style: { backgroundColor: activeBgColor, height: `${height}px` }
        },
            // Resize handle at top
            el('div', { 
                className: "absolute top-0 left-0 right-0 h-2 cursor-ns-resize z-[10000]", 
                onMouseDown: handleResizeStart
            }),
            
            // Resize handle at bottom
            el('div', { 
                className: "absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize z-[10000]", 
                onMouseDown: handleResizeBottomStart
            }),
            
            // Flat Header
            el('div', { 
                className: `flex items-center justify-between py-3 px-6 shrink-0 cursor-move`, 
                onMouseDown: handleDragStart
            },
                el('button', {
                    onClick: () => setActiveTool(null),
                    className: "flex items-center gap-1.5 font-black tracking-widest text-sm hover:opacity-70 active:scale-95 transition-all uppercase"
                },
                    el(ChevronLeft, { size: 18 }),
                    activeData.title
                ),
                el('button', {
                    onClick: () => { setIsOpen(false); setActiveTool(null); },
                    className: "w-8 h-8 rounded-full border border-black/80 hover:bg-black hover:text-white flex items-center justify-center transition-all active:scale-90 bg-transparent text-black"
                }, el(X, { size: 16 }))
            ),
            
            // Tool Content Area (transparent so it uses the parent's solid color)
            el('div', { className: `flex-1 overflow-y-auto yizi-toolkit-scrollbar relative px-2` },
                LoadedComponent
                    ? el(React.Suspense, { fallback: el('div', { className: "flex h-full items-center justify-center text-[#737373] text-sm font-medium" }, "加载中...") }, 
                        el(ToolWrapper, { Component: LoadedComponent })
                    )
                    : el('div', { className: "flex h-full items-center justify-center text-[#737373] text-sm font-medium" }, "载入中...")
            )
        )
    );
};

// Wrapper to inject useSettings hook into legacy components that expect props
const ToolWrapper = ({ Component }) => {
    const [settings, setSettings] = useSettings();
    return el(Component, { settings, setSettings });
};

import React, { useState, useEffect, useCallback } from 'react';
import { Columns, Rows, X, Plus, FolderPlus } from 'lucide-react';
import logo from '@/assets/logo.svg';

/**
 * SplitViewContainer - Manages multiple panels with resizable splits
 */
const SplitViewContainer = ({
    panels,
    layout,
    activePanelId,
    onLayoutChange,
    onAddPanel,
    onRemovePanel,
    onPanelActivate,
    renderPanel,
    onAddFolder,
    onOpenSettings,
    hasUpdate
}) => {
    const [panelSizes, setPanelSizes] = useState(
        panels.map(() => 100 / panels.length)
    );
    const [isResizing, setIsResizing] = useState(false);
    const [resizingIndex, setResizingIndex] = useState(null);

    const handleMouseDown = (index) => (e) => {
        e.preventDefault();
        setIsResizing(true);
        setResizingIndex(index);
        document.body.style.cursor = layout === 'horizontal' ? 'col-resize' : 'row-resize';
    };

    const handleMouseMove = useCallback((e) => {
        if (!isResizing || resizingIndex === null) return;

        const container = document.querySelector('.split-panels-container');
        if (!container) return;

        const rect = container.getBoundingClientRect();

        let percentage;
        if (layout === 'horizontal') {
            percentage = ((e.clientX - rect.left) / rect.width) * 100;
        } else {
            percentage = ((e.clientY - rect.top) / rect.height) * 100;
        }

        // Calculate new sizes
        const newSizes = [...panelSizes];
        const totalBefore = newSizes.slice(0, resizingIndex + 1).reduce((a, b) => a + b, 0);
        const diff = percentage - totalBefore;

        // Adjust current and next panel with constraints
        const minSize = 15; // Minimum 15%
        const maxSize = 85; // Maximum 85%

        const newCurrent = Math.max(minSize, Math.min(maxSize, newSizes[resizingIndex] + diff));
        const newNext = Math.max(minSize, Math.min(maxSize, newSizes[resizingIndex + 1] - diff));

        // Only update if both panels are within valid range
        if (newCurrent >= minSize && newNext >= minSize) {
            newSizes[resizingIndex] = newCurrent;
            newSizes[resizingIndex + 1] = newNext;
            setPanelSizes(newSizes);
        }
    }, [isResizing, resizingIndex, panelSizes, layout]);

    const handleMouseUp = useCallback(() => {
        setIsResizing(false);
        setResizingIndex(null);
        document.body.style.cursor = 'default';
    }, []);

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

    // Update sizes when panels change
    useEffect(() => {
        setPanelSizes(panels.map(() => 100 / panels.length));
    }, [panels.length]);

    const containerClass = layout === 'horizontal'
        ? 'flex flex-row h-full'
        : 'flex flex-col h-full';

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Top Bar with Logo and Controls */}
            <div className="h-12 border-b border-neutral-800 flex items-center justify-between px-4 bg-neutral-900/50 shrink-0 titlebar-drag-region">
                {/* Left: Logo and Add Folder */}
                <div className="flex items-center gap-3 no-drag">
                    <div className="relative cursor-pointer" onClick={onOpenSettings} title="Settings">
                        <img
                            src={logo}
                            alt="YiziView"
                            className="h-7 w-auto opacity-90 hover:opacity-100 transition-opacity"
                        />
                        {hasUpdate && (
                            <span className="absolute top-0 -right-1 flex h-2.5 w-2.5">
                                <span className="relative inline-flex rounded-full h-full w-full bg-red-500 border border-neutral-900 shadow-sm"></span>
                            </span>
                        )}
                    </div>
                    <div className="h-6 w-px bg-neutral-700"></div>
                    <button
                        onClick={onAddFolder}
                        className="bg-neutral-800 hover:bg-neutral-700 text-gray-300 hover:text-white text-xs py-1.5 px-3 rounded flex items-center gap-1.5 border border-neutral-700 transition-colors h-7"
                        title="Add Folder to Active Panel"
                    >
                        <FolderPlus size={14} /> Add Folder
                    </button>
                </div>

                {/* Center: Combined Layout and Panel Controls */}
                <div className="flex items-center gap-3 no-drag">
                    {/* Layout Switcher */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 font-medium">Layout:</span>
                        <div className="flex bg-neutral-900 rounded border border-neutral-700 p-1 gap-1">
                            <button
                                onClick={() => onLayoutChange('horizontal')}
                                className={`p-1.5 rounded transition-colors ${layout === 'horizontal'
                                    ? 'bg-neutral-700 text-white'
                                    : 'text-gray-500 hover:text-gray-300'
                                    }`}
                                title="Horizontal Split"
                            >
                                <Columns size={14} />
                            </button>
                            <button
                                onClick={() => onLayoutChange('vertical')}
                                className={`p-1.5 rounded transition-colors ${layout === 'vertical'
                                    ? 'bg-neutral-700 text-white'
                                    : 'text-gray-500 hover:text-gray-300'
                                    }`}
                                title="Vertical Split"
                            >
                                <Rows size={14} />
                            </button>
                        </div>
                    </div>

                    <div className="h-6 w-px bg-neutral-700"></div>

                    {/* Panel Controls */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 font-medium">Panels:</span>
                        <div className="flex items-center gap-2 bg-neutral-900 rounded border border-neutral-700 px-2 py-1">
                            <span className="text-xs text-gray-400">
                                {panels.length}
                            </span>
                            {panels.length < 3 && (
                                <>
                                    <div className="h-3 w-px bg-neutral-700"></div>
                                    <button
                                        onClick={onAddPanel}
                                        className="p-0.5 rounded hover:bg-neutral-700 text-blue-400 hover:text-blue-300 transition-colors"
                                        title="Add Panel (Ctrl+Shift+\)"
                                    >
                                        <Plus size={14} />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Spacer for window controls */}
                <div className="w-32"></div>
            </div>

            {/* Panels Container */}
            <div className={`${containerClass} split-panels-container`}>
                {panels.map((panel, index) => (
                    <React.Fragment key={panel.id}>
                        <div
                            style={{
                                [layout === 'horizontal' ? 'width' : 'height']: `${panelSizes[index]}%`,
                            }}
                            className="relative"
                        >
                            {renderPanel(panel, index)}

                            {/* Close button (only if more than 1 panel) */}
                            {panels.length > 1 && (
                                <button
                                    onClick={() => onRemovePanel(panel.id)}
                                    className="absolute top-2 right-2 z-10 p-1 rounded bg-red-600/80 hover:bg-red-500 text-white transition-colors no-drag"
                                    title="Close Panel"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>

                        {/* Resize Handle */}
                        {index < panels.length - 1 && (
                            <div
                                className={`${layout === 'horizontal'
                                    ? 'w-1 cursor-col-resize hover:bg-blue-500/50'
                                    : 'h-1 cursor-row-resize hover:bg-blue-500/50'
                                    } bg-neutral-700 transition-colors shrink-0 no-drag`}
                                onMouseDown={handleMouseDown(index)}
                            />
                        )}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
};

export default SplitViewContainer;

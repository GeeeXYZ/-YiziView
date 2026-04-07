import React, { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

/**
 * SplitViewContainer - Manages multiple panels with resizable splits
 */
const SplitViewContainer = ({
    panels,
    layout,
    onRemovePanel,
    renderPanel
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
        ? 'flex flex-row flex-1 min-h-0'
        : 'flex flex-col flex-1 min-h-0';

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden relative">
            <div className={`${containerClass} split-panels-container`}>
                {panels.map((panel, index) => (
                    <React.Fragment key={panel.id}>
                        <div
                            style={{
                                [layout === 'horizontal' ? 'width' : 'height']: `${panelSizes[index]}%`,
                            }}
                            className="relative h-full overflow-hidden"
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

                        {/* Resize Handle (1px visual with expanded invisible hit area) */}
                        {index < panels.length - 1 && (
                            <div
                                className={`relative shrink-0 no-drag bg-neutral-700
                                    ${layout === 'horizontal'
                                    ? 'w-[2px] cursor-col-resize'
                                    : 'h-[2px] cursor-row-resize'
                                    }`}
                                onMouseDown={handleMouseDown(index)}
                            >
                                <div className={`absolute z-10 transition-colors bg-transparent hover:bg-blue-500/80
                                    ${layout === 'horizontal'
                                    ? 'w-1.5 h-full -left-[3px] top-0 cursor-col-resize'
                                    : 'h-1.5 w-full -top-[3px] left-0 cursor-row-resize'
                                    }`}
                                />
                            </div>
                        )}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
};

export default SplitViewContainer;

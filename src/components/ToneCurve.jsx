import React, { useRef, useState, useEffect } from 'react';
import { createCurveLUT } from '../utils/curveSpline';

const ToneCurve = ({ value, onChange, onReset }) => {
    const svgRef = useRef(null);
    const [draggingIdx, setDraggingIdx] = useState(null);
    
    // Default fallback
    const points = Array.isArray(value) && value.length >= 2 ? value : [{x: 0, y: 0}, {x: 255, y: 255}];
    
    // Sort points visually (they should be naturally sorted, but just in case)
    const sortedPoints = [...points].sort((a, b) => a.x - b.x);

    // Create LUT for drawing the path
    const lut = createCurveLUT(sortedPoints);
    let pathData = `M 0 ${255 - lut[0]}`;
    for (let x = 1; x <= 255; x++) {
        pathData += ` L ${x} ${255 - lut[x]}`;
    }

    const getMouseCoords = (e) => {
        const rect = svgRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(255, ((e.clientX - rect.left) / rect.width) * 255));
        const y = Math.max(0, Math.min(255, ((rect.bottom - e.clientY) / rect.height) * 255));
        return { x: Math.round(x), y: Math.round(y) };
    };

    const handlePointerDown = (e, index) => {
        e.stopPropagation();
        setDraggingIdx(index);
    };

    const handleSvgPointerDown = (e) => {
        // Add new point
        const { x, y } = getMouseCoords(e);
        const newPoints = [...sortedPoints, { x, y }].sort((a, b) => a.x - b.x);
        onChange(newPoints);
        
        // Setup dragging for new point
        const newIndex = newPoints.findIndex(p => p.x === x && p.y === y);
        setDraggingIdx(newIndex);
    };

    useEffect(() => {
        const handlePointerMove = (e) => {
            if (draggingIdx === null) return;
            const { x, y } = getMouseCoords(e);
            
            const newPoints = [...sortedPoints];
            
            // Boundary lock for first and last
            if (draggingIdx === 0) {
                newPoints[0] = { x: 0, y };
            } else if (draggingIdx === sortedPoints.length - 1) {
                newPoints[sortedPoints.length - 1] = { x: 255, y };
            } else {
                // Determine bounds
                const minX = newPoints[draggingIdx - 1].x + 1;
                const maxX = newPoints[draggingIdx + 1].x - 1;
                
                // If dragging way out vertically/horizontally, delete point
                const rect = svgRef.current.getBoundingClientRect();
                const outOfBounds = e.clientX < rect.left - 20 || e.clientX > rect.right + 20 ||
                                    e.clientY < rect.top - 20 || e.clientY > rect.bottom + 20;

                if (outOfBounds && newPoints.length > 2) {
                    newPoints.splice(draggingIdx, 1);
                    setDraggingIdx(null);
                } else {
                    newPoints[draggingIdx] = { 
                        x: Math.max(minX, Math.min(maxX, x)), 
                        y 
                    };
                }
            }
            onChange(newPoints);
        };

        const handlePointerUp = () => {
            setDraggingIdx(null);
        };

        if (draggingIdx !== null) {
            window.addEventListener('pointermove', handlePointerMove);
            window.addEventListener('pointerup', handlePointerUp);
        }

        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };
    }, [draggingIdx, sortedPoints, onChange]);

    return (
        <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center mb-1">
                <span className="text-gray-400 text-xs font-medium">Tone Curve</span>
                <button 
                    onClick={onReset}
                    className="text-[10px] text-gray-500 hover:text-blue-400 transition-colors"
                >
                    Reset Curve
                </button>
            </div>
            
            <div className="relative w-full aspect-square bg-neutral-900 border border-neutral-700 rounded-md overflow-hidden select-none">
                {/* Background Grid */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20" viewBox="0 0 4 4">
                    <line x1="1" y1="0" x2="1" y2="4" stroke="currentColor" strokeWidth="0.05" />
                    <line x1="2" y1="0" x2="2" y2="4" stroke="currentColor" strokeWidth="0.05" />
                    <line x1="3" y1="0" x2="3" y2="4" stroke="currentColor" strokeWidth="0.05" />
                    <line x1="0" y1="1" x2="4" y2="1" stroke="currentColor" strokeWidth="0.05" />
                    <line x1="0" y1="2" x2="4" y2="2" stroke="currentColor" strokeWidth="0.05" />
                    <line x1="0" y1="3" x2="4" y2="3" stroke="currentColor" strokeWidth="0.05" />
                </svg>
                
                {/* Diagonal Reference */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20" viewBox="0 0 255 255">
                    <line x1="0" y1="255" x2="255" y2="0" stroke="currentColor" strokeWidth="1" />
                </svg>

                <svg 
                    ref={svgRef}
                    className="absolute inset-0 w-full h-full cursor-crosshair overflow-visible touch-none" 
                    viewBox="0 0 255 255"
                    onPointerDown={handleSvgPointerDown}
                >
                    {/* Curve Path */}
                    <path 
                        d={pathData} 
                        fill="none" 
                        stroke="#3b82f6" 
                        strokeWidth="2"
                        vectorEffect="non-scaling-stroke"
                        className="pointer-events-none"
                    />

                    {/* Nodes */}
                    {sortedPoints.map((p, idx) => (
                        <g 
                            key={idx} 
                            transform={`translate(${p.x}, ${255 - p.y})`}
                            onPointerDown={(e) => handlePointerDown(e, idx)}
                            className="cursor-move"
                            onDoubleClick={(e) => {
                                e.stopPropagation();
                                if (idx > 0 && idx < sortedPoints.length - 1) {
                                    const newPts = [...sortedPoints];
                                    newPts.splice(idx, 1);
                                    onChange(newPts);
                                }
                            }}
                        >
                            {/* Hitbox */}
                            <circle r="12" fill="transparent" />
                            {/* Visual Point */}
                            <circle 
                                r="4" 
                                fill={draggingIdx === idx ? "#60a5fa" : "#3b82f6"} 
                                stroke="#171717"
                                strokeWidth="1.5"
                                vectorEffect="non-scaling-stroke"
                            />
                        </g>
                    ))}
                </svg>
            </div>
            <div className="text-[10px] text-gray-500 text-center">
                Click line to add • Drag out to delete
            </div>
        </div>
    );
};

export default ToneCurve;

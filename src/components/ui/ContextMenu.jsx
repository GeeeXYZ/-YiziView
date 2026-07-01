import React, { useEffect, useRef, useLayoutEffect, useState } from 'react';

const ContextMenu = ({ x, y, options, onClose, isSubmenu = false, parentRect = null }) => {
    const menuRef = useRef(null);
    const [activeSubmenu, setActiveSubmenu] = useState(null);

    useEffect(() => {
        if (isSubmenu) return; // Only root menu handles outside click
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                // We need to make sure we don't close if clicking inside a child submenu.
                // Since child submenus are rendered inside this component tree, React events bubble up.
                // But this is a DOM event. If we render submenu as a child React node but DOM-wise it's inside menuRef, it works.
                // Wait, child ContextMenu is rendered inside the root ContextMenu DOM node?
                // Yes, if we put it inside the return div.
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside, true);
        return () => document.removeEventListener('mousedown', handleClickOutside, true);
    }, [onClose, isSubmenu]);

    const [pos, setPos] = useState({ top: y, left: x });

    useLayoutEffect(() => {
        if (menuRef.current) {
            const rect = menuRef.current.getBoundingClientRect();
            const windowW = window.innerWidth;
            const windowH = window.innerHeight;

            let finalX = x;
            let finalY = y;

            if (isSubmenu && parentRect) {
                if (x + rect.width > windowW) {
                    finalX = parentRect.left - rect.width;
                }
            } else {
                if (x + rect.width > windowW) {
                    finalX = x - rect.width;
                }
            }

            if (y + rect.height > windowH) {
                finalY = windowH - rect.height - 5; // Prevent clipping
            }

            setPos({ top: finalY, left: finalX });
        }
    }, [x, y, options, isSubmenu, parentRect]);

    const handleMouseEnter = (e, index, option) => {
        if (option.submenu) {
            const rect = e.currentTarget.getBoundingClientRect();
            setActiveSubmenu({ index, x: rect.right, y: rect.top, options: option.submenu, parentRect: rect });
        } else {
            setActiveSubmenu(null);
        }
    };

    const style = {
        top: pos.top,
        left: pos.left,
        minWidth: '150px'
    };

    return (
        <div
            ref={menuRef}
            className="fixed z-[1000] bg-neutral-800 border border-neutral-700 shadow-xl rounded-lg py-1 text-sm text-gray-200 select-none"
            style={style}
            onMouseLeave={() => isSubmenu && onClose()}
        >
            {options.map((option, index) => {
                if (option.type === 'divider') {
                    return <div key={index} className="h-px bg-neutral-700 my-1 mx-1" onMouseEnter={() => setActiveSubmenu(null)} />;
                }

                if (option.type === 'custom') {
                    return <div key={index} onMouseEnter={() => setActiveSubmenu(null)}>{option.render()}</div>;
                }

                const isDisabled = option.disabled;

                if (option.submenu) {
                    const isActive = activeSubmenu?.index === index;
                    return (
                        <div
                            key={index}
                            className={`px-4 py-2 flex items-center justify-between cursor-pointer ${isDisabled ? 'opacity-30 cursor-not-allowed text-gray-400' : (isActive ? 'bg-blue-600' : 'hover:bg-blue-600')}`}
                            onMouseEnter={(e) => !isDisabled && handleMouseEnter(e, index, option)}
                            onClick={(e) => { e.stopPropagation(); }}
                        >
                            <div className="flex items-center gap-2">
                                {option.icon && <span>{option.icon}</span>}
                                <span>{option.label}</span>
                            </div>
                            <span className="text-gray-400 text-[10px] ml-4">▶</span>
                        </div>
                    );
                }

                return (
                    <div
                        key={index}
                        className={`px-4 py-2 flex items-center gap-2 ${isDisabled
                            ? 'opacity-30 cursor-not-allowed text-gray-400'
                            : 'hover:bg-blue-600 cursor-pointer ' + (option.danger ? 'text-red-400 hover:text-white hover:bg-red-600' : '')
                            }`}
                        onMouseEnter={(e) => !isDisabled && handleMouseEnter(e, index, option)}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (isDisabled) return;
                            if (option.onClick) option.onClick();
                            onClose();
                        }}
                    >
                        {option.icon && <span>{option.icon}</span>}
                        <span>{option.label}</span>
                    </div>
                );
            })}
            
            {activeSubmenu && (
                <ContextMenu
                    x={activeSubmenu.x}
                    y={activeSubmenu.y}
                    options={activeSubmenu.options}
                    onClose={onClose}
                    isSubmenu={true}
                    parentRect={activeSubmenu.parentRect}
                />
            )}
        </div>
    );
};

export default ContextMenu;

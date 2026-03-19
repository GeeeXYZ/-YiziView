import React, { useEffect, useRef, useLayoutEffect, useState } from 'react';

const ContextMenu = ({ x, y, options, onClose }) => {
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside, true);
        return () => document.removeEventListener('mousedown', handleClickOutside, true);
    }, [onClose]);

    const [pos, setPos] = useState({ top: y, left: x });

    useLayoutEffect(() => {
        if (menuRef.current) {
            const rect = menuRef.current.getBoundingClientRect();
            const windowW = window.innerWidth;
            const windowH = window.innerHeight;

            let finalX = x;
            let finalY = y;

            // Check right overflow: switch to the exact left of the cursor
            if (x + rect.width > windowW) {
                finalX = x - rect.width;
            }

            // Check bottom overflow: switch to the exact top of the cursor
            if (y + rect.height > windowH) {
                finalY = y - rect.height;
            }

            setPos({ top: finalY, left: finalX });
        }
    }, [x, y, options]);

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
        >
            {options.map((option, index) => {
                if (option.type === 'divider') {
                    return <div key={index} className="h-px bg-neutral-700 my-1 mx-1" />;
                }

                if (option.type === 'custom') {
                    return <div key={index}>{option.render()}</div>;
                }

                const isDisabled = option.disabled;

                return (
                    <div
                        key={index}
                        className={`px-4 py-2 flex items-center gap-2 ${isDisabled
                            ? 'opacity-30 cursor-not-allowed text-gray-400'
                            : `hover:bg-blue-600 cursor-pointer ${option.danger ? 'text-red-400 hover:text-white hover:bg-red-600' : ''}`
                            }`}
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
        </div>
    );
};

export default ContextMenu;

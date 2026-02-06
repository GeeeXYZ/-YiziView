import React, { useEffect, useRef } from 'react';

const ContextMenu = ({ x, y, options, onClose }) => {
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    // Simple bounds check to prevent overflow (bottom/right)
    // For now, simple positioning
    const style = {
        top: y,
        left: x,
        minWidth: '150px'
    };

    return (
        <div
            ref={menuRef}
            className="fixed z-50 bg-neutral-800 border border-neutral-700 shadow-xl rounded-lg py-1 text-sm text-gray-200 select-none animate-in fade-in zoom-in-95 duration-100"
            style={style}
        >
            {options.map((option, index) => {
                if (option.type === 'divider') {
                    return <div key={index} className="h-px bg-neutral-700 my-1 mx-1" />;
                }

                return (
                    <div
                        key={index}
                        className={`px-4 py-2 hover:bg-blue-600 cursor-pointer flex items-center gap-2 ${option.danger ? 'text-red-400 hover:text-white hover:bg-red-600' : ''}`}
                        onClick={(e) => {
                            e.stopPropagation();
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

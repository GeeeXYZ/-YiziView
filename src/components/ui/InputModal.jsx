import React, { useState, useEffect, useRef } from 'react';

const InputModal = ({ title, initialValue = '', placeholder, onConfirm, onCancel, isOpen }) => {
    const [value, setValue] = useState(initialValue);
    const inputRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            setValue(initialValue);
            setTimeout(() => {
                if (inputRef.current) {
                    inputRef.current.focus();
                    inputRef.current.select();
                }
            }, 50);
        }
    }, [isOpen, initialValue]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onConfirm(value);
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-neutral-800 border border-neutral-700 p-6 rounded-xl shadow-2xl w-96 transform transition-all scale-100">
                <h3 className="text-lg font-bold text-gray-200 mb-4">{title}</h3>
                <form onSubmit={handleSubmit}>
                    <input
                        ref={inputRef}
                        type="text"
                        className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-6"
                        placeholder={placeholder}
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                    />
                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-4 py-2 rounded-lg text-gray-400 hover:bg-neutral-700 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors font-medium"
                        >
                            Confirm
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default InputModal;

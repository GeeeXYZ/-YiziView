import React, { useEffect, useRef } from 'react';

const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel, confirmText = 'Confirm', confirmKind = 'primary' }) => {
    const confirmRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            // Focus confirm button for keyboard navigation
            setTimeout(() => {
                confirmRef.current?.focus();
            }, 50);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-neutral-800 border border-neutral-700 p-6 rounded-xl shadow-2xl w-96 transform transition-all scale-100">
                <h3 className="text-lg font-bold text-gray-200 mb-2">{title || 'Confirm'}</h3>
                <p className="text-gray-400 mb-6 text-sm leading-relaxed">
                    {message}
                </p>
                <div className="flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-4 py-2 rounded-lg text-gray-400 hover:bg-neutral-700 hover:text-white transition-colors text-sm font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        ref={confirmRef}
                        type="button"
                        onClick={onConfirm}
                        className={`px-4 py-2 rounded-lg text-white transition-colors text-sm font-medium focus:outline-none ${confirmKind === 'danger'
                            ? 'bg-red-600 hover:bg-red-500'
                            : 'bg-blue-600 hover:bg-blue-500'
                            }`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;

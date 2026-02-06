import React from 'react';
import { Clock, ArrowUp, ArrowDown } from 'lucide-react';

const SortControl = ({ sortConfig, onSortChange }) => {
    const isNameActive = sortConfig.type === 'name';
    const isDateActive = sortConfig.type === 'date';

    const handleNameClick = () => {
        if (isNameActive) {
            onSortChange('name', sortConfig.direction === 'asc' ? 'desc' : 'asc');
        } else {
            onSortChange('name', 'asc');
        }
    };

    const handleDateClick = () => {
        if (isDateActive) {
            onSortChange('date', sortConfig.direction === 'asc' ? 'desc' : 'asc');
        } else {
            onSortChange('date', 'desc'); // Default to newest first
        }
    };

    return (
        <div className="flex items-center gap-1 no-drag">
            {/* Name Sort Button */}
            <button
                onClick={handleNameClick}
                className={`px-2 rounded h-8 transition-colors flex items-center gap-1 ${isNameActive
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'hover:bg-neutral-700/50 text-gray-400'
                    }`}
                title={isNameActive
                    ? (sortConfig.direction === 'asc' ? 'Name: A → Z' : 'Name: Z → A')
                    : 'Sort by Name'
                }
            >
                <div className="text-[11px] font-bold leading-none">A-Z</div>
                {isNameActive && (
                    sortConfig.direction === 'asc' ? <ArrowDown size={14} /> : <ArrowUp size={14} />
                )}
            </button>

            {/* Date Sort Button */}
            <button
                onClick={handleDateClick}
                className={`px-2 rounded h-8 transition-colors flex items-center gap-1 ${isDateActive
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'hover:bg-neutral-700/50 text-gray-400'
                    }`}
                title={isDateActive
                    ? (sortConfig.direction === 'asc' ? 'Date: Oldest First' : 'Date: Newest First')
                    : 'Sort by Date'
                }
            >
                <Clock size={16} />
                {isDateActive && (
                    sortConfig.direction === 'asc' ? <ArrowDown size={14} /> : <ArrowUp size={14} />
                )}
            </button>
        </div>
    );
};

export default SortControl;

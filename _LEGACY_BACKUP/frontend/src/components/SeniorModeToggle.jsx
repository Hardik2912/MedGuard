import React from 'react';

const SeniorModeToggle = ({ isSenior, onToggle }) => {
    return (
        <div className="flex items-center gap-3 bg-gray-50 px-3 py-2 rounded-lg">
            <span className={`text-sm font-medium ${isSenior ? 'text-gray-900' : 'text-gray-500'}`}>
                Senior Mode
            </span>
            <button
                onClick={onToggle}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${isSenior ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
            >
                <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isSenior ? 'translate-x-6' : 'translate-x-1'
                        }`}
                />
            </button>
        </div>
    );
};

export default SeniorModeToggle;

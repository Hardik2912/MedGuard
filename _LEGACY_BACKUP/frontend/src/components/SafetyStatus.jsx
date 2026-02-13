import React from 'react';

const SafetyStatus = ({ warningLevel = 'green', seniorMode = false }) => {
    // Styles based on level
    const styles = {
        green: {
            bg: 'bg-green-50 border-green-200',
            dot: 'bg-green-500',
            text: 'text-green-800',
            subtext: 'text-green-700',
            title: 'Safety Status: Good',
            msg: 'No immediate risks detected. Keep following your schedule.'
        },
        yellow: {
            bg: 'bg-yellow-50 border-yellow-200',
            dot: 'bg-yellow-500',
            text: 'text-yellow-800',
            subtext: 'text-yellow-700',
            title: 'Monitor Closely',
            msg: 'Some potential interactions found. Check details.'
        },
        red: {
            bg: 'bg-red-50 border-red-200',
            dot: 'bg-red-500',
            text: 'text-red-800',
            subtext: 'text-red-700',
            title: 'Medical Advice Recommended',
            msg: 'Serious interactions detected. Consult your doctor.'
        }
    };

    const currentStyle = styles[warningLevel] || styles.green;

    return (
        <div className={`${currentStyle.bg} border rounded-2xl p-5 mb-6 transition-all duration-300`}>
            <div className="flex items-center gap-3 mb-2">
                <div className={`w-4 h-4 rounded-full ${currentStyle.dot} animate-pulse`}></div>
                <h2 className={`font-bold ${currentStyle.text} ${seniorMode ? 'text-xl' : 'text-lg'}`}>
                    {currentStyle.title}
                </h2>
            </div>
            <p className={`${currentStyle.subtext} leading-snug ${seniorMode ? 'text-lg' : 'text-sm'}`}>
                {currentStyle.msg}
            </p>
        </div>
    );
};

export default SafetyStatus;


import React, { useState, useEffect } from 'react';

const SplashScreen = ({ onComplete }) => {
    const [step, setStep] = useState('logo'); // 'logo' | 'disclaimer'
    const [accepted, setAccepted] = useState(false);

    useEffect(() => {
        // Logo Animation Timer
        const timer = setTimeout(() => {
            setStep('disclaimer');
        }, 2500);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="fixed inset-0 bg-blue-600 flex flex-col items-center justify-center text-white z-50">

            {/* Phase 1: Logo Reveal */}
            {step === 'logo' && (
                <div className="animate-fade-in-up text-center">
                    <div className="w-24 h-24 bg-white rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-2xl">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="#2563EB" className="w-14 h-14">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                    </div>
                    <h1 className="text-4xl font-bold tracking-tight">MED GUARD</h1>
                    <p className="opacity-80 mt-2 text-sm tracking-widest uppercase">AI Health Companion</p>
                </div>
            )}

            {/* Phase 2: Disclaimer */}
            {step === 'disclaimer' && (
                <div className="bg-white text-slate-800 p-8 rounded-3xl max-w-sm w-full mx-6 shadow-2xl animate-fade-in-up">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-blue-600">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                        </svg>
                    </div>

                    <h2 className="text-2xl font-bold mb-2">Safety First</h2>
                    <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                        Med Guard is an artificial intelligence designed for educational and informational purposes only.
                        <br /><br />
                        It does <strong>not</strong> provide medical diagnosis, treatment, or prescriptions. Always consult a certified healthcare professional for medical decisions.
                    </p>

                    <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                        <input
                            type="checkbox"
                            className="mt-1 w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            checked={accepted}
                            onChange={(e) => setAccepted(e.target.checked)}
                        />
                        <span className="text-sm font-medium">
                            I understand that Med Guard is not a doctor.
                        </span>
                    </label>

                    <div className="mt-8 pt-6 border-t border-slate-100 text-center animate-fade-in-up delay-100">
                        <p className="text-slate-400 text-xs uppercase tracking-widest font-bold mb-3">Welcome to Med Guard</p>
                        <button
                            onClick={onComplete}
                            disabled={!accepted}
                            className={`w-full py-4 rounded-2xl font-bold text-lg transition-all shadow-xl
                                ${accepted
                                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:scale-105 active:scale-95'
                                    : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}
                        >
                            Start Your Journey
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SplashScreen;

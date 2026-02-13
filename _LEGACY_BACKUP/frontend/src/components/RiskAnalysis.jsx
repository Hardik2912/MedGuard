import React, { useState, useEffect } from 'react';
import axios from 'axios';

const RiskAnalysis = ({ onBack, seniorMode = false, risks = [], userAge = 40, userMode = 'adult' }) => {
    const [aiAdvice, setAiAdvice] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Fetch AI Persona advice on mount
        const fetchAdvice = async () => {
            try {
                setLoading(true);
                const res = await axios.post('/ai/advice', {
                    user_id: 'default',
                    user_age: userAge,
                    mode: userMode
                });
                setAiAdvice(res.data);
            } catch (error) {
                console.error("Error fetching AI advice:", error);
            } finally {
                setLoading(false);
            }
        };

        if (risks.length > 0) {
            fetchAdvice();
        } else {
            setLoading(false);
        }
    }, [risks, userAge, userMode]);

    return (
        <div className={`flex flex-col h-full ${seniorMode ? 'p-6 bg-white' : 'p-4 bg-transparent'}`}>

            {/* Header */}
            <div className="flex items-center mb-6 z-10">
                <button
                    onClick={onBack}
                    className={`p-2 -ml-2 rounded-full transition-colors ${seniorMode ? 'bg-gray-100' : 'glass-card hover:bg-white/50'}`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6 text-slate-700">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                    </svg>
                </button>
                <h2 className={`font-bold text-slate-800 ml-4 ${seniorMode ? 'text-2xl' : 'text-xl tracking-tight'}`}>
                    Medication Analysis
                </h2>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto pb-8 space-y-6">

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="mt-4 text-slate-500 font-medium">Analyzing interactions...</p>
                    </div>
                ) : aiAdvice ? (
                    <>
                        {/* 1. The Doctor's Note (AI Persona) */}
                        <div className={`rounded-3xl p-6 relative overflow-hidden animate-fade-in-up
                            ${seniorMode ? 'bg-blue-50 border-2 border-blue-100' : 'glass-card border-white/40'}`}>

                            {/* Decorative Quote Icon */}
                            <div className="absolute top-4 right-4 opacity-10 text-6xl font-serif text-blue-900 leading-none">"</div>

                            <h3 className={`font-bold mb-3 ${seniorMode ? 'text-xl text-blue-900' : 'text-sm uppercase tracking-wider text-blue-700'}`}>
                                Assessment
                            </h3>

                            <p className={`font-medium text-slate-800 ${seniorMode ? 'text-2xl leading-relaxed' : 'text-xl leading-relaxed'}`}>
                                {aiAdvice.assistant_message}
                            </p>

                            {/* Verification Badge */}
                            <div className="mt-6 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                <span className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Verified by Med Guard Kernel</span>
                            </div>
                        </div>

                        {/* 2. Why & What */}
                        <div className="grid gap-4">
                            {/* Reason */}
                            <div className={`p-5 rounded-2xl ${seniorMode ? 'bg-amber-50 border border-amber-100' : 'glass-card bg-amber-50/40'}`}>
                                <h4 className="font-bold text-amber-800 mb-2 flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                    </svg>
                                    Why this happened
                                </h4>
                                <ul className="space-y-2">
                                    {aiAdvice.why_this_happened.map((reason, i) => (
                                        <li key={i} className="text-slate-700 text-sm font-medium ml-1">• {reason}</li>
                                    ))}
                                </ul>
                            </div>

                            {/* Action */}
                            <div className={`p-5 rounded-2xl ${seniorMode ? 'bg-blue-600 text-white shadow-lg' : 'glass-card bg-white/60'}`}>
                                <h4 className={`font-bold mb-3 flex items-center gap-2 ${seniorMode ? 'text-white' : 'text-slate-800'}`}>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    Recommended Action
                                </h4>
                                <ul className="space-y-3">
                                    {aiAdvice.what_to_do_now.map((action, i) => (
                                        <li key={i} className={`flex items-start gap-3 p-3 rounded-xl 
                                            ${seniorMode ? 'bg-white/10' : 'bg-white shadow-sm'}`}>
                                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                                                ${seniorMode ? 'bg-white text-blue-600' : 'bg-blue-100 text-blue-600'}`}>
                                                {i + 1}
                                            </span>
                                            <span className={`flex-1 font-medium ${seniorMode ? 'text-white' : 'text-slate-700'}`}>
                                                {action}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        {/* Senior Support Message */}
                        {seniorMode && aiAdvice.senior_support.enabled && (
                            <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100 text-center">
                                <p className="text-purple-800 font-medium italic">
                                    "{aiAdvice.senior_support.message}"
                                </p>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="text-center py-10 opacity-70">
                        <p>No risks detected. Stay healthy!</p>
                    </div>
                )}
            </div>

            {/* Disclaimer Footer */}
            <p className="text-[10px] text-center text-slate-400 px-4">
                {aiAdvice?.disclaimer || "Medical Assistance AI. Not a substitute for professional advice."}
            </p>
        </div>
    );
};

export default RiskAnalysis;

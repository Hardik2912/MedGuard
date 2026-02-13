import React, { useState, useEffect } from 'react';
import axios from 'axios';

const DeviceConnect = ({ onComplete, onSkip }) => {
    const [status, setStatus] = useState('idle'); // 'idle' | 'scanning' | 'found' | 'syncing' | 'success'
    const [device, setDevice] = useState(null);
    const [vitals, setVitals] = useState(null);

    const startScan = () => {
        setStatus('scanning');
        setTimeout(() => {
            // Find a mock device
            setDevice("HealthWatch Series 7");
            setStatus('found');
        }, 2000);
    };

    const connectAndSync = async () => {
        setStatus('syncing');
        try {
            // Call Backend Mock Endpoint
            const res = await axios.post('/device/sync', { user_id: 'default' });
            if (res.data.success) {
                setVitals(res.data.vitals);
                setStatus('success');
            }
        } catch (error) {
            console.error("Sync failed", error);
            setStatus('idle'); // simple reset on error
        }
    };

    return (
        <div className="fixed inset-0 bg-white z-40 flex flex-col items-center justify-center p-6 font-sans">

            {/* Header / Intro */}
            {status === 'idle' && (
                <div className="text-center animate-fade-in-up">
                    <div className="w-24 h-24 bg-slate-100 rounded-full mx-auto mb-6 flex items-center justify-center animate-pulse">
                        <span className="text-4xl">⌚</span>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Connect Device</h2>
                    <p className="text-slate-500 mb-8 max-w-xs mx-auto">
                        Link your Smart Watch or Phone Tracker to give Med Guard better health context.
                    </p>

                    <div className="space-y-4 w-full max-w-xs mx-auto">
                        <button
                            onClick={startScan}
                            className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl shadow-lg hover:scale-105 transition-transform"
                        >
                            Connect Watch / Tracker
                        </button>
                        <button
                            onClick={onSkip}
                            className="w-full py-3 text-slate-400 font-medium hover:text-slate-600"
                        >
                            Skip for now
                        </button>
                    </div>
                </div>
            )}

            {/* Scanning / Finding */}
            {status === 'scanning' && (
                <div className="text-center">
                    <div className="relative w-32 h-32 mx-auto mb-8">
                        {/* Ripple rings */}
                        <div className="absolute inset-0 border-4 border-blue-100 rounded-full animate-ping"></div>
                        <div className="absolute inset-2 border-4 border-blue-200 rounded-full animate-ping delay-75"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-4xl">📡</span>
                        </div>
                    </div>
                    <h3 className="text-xl font-bold text-slate-700">Searching for devices...</h3>
                </div>
            )}

            {/* Device Found */}
            {status === 'found' && (
                <div className="text-center animate-fade-in-up w-full max-w-sm">
                    <div className="bg-green-50 rounded-2xl p-6 mb-8 border border-green-100">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm text-2xl">
                                ⌚
                            </div>
                            <div className="text-left">
                                <p className="text-xs font-bold text-green-600 uppercase tracking-wide">Device Found</p>
                                <h3 className="text-lg font-bold text-slate-800">{device}</h3>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={connectAndSync}
                        className="w-full py-4 bg-green-600 text-white font-bold rounded-2xl shadow-lg hover:scale-105 transition-transform"
                    >
                        Pair & Sync Data
                    </button>
                </div>
            )}

            {/* Syncing... */}
            {status === 'syncing' && (
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="font-medium text-slate-600">Retrieving Health Data...</p>
                </div>
            )}

            {/* Success */}
            {status === 'success' && (
                <div className="text-center animate-fade-in-up w-full max-w-sm">
                    <div className="w-20 h-20 bg-green-500 rounded-full mx-auto mb-6 flex items-center justify-center text-white shadow-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-10 h-10">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Connected!</h2>
                    <p className="text-slate-500 mb-8">We've synced your daily stats.</p>

                    <div className="grid grid-cols-2 gap-4 mb-8">
                        <div className="bg-slate-50 p-4 rounded-xl text-center">
                            <p className="text-xs text-slate-400 font-bold uppercase">Steps</p>
                            <p className="text-xl font-bold text-slate-800">{vitals.steps}</p>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl text-center">
                            <p className="text-xs text-slate-400 font-bold uppercase">Heart Rate</p>
                            <p className="text-xl font-bold text-slate-800">{vitals.heart_rate} <span className="text-xs">bpm</span></p>
                        </div>
                    </div>

                    <button
                        onClick={onComplete}
                        className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl shadow-lg hover:bg-blue-700 transition"
                    >
                        Go to Dashboard
                    </button>
                </div>
            )}
        </div>
    );
};

export default DeviceConnect;

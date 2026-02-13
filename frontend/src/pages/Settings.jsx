import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Watch, Smartphone, Bluetooth, Check, LogOut, Moon, Bell, ChevronRight, Loader2, RefreshCw, Brain, Key, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Settings() {
    const navigate = useNavigate();
    const { signOut } = useAuth();

    const [scanning, setScanning] = useState(false);
    const [connectedDevice, setConnectedDevice] = useState(localStorage.getItem('medguard_device') || null);

    // AI Settings State
    const [apiKey, setApiKey] = useState(localStorage.getItem('gemini_api_key') || '');
    const [showKey, setShowKey] = useState(false);
    const [keySaved, setKeySaved] = useState(!!localStorage.getItem('gemini_api_key'));

    const saveApiKey = () => {
        if (apiKey.trim()) {
            localStorage.setItem('gemini_api_key', apiKey.trim());
            setKeySaved(true);
            setTimeout(() => setKeySaved(false), 2000);
        }
    };

    const clearApiKey = () => {
        localStorage.removeItem('gemini_api_key');
        setApiKey('');
        setKeySaved(false);
    };

    // Simulate Bluetooth Scan
    const handleScan = () => {
        setScanning(true);
        setTimeout(() => {
            setScanning(false);
        }, 3000);
    };

    const connectDevice = (deviceName) => {
        setConnectedDevice(deviceName);
        localStorage.setItem('medguard_device', deviceName);
    };

    const disconnectDevice = () => {
        setConnectedDevice(null);
        localStorage.removeItem('medguard_device');
    };

    const handleSignOut = async () => {
        await signOut();
        navigate('/');
    };

    return (
        <div className="min-h-screen bg-slate-50 relative">
            {/* Header */}
            <div className="bg-white px-6 pt-12 pb-6 shadow-sm sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/dashboard')} className="p-2 -ml-2 rounded-full hover:bg-slate-100 transition-colors">
                        <ArrowLeft className="w-6 h-6 text-slate-700" />
                    </button>
                    <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
                </div>
            </div>

            <div className="p-6 space-y-8 max-w-lg mx-auto">

                {/* 1. Smart Watch / Device Section */}
                <section>
                    <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Device Integration</h2>
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">

                        {/* Status Header */}
                        <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-indigo-50">
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${connectedDevice ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                                    {connectedDevice ? <Check className="w-6 h-6" /> : <Watch className="w-6 h-6" />}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900">Health Monitor</h3>
                                    <p className="text-xs text-slate-500 font-medium">
                                        {connectedDevice ? `Connected to ${connectedDevice}` : 'No device connected'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Connection UI */}
                        <div className="p-6">
                            {connectedDevice ? (
                                <div>
                                    <div className="flex items-center justify-between bg-green-50 p-4 rounded-xl mb-4 border border-green-100">
                                        <div className="flex items-center gap-3">
                                            <Watch className="w-5 h-5 text-green-600" />
                                            <span className="font-bold text-green-800">{connectedDevice}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-green-600">
                                            <span className="relative flex h-2 w-2">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                            </span>
                                            Syncing
                                        </div>
                                    </div>
                                    <button
                                        onClick={disconnectDevice}
                                        className="w-full py-3 text-red-500 font-bold text-sm bg-red-50 rounded-xl hover:bg-red-100 transition-colors"
                                    >
                                        Disconnect Device
                                    </button>
                                </div>
                            ) : (
                                <div>
                                    {!scanning ? (
                                        <div className="text-center">
                                            <p className="text-sm text-slate-500 mb-6">
                                                Connect your smart watch to auto-sync vitals and medicine adherence properly.
                                            </p>
                                            <button
                                                onClick={handleScan}
                                                className="btn-primary w-full flex items-center justify-center gap-2 group"
                                            >
                                                <Bluetooth className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                                Scan for Devices
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-center gap-2 text-sm text-blue-600 font-bold mb-4">
                                                <Loader2 className="w-4 h-4 animate-spin" /> Scanning...
                                            </div>

                                            {/* Mock Devices */}
                                            <button onClick={() => connectDevice('Apple Watch Series 8')} className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-blue-50 hover:border-blue-200 border border-transparent transition-all group">
                                                <div className="flex items-center gap-3">
                                                    <Watch className="w-5 h-5 text-slate-400 group-hover:text-blue-500" />
                                                    <span className="font-semibold text-slate-700 group-hover:text-slate-900">Apple Watch Series 8</span>
                                                </div>
                                                <ChevronRight className="w-4 h-4 text-slate-300" />
                                            </button>
                                            <button onClick={() => connectDevice('Samsung Galaxy Watch')} className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-blue-50 hover:border-blue-200 border border-transparent transition-all group">
                                                <div className="flex items-center gap-3">
                                                    <Watch className="w-5 h-5 text-slate-400 group-hover:text-blue-500" />
                                                    <span className="font-semibold text-slate-700 group-hover:text-slate-900">Samsung Galaxy Watch</span>
                                                </div>
                                                <ChevronRight className="w-4 h-4 text-slate-300" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                {/* 2. AI Settings */}
                <section>
                    <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">AI Settings</h2>
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                        <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-purple-50 to-blue-50">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full flex items-center justify-center bg-purple-100 text-purple-600">
                                    <Brain className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900">Gemini AI</h3>
                                    <p className="text-xs text-slate-500 font-medium">
                                        {apiKey ? '✅ API Key configured' : '⚠️ No API Key set'}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="p-6">
                            <p className="text-sm text-slate-500 mb-4">
                                Enter your Gemini API key for OCR scanning, AI chat, and health insights.
                                Get one free at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-600 font-bold underline">Google AI Studio</a>.
                            </p>
                            <div className="flex gap-2 mb-3">
                                <div className="relative flex-1">
                                    <Key className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                                    <input
                                        type={showKey ? 'text' : 'password'}
                                        value={apiKey}
                                        onChange={(e) => setApiKey(e.target.value)}
                                        placeholder="AIzaSy..."
                                        className="w-full bg-slate-50 rounded-xl pl-10 pr-10 py-3 text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 border border-slate-100"
                                    />
                                    <button
                                        onClick={() => setShowKey(!showKey)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
                                    >
                                        {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={saveApiKey}
                                    disabled={!apiKey.trim()}
                                    className="flex-1 bg-purple-600 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-purple-200 active:scale-95 transition-transform disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {keySaved ? <><Check className="w-4 h-4" /> Saved!</> : <><Key className="w-4 h-4" /> Save Key</>}
                                </button>
                                {apiKey && (
                                    <button
                                        onClick={clearApiKey}
                                        className="px-4 py-3 rounded-xl font-bold text-sm text-red-500 bg-red-50 hover:bg-red-100 transition-colors"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </section>

                {/* 3. General Settings */}
                <section>
                    <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Preferences</h2>
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden divide-y divide-slate-50">
                        <div className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><Bell className="w-5 h-5" /></div>
                                <span className="font-semibold text-slate-700">Notifications</span>
                            </div>
                            <div className="w-10 h-6 bg-green-500 rounded-full relative cursor-pointer"><div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm"></div></div>
                        </div>
                        <div className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><Moon className="w-5 h-5" /></div>
                                <span className="font-semibold text-slate-700">Dark Mode</span>
                            </div>
                            <div className="w-10 h-6 bg-slate-200 rounded-full relative cursor-pointer"><div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm"></div></div>
                        </div>
                    </div>
                </section>

                {/* 3. Account Actions */}
                <button
                    onClick={handleSignOut}
                    className="w-full bg-red-50 text-red-500 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-red-100 transition-colors"
                >
                    <LogOut className="w-5 h-5" /> Sign Out
                </button>

                <p className="text-center text-xs text-slate-400">MedGuard v1.0.2</p>
            </div>
        </div>
    );
}

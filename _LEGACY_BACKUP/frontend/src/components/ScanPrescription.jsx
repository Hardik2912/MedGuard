
import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';

const ScanPrescription = ({ onBack, onAnalysisComplete, seniorMode = false }) => {
    const [imagePreview, setImagePreview] = useState(null);
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [scanProgress, setScanProgress] = useState(0); // 0 to 100
    const [error, setError] = useState('');
    const fileInputRef = useRef(null);

    // Simulate scanning progress animation
    useEffect(() => {
        let interval;
        if (loading) {
            setScanProgress(0);
            interval = setInterval(() => {
                setScanProgress(prev => {
                    if (prev >= 90) return prev; // Hold at 90 until done
                    return prev + 5; // Increment
                });
            }, 100);
        } else {
            setScanProgress(100);
        }
        return () => clearInterval(interval);
    }, [loading]);

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
            setImagePreview(URL.createObjectURL(selectedFile));
            setError('');
        }
    };

    const handleAnalyze = async () => {
        if (!file) {
            setError('Please select or capture an image first.');
            return;
        }

        setLoading(true);
        setError('');

        const formData = new FormData();
        formData.append('file', file);

        try {
            // Using /api/ocr based on vite proxy setup
            const response = await axios.post('/api/ocr', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            if (response.data.candidates) {
                // Wait a moment for "100%" progress visual
                setTimeout(() => {
                    onAnalysisComplete(response.data.candidates);
                }, 500);
            } else {
                setError('No medicines found. Please try again.');
                setLoading(false);
            }
        } catch (err) {
            console.error("OCR Error:", err);
            setError('Failed to analyze image. Please try again or check your connection.');
            setLoading(false);
        }
    };

    return (
        <div className={`flex flex-col h-full ${seniorMode ? 'bg-white' : 'bg-slate-50'}`}>

            {/* Header */}
            <div className={`flex items-center p-4 sticky top-0 z-10 ${seniorMode ? 'bg-white border-b' : 'glass-header'}`}>
                <button
                    onClick={onBack}
                    className="p-2 -ml-2 rounded-full hover:bg-slate-200/50 text-slate-600 transition-colors"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                    </svg>
                </button>
                <h1 className={`font-bold text-slate-800 ml-2 ${seniorMode ? 'text-2xl' : 'text-xl'}`}>
                    Upload Prescription
                </h1>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col p-6 overflow-y-auto">

                <p className={`text-slate-500 mb-6 ${seniorMode ? 'text-lg' : 'text-sm'}`}>
                    Take a clear photo of your prescription or medicine strip.
                </p>

                {/* Upload Area */}
                <div
                    className={`relative w-full aspect-[3/4] rounded-3xl overflow-hidden shadow-sm transition-all
                        ${!imagePreview ? 'border-2 border-dashed border-slate-300 bg-slate-100 hover:bg-slate-200/50' : 'shadow-xl'}
                        ${loading ? 'ring-4 ring-blue-500/20' : ''}`}
                    onClick={() => !loading && fileInputRef.current?.click()}
                >
                    {imagePreview ? (
                        <>
                            <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />

                            {/* Scanning Overlay */}
                            {loading && (
                                <div className="absolute inset-0 bg-black/30 z-10">
                                    {/* Scan Line Animation */}
                                    <div className="absolute top-0 left-0 w-full h-1 bg-blue-400 shadow-[0_0_15px_rgba(96,165,250,0.8)] animate-scan-y"></div>

                                    {/* Pulse Grid */}
                                    <div className="absolute inset-0 grid grid-cols-4 grid-rows-4 opacity-20">
                                        {[...Array(16)].map((_, i) => (
                                            <div key={i} className="border border-white/30"></div>
                                        ))}
                                    </div>

                                    {/* Progress Text */}
                                    <div className="absolute bottom-10 left-0 right-0 text-center">
                                        <div className="inline-block bg-black/60 backdrop-blur-md px-6 py-2 rounded-full text-white font-mono font-bold">
                                            SCANNING {scanProgress}%
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Change Image Button (if not loading) */}
                            {!loading && (
                                <div className="absolute bottom-4 right-4">
                                    <div className="bg-white/90 backdrop-blur text-slate-700 p-3 rounded-full shadow-lg">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 4.992l9.19-9.190M4.049 4.05c.42-.416.732-.988.755-1.455.023-.466.195-.888.583-1.076.388-.188.887-.196 1.348-.02.46.176.992.172 1.45.008 .458-.164.885-.487 1.07-.887.185-.4.187-.898.006-1.353-.18-.455-.494-.908-.908-.908h-.001c-.42.416-.732.988-.755 1.455-.023.466-.195.888-.583 1.076-.388.188-.887.196-1.348.02-.46-.176-.992-.172-1.45-.008-.458.164-.885.487-1.07.887-.185.4-.187.898-.006 1.353.18.455.494.908.908.908h.001z" />
                                            {/* Retake Icon Replacement */}
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                                        </svg>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                            <div className="bg-white p-6 rounded-full shadow-lg mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#3B82F6" className="w-12 h-12">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                                </svg>
                            </div>
                            <span className="font-medium text-lg">Tap to Capture</span>
                        </div>
                    )}
                </div>

                <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleFileChange}
                />

                {error && (
                    <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-xl text-center font-medium animate-shake">
                        {error}
                    </div>
                )}
            </div>

            {/* Bottom Actions */}
            <div className={`p-6 ${seniorMode ? 'pb-8' : ''}`}>
                <button
                    onClick={handleAnalyze}
                    disabled={!file || loading}
                    className={`w-full font-bold shadow-lg transition-all rounded-2xl flex items-center justify-center gap-3
                        ${seniorMode ? 'py-5 text-xl' : 'py-4 text-lg'}
                        ${!file || loading
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:scale-105 active:scale-95'}`}
                >
                    {loading ? 'Analyzing...' : 'Analyze Prescription'}
                    {!loading && file && (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                        </svg>
                    )}
                </button>
            </div>

            {/* Inline CSS for scan animation */}
            <style>{`
                @keyframes scan-y {
                    0% { top: 0; }
                    50% { top: 100%; }
                    100% { top: 0; }
                }
                .animate-scan-y {
                    animation: scan-y 3s linear infinite;
                }
            `}</style>
        </div>
    );
};

export default ScanPrescription;

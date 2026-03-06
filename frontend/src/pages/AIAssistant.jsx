import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Send, Bot, Upload, Loader, X, Trash2, Mic, Square, Globe, Volume2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { safeQuery } from '../lib/safeAsync';
import { chatWithAI, voiceChat, voiceInput } from '../lib/aiClient';
import { speakText as speakTtsText } from '../lib/speech';

export default function AIAssistant() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const chatEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const mediaStreamRef = useRef(null);
    const audioChunksRef = useRef([]);

    const [messages, setMessages] = useState([
        { role: 'bot', text: 'Hello! I\'m your MedGuard AI assistant. I can answer health questions, analyze medical documents, and provide medication guidance. How can I help you today?' }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [uploadedFile, setUploadedFile] = useState(null); // { name, base64, mimeType }
    const [isRecording, setIsRecording] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [selectedLang, setSelectedLang] = useState(localStorage.getItem('medguard_voice_lang') || 'en-IN');

    const LANG_OPTIONS = [
        { code: 'en-IN', label: 'English' },
        { code: 'hi-IN', label: 'Hindi' },
        { code: 'ta-IN', label: 'Tamil' },
        { code: 'te-IN', label: 'Telugu' },
        { code: 'mr-IN', label: 'Marathi' },
        { code: 'kn-IN', label: 'Kannada' },
        { code: 'pa-IN', label: 'Punjabi' },
        { code: 'bn-IN', label: 'Bengali' },
        { code: 'gu-IN', label: 'Gujarati' },
        { code: 'ml-IN', label: 'Malayalam' },
    ];

    // Auto-scroll to bottom
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        localStorage.setItem('medguard_voice_lang', selectedLang);
    }, [selectedLang]);

    useEffect(() => () => {
        try { mediaRecorderRef.current?.stop(); } catch (err) { }
        try { mediaStreamRef.current?.getTracks()?.forEach((t) => t.stop()); } catch (err) { }
    }, []);

    useEffect(() => {
        const shouldAutoTalk = localStorage.getItem('medguard_auto_talk_now') === '1';
        if (!shouldAutoTalk || isRecording) return;
        localStorage.removeItem('medguard_auto_talk_now');
        const timer = setTimeout(() => {
            startTalkNow();
        }, 400);
        return () => clearTimeout(timer);
    }, [isRecording]);

    // --- REAL FILE UPLOAD HANDLING ---
    const handleFileChange = (e) => {
        const file = e?.target?.files?.[0];
        if (!file) return;

        // Validate file
        const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
        if (!validTypes.includes(file.type)) {
            setMessages(prev => [...prev, { role: 'bot', text: '⚠️ Please upload an image (JPG, PNG, WebP) or PDF file.' }]);
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            setMessages(prev => [...prev, { role: 'bot', text: '⚠️ File too large. Maximum size is 10MB.' }]);
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setUploadedFile({
                name: file.name,
                base64: reader.result.split(',')[1],
                mimeType: file.type,
                preview: reader.result,
            });
            setMessages(prev => [...prev, { role: 'user', text: `📎 Uploaded: ${file.name}`, isFile: true }]);
        };
        reader.onerror = () => {
            setMessages(prev => [...prev, { role: 'bot', text: '⚠️ Failed to read file. Please try again.' }]);
        };
        reader.readAsDataURL(file);
    };

    // --- SEND MESSAGE (with optional file) ---
    const sendMessage = async () => {
        const trimmed = input.trim();
        if (!trimmed && !uploadedFile) return;

        // Add user message to chat
        if (trimmed) {
            setMessages(prev => [...prev, { role: 'user', text: trimmed }]);
        }
        setInput('');
        setLoading(true);

        try {
            // Build context from user's medicines
            let medicines = [];
            try {
                medicines = await safeQuery('medicines', (sb) =>
                    sb.from('medicines').select('name, dosage, frequency, type, status').eq('user_id', user?.id),
                    []
                );
            } catch (err) {
                medicines = [];
            }

            const responseText = await chatWithAI({
                message: trimmed || 'Please analyze uploaded medical document.',
                uploadedFile,
                medicines,
            });

            // Clear uploaded file after sending
            setUploadedFile(null);

            if (!responseText) {
                setMessages(prev => [...prev, { role: 'bot', text: '⚠️ I couldn\'t process your request right now. Please try again in a moment.' }]);
                setLoading(false);
                return;
            }
            setMessages(prev => [...prev, { role: 'bot', text: responseText }]);
            await speakTtsText(responseText, selectedLang, 'aditya');
        } catch (err) {
            console.error('[AI Assistant]', err);
            setMessages(prev => [...prev, { role: 'bot', text: '⚠️ An error occurred. Please try again.' }]);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const clearChat = () => {
        setMessages([{ role: 'bot', text: 'Chat cleared. How can I help you?' }]);
        setUploadedFile(null);
    };

    const blobToBase64 = (blob) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result || ''));
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });

    const processRecordedAudio = async (base64Audio) => {
        setLoading(true);
        setIsListening(true);
        try {
            const inputResult = await voiceInput({
                audioBase64: base64Audio,
                languageHint: selectedLang,
            });

            if (!inputResult?.transcript) {
                setMessages(prev => [...prev, { role: 'bot', text: '⚠️ Speech recognition failed. You can type manually.' }]);
                return;
            }

            const transcript = String(inputResult.transcript).trim();
            const detectedLanguage = inputResult.detectedLanguage || selectedLang;
            setMessages(prev => [...prev, { role: 'user', text: `🎤 ${transcript}` }]);

            const medicines = await safeQuery('medicines', (sb) =>
                sb.from('medicines').select('name, dosage, frequency, type, status').eq('user_id', user?.id),
                []
            );

            const chatResult = await voiceChat({
                transcript,
                languageHint: detectedLanguage,
                medicines: medicines || [],
            });
            if (!chatResult) {
                setMessages(prev => [...prev, { role: 'bot', text: '⚠️ Voice chat failed. Please try again.' }]);
                return;
            }

            const nativeResponse = chatResult.translatedResponse || chatResult.aiEnglishResponse || '';
            setMessages(prev => [...prev, {
                role: 'bot',
                text: nativeResponse || 'No response',
                englishUserText: chatResult.englishUserText || '',
                aiEnglishResponse: chatResult.aiEnglishResponse || '',
                nativeResponse: nativeResponse || '',
                detectedLanguage: chatResult.detectedLanguage || detectedLanguage,
                isVoiceResult: true,
            }]);

            await speakTtsText(
                nativeResponse || chatResult.aiEnglishResponse,
                chatResult.detectedLanguage || detectedLanguage,
                'aditya'
            );
        } catch (err) {
            setMessages(prev => [...prev, { role: 'bot', text: '⚠️ Voice pipeline failed. Please try again.' }]);
        } finally {
            setLoading(false);
            setIsListening(false);
        }
    };

    const startTalkNow = async () => {
        if (isRecording) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;
            const recorder = new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;
            audioChunksRef.current = [];

            recorder.onstart = () => {
                setIsRecording(true);
                setIsListening(true);
            };
            recorder.ondataavailable = (event) => {
                if (event.data?.size > 0) audioChunksRef.current.push(event.data);
            };
            recorder.onstop = async () => {
                setIsRecording(false);
                setIsListening(false);
                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const base64 = await blobToBase64(blob);
                try { mediaStreamRef.current?.getTracks()?.forEach((t) => t.stop()); } catch (err) { }
                await processRecordedAudio(base64);
            };

            recorder.start();
        } catch (err) {
            setMessages(prev => [...prev, { role: 'bot', text: '⚠️ Microphone access denied or unavailable.' }]);
        }
    };

    const stopTalkNow = () => {
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') return;
        try {
            mediaRecorderRef.current.stop();
        } catch (err) {
            setIsRecording(false);
            setIsListening(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            {/* Header */}
            <div className="bg-white shadow-sm px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate(-1)} className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
                        <ArrowLeft className="w-5 h-5 text-slate-600" />
                    </button>
                    <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <Bot className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-slate-900">MedGuard AI</h1>
                            <p className="text-xs text-green-600 font-medium">● Online</p>
                        </div>
                    </div>
                </div>
                <button onClick={clearChat} className="p-2 rounded-xl bg-slate-50 hover:bg-red-50 hover:text-red-500 transition-colors text-slate-400">
                    <Trash2 className="w-5 h-5" />
                </button>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {messages.map((msg, index) => (
                    <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${msg.role === 'user'
                            ? 'bg-blue-600 text-white rounded-br-md'
                            : 'bg-white text-slate-700 shadow-sm border border-slate-100 rounded-bl-md'
                            }`}>
                            {msg.isFile && msg.role === 'user' && (
                                <div className="flex items-center gap-1 mb-1">
                                    <Upload className="w-3 h-3" />
                                </div>
                            )}
                            <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                            {msg.role === 'bot' && (
                                <button
                                    type="button"
                                    onClick={() => speakTtsText(msg.text, selectedLang, 'aditya')}
                                    className="mt-2 inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-200"
                                    title="Speak"
                                >
                                    <Volume2 className="h-3.5 w-3.5" />
                                    Speak
                                </button>
                            )}
                            {msg.isVoiceResult && msg.role === 'bot' && (
                                <div className="mt-3 space-y-2">
                                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
                                        <p className="text-[11px] font-bold text-slate-500 uppercase">User In English</p>
                                        <p className="text-xs text-slate-700">{msg.englishUserText || '-'}</p>
                                    </div>
                                    <div className="bg-sky-50 border border-sky-200 rounded-lg p-2">
                                        <p className="text-[11px] font-bold text-sky-700 uppercase">AI English Response</p>
                                        <p className="text-xs text-sky-900">{msg.aiEnglishResponse || '-'}</p>
                                    </div>
                                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2">
                                        <p className="text-[11px] font-bold text-emerald-700 uppercase">Native Response ({msg.detectedLanguage || selectedLang})</p>
                                        <p className="text-xs text-emerald-900">{msg.nativeResponse || msg.text}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {loading && (
                    <div className="flex justify-start">
                        <div className="bg-white rounded-2xl rounded-bl-md px-4 py-3 shadow-sm border border-slate-100">
                            <div className="flex items-center gap-2">
                                <Loader className="w-4 h-4 text-blue-600 animate-spin" />
                                <span className="text-sm text-slate-500">Thinking...</span>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={chatEndRef} />
            </div>

            {/* File Preview */}
            {uploadedFile && (
                <div className="px-6 pb-2">
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Upload className="w-4 h-4 text-blue-600" />
                            <span className="text-sm text-blue-700 font-medium truncate max-w-[200px]">{uploadedFile.name}</span>
                            <span className="text-xs text-blue-500">Ready to send</span>
                        </div>
                        <button onClick={() => setUploadedFile(null)} className="text-blue-400 hover:text-red-500">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Input Area */}
            <div className="bg-white border-t border-slate-100 px-6 py-4">
                <div className="mb-3 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-slate-500" />
                    <select
                        value={selectedLang}
                        onChange={(e) => setSelectedLang(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700"
                    >
                        {LANG_OPTIONS.map((lang) => (
                            <option key={lang.code} value={lang.code}>{lang.label}</option>
                        ))}
                    </select>
                    {!isRecording ? (
                        <button
                            onClick={startTalkNow}
                            className="ml-auto px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center gap-1"
                        >
                            <Mic className="w-3.5 h-3.5" /> Talk Now
                        </button>
                    ) : (
                        <button
                            onClick={stopTalkNow}
                            className="ml-auto px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold flex items-center gap-1"
                        >
                            <Square className="w-3.5 h-3.5" /> Stop
                        </button>
                    )}
                    {isListening && <span className="text-xs font-semibold text-red-600">Listening...</span>}
                </div>
                <div className="flex items-end gap-2">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="p-3 rounded-xl bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors flex-shrink-0"
                    >
                        <Upload className="w-5 h-5" />
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,.pdf"
                        onChange={handleFileChange}
                        className="hidden"
                    />
                    <div className="flex-1 relative">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask about your medicines..."
                            rows={1}
                            className="w-full bg-slate-50 rounded-xl px-4 py-3 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        />
                    </div>
                    <button
                        onClick={sendMessage}
                        disabled={loading || (!input.trim() && !uploadedFile)}
                        className="p-3 rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-200 hover:bg-blue-700 transition-colors flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-transform"
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
}

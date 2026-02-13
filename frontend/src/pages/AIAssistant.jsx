import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Send, Bot, User, Upload, Loader, X, AlertTriangle, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { safeFetch, safeQuery } from '../lib/safeAsync';

export default function AIAssistant() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const chatEndRef = useRef(null);
    const fileInputRef = useRef(null);

    const [messages, setMessages] = useState([
        { role: 'bot', text: 'Hello! I\'m your MedGuard AI assistant. I can answer health questions, analyze medical documents, and provide medication guidance. How can I help you today?' }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [uploadedFile, setUploadedFile] = useState(null); // { name, base64, mimeType }

    // Auto-scroll to bottom
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Get API key
    const getApiKey = () => {
        return localStorage.getItem('gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY || '';
    };

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

        const apiKey = getApiKey();
        if (!apiKey) {
            setMessages(prev => [...prev, { role: 'bot', text: '🚀 This feature is currently under trial and will be fully operational soon! Stay tuned for updates.' }]);
            return;
        }

        // Add user message to chat
        if (trimmed) {
            setMessages(prev => [...prev, { role: 'user', text: trimmed }]);
        }
        setInput('');
        setLoading(true);

        try {
            // Build context from user's medicines
            let medContext = '';
            try {
                const meds = await safeQuery('medicines', (sb) =>
                    sb.from('medicines').select('name, dosage, frequency, type, status').eq('user_id', user?.id),
                    []
                );
                if (meds?.length > 0) {
                    medContext = `\n\nUser's current medicines: ${meds.map(m => `${m?.name} (${m?.dosage}, ${m?.frequency})`).join(', ')}`;
                }
            } catch (e) { /* skip */ }

            // Build request parts
            const parts = [];

            // Add file if uploaded (real multimodal analysis)
            if (uploadedFile) {
                parts.push({
                    inlineData: {
                        mimeType: uploadedFile.mimeType,
                        data: uploadedFile.base64,
                    }
                });
            }

            // Add text prompt
            const systemPrompt = `You are MedGuard AI, a helpful and friendly medical assistant. You provide general health information and medication guidance.
            
RULES:
- Be helpful but always include a medical disclaimer
- If asked about drug interactions, be specific and cite risks
- If analyzing a medical document/image, extract and summarize key information
- Keep responses concise (3-5 sentences unless more detail is needed)
- Never diagnose diseases or prescribe medication
- Always recommend consulting a healthcare professional for serious concerns
${medContext}`;

            parts.push({
                text: uploadedFile
                    ? `${systemPrompt}\n\nThe user uploaded a medical document/image. ${trimmed || 'Please analyze this document and summarize the key medical information.'}`
                    : `${systemPrompt}\n\nUser question: ${trimmed}`
            });

            const { data, error: fetchError } = await safeFetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts }],
                    }),
                    timeout: 30000,
                    retries: 1,
                    label: 'ai-chat',
                }
            );

            // Clear uploaded file after sending
            setUploadedFile(null);

            if (fetchError || !data) {
                setMessages(prev => [...prev, { role: 'bot', text: '⚠️ I couldn\'t process your request. Please check your API key and try again.' }]);
                setLoading(false);
                return;
            }

            const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (responseText) {
                setMessages(prev => [...prev, { role: 'bot', text: responseText }]);
            } else {
                setMessages(prev => [...prev, { role: 'bot', text: '⚠️ I received an empty response. Please try rephrasing your question.' }]);
            }
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

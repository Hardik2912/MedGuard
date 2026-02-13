
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Volume2, CheckCircle, Mic, AlertCircle, Settings, Phone, Calendar } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { safeQuery, safeMutation, safeStorageGet } from '../lib/safeAsync';

export default function SeniorDashboard() {
    console.log("Senior Dashboard Loaded");
    const navigate = useNavigate();
    const { user, signOut } = useAuth();
    const [medicines, setMedicines] = useState([]);
    const [loading, setLoading] = useState(true);
    const [nextMed, setNextMed] = useState(null);
    const [caregiverAudio, setCaregiverAudio] = useState(safeStorageGet('medguard_caregiver_voice', null));
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);

    // Load Data
    useEffect(() => {
        if (!user) return;
        async function loadMeds() {
            setLoading(true);
            try {
                const data = await safeQuery('medicines', (sb) =>
                    sb.from('medicines').select('*').eq('user_id', user.id), []
                );

                setMedicines(data);
                const pending = data.filter(m => m?.status !== 'taken');
                if (pending.length > 0) {
                    setNextMed(pending[0]);
                }
            } catch (err) {
                console.error('[SeniorDash] Load error:', err);
            } finally {
                setLoading(false);
            }
        }
        loadMeds();
    }, [user]);

    // TTS Helper
    const speak = (text) => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel(); // Stop previous
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 0.9; // Slower for seniors
            utterance.pitch = 1.0;
            window.speechSynthesis.speak(utterance);
        }
    };

    // 1. HEAR REMINDER
    const playReminder = () => {
        if (caregiverAudio) {
            // Play recorded voice
            const audio = new Audio(caregiverAudio);
            audio.play();
        } else if (nextMed) {
            // Fallback to TTS
            speak(`It is time for your ${nextMed.name}. Please take ${nextMed.dosage}.`);
        } else {
            speak("You have no medicines pending for today. You are doing great.");
        }
    };

    // 2. MARK AS TAKEN
    const markTaken = async () => {
        if (!nextMed) return;

        // Optimistic Update
        const updated = { ...nextMed, status: 'taken' };
        setNextMed(null); // Clear main view temporarily or find next
        setMedicines(prev => prev.map(m => m.id === nextMed.id ? updated : m));

        // DB Update (safe)
        await safeMutation('medicines', (sb) =>
            sb.from('medicines').update({ status: 'taken' }).eq('id', nextMed.id)
        );

        // Verbal Confirmation
        speak("Thank you. I have marked that as taken. Great job.");
    };

    // 3. CAREGIVER RECORDING (Simple Implementation)
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) audioChunksRef.current.push(event.data);
            };

            mediaRecorderRef.current.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64Audio = reader.result;
                    localStorage.setItem('medguard_caregiver_voice', base64Audio);
                    setCaregiverAudio(base64Audio);
                    alert("Caregiver voice saved!");
                };
                reader.readAsDataURL(blob);
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
        } catch (err) {
            console.error("Mic Error:", err);
            alert("Could not access microphone.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center text-2xl font-bold bg-white">Loading...</div>;

    return (
        <div className="min-h-screen bg-white flex flex-col font-sans">

            {/* High Contrast Header */}
            <div className="bg-blue-900 text-white p-6 shadow-lg flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-wide">MED GUARD</h1>
                    <p className="text-blue-200 text-lg">Senior Mode</p>
                </div>
                <button onClick={signOut} className="text-lg font-bold bg-blue-800 px-6 py-2 rounded-xl border-2 border-blue-400">
                    Sign Out
                </button>
            </div>

            <div className="flex-1 p-6 flex flex-col gap-6 max-w-2xl mx-auto w-full">

                {/* 1. MAIN ACTION CARD (Next Medicine) */}
                <div className="flex-1 bg-amber-50 rounded-[3rem] border-4 border-amber-200 p-8 flex flex-col items-center justify-center text-center shadow-xl mb-4">
                    {nextMed ? (
                        <>
                            <div className="bg-white p-6 rounded-full shadow-md mb-6">
                                <AlertCircle className="w-20 h-20 text-amber-600" />
                            </div>
                            <h2 className="text-2xl text-slate-600 font-bold mb-2">It is time for your</h2>
                            <h1 className="text-5xl font-black text-slate-900 mb-4">{nextMed.name}</h1>
                            <span className="text-3xl font-bold text-blue-700 bg-blue-100 px-6 py-2 rounded-full mb-8">
                                {nextMed.dosage}
                            </span>

                            <div className="w-full grid gap-4">
                                <button
                                    onClick={playReminder}
                                    className="w-full py-8 bg-blue-600 hover:bg-blue-700 text-white text-3xl font-bold rounded-3xl shadow-lg flex items-center justify-center gap-4 transition-transform active:scale-95"
                                >
                                    <Volume2 className="w-10 h-10" /> Hear Reminder
                                </button>

                                <button
                                    onClick={markTaken}
                                    className="w-full py-8 bg-green-600 hover:bg-green-700 text-white text-3xl font-bold rounded-3xl shadow-lg flex items-center justify-center gap-4 transition-transform active:scale-95"
                                >
                                    <CheckCircle className="w-10 h-10" /> Mark as Taken
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="py-20">
                            <CheckCircle className="w-32 h-32 text-green-500 mx-auto mb-6" />
                            <h2 className="text-4xl font-bold text-slate-800">All Done!</h2>
                            <p className="text-2xl text-slate-500 mt-4">You have taken all your medicines.</p>
                        </div>
                    )}
                </div>

                {/* 2. SECONDARY ACTIONS */}
                <div className="grid grid-cols-2 gap-4">
                    <button
                        onClick={() => navigate('/ai-assistant')}
                        className="bg-purple-100 hover:bg-purple-200 border-4 border-purple-200 p-8 rounded-3xl flex flex-col items-center text-center transition-colors"
                    >
                        <div className="bg-white p-4 rounded-full mb-3 shadow-sm">
                            <Mic className="w-12 h-12 text-purple-600" />
                        </div>
                        <span className="text-2xl font-bold text-purple-900">Talk to<br />Assistant</span>
                    </button>

                    <div className="bg-slate-100 border-4 border-slate-200 p-6 rounded-3xl flex flex-col items-center justify-center text-center">
                        <h3 className="text-lg font-bold text-slate-700 mb-4">Caregiver Voice</h3>
                        {!isRecording ? (
                            <button
                                onClick={startRecording}
                                className="w-full py-3 bg-white border-2 border-slate-300 rounded-xl text-xl font-bold text-slate-600 shadow-sm active:bg-slate-200"
                            >
                                Record New
                            </button>
                        ) : (
                            <button
                                onClick={stopRecording}
                                className="w-full py-3 bg-red-100 border-2 border-red-300 rounded-xl text-xl font-bold text-red-600 shadow-sm animate-pulse"
                            >
                                Stop
                            </button>
                        )}
                        {caregiverAudio && !isRecording && (
                            <p className="text-sm text-green-600 font-bold mt-2">✓ Voice Saved</p>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}

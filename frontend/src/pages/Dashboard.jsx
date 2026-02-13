import React, { useState, useEffect, useRef } from 'react';
import { Bot, Mic, Check, X, Clock, Pill, Activity, Volume2, VolumeX, User, RefreshCw, Zap, Calendar, Settings, ChevronRight, Flame, Trophy, FileText, PlusCircle, AlertTriangle, Brain, Shield, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { safeQuery, safeMutation, safeStorageGet, safeStorageSet } from '../lib/safeAsync';
import { useBrain } from '../lib/useBrain';
import SeniorDashboard from './SeniorDashboard';

export default function Dashboard() {
    const navigate = useNavigate();
    const { user, signOut } = useAuth();

    // --- STATE ---
    const [medicines, setMedicines] = useState([]);
    const [loading, setLoading] = useState(true);
    const [userName, setUserName] = useState('User');
    const [progress, setProgress] = useState(0);
    const [stock, setStock] = useState({}); // Local Refill Tracker { medId: count }

    // Audio State
    const [speaking, setSpeaking] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [seniorMode, setSeniorMode] = useState(false);
    const [selectedVoiceName, setSelectedVoiceName] = useState("Default");
    const utteranceRef = useRef(null);

    // 🧠 AI Brain
    const { patterns, risks, decisions, brainLoading, refreshBrain } = useBrain(user, medicines);

    // --- FETCH DATA (Crash-Proof) ---
    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }

        async function fetchData() {
            setLoading(true);

            try {
                // 1. Get Profile (safe)
                const profile = await safeQuery(
                    'profiles',
                    (sb) => sb.from('profiles').select('*').eq('id', user.id).single(),
                    null
                );

                if (profile) {
                    // CHECK IF PROFILE IS COMPLETE — show what's missing
                    const missing = [];
                    if (!profile.full_name) missing.push('Full Name');
                    if (!profile.age) missing.push('Age');
                    if (!profile.gender) missing.push('Gender');

                    if (missing.length > 0) {
                        alert('Please complete your profile first! Missing: ' + missing.join(', '));
                        navigate('/profile');
                        return;
                    }

                    setUserName(profile.full_name?.split(' ')[0] || 'User');

                    // AUTO-ACTIVATE SENIOR MODE
                    if (profile.age >= 60 || profile.senior_mode) {
                        setSeniorMode(true);
                    }
                } else {
                    navigate('/profile');
                    return;
                }

                // 2. Get Medicines (safe)
                const meds = await safeQuery(
                    'medicines',
                    (sb) => sb.from('medicines').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
                    []
                );

                setMedicines(meds);

                // Calculate Progress
                const taken = meds.filter(m => m?.status === 'taken').length;
                const total = meds.length;
                setProgress(total > 0 ? Math.round((taken / total) * 100) : 0);

                // Load Stock from LocalStorage (safe)
                const savedStock = safeStorageGet('medguard_stock', null);
                if (savedStock) {
                    setStock(savedStock);
                } else {
                    const initialStock = {};
                    meds.forEach(m => initialStock[m.id] = 10);
                    setStock(initialStock);
                    safeStorageSet('medguard_stock', initialStock);
                }

                // --- DAILY RESET LOGIC (For Habit Loop & Demos) ---
                const today = new Date().toISOString().split('T')[0];
                const lastActive = localStorage.getItem('medguard_last_active_date');

                if (lastActive !== today && meds.length > 0) {
                    console.log("New Day Detected! Resetting Schedule...");

                    const { success } = await safeMutation(
                        'medicines',
                        (sb) => sb.from('medicines').update({ status: 'pending' }).eq('user_id', user.id).neq('status', 'pending')
                    );

                    if (success) {
                        const resetMeds = meds.map(m => ({ ...m, status: 'pending' }));
                        setMedicines(resetMeds);
                        setProgress(0);
                        localStorage.setItem('medguard_last_active_date', today);
                    }
                } else {
                    localStorage.setItem('medguard_last_active_date', today);
                }
            } catch (err) {
                console.error('[Dashboard] Fatal error during fetch:', err);
                // Don't crash — show empty state
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, [user, navigate]);


    // --- ROBUST AUDIO ENGINE ---
    const speak = (text) => {
        if (isMuted) return;
        if (!('speechSynthesis' in window)) return;

        try {
            window.speechSynthesis.cancel();
            window.speechSynthesis.resume();

            const utterance = new SpeechSynthesisUtterance(text);
            const voices = window.speechSynthesis.getVoices();

            let selectedVoice = null;
            if (seniorMode) {
                selectedVoice = voices.find(v => v.name.includes("Google US English")) || voices.find(v => v.name.includes("Daniel"));
            }
            if (!selectedVoice) {
                selectedVoice = voices.find(v => v.lang?.includes("en-US")) || voices[0];
            }

            utterance.voice = selectedVoice;
            utterance.rate = seniorMode ? 0.85 : 1.0;
            utterance.pitch = 1.0;

            utterance.onstart = () => setSpeaking(true);
            utterance.onend = () => {
                setSpeaking(false);
                utteranceRef.current = null;
            };
            utterance.onerror = () => setSpeaking(false);

            utteranceRef.current = utterance;
            window.speechSynthesis.speak(utterance);
        } catch (err) {
            console.error('[Audio]', err);
        }
    };

    // Voice Loader
    useEffect(() => {
        if (!('speechSynthesis' in window)) return;
        const load = () => window.speechSynthesis.getVoices();
        load();
        window.speechSynthesis.onvoiceschanged = load;
    }, []);

    const resetDashboard = async () => {
        try { window.speechSynthesis?.cancel(); } catch (e) { /* safe */ }

        // Delete all medicines for this user from DB
        if (user) {
            await safeMutation('medicines', (sb) =>
                sb.from('medicines').delete().eq('user_id', user.id)
            );
        }

        // Clear local state
        setMedicines([]);
        setProgress(0);
        setStock({});
        safeStorageSet('medguard_stock', {});
        localStorage.removeItem('medguard_last_active_date');
    };

    // --- ACTIONS (Crash-Proof) ---
    const triggerReminder = (med, level) => {
        let text = "";
        if (seniorMode) {
            if (level === 'due') {
                text = "Hello. It is time for your " + (med?.name || 'medicine') + ".";
            } else {
                text = "Please remember to take your " + (med?.name || 'medicine') + ".";
            }
        } else {
            if (level === 'due') text = "It is time to take " + (med?.name || 'medicine') + ".";
            if (level === '1h') text = "Alert: " + (med?.name || 'medicine') + " is overdue.";
        }
        speak(text);
    };

    const markTaken = async (id) => {
        // Optimistic Update
        const updatedMeds = medicines.map(m => m.id === id ? { ...m, status: 'taken' } : m);
        setMedicines(updatedMeds);

        // Update Progress State
        const taken = updatedMeds.filter(m => m?.status === 'taken').length;
        const total = updatedMeds.length;
        const newProgress = total > 0 ? Math.round((taken / total) * 100) : 0;
        setProgress(newProgress);

        speak("Great. I have updated your records.");

        // Database Update (safe)
        await safeMutation('medicines', (sb) =>
            sb.from('medicines').update({ status: 'taken' }).eq('id', id)
        );

        // Update Stock
        const newStock = { ...stock, [id]: Math.max((stock[id] || 0) - 1, 0) };
        setStock(newStock);
        safeStorageSet('medguard_stock', newStock);

        // 🧠 Log adherence if ALL done today
        const allDone = updatedMeds.every(m => m?.status === 'taken' || m?.status === 'skipped');
        if (allDone && total > 0) {
            const today = new Date().toISOString().split('T')[0];
            await safeMutation('adherence_log', (sb) =>
                sb.from('adherence_log').upsert({
                    user_id: user.id,
                    date: today,
                    all_taken: updatedMeds.every(m => m?.status === 'taken'),
                    total_meds: total,
                    taken_meds: taken,
                }, { onConflict: 'user_id,date' })
            );
            // Refresh Brain to update streak
            refreshBrain(updatedMeds);
        }
    };

    const handleSkip = async (id) => {
        const { success } = await safeMutation(
            'medicines',
            (sb) => sb.from('medicines').update({ status: 'skipped' }).eq('id', id)
        );
        if (success) {
            const updatedMeds = medicines.map(m => m.id === id ? { ...m, status: 'skipped' } : m);
            setMedicines(updatedMeds);

            // Update Progress
            const taken = updatedMeds.filter(m => m?.status === 'taken').length;
            const total = updatedMeds.length;
            setProgress(total > 0 ? Math.round((taken / total) * 100) : 0);

            // Check if all done
            const allDone = updatedMeds.every(m => m?.status === 'taken' || m?.status === 'skipped');
            if (allDone && total > 0) {
                const today = new Date().toISOString().split('T')[0];
                await safeMutation('adherence_log', (sb) =>
                    sb.from('adherence_log').upsert({
                        user_id: user.id,
                        date: today,
                        all_taken: false,
                        total_meds: total,
                        taken_meds: taken,
                    }, { onConflict: 'user_id,date' })
                );
                refreshBrain(updatedMeds);
            }
        }
    };

    const handleRefill = (id) => {
        const newStock = { ...stock, [id]: (stock[id] || 0) + 30 }; // Add 30 pills
        setStock(newStock);
        safeStorageSet('medguard_stock', newStock);
        alert("Refill Successful! Added 30 pills.");
    };

    const handleSignOut = async () => {
        await signOut();
        navigate('/');
    };

    // Get real streak from Brain (fallback to 0)
    const streak = patterns?.streak || 0;

    if (loading) return <div className="min-h-screen flex items-center justify-center">Loading Dashboard...</div>;

    if (seniorMode) return <SeniorDashboard />;

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col relative overflow-hidden">

            {/* Header Section */}
            <div className="bg-white rounded-b-[3rem] shadow-sm pb-8 pt-6 px-6 relative z-10">

                {/* Top Bar */}
                <div className="flex justify-between items-center mb-8">
                    <div className="flex items-center gap-3">
                        <div onClick={() => speak("I am online.")} className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center relative cursor-pointer active:scale-95 transition-transform">
                            <Bot className={`w-7 h-7 text-blue-600 ${speaking ? 'animate-bounce' : ''}`} />
                            {speaking && <span className="absolute -top-1 -right-1 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span></span>}
                        </div>
                        <div>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Good Morning</p>
                            <h1 className="text-xl font-bold text-slate-900">{userName}</h1>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button onClick={resetDashboard} className="p-2.5 rounded-xl bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"><RefreshCw className="w-5 h-5" /></button>
                        <button
                            onClick={() => navigate('/report')}
                            className="p-2.5 rounded-xl bg-slate-50 text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Doctor Report"
                        >
                            <FileText className="w-5 h-5" />
                        </button>
                        <button onClick={() => navigate('/profile')} className="p-2.5 rounded-xl bg-slate-50 text-slate-400 hover:text-slate-600 transition-colors"><User className="w-5 h-5" /></button>
                        <button onClick={() => navigate('/settings')} className="p-2.5 rounded-xl bg-slate-50 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"><Settings className="w-5 h-5" /></button>
                    </div>
                </div>

                {/* Gamification Card (Health Score & Streak) */}
                <div className="grid grid-cols-2 gap-4 mb-8">
                    {/* 1. Health Score */}
                    <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-5 text-white shadow-lg shadow-blue-200 relative overflow-hidden flex flex-col justify-between">
                        <div className="absolute right-0 top-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <Activity className="w-5 h-5 text-blue-200" />
                                <span className="text-sm font-bold text-blue-100 uppercase tracking-wider">Health Score</span>
                            </div>
                            <h2 className="text-4xl font-black">{progress}<span className="text-lg text-blue-300 font-medium">/100</span></h2>
                        </div>
                        <div className="mt-4">
                            <div className="h-2 w-full bg-black/20 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-white transition-all duration-1000 ease-out"
                                    style={{ width: `${progress}%` }}
                                ></div>
                            </div>
                            <p className="text-xs text-blue-200 mt-2 font-medium">
                                {progress === 100 ? "Perfect! Keep it up! 🌟" : "Take your meds to boost score!"}
                            </p>
                        </div>
                    </div>

                    {/* 2. Streak Counter (REAL — from Brain) */}
                    <div className="bg-gradient-to-br from-orange-500 to-pink-600 rounded-3xl p-5 text-white shadow-lg shadow-orange-200 relative overflow-hidden flex flex-col justify-between">
                        <div className="absolute right-0 top-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <Flame className="w-5 h-5 text-orange-200 animate-pulse" />
                                <span className="text-sm font-bold text-orange-100 uppercase tracking-wider">Streak</span>
                            </div>
                            <h2 className="text-4xl font-black">{streak} <span className="text-lg text-orange-200 font-medium">{streak === 1 ? 'Day' : 'Days'}</span></h2>
                        </div>
                        <div className="mt-4 flex items-center justify-between">
                            <div className="flex -space-x-2">
                                {[...Array(Math.min(streak, 7))].map((_, i) => (
                                    <div key={i} className={`w-7 h-7 rounded-full ${i === Math.min(streak, 7) - 1 ? 'bg-white text-orange-600 font-bold' : 'bg-white/20'} border-2 border-white/50 flex items-center justify-center text-[10px]`}>
                                        {['M', 'T', 'W', 'T', 'F', 'S', 'S'][i % 7]}
                                    </div>
                                ))}
                                {streak === 0 && <span className="text-xs text-orange-200">Start your streak today!</span>}
                            </div>
                            {streak >= 3 && <Trophy className="w-8 h-8 text-yellow-300 drop-shadow-sm" />}
                        </div>
                    </div>
                </div>
            </div>

            {/* 🚦 Traffic Light — Simple Adherence Status */}
            {medicines.length > 0 && (() => {
                const total = medicines.length;
                const taken = medicines.filter(m => m?.status === 'taken').length;
                const skipped = medicines.filter(m => m?.status === 'skipped').length;
                const pending = medicines.filter(m => m?.status === 'pending').length;

                // Determine traffic light level
                let level = 'green';
                let statusText = '✅ All Clear — Great job!';
                let statusDetail = 'All medicines taken for today.';

                if (taken === total && total > 0) {
                    level = 'green';
                    statusText = '✅ All Clear — Great job!';
                    statusDetail = `${taken}/${total} medicines taken today.`;
                } else if (skipped >= total && taken === 0 && pending === 0) {
                    level = 'red';
                    statusText = '🚨 Warning — All Doses Missed!';
                    statusDetail = `All ${total} medicines skipped today. Please take them or consult your doctor.`;
                } else if (skipped > 0 || (pending > 0 && taken > 0)) {
                    level = 'yellow';
                    statusText = `⚠️ Attention — ${skipped + pending} dose${skipped + pending !== 1 ? 's' : ''} remaining`;
                    statusDetail = `${taken} taken, ${skipped} skipped, ${pending} pending.`;
                } else if (pending === total) {
                    level = 'yellow';
                    statusText = '⏳ Pending — No medicines taken yet';
                    statusDetail = `${total} medicine${total !== 1 ? 's' : ''} scheduled for today.`;
                }

                // Check symptoms for extra warnings
                const symptomIds = (() => {
                    try {
                        const raw = localStorage.getItem('medguard_symptoms');
                        return raw ? JSON.parse(raw) : [];
                    } catch (e) { return []; }
                })();

                const SYMPTOM_MAP = {
                    'rash': 'Skin Rash / Itching',
                    'gastritis': 'Stomach Pain / Acidity',
                    'swelling': 'Swelling of Face/Lips',
                    'dizziness': 'Dizziness / Giddiness',
                    'cough': 'Dry Cough (Persistent)',
                    'fever_pers': 'Fever not reducing (3+ days)',
                    'recur_inf': 'Recurring Infection',
                    'fatigue': 'Extreme Weakness'
                };

                const HIGH_SEVERITY = ['swelling', 'fever_pers', 'recur_inf'];
                const hasHighSymptoms = symptomIds.some(id => HIGH_SEVERITY.includes(id));
                const hasMediumSymptoms = symptomIds.length > 0;

                // Symptom escalation
                if (hasHighSymptoms && level !== 'red') {
                    level = 'red';
                    statusText = '🚨 Alert — Severe Symptoms Reported';
                    statusDetail = 'You have high-risk symptoms. Consult your doctor immediately.';
                } else if (hasMediumSymptoms && level === 'green') {
                    level = 'yellow';
                    statusText = '⚠️ Monitor — Symptoms Reported';
                    statusDetail = 'Symptoms reported. Keep taking medicines and monitor closely.';
                }

                const colors = {
                    green: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', detail: 'text-emerald-600', dot: 'bg-emerald-500', glow: 'shadow-emerald-200' },
                    yellow: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', detail: 'text-amber-600', dot: 'bg-amber-500', glow: 'shadow-amber-200' },
                    red: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', detail: 'text-red-600', dot: 'bg-red-500', glow: 'shadow-red-200' },
                };
                const c = colors[level];

                return (
                    <div className="px-6 pt-4 space-y-3">
                        {/* Main Traffic Light Card */}
                        <div className={`${c.bg} border ${c.border} rounded-2xl p-4 shadow-sm ${c.glow}`}>
                            <div className="flex items-center gap-3">
                                {/* Traffic light dots */}
                                <div className="flex flex-col gap-1.5">
                                    <div className={`w-4 h-4 rounded-full ${level === 'red' ? 'bg-red-500 shadow-lg shadow-red-300' : 'bg-red-200'} transition-all`} />
                                    <div className={`w-4 h-4 rounded-full ${level === 'yellow' ? 'bg-amber-500 shadow-lg shadow-amber-300' : 'bg-amber-200'} transition-all`} />
                                    <div className={`w-4 h-4 rounded-full ${level === 'green' ? 'bg-emerald-500 shadow-lg shadow-emerald-300' : 'bg-emerald-200'} transition-all`} />
                                </div>
                                <div className="flex-1">
                                    <h4 className={`font-bold text-sm ${c.text}`}>{statusText}</h4>
                                    <p className={`text-xs mt-0.5 ${c.detail}`}>{statusDetail}</p>
                                </div>
                                <Shield className={`w-6 h-6 ${c.text} opacity-50`} />
                            </div>
                        </div>

                        {/* Symptom Warning Cards */}
                        {symptomIds.length > 0 && (
                            <div className={`${hasHighSymptoms ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'} border rounded-2xl p-4`}>
                                <div className="flex items-start gap-3">
                                    <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${hasHighSymptoms ? 'text-red-500' : 'text-amber-500'}`} />
                                    <div>
                                        <h4 className={`font-bold text-sm ${hasHighSymptoms ? 'text-red-800' : 'text-amber-800'}`}>
                                            {hasHighSymptoms ? 'Severe Symptoms Detected' : 'Active Symptoms'}
                                        </h4>
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {symptomIds.map(id => (
                                                <span key={id} className={`text-[10px] font-bold px-2 py-1 rounded-full ${HIGH_SEVERITY.includes(id) ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                                    {SYMPTOM_MAP[id] || id}
                                                </span>
                                            ))}
                                        </div>
                                        {hasHighSymptoms && (
                                            <p className="text-xs text-red-600 mt-2 font-semibold">⚕️ Please consult your doctor about these symptoms.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* Timeline Section */}
            <div className="flex-1 overflow-y-auto px-6 py-6 pb-24">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-slate-800 text-lg">Today's Schedule</h3>
                    <div className="flex gap-2">
                        <button
                            onClick={() => navigate('/scan-prescription')}
                            className="flex items-center gap-1 text-blue-600 text-xs font-bold bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                            <PlusCircle className="w-3.5 h-3.5" /> Add / Upload
                        </button>
                    </div>
                </div>

                {medicines.length === 0 ? (
                    <div className="text-center py-10 opacity-50">
                        <Pill className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                        <p>No medicines scheduled today.</p>
                        <button onClick={() => navigate('/scan-prescription')} className="text-blue-600 font-bold mt-2">Scan Prescription</button>
                    </div>
                ) : (
                    <div className="space-y-6 relative">
                        {/* Timeline Line */}
                        <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-slate-200"></div>

                        {medicines.map((med, index) => (
                            <div key={med?.id || index} className="relative pl-10 animate-fade-in-up" style={{ animationDelay: `${index * 100}ms` }}>

                                {/* Timeline Dot */}
                                <div className={`absolute left-0 top-4 w-10 h-10 rounded-full border-4 border-slate-50 flex items-center justify-center z-10 ${med?.status === 'taken' ? 'bg-green-500 text-white' : med?.urgent ? 'bg-red-500 text-white animate-pulse' : 'bg-blue-100 text-blue-600'
                                    }`}>
                                    {med?.status === 'taken' ? <Check className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                                </div>

                                {/* Card */}
                                <div className={`bg-white rounded-2xl p-5 shadow-sm border transition-all ${med?.status === 'taken' ? 'border-slate-100 opacity-60' : med?.urgent ? 'border-red-100 shadow-md ring-1 ring-red-100' : 'border-slate-100'
                                    }`}>
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h4 className={`font-bold text-lg ${med?.status === 'taken' ? 'text-slate-500 line-through' : 'text-slate-800'}`}>{med?.name || 'Medicine'}</h4>
                                            <p className="text-slate-400 text-sm font-medium">{med?.dosage || ''}</p>

                                            {/* Refill Tracker UI */}
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${(stock[med?.id] || 0) <= 3
                                                    ? 'bg-red-100 text-red-600 animate-pulse'
                                                    : 'bg-slate-100 text-slate-500'
                                                    }`}>
                                                    {(stock[med?.id] || 0)} left
                                                </span>
                                                {(stock[med?.id] || 0) <= 5 && (
                                                    <button
                                                        onClick={() => handleRefill(med?.id)}
                                                        className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-1"
                                                    >
                                                        <PlusCircle className="w-3 h-3" /> Refill
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            {med?.times?.[0] && (
                                                <span className={`text-xs font-bold px-2 py-1 rounded-md ${med?.urgent && med?.status !== 'taken' ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-500'}`}>
                                                    {med.times[0]}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {med?.status !== 'taken' && (
                                        <div className="flex gap-3 mt-4">
                                            <button
                                                onClick={() => markTaken(med?.id)}
                                                className="flex-1 bg-slate-900 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-slate-200 active:scale-95 transition-transform flex items-center justify-center gap-2"
                                            >
                                                <Check className="w-4 h-4" /> Take
                                            </button>
                                            <div className="flex gap-1">
                                                <button onClick={() => handleSkip(med?.id)} className="p-3 rounded-xl bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors" title="Skip">
                                                    <X className="w-5 h-5" />
                                                </button>
                                                <button onClick={() => triggerReminder(med, 'due')} className="p-3 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors">
                                                    <Volume2 className="w-5 h-5" />
                                                </button>
                                                <button onClick={() => triggerReminder(med, '1h')} className="p-3 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
                                                    <Zap className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Floating Mic Button */}
            <div className="absolute bottom-6 left-0 right-0 flex justify-center z-50 pointer-events-none">
                <button
                    onClick={() => navigate('/ai-assistant')}
                    className="pointer-events-auto w-16 h-16 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-full shadow-2xl shadow-blue-400/50 flex items-center justify-center text-white transition-transform hover:scale-110 active:scale-95 group"
                >
                    <Mic className="w-8 h-8 group-hover:animate-pulse" />
                </button>
            </div>
        </div>
    );
}

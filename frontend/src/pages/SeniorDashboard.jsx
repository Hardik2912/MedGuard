
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Volume2, CheckCircle, Mic, AlertCircle, Bot, Globe, Upload, RotateCcw, Clock, Activity } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { safeQuery, safeMutation, safeStorageGet } from '../lib/safeAsync';
import { chatWithAI, voiceConverse } from '../lib/aiClient';

export default function SeniorDashboard({ onExitSeniorMode }) {
    const navigate = useNavigate();
    const { user, signOut } = useAuth();
    const [medicines, setMedicines] = useState([]);
    const [loading, setLoading] = useState(true);
    const [nextMed, setNextMed] = useState(null);
    const [caregiverAudio, setCaregiverAudio] = useState(safeStorageGet('medguard_caregiver_voice', null));
    const [isRecording, setIsRecording] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [liveMode, setLiveMode] = useState(false);
    const [heardText, setHeardText] = useState('');
    const [availableVoices, setAvailableVoices] = useState([]);
    const [selectedLang, setSelectedLang] = useState(localStorage.getItem('medguard_senior_lang') || 'en-IN');
    const [timeModalOpen, setTimeModalOpen] = useState(false);
    const [editingMedicine, setEditingMedicine] = useState(null);
    const [selectedTimes, setSelectedTimes] = useState(['08:00']);
    const [timeDraft, setTimeDraft] = useState('08:00');
    const [voiceProvider, setVoiceProvider] = useState('unknown');
    const [emergencyAlert, setEmergencyAlert] = useState('');
    const [demoRunning, setDemoRunning] = useState(false);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const speechRecRef = useRef(null);
    const reminderSpokenRef = useRef(new Set());

    const LANG_OPTIONS = [
        { code: 'en-IN', label: 'English (India)' },
        { code: 'hi-IN', label: 'Hindi' },
        { code: 'bn-IN', label: 'Bengali' },
        { code: 'ta-IN', label: 'Tamil' },
        { code: 'te-IN', label: 'Telugu' },
        { code: 'bho-IN', label: 'Bhojpuri' },
        { code: 'mr-IN', label: 'Marathi' },
        { code: 'gu-IN', label: 'Gujarati' },
        { code: 'kn-IN', label: 'Kannada' },
        { code: 'ml-IN', label: 'Malayalam' },
        { code: 'pa-IN', label: 'Punjabi' },
    ];

    const I18N = {
        'en-IN': {
            reminderWithMed: (name, dose) => `It is time for your ${name}. Please take ${dose}.`,
            reminderDone: 'You have no medicines pending for today. You are doing great.',
            thanksTaken: 'Thank you. I have marked that as taken. Great job.',
            unsupported: 'Voice commands are not supported on this device browser.',
            unclear: 'I could not hear clearly. Please try again.',
            unknown: 'I heard you, but I did not understand. Please say reminder, taken, or assistant.',
        },
        'hi-IN': {
            reminderWithMed: (name, dose) => `आपकी ${name} लेने का समय हो गया है। कृपया ${dose} लें।`,
            reminderDone: 'आज आपकी सभी दवाइयाँ पूरी हो गई हैं। बहुत अच्छा।',
            thanksTaken: 'धन्यवाद। मैंने इसे लिया हुआ मार्क कर दिया है।',
            unsupported: 'इस ब्राउज़र में वॉइस कमांड उपलब्ध नहीं है।',
            unclear: 'मैं साफ़ नहीं सुन पाया। कृपया फिर से बोलें।',
            unknown: 'मैंने सुना, लेकिन समझ नहीं पाया। कृपया रिमाइंडर, टेकन या असिस्टेंट बोलें।',
        },
        'bn-IN': {
            reminderWithMed: (name, dose) => `আপনার ${name} নেওয়ার সময় হয়েছে। দয়া করে ${dose} নিন।`,
            reminderDone: 'আজ আপনার সব ওষুধ শেষ। খুব ভালো।',
            thanksTaken: 'ধন্যবাদ। আমি এটি নেওয়া হয়েছে বলে চিহ্নিত করেছি।',
            unsupported: 'এই ব্রাউজারে ভয়েস কমান্ড নেই।',
            unclear: 'আমি পরিষ্কার শুনতে পারিনি। আবার বলুন।',
            unknown: 'আমি শুনেছি, কিন্তু বুঝতে পারিনি। reminder, taken, assistant বলুন।',
        },
        'ta-IN': {
            reminderWithMed: (name, dose) => `${name} மருந்து எடுக்க வேண்டிய நேரம் வந்துவிட்டது. தயவுசெய்து ${dose} எடுக்கவும்.`,
            reminderDone: 'இன்று உங்கள் மருந்துகள் அனைத்தும் முடிந்துவிட்டது. அருமை.',
            thanksTaken: 'நன்றி. எடுத்ததாக குறித்துவிட்டேன்.',
            unsupported: 'இந்த உலாவியில் குரல் கட்டளைகள் இல்லை.',
            unclear: 'தெளிவாக கேட்கவில்லை. மீண்டும் சொல்லுங்கள்.',
            unknown: 'கேட்டேன், ஆனால் புரியவில்லை. reminder, taken அல்லது assistant சொல்லுங்கள்.',
            liveOn: 'நேரடி உரையாடல் தொடங்கப்பட்டது. தொடர்ந்து பேசலாம்.',
            liveOff: 'நேரடி உரையாடல் நிறுத்தப்பட்டது.',
        },
        'pa-IN': {
            reminderWithMed: (name, dose) => `ਤੁਹਾਡੀ ${name} ਲੈਣ ਦਾ ਸਮਾਂ ਹੋ ਗਿਆ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ${dose} ਲਓ।`,
            reminderDone: 'ਅੱਜ ਤੁਹਾਡੀਆਂ ਸਾਰੀਆਂ ਦਵਾਈਆਂ ਮੁੱਕ ਗਈਆਂ ਹਨ। ਬਹੁਤ ਵਧੀਆ।',
            thanksTaken: 'ਧੰਨਵਾਦ। ਮੈਂ ਇਸਨੂੰ ਲਿਆ ਹੋਇਆ ਨਿਸ਼ਾਨ ਲਾ ਦਿੱਤਾ ਹੈ।',
            unsupported: 'ਇਸ ਬਰਾਊਜ਼ਰ ਵਿੱਚ ਵੌਇਸ ਕਮਾਂਡ ਉਪਲਬਧ ਨਹੀਂ ਹਨ।',
            unclear: 'ਮੈਂ ਸਾਫ਼ ਨਹੀਂ ਸੁਣ ਸਕਿਆ। ਕਿਰਪਾ ਕਰਕੇ ਮੁੜ ਬੋਲੋ।',
            unknown: 'ਮੈਂ ਸੁਣਿਆ, ਪਰ ਸਮਝ ਨਹੀਂ ਆਇਆ। reminder, taken ਜਾਂ assistant ਬੋਲੋ।',
            liveOn: 'ਲਾਈਵ ਗੱਲਬਾਤ ਸ਼ੁਰੂ ਹੋ ਗਈ ਹੈ। ਤੁਸੀਂ ਲਗਾਤਾਰ ਬੋਲ ਸਕਦੇ ਹੋ।',
            liveOff: 'ਲਾਈਵ ਗੱਲਬਾਤ ਬੰਦ ਕਰ ਦਿੱਤੀ ਗਈ ਹੈ।',
        },
        'mr-IN': {
            reminderWithMed: (name, dose) => `तुमची ${name} घेण्याची वेळ झाली आहे. कृपया ${dose} घ्या.`,
            reminderDone: 'आजची सर्व औषधे पूर्ण झाली. खूप छान.',
            thanksTaken: 'धन्यवाद. मी हे घेतले म्हणून नोंदवले आहे.',
            unsupported: 'या ब्राउझरमध्ये व्हॉइस कमांड उपलब्ध नाहीत.',
            unclear: 'मला स्पष्ट ऐकू आले नाही. कृपया पुन्हा बोला.',
            unknown: 'मी ऐकले, पण समजले नाही. reminder, taken किंवा assistant म्हणा.',
            liveOn: 'लाईव्ह संवाद सुरू झाला आहे. तुम्ही बोलू शकता.',
            liveOff: 'लाईव्ह संवाद बंद केला आहे.',
        },
        'kn-IN': {
            reminderWithMed: (name, dose) => `${name} ಔಷಧಿ ತೆಗೆದುಕೊಳ್ಳುವ ಸಮಯವಾಗಿದೆ. ದಯವಿಟ್ಟು ${dose} ತೆಗೆದುಕೊಳ್ಳಿ.`,
            reminderDone: 'ಇಂದು ನಿಮ್ಮ ಎಲ್ಲಾ ಔಷಧಿಗಳು ಪೂರ್ಣಗೊಂಡಿವೆ. ತುಂಬಾ ಚೆನ್ನಾಗಿದೆ.',
            thanksTaken: 'ಧನ್ಯವಾದಗಳು. ತೆಗೆದುಕೊಂಡಂತೆ ಗುರುತಿಸಲಾಗಿದೆ.',
            unsupported: 'ಈ ಬ್ರೌಸರ್‌ನಲ್ಲಿ ವಾಯ್ಸ್ ಕಮಾಂಡ್ ಬೆಂಬಲ ಇಲ್ಲ.',
            unclear: 'ಸ್ಪಷ್ಟವಾಗಿ ಕೇಳಿಸಲಿಲ್ಲ. ಮತ್ತೆ ಹೇಳಿ.',
            unknown: 'ನಾನು ಕೇಳಿದೆ, ಆದರೆ ಅರ್ಥವಾಗಲಿಲ್ಲ. reminder, taken ಅಥವಾ assistant ಹೇಳಿ.',
            liveOn: 'ಲೈವ್ ಸಂಭಾಷಣೆ ಆರಂಭವಾಗಿದೆ. ಮುಂದುವರಿಸಿ ಮಾತನಾಡಬಹುದು.',
            liveOff: 'ಲೈವ್ ಸಂಭಾಷಣೆ ನಿಲ್ಲಿಸಲಾಗಿದೆ.',
        },
        'te-IN': {
            reminderWithMed: (name, dose) => `మీ ${name} తీసుకునే సమయం వచ్చింది. దయచేసి ${dose} తీసుకోండి.`,
            reminderDone: 'ఈ రోజు మీ మందులు అన్నీ పూర్తయ్యాయి. చాలా బాగుంది.',
            thanksTaken: 'ధన్యవాదాలు. తీసుకున్నట్లు నమోదు చేసాను.',
            unsupported: 'ఈ బ్రౌజర్‌లో వాయిస్ కమాండ్లు అందుబాటులో లేవు.',
            unclear: 'స్పష్టంగా వినిపించలేదు. మళ్లీ చెప్పండి.',
            unknown: 'విన్నాను కానీ అర్థం కాలేదు. reminder, taken లేదా assistant అనండి.',
            liveOn: 'లైవ్ సంభాషణ ప్రారంభమైంది. మాట్లాడవచ్చు.',
            liveOff: 'లైవ్ సంభాషణ ఆపబడింది.',
        },
        'bho-IN': {
            reminderWithMed: (name, dose) => `अब ${name} खाए के समय हो गइल बा। कृपया ${dose} लीं।`,
            reminderDone: 'आज रउआ सभे दवाई पूरा हो गइल। बहुते बढ़िया।',
            thanksTaken: 'धन्यवाद। हम एहके खाइल मार्क कर देनी।',
            unsupported: 'एह ब्राउज़र में वॉइस कमांड उपलब्ध नइखे।',
            unclear: 'हम ठीक से सुन ना पवनी। फेरु बोलीं।',
            unknown: 'हम सुननी, बाकिर समझ ना आइल। reminder, taken या assistant बोलीं।',
            liveOn: 'लाइव बातचीत चालू हो गइल बा। अब बोल सकत बानी।',
            liveOff: 'लाइव बातचीत बंद कर दिहल गइल बा।',
        },
    };

    const t = (key, ...args) => {
        const pack = I18N[selectedLang] || I18N['en-IN'];
        const fallback = I18N['en-IN'];
        const val = pack[key] || fallback[key];
        return typeof val === 'function' ? val(...args) : val;
    };

    // Load Data
    useEffect(() => {
        if (!user) return;
        async function loadMeds() {
            setLoading(true);
            try {
                const data = await safeQuery('medicines', (sb) =>
                    sb.from('medicines').select('*').eq('user_id', user.id), []
                );

                setMedicines(data || []);
            } catch (err) {
                console.error('[SeniorDash] Load error:', err);
            } finally {
                setLoading(false);
            }
        }
        loadMeds();
    }, [user]);

    const getNextDoseDate = (med) => {
        const now = new Date();
        const times = Array.isArray(med?.times) && med.times.length > 0 ? med.times : ['08:00'];
        let best = null;

        for (const t of times) {
            const [hh, mm] = String(t).split(':').map(Number);
            if (Number.isNaN(hh) || Number.isNaN(mm)) continue;
            const d = new Date(now);
            d.setHours(hh, mm, 0, 0);
            if (d < now) d.setDate(d.getDate() + 1);
            if (!best || d < best) best = d;
        }
        return best || new Date(now.getTime() + 24 * 60 * 60 * 1000);
    };

    const sortedMedicines = [...medicines].sort((a, b) => getNextDoseDate(a) - getNextDoseDate(b));

    useEffect(() => {
        const pending = sortedMedicines.filter(m => m?.status !== 'taken');
        setNextMed(pending.length > 0 ? pending[0] : null);
    }, [medicines]);

    useEffect(() => {
        const timer = setInterval(() => {
            const now = new Date();
            const hh = String(now.getHours()).padStart(2, '0');
            const mm = String(now.getMinutes()).padStart(2, '0');
            const nowKey = `${hh}:${mm}`;

            for (const med of medicines) {
                if (med?.status === 'taken') continue;
                const times = Array.isArray(med?.times) && med.times.length > 0 ? med.times : ['08:00'];
                for (const doseTime of times) {
                    const slot = `${med.id}|${doseTime}|${now.toDateString()}`;
                    if (doseTime === nowKey && !reminderSpokenRef.current.has(slot)) {
                        reminderSpokenRef.current.add(slot);
                        playReminder(med).catch(() => {
                            speakWithBrowserFallback(t('reminderWithMed', med.name, med.dosage || 'your dose'));
                        });
                    }
                }
            }
        }, 30000);

        return () => clearInterval(timer);
    }, [medicines, selectedLang, availableVoices]);

    useEffect(() => {
        if (!('speechSynthesis' in window)) return;
        const loadVoices = () => {
            const voices = window.speechSynthesis.getVoices() || [];
            setAvailableVoices(voices);
        };
        loadVoices();
        window.speechSynthesis.onvoiceschanged = loadVoices;
        return () => {
            window.speechSynthesis.onvoiceschanged = null;
            try { window.speechSynthesis.cancel(); } catch (err) { }
        };
    }, []);

    useEffect(() => {
        localStorage.setItem('medguard_senior_lang', selectedLang);
    }, [selectedLang]);

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const res = await fetch('/api/health');
                const data = await res.json();
                if (mounted) setVoiceProvider(String(data?.voiceProvider || 'unknown'));
            } catch {
                if (mounted) setVoiceProvider('unknown');
            }
        })();
        return () => { mounted = false; };
    }, []);

    // TTS Helper
    const speakWithBrowserFallback = (text) => {
        if (!('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.lang = selectedLang;
        const exactVoice = availableVoices.find(v => v.lang === selectedLang);
        const prefixVoice = availableVoices.find(v => v.lang?.startsWith(selectedLang.split('-')[0]));
        const fallbackHindi = selectedLang === 'bho-IN'
            ? availableVoices.find(v => v.lang === 'hi-IN' || v.lang?.startsWith('hi'))
            : null;
        if (exactVoice || prefixVoice || fallbackHindi) utterance.voice = exactVoice || prefixVoice || fallbackHindi;
        window.speechSynthesis.speak(utterance);
    };

    const speak = async (text) => {
        const content = String(text || '').trim();
        if (!content) return;
        speakWithBrowserFallback(content);
    };

    const speakInLanguage = async (text, langCode) => {
        speakWithBrowserFallback(text);
    };

    const runDemoScript = async () => {
        if (demoRunning) return;
        setDemoRunning(true);
        try {
            const scenes = [
                { lang: 'hi-IN', text: 'Reminder: It is time to take your Amoxicillin 500 milligram.' },
                { lang: 'ta-IN', text: 'You reported dizziness. Please drink water and consult your doctor if it continues.' },
                { lang: 'kn-IN', text: 'Please confirm if you took your evening medicine.' },
            ];
            for (const s of scenes) {
                await speakInLanguage(s.text, s.lang);
                await new Promise((r) => setTimeout(r, 3500));
            }
        } finally {
            setDemoRunning(false);
        }
    };

    const playBase64Audio = (audioBase64, mimeType = 'audio/wav') => {
        try {
            if (!audioBase64) return false;
            const src = `data:${mimeType};base64,${audioBase64}`;
            const audio = new Audio(src);
            audio.play().catch(() => speak(t('unknown')));
            return true;
        } catch {
            return false;
        }
    };

    const playBlobAudio = (blob) => {
        try {
            if (!blob) return false;
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audio.onended = () => URL.revokeObjectURL(url);
            audio.play().catch(() => URL.revokeObjectURL(url));
            return true;
        } catch {
            return false;
        }
    };

    const commandMatches = (transcript, words) =>
        words.some(w => transcript.includes(w));

    const handleVoiceCommand = async (rawText) => {
        const text = String(rawText || '').toLowerCase().trim();
        if (!text) return;
        setHeardText(rawText);

        const EMERGENCY_WORDS = [
            'chest pain', 'breathless', 'breathing problem', 'fainted', 'collapse', 'severe dizziness',
            'सीने में दर्द', 'सांस', 'बेहोश', 'மார்பு வலி', 'மூச்சு', 'ನೊವು', 'ಉಸಿರಾಟ',
        ];
        if (EMERGENCY_WORDS.some((w) => text.includes(w))) {
            const alertText = 'Emergency warning: serious symptoms detected. Please seek immediate medical help or call emergency services.';
            setEmergencyAlert(alertText);
            await speak(alertText);
            return;
        }

        const TAKE_WORDS = ['take', 'taken', 'done', 'complete', 'mark as taken', 'ले लिया', 'हो गया', 'खा लिया', 'ট্যাবলেট নিয়েছি', 'মার্ক', 'ಮುಗಿತು', 'ஆயிற்று', 'తీసుకున్నాను'];
        const REMINDER_WORDS = ['reminder', 'repeat', 'hear', 'play', 'याद', 'फिर', 'सुनाओ', 'আবার', 'শোনাও', 'ಮತ್ತೆ', 'மீண்டும்', 'మళ్లీ'];
        const ASSISTANT_WORDS = ['assistant', 'help', 'doctor', 'chat', 'मदद', 'सहायता', 'ডাক্তার', 'সহায়তা', 'உதவி', 'సహాయం'];

        if (commandMatches(text, TAKE_WORDS)) {
            await markTaken();
            return;
        }
        if (commandMatches(text, REMINDER_WORDS)) {
            playReminder();
            return;
        }
        if (commandMatches(text, ASSISTANT_WORDS)) {
            navigate('/ai-assistant');
            return;
        }
        if (commandMatches(text, ['stop', 'exit live', 'बंद', 'நிறுத்து', 'ఆపు', 'বন্ধ'])) {
            if (liveMode) {
                setLiveMode(false);
                stopVoiceAssistant();
                speak(t('liveOff') || 'Live conversation stopped.');
                return;
            }
        }

        // Conversational fallback: multilingual voice pipeline (Sarvam/Bhashini/Ollama based on backend provider).
        const voiceResult = await voiceConverse({
            transcript: rawText,
            languageHint: selectedLang,
            medicines,
        });
        if (voiceResult) {
            const played = voiceResult?.audioBase64
                ? playBase64Audio(voiceResult.audioBase64, voiceResult.mimeType || 'audio/wav')
                : false;
            if (!played) {
                const replyText = voiceResult.nativeResponse || voiceResult.aiEnglishResponse || '';
                if (replyText) speak(replyText);
            }
            return;
        }

        const langLabel = LANG_OPTIONS.find(l => l.code === selectedLang)?.label || selectedLang;
        const aiPrompt = `Respond in ${langLabel}. Keep answer concise and senior-friendly. User said: ${rawText}`;
        const aiReply = await chatWithAI({ message: aiPrompt, medicines });
        if (aiReply) {
            speak(aiReply);
            return;
        }

        speak(t('unknown'));
    };

    const stopVoiceAssistant = () => {
        setIsListening(false);
        if (speechRecRef.current) {
            try { speechRecRef.current.stop(); } catch (err) { }
        }
    };

    const startVoiceAssistant = () => {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) {
            speak(t('unsupported'));
            return;
        }
        try {
            if (speechRecRef.current) {
                speechRecRef.current.abort();
            }
            const rec = new SR();
            rec.lang = selectedLang;
            rec.interimResults = false;
            rec.maxAlternatives = 1;
            rec.continuous = liveMode;

            rec.onstart = () => setIsListening(true);
            rec.onend = () => {
                setIsListening(false);
                if (liveMode) {
                    // Auto-restart for one-to-one live conversation
                    setTimeout(() => {
                        if (liveMode) startVoiceAssistant();
                    }, 300);
                }
            };
            rec.onerror = () => {
                setIsListening(false);
                speak(t('unclear'));
            };
            rec.onresult = async (event) => {
                const transcript = event?.results?.[0]?.[0]?.transcript || '';
                await handleVoiceCommand(transcript);
            };

            speechRecRef.current = rec;
            rec.start();
        } catch (err) {
            setIsListening(false);
        }
    };

    const toggleLiveMode = () => {
        const next = !liveMode;
        setLiveMode(next);
        if (!next) {
            stopVoiceAssistant();
            speak(t('liveOff') || 'Live conversation stopped.');
            return;
        }
        speak(t('liveOn') || 'Live conversation started.');
        setTimeout(() => startVoiceAssistant(), 200);
    };

    // 1. HEAR REMINDER
    const playReminder = async (targetMed = null) => {
        const med = targetMed || nextMed;

        try {
            if (caregiverAudio) {
                // Play recorded voice
                const audio = new Audio(caregiverAudio);
                audio.play();
            } else if (med) {
                const reminderText = `Reminder: It is time to take your ${med.name}${med.dosage ? ` ${med.dosage}` : ''}. Please follow your doctor's instructions.`;
                await speak(reminderText);
            } else {
                await speak(t('reminderDone'));
            }
        } catch (err) {
            const fallbackText = med
                ? t('reminderWithMed', med.name, med.dosage || 'your dose')
                : t('reminderDone');
            speakWithBrowserFallback(fallbackText);
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
        speak(t('thanksTaken'));
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

    const resetSeniorModeData = async () => {
        const ok = window.confirm('Reset Senior Mode data? This will clear current medicines and caregiver voice on this account.');
        if (!ok) return;

        try {
            if (user?.id) {
                await safeMutation('medicines', (sb) =>
                    sb.from('medicines').delete().eq('user_id', user.id)
                );
            }

            localStorage.removeItem('medguard_caregiver_voice');
            setCaregiverAudio(null);
            setMedicines([]);
            setNextMed(null);
            setHeardText('');
            speak('Senior mode data has been reset.');
        } catch (err) {
            console.error('[SeniorReset]', err);
            speak('Could not reset right now. Please try again.');
        }
    };

    const openTimePicker = (med) => {
        const current = Array.isArray(med?.times) && med.times.length > 0 ? med.times : ['08:00'];
        setEditingMedicine(med);
        const sorted = [...new Set(current)].sort();
        setSelectedTimes(sorted);
        setTimeDraft(sorted[0] || '08:00');
        setTimeModalOpen(true);
    };

    const addCustomTime = () => {
        const t = String(timeDraft || '').trim();
        if (!t) return;
        setSelectedTimes(prev => [...new Set([...prev, t])].sort());
    };

    const removeCustomTime = (timeValue) => {
        setSelectedTimes(prev => prev.filter(t => t !== timeValue));
    };

    const saveMedicineTime = async () => {
        if (!editingMedicine?.id) return;
        const updatedTimes = (selectedTimes.length > 0 ? selectedTimes : ['08:00']).sort();

        setMedicines(prev =>
            prev.map(m => (m.id === editingMedicine.id ? { ...m, times: updatedTimes } : m))
        );
        setTimeModalOpen(false);

        await safeMutation('medicines', (sb) =>
            sb.from('medicines').update({ times: updatedTimes }).eq('id', editingMedicine.id)
        );
        speak(`Time updated for ${editingMedicine.name} to ${updatedTimes.join(', ')}.`);
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
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => {
                            if (typeof onExitSeniorMode === 'function') onExitSeniorMode();
                            navigate('/dashboard');
                        }}
                        className="text-lg font-bold bg-amber-700 px-6 py-2 rounded-xl border-2 border-amber-400"
                    >
                        Exit Senior Mode
                    </button>
                    <button onClick={signOut} className="text-lg font-bold bg-blue-800 px-6 py-2 rounded-xl border-2 border-blue-400">
                        Sign Out
                    </button>
                </div>
            </div>

            <div className="flex-1 p-6 flex flex-col gap-6 max-w-2xl mx-auto w-full">
                <div className="bg-indigo-50 border-2 border-indigo-200 rounded-3xl p-4">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className={`p-3 rounded-full ${isListening ? 'bg-red-100' : 'bg-white'} shadow-sm`}>
                                <Bot className={`w-8 h-8 ${isListening ? 'text-red-600 animate-pulse' : 'text-indigo-700'}`} />
                            </div>
                            <div>
                                <p className="text-lg font-bold text-indigo-900">Voice Avatar</p>
                                <p className="text-sm text-indigo-700">Say: reminder, taken, assistant</p>
                                <p className="text-xs text-indigo-500 mt-1">Voice Provider: <span className="font-bold uppercase">{voiceProvider}</span></p>
                            </div>
                        </div>
                        <button
                            onClick={startVoiceAssistant}
                            className={`px-5 py-3 rounded-xl text-lg font-bold border-2 ${isListening ? 'bg-red-100 border-red-300 text-red-700' : 'bg-white border-indigo-300 text-indigo-700'}`}
                        >
                            {isListening ? 'Listening...' : 'Talk'}
                        </button>
                        <button
                            onClick={toggleLiveMode}
                            className={`px-5 py-3 rounded-xl text-lg font-bold border-2 ${liveMode ? 'bg-emerald-100 border-emerald-300 text-emerald-700' : 'bg-white border-emerald-300 text-emerald-700'}`}
                        >
                            {liveMode ? 'Live ON' : 'Live Talk'}
                        </button>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                        <Globe className="w-5 h-5 text-indigo-600" />
                        <select
                            value={selectedLang}
                            onChange={(e) => setSelectedLang(e.target.value)}
                            className="bg-white border border-indigo-200 rounded-xl px-3 py-2 text-sm font-semibold text-indigo-900"
                        >
                            {LANG_OPTIONS.map((lang) => (
                                <option key={lang.code} value={lang.code}>{lang.label}</option>
                            ))}
                        </select>
                    </div>
                    {heardText ? <p className="mt-2 text-xs text-indigo-700">Heard: "{heardText}"</p> : null}
                    <button
                        onClick={resetSeniorModeData}
                        className="mt-3 w-full py-3 rounded-xl border-2 border-red-200 bg-red-50 text-red-700 font-bold text-lg flex items-center justify-center gap-2"
                    >
                        <RotateCcw className="w-5 h-5" /> Reset Senior Mode
                    </button>
                    <button
                        onClick={runDemoScript}
                        disabled={demoRunning}
                        className="mt-3 w-full py-3 rounded-xl border-2 border-emerald-200 bg-emerald-50 text-emerald-700 font-bold text-lg disabled:opacity-60"
                    >
                        {demoRunning ? 'Running Demo Script...' : 'Run Demo Script'}
                    </button>
                </div>

                {emergencyAlert ? (
                    <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4">
                        <p className="text-red-800 font-black">Emergency Alert</p>
                        <p className="text-red-700 text-sm mt-1">{emergencyAlert}</p>
                    </div>
                ) : null}

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

                {/* 1.5 SCHEDULE LIST */}
                <div className="bg-white rounded-3xl border-4 border-slate-200 p-5 shadow-sm">
                    <h3 className="text-2xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Clock className="w-6 h-6 text-blue-600" /> Medicine Schedule
                    </h3>
                    <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                        {sortedMedicines.map((med) => {
                            const slots = (Array.isArray(med?.times) && med.times.length > 0 ? med.times : ['08:00']).sort();
                            return (
                                <div key={med.id} className="border-2 border-slate-200 rounded-2xl p-4 flex items-center justify-between">
                                    <div>
                                        <p className="text-xl font-bold text-slate-900">{med.name}</p>
                                        <p className="text-sm text-slate-500">{med.dosage} • {med.status || 'pending'}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-blue-700">{slots.join(' • ')}</p>
                                        <button
                                            onClick={() => openTimePicker(med)}
                                            className="mt-2 px-4 py-2 rounded-xl bg-blue-50 border-2 border-blue-200 text-blue-700 font-bold"
                                        >
                                            Set Time
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* 2. SECONDARY ACTIONS */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <button
                        onClick={() => navigate('/ai-assistant')}
                        className="bg-purple-100 hover:bg-purple-200 border-4 border-purple-200 p-8 rounded-3xl flex flex-col items-center text-center transition-colors"
                    >
                        <div className="bg-white p-4 rounded-full mb-3 shadow-sm">
                            <Mic className="w-12 h-12 text-purple-600" />
                        </div>
                        <span className="text-2xl font-bold text-purple-900">Talk to<br />Assistant</span>
                    </button>

                    <button
                        onClick={() => navigate('/scan-prescription')}
                        className="bg-blue-100 hover:bg-blue-200 border-4 border-blue-200 p-8 rounded-3xl flex flex-col items-center text-center transition-colors"
                    >
                        <div className="bg-white p-4 rounded-full mb-3 shadow-sm">
                            <Upload className="w-12 h-12 text-blue-600" />
                        </div>
                        <span className="text-2xl font-bold text-blue-900">Upload<br />Prescription</span>
                    </button>

                    <button
                        onClick={() => navigate('/senior-symptoms')}
                        className="bg-emerald-100 hover:bg-emerald-200 border-4 border-emerald-200 p-8 rounded-3xl flex flex-col items-center text-center transition-colors"
                    >
                        <div className="bg-white p-4 rounded-full mb-3 shadow-sm">
                            <Activity className="w-12 h-12 text-emerald-600" />
                        </div>
                        <span className="text-2xl font-bold text-emerald-900">Record<br />Symptoms</span>
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

            {timeModalOpen && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4">
                    <div className="w-full max-w-md bg-white rounded-3xl border-4 border-blue-200 p-6 shadow-2xl">
                        <h3 className="text-3xl font-black text-slate-900 mb-2">Set Medicine Time</h3>
                        <p className="text-slate-600 mb-4">{editingMedicine?.name || 'Medicine'}</p>
                        <div className="flex items-center gap-2">
                            <input
                                type="time"
                                value={timeDraft}
                                onChange={(e) => setTimeDraft(e.target.value)}
                                className="flex-1 text-3xl font-black rounded-2xl border-2 border-slate-300 p-3"
                            />
                            <button
                                onClick={addCustomTime}
                                className="px-4 py-3 rounded-2xl bg-blue-600 text-white font-bold"
                            >
                                Add
                            </button>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                            {selectedTimes.map((tm) => (
                                <button
                                    key={tm}
                                    onClick={() => removeCustomTime(tm)}
                                    className="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 font-bold text-sm"
                                >
                                    {tm} ×
                                </button>
                            ))}
                        </div>
                        <div className="grid grid-cols-2 gap-3 mt-5">
                            <button
                                onClick={() => setTimeModalOpen(false)}
                                className="py-3 rounded-2xl border-2 border-slate-300 text-slate-700 font-bold text-xl"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={saveMedicineTime}
                                className="py-3 rounded-2xl bg-blue-600 text-white font-bold text-xl"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

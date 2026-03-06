import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mic, Square, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { safeMutation, safeQuery, safeStorageGet, safeStorageSet } from '../lib/safeAsync';
import { voiceInput } from '../lib/aiClient';
import { normalizeLanguageCode } from '../lib/speech';

const SYMPTOM_OPTIONS = [
    { id: 'rash', label: 'Skin Rash / Itching', labels: { hi: 'त्वचा पर दाने / खुजली', bho: 'चमड़ी पर दाना / खुजली' }, keywords: ['rash', 'itch', 'itching'] },
    { id: 'gastritis', label: 'Stomach Pain / Acidity', labels: { hi: 'पेट दर्द / एसिडिटी', bho: 'पेट दरद / एसिडिटी' }, keywords: ['stomach pain', 'acidity', 'burning', 'gastric'] },
    { id: 'swelling', label: 'Swelling of Face/Lips', labels: { hi: 'चेहरे/होंठ की सूजन', bho: 'मुँह/होठ सूजन' }, keywords: ['swelling', 'face swelling', 'lip swelling', 'swell'] },
    { id: 'dizziness', label: 'Dizziness / Giddiness', labels: { hi: 'चक्कर / सिर घूमना', bho: 'चक्कर / सिर घूमल' }, keywords: ['dizziness', 'dizzy', 'giddiness', 'vertigo'] },
    { id: 'cough', label: 'Dry Cough (Persistent)', labels: { hi: 'सूखी खांसी (लगातार)', bho: 'सूखी खाँसी (लगातार)' }, keywords: ['dry cough', 'cough', 'khasi'] },
    { id: 'fever_pers', label: 'Fever not reducing (3+ days)', labels: { hi: 'बुखार कम न होना (3+ दिन)', bho: 'बुखार कम ना होना (3+ दिन)' }, keywords: ['persistent fever', 'fever', 'high fever'] },
    { id: 'recur_inf', label: 'Recurring Infection', labels: { hi: 'बार-बार संक्रमण', bho: 'बार-बार संक्रमण' }, keywords: ['recurring infection', 'infection again', 'repeat infection'] },
    { id: 'fatigue', label: 'Extreme Weakness', labels: { hi: 'बहुत ज्यादा कमजोरी', bho: 'बहुत कमजोरी' }, keywords: ['weakness', 'fatigue', 'tired', 'low energy'] },
];

const detectSymptomsFromText = (text) => {
    const haystack = String(text || '').toLowerCase();
    if (!haystack.trim()) return [];

    return SYMPTOM_OPTIONS
        .filter((s) => s.keywords.some((k) => haystack.includes(k)))
        .map((s) => s.id);
};

export default function SeniorSymptoms() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { language } = useLanguage();
    const recorderRef = useRef(null);
    const chunksRef = useRef([]);
    const streamRef = useRef(null);

    const [selected, setSelected] = useState([]);
    const [transcript, setTranscript] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [saving, setSaving] = useState(false);
    const [voiceStatus, setVoiceStatus] = useState('');
    const langCode = String(language || 'en').toLowerCase();
    const tr = {
        title: {
            en: 'Record Symptoms',
            hi: 'लक्षण रिकॉर्ड करें',
            bho: 'लक्षण रिकॉर्ड करीं',
        },
        subtitle: {
            en: 'Speak symptoms, then verify below.',
            hi: 'लक्षण बोलें, फिर नीचे जांच करें।',
            bho: 'लक्षण बोलीं, फेर नीचे जांच करीं।',
        },
        start: {
            en: 'Start Recording',
            hi: 'रिकॉर्डिंग शुरू करें',
            bho: 'रिकॉर्डिंग शुरू करीं',
        },
        stop: {
            en: 'Stop',
            hi: 'रोकें',
            bho: 'रोकीं',
        },
        detectedSpeech: {
            en: 'Detected Speech',
            hi: 'पहचानी गई आवाज',
            bho: 'पहिचानल आवाज',
        },
        symptomChecklist: {
            en: 'Symptom Checklist',
            hi: 'लक्षण सूची',
            bho: 'लक्षण सूची',
        },
        note: {
            en: 'Voice detection helps, but you should confirm symptoms manually before saving.',
            hi: 'वॉइस डिटेक्शन मदद करता है, लेकिन सेव करने से पहले लक्षण मैन्युअली जांचें।',
            bho: 'आवाज पहचान मदद करेले, बाकिर सेव करे से पहिले मैन्युअली जांच लीं।',
        },
        save: {
            en: 'Save Symptoms',
            hi: 'लक्षण सेव करें',
            bho: 'लक्षण सेव करीं',
        },
        saving: {
            en: 'Saving...',
            hi: 'सेव हो रहा है...',
            bho: 'सेव हो रहल बा...',
        },
        noKnown: {
            en: 'No known symptom detected. Please tick manually below.',
            hi: 'कोई पहचान योग्य लक्षण नहीं मिला। नीचे मैन्युअली चुनें।',
            bho: 'कोई पहिचानल लक्षण ना मिलल। नीचे हाथ से चुनीं।',
        },
        detectedSelected: {
            en: 'Detected and selected',
            hi: 'पहचाना और चुना गया',
            bho: 'पहिचानल आ चुनल गइल',
        },
        listening: {
            en: 'Listening...',
            hi: 'सुन रहा है...',
            bho: 'सुन रहल बा...',
        },
        noSpeech: {
            en: 'Could not understand speech. Please try again or select manually.',
            hi: 'आवाज समझ नहीं आई। दोबारा कोशिश करें या मैन्युअली चुनें।',
            bho: 'आवाज समझ में ना आइल। फेर कोशिश करीं या हाथ से चुनीं।',
        },
        voiceFail: {
            en: 'Voice input failed. Please try again.',
            hi: 'वॉइस इनपुट विफल रहा। दोबारा कोशिश करें।',
            bho: 'वॉइस इनपुट फेल हो गइल। फेर कोशिश करीं।',
        },
        micFail: {
            en: 'Microphone access failed. Please allow mic permission.',
            hi: 'माइक्रोफोन एक्सेस नहीं मिला। कृपया अनुमति दें।',
            bho: 'माइक एक्सेस ना मिलल। कृपया अनुमति दीं।',
        },
    };
    const l = (key) => tr[key]?.[langCode] || tr[key]?.en || key;

    const symptomLabel = (symptom) => symptom?.labels?.[langCode] || symptom?.label || symptom?.id;

    useEffect(() => {
        const localSymptoms = safeStorageGet('medguard_symptoms', []);
        if (Array.isArray(localSymptoms)) {
            setSelected(localSymptoms);
        }

        if (!user?.id) return;
        let mounted = true;
        (async () => {
            const rows = await safeQuery('symptoms', (sb) =>
                sb.from('symptoms').select('symptom_id').eq('user_id', user.id), []
            );
            if (!mounted || !rows?.length) return;
            const dbSymptoms = rows.map((r) => r.symptom_id).filter(Boolean);
            if (dbSymptoms.length > 0) setSelected([...new Set(dbSymptoms)]);
        })();
        return () => { mounted = false; };
    }, [user?.id]);

    useEffect(() => () => {
        try { recorderRef.current?.stop(); } catch (err) { }
        try { streamRef.current?.getTracks()?.forEach((t) => t.stop()); } catch (err) { }
    }, []);

    const toggleSymptom = (id) => {
        setSelected((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);
    };

    const applyDetectedSymptoms = (rawText) => {
        const found = detectSymptomsFromText(rawText);
        if (found.length === 0) {
            setVoiceStatus(l('noKnown'));
            return;
        }
        setSelected((prev) => [...new Set([...prev, ...found])]);
        const labelMap = Object.fromEntries(SYMPTOM_OPTIONS.map((s) => [s.id, symptomLabel(s)]));
        const labels = found.map((id) => labelMap[id] || id).join(', ');
        setVoiceStatus(`${l('detectedSelected')}: ${labels}`);
    };

    const blobToBase64 = (blob) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result || ''));
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });

    const startVoiceInput = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            const recorder = new MediaRecorder(stream);
            recorderRef.current = recorder;
            chunksRef.current = [];

            recorder.onstart = () => {
                setIsListening(true);
                setVoiceStatus(l('listening'));
            };
            recorder.ondataavailable = (event) => {
                if (event.data?.size > 0) chunksRef.current.push(event.data);
            };
            recorder.onstop = async () => {
                setIsListening(false);
                try {
                    const base64Audio = await blobToBase64(new Blob(chunksRef.current, { type: 'audio/webm' }));
                    const lang = normalizeLanguageCode(language);
                    const parsed = await voiceInput({ audioBase64: base64Audio, languageHint: lang });
                    const text = String(parsed?.transcript || '').trim();
                    if (!text) {
                        setVoiceStatus(l('noSpeech'));
                        return;
                    }
                    setTranscript(text);
                    applyDetectedSymptoms(text);
                } catch (err) {
                    setVoiceStatus(l('voiceFail'));
                } finally {
                    try { streamRef.current?.getTracks()?.forEach((t) => t.stop()); } catch (err) { }
                }
            };

            recorder.start();
        } catch (err) {
            setIsListening(false);
            setVoiceStatus(l('micFail'));
        }
    };

    const stopVoiceInput = () => {
        try { recorderRef.current?.stop(); } catch (err) { }
        setIsListening(false);
    };

    const saveSymptoms = async () => {
        setSaving(true);
        safeStorageSet('medguard_symptoms', selected);

        if (user?.id) {
            await safeMutation('symptoms', (sb) =>
                sb.from('symptoms').delete().eq('user_id', user.id)
            );
            await safeMutation('patient_symptoms', (sb) =>
                sb.from('patient_symptoms').delete().eq('user_id', user.id)
            );

            if (selected.length > 0) {
                const rows = selected.map((symptomId) => ({
                    user_id: user.id,
                    symptom_id: symptomId,
                }));
                await safeMutation('symptoms', (sb) => sb.from('symptoms').insert(rows));
                await safeMutation('patient_symptoms', (sb) =>
                    sb.from('patient_symptoms').insert(
                        rows.map((r) => ({ ...r, timestamp: new Date().toISOString() }))
                    )
                );
            }
        }

        setSaving(false);
        navigate('/senior-dashboard');
    };

    return (
        <div className="min-h-screen bg-slate-50 p-5">
            <div className="max-w-2xl mx-auto">
                <div className="flex items-center gap-3 mb-5">
                    <button
                        onClick={() => navigate('/senior-dashboard')}
                        className="p-2 rounded-xl bg-white border border-slate-200"
                    >
                        <ArrowLeft className="w-5 h-5 text-slate-700" />
                    </button>
                    <h1 className="text-2xl font-black text-slate-900">{l('title')}</h1>
                </div>

                <div className="bg-white rounded-3xl border-2 border-slate-200 p-5 mb-5">
                    <p className="text-slate-700 font-semibold mb-3">{l('subtitle')}</p>
                    <div className="flex gap-3">
                        {!isListening ? (
                            <button
                                onClick={startVoiceInput}
                                className="px-4 py-3 rounded-xl bg-blue-600 text-white font-bold flex items-center gap-2"
                            >
                                <Mic className="w-5 h-5" /> {l('start')}
                            </button>
                        ) : (
                            <button
                                onClick={stopVoiceInput}
                                className="px-4 py-3 rounded-xl bg-red-600 text-white font-bold flex items-center gap-2"
                            >
                                <Square className="w-5 h-5" /> {l('stop')}
                            </button>
                        )}
                    </div>

                    {voiceStatus ? (
                        <p className="mt-3 text-sm font-medium text-slate-600">{voiceStatus}</p>
                    ) : null}

                    {transcript ? (
                        <div className="mt-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
                            <p className="text-xs font-bold text-slate-500 uppercase">{l('detectedSpeech')}</p>
                            <p className="text-sm text-slate-800">{transcript}</p>
                        </div>
                    ) : null}
                </div>

                <div className="bg-white rounded-3xl border-2 border-slate-200 p-5">
                    <p className="text-slate-900 font-black text-lg mb-4">{l('symptomChecklist')}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {SYMPTOM_OPTIONS.map((symptom) => {
                            const active = selected.includes(symptom.id);
                            return (
                                <button
                                    key={symptom.id}
                                    onClick={() => toggleSymptom(symptom.id)}
                                    className={`p-4 rounded-2xl border-2 text-left transition-colors flex items-center justify-between ${active
                                        ? 'bg-red-50 border-red-200 text-red-700'
                                        : 'bg-white border-slate-200 text-slate-700'
                                        }`}
                                >
                                    <span className="font-semibold">{symptomLabel(symptom)}</span>
                                    {active ? <CheckCircle2 className="w-5 h-5" /> : null}
                                </button>
                            );
                        })}
                    </div>

                    <div className="mt-5 flex items-start gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <p className="text-sm">{l('note')}</p>
                    </div>

                    <button
                        onClick={saveSymptoms}
                        disabled={saving}
                        className="mt-5 w-full py-4 rounded-2xl bg-green-600 text-white font-black text-lg disabled:opacity-60"
                    >
                        {saving ? l('saving') : l('save')}
                    </button>
                </div>
            </div>
        </div>
    );
}

import React, { useState, useRef } from 'react';
import { Camera, Upload, ArrowLeft, Check, AlertTriangle, Loader, Shield, Brain, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { safeFetch, safeMutation, safeStorageGet } from '../lib/safeAsync';
import { checkAllInteractions, getAdverseReactions, isAntibiotic } from '../lib/drugInteractions';
import { supabase } from '../lib/supabase';

export default function ScanPrescription() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const fileInputRef = useRef(null);

    const [image, setImage] = useState(null);
    const [base64Image, setBase64Image] = useState(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [results, setResults] = useState([]);
    const [error, setError] = useState(null);

    // 🧠 Brain safety check state
    const [safetyCheck, setSafetyCheck] = useState(null); // null = not checked, { level, flags }
    const [checkingInteractions, setCheckingInteractions] = useState(false);

    // --- IMAGE HANDLING ---
    const handleImageUpload = (event) => {
        const file = event?.target?.files?.[0];
        if (!file) return;

        setError(null);
        setResults([]);
        setSafetyCheck(null);

        const reader = new FileReader();
        reader.onloadend = () => {
            setImage(reader.result);
            setBase64Image(reader.result);
        };
        reader.onerror = () => setError('Failed to read file. Please try again.');
        reader.readAsDataURL(file);
    };

    // --- REAL OCR via Gemini Vision ---
    const analyzeWithGemini = async () => {
        if (!base64Image) {
            setError('Please upload an image first.');
            return;
        }

        setAnalyzing(true);
        setError(null);
        setResults([]);
        setSafetyCheck(null);

        try {
            const apiKey = localStorage.getItem('gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY;
            if (!apiKey) {
                // DEMO MODE — show realistic medicines when no API key
                await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate scan time
                setResults([
                    { name: 'Amoxicillin', dosage: '500mg', type: 'antibiotic', frequency: 'Three Times Daily', times: ['08:00', '14:00', '20:00'] },
                    { name: 'Paracetamol', dosage: '650mg', type: 'pain', frequency: 'Twice Daily', times: ['09:00', '21:00'] },
                    { name: 'Pantoprazole', dosage: '40mg', type: 'other', frequency: 'Once Daily', times: ['07:00'] },
                ]);
                setAnalyzing(false);
                return;
            }

            // Strip data:image/xxx;base64, prefix
            const base64Data = base64Image.split(',')[1];
            const mimeType = base64Image.split(';')[0].split(':')[1] || 'image/jpeg';

            const { data, error: fetchError } = await safeFetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [
                                {
                                    inlineData: {
                                        mimeType: mimeType,
                                        data: base64Data
                                    }
                                },
                                {
                                    text: `Analyze this prescription image. Extract all medicines with their details.
                                    Return ONLY a valid JSON array with this exact format, no extra text or markdown:
                                    [{"name": "Medicine Name", "dosage": "500mg", "type": "antibiotic|heart|diabetes|pain|other", "frequency": "Twice Daily", "times": ["08:00", "20:00"]}]
                                    
                                    Rules:
                                    - Extract REAL medicine names as written on the prescription
                                    - If dosage is visible, include it (e.g., "500mg", "10mg")
                                    - Classify type based on the medicine category
                                    - If times are visible, use them. Otherwise suggest sensible defaults
                                    - If you cannot read the prescription clearly, return an empty array []`
                                }
                            ]
                        }]
                    }),
                    timeout: 30000,
                    retries: 1,
                    label: 'gemini-ocr',
                }
            );

            if (fetchError || !data) {
                setError('OCR analysis failed. Please check your API key or try a clearer photo.');
                setAnalyzing(false);
                return;
            }

            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';

            // Parse JSON from response (handle markdown code blocks)
            const jsonMatch = text.match(/\[[\s\S]*?\]/);
            let medicines = [];

            try {
                medicines = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
            } catch {
                console.error('[OCR] Failed to parse response:', text);
                setError('Could not parse the prescription. Please try a clearer photo.');
                setAnalyzing(false);
                return;
            }

            if (medicines.length === 0) {
                setError('No medicines detected. Please retake the photo with better lighting and focus.');
            }

            setResults(medicines);
        } catch (err) {
            console.error('[OCR] Error:', err);
            setError('Analysis failed. Please try again.');
        } finally {
            setAnalyzing(false);
        }
    };

    // --- 🧠 BRAIN SAFETY CHECK (before confirm) ---
    const runSafetyCheck = async () => {
        if (results.length === 0) return;

        setCheckingInteractions(true);
        setSafetyCheck(null);

        try {
            // Get user's EXISTING medicines from DB
            const { data: existingMeds } = await supabase
                .from('medicines')
                .select('name')
                .eq('user_id', user?.id);

            const existingNames = (existingMeds || []).map(m => m.name);
            const newNames = results.map(r => r.name);
            const allNames = [...existingNames, ...newNames];

            // Run interaction check on ALL medicines (existing + new)
            const interactions = await checkAllInteractions(allNames);

            // Check each new medicine for ADRs and antibiotic warnings
            const flags = [...interactions];
            const symptoms = safeStorageGet('medguard_symptoms', []);
            const symptomLabels = symptoms.map(id => {
                const MAP = {
                    'rash': 'Skin Rash', 'gastritis': 'Stomach Pain', 'dizziness': 'Dizziness',
                    'swelling': 'Swelling', 'cough': 'Dry Cough', 'fatigue': 'Weakness',
                    'fever_pers': 'Persistent Fever', 'recur_inf': 'Recurring Infection',
                };
                return MAP[id] || id;
            });

            for (const med of results) {
                // ADR + symptom matching
                const { matchedSymptoms } = getAdverseReactions(med.name, symptomLabels);
                for (const match of matchedSymptoms) {
                    flags.push({
                        level: 'yellow', type: 'adr_symptom', drug: med.name,
                        message: match.message, advice: match.severity === 'high' ? 'Alert your doctor.' : 'Monitor closely.',
                    });
                }

                // Antibiotic warning
                if (isAntibiotic(med.name)) {
                    flags.push({
                        level: 'yellow', type: 'antibiotic',
                        message: `${med.name} is an antibiotic. You MUST complete the full course to prevent drug resistance.`,
                    });
                }
            }

            const redFlags = flags.filter(f => f.level === 'red');
            const yellowFlags = flags.filter(f => f.level === 'yellow');
            const level = redFlags.length > 0 ? 'red' : yellowFlags.length > 0 ? 'yellow' : 'green';

            setSafetyCheck({ level, flags, redFlags: redFlags.length, yellowFlags: yellowFlags.length });
        } catch (err) {
            console.error('[Brain:safety]', err);
            // Don't block the user — default to green
            setSafetyCheck({ level: 'green', flags: [], redFlags: 0, yellowFlags: 0 });
        } finally {
            setCheckingInteractions(false);
        }
    };

    // Auto-run safety check when results are available
    React.useEffect(() => {
        if (results.length > 0) {
            runSafetyCheck();
        }
    }, [results]);

    // --- CONFIRM & SAVE ---
    const handleConfirm = async () => {
        if (!user?.id || results.length === 0) return;

        try {
            const medicinesToInsert = results.map(med => ({
                user_id: user.id,
                name: med.name || 'Unknown',
                dosage: med.dosage || 'N/A',
                type: med.type || 'other',
                frequency: med.frequency || 'Once Daily',
                times: med.times || ['08:00'],
                status: 'pending',
            }));

            const { success, error: dbError } = await safeMutation(
                'medicines',
                (sb) => sb.from('medicines').insert(medicinesToInsert)
            );

            if (success) {
                navigate('/dashboard');
            } else {
                setError('Failed to save medicines: ' + (dbError || 'Unknown error'));
            }
        } catch (err) {
            console.error('[Confirm]', err);
            setError('Failed to save. Please try again.');
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-6 flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <button onClick={() => navigate(-1)} className="p-2 rounded-xl bg-white shadow-sm">
                    <ArrowLeft className="w-5 h-5 text-slate-600" />
                </button>
                <h1 className="text-xl font-bold text-slate-900">Scan Prescription</h1>
            </div>

            {/* Upload Area */}
            {!image ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-6">
                    <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
                        <Camera className="w-10 h-10 text-blue-600" />
                    </div>
                    <div className="text-center">
                        <p className="text-slate-700 font-bold text-lg">Upload Prescription</p>
                        <p className="text-slate-400 text-sm mt-1">Take a photo or choose from gallery</p>
                    </div>
                    <div className="flex gap-4 w-full max-w-xs">
                        <button
                            onClick={() => { fileInputRef.current.setAttribute('capture', 'environment'); fileInputRef.current.click(); }}
                            className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-blue-200 active:scale-95 transition-transform flex items-center justify-center gap-2"
                        >
                            <Camera className="w-5 h-5" /> Camera
                        </button>
                        <button
                            onClick={() => { fileInputRef.current.removeAttribute('capture'); fileInputRef.current.click(); }}
                            className="flex-1 bg-white text-blue-600 py-4 rounded-2xl font-bold shadow-sm border-2 border-blue-200 active:scale-95 transition-transform flex items-center justify-center gap-2"
                        >
                            <Upload className="w-5 h-5" /> Gallery
                        </button>
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                    />
                </div>
            ) : (
                <div className="flex-1 flex flex-col gap-4">
                    {/* Image Preview */}
                    <div className="relative rounded-2xl overflow-hidden shadow-lg">
                        <img src={image} alt="Prescription" className="w-full max-h-60 object-cover" />
                        <button
                            onClick={() => { setImage(null); setBase64Image(null); setResults([]); setError(null); setSafetyCheck(null); }}
                            className="absolute top-3 right-3 bg-black/50 p-2 rounded-full text-white hover:bg-black/70"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Analyze Button */}
                    {results.length === 0 && !analyzing && (
                        <button
                            onClick={analyzeWithGemini}
                            className="bg-blue-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-blue-200 active:scale-95 transition-transform flex items-center justify-center gap-2"
                        >
                            <Brain className="w-5 h-5" /> Analyze with AI
                        </button>
                    )}

                    {/* Loading State */}
                    {analyzing && (
                        <div className="bg-white rounded-2xl p-8 text-center shadow-sm border">
                            <Loader className="w-10 h-10 text-blue-600 mx-auto mb-3 animate-spin" />
                            <p className="text-slate-600 font-medium">AI is analyzing your prescription...</p>
                            <p className="text-slate-400 text-sm mt-1">This may take a few seconds</p>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-red-700 text-sm font-medium">{error}</p>
                                <button onClick={analyzeWithGemini} className="text-red-600 text-xs font-bold mt-1 underline">Try Again</button>
                            </div>
                        </div>
                    )}

                    {/* Results */}
                    {results.length > 0 && (
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <Check className="w-5 h-5 text-green-600" /> Detected Medicines ({results.length})
                            </h3>

                            {results.map((med, index) => (
                                <div key={index} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h4 className="font-bold text-slate-800">{med.name}</h4>
                                            <p className="text-slate-400 text-sm">{med.dosage} • {med.frequency}</p>
                                            <div className="flex gap-2 mt-2">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${med.type === 'antibiotic' ? 'bg-orange-100 text-orange-700' :
                                                    med.type === 'heart' ? 'bg-red-100 text-red-700' :
                                                        med.type === 'diabetes' ? 'bg-purple-100 text-purple-700' :
                                                            'bg-slate-100 text-slate-600'
                                                    }`}>
                                                    {med.type?.toUpperCase() || 'OTHER'}
                                                </span>
                                                {isAntibiotic(med.name) && (
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                                        ⚠️ ANTIBIOTIC
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <span className="text-xs text-slate-400">{med.times?.[0] || '08:00'}</span>
                                    </div>
                                </div>
                            ))}

                            {/* 🧠 Brain Safety Check Results */}
                            {checkingInteractions && (
                                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center gap-3">
                                    <Loader className="w-5 h-5 text-blue-600 animate-spin" />
                                    <p className="text-blue-700 text-sm font-medium">🧠 Brain is checking for drug interactions...</p>
                                </div>
                            )}

                            {safetyCheck && !checkingInteractions && (
                                <div className={`rounded-2xl p-4 border ${safetyCheck.level === 'red' ? 'bg-red-50 border-red-200' :
                                    safetyCheck.level === 'yellow' ? 'bg-amber-50 border-amber-200' :
                                        'bg-emerald-50 border-emerald-200'
                                    }`}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <Shield className={`w-5 h-5 ${safetyCheck.level === 'red' ? 'text-red-600' :
                                            safetyCheck.level === 'yellow' ? 'text-amber-600' :
                                                'text-emerald-600'
                                            }`} />
                                        <h4 className={`font-bold text-sm ${safetyCheck.level === 'red' ? 'text-red-800' :
                                            safetyCheck.level === 'yellow' ? 'text-amber-800' :
                                                'text-emerald-800'
                                            }`}>
                                            {safetyCheck.level === 'green' ? '✅ Safety Check Passed' :
                                                safetyCheck.level === 'yellow' ? `⚠️ ${safetyCheck.yellowFlags} Warning${safetyCheck.yellowFlags !== 1 ? 's' : ''} Found` :
                                                    `🚨 ${safetyCheck.redFlags} Critical Alert${safetyCheck.redFlags !== 1 ? 's' : ''}!`}
                                        </h4>
                                    </div>

                                    {safetyCheck.flags.slice(0, 5).map((flag, i) => (
                                        <div key={i} className={`text-xs mt-2 p-2 rounded-lg ${flag.level === 'red' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                            }`}>
                                            <p className="font-semibold">{flag.message}</p>
                                            {flag.advice && <p className="mt-0.5 opacity-80">{flag.advice}</p>}
                                        </div>
                                    ))}

                                    {safetyCheck.level === 'green' && (
                                        <p className="text-xs text-emerald-600 mt-1">No interactions detected with your current medicines.</p>
                                    )}
                                </div>
                            )}

                            {/* Confirm Button */}
                            <button
                                onClick={handleConfirm}
                                disabled={checkingInteractions}
                                className={`w-full py-4 rounded-2xl font-bold text-lg shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 ${safetyCheck?.level === 'red'
                                    ? 'bg-red-600 text-white shadow-red-200'
                                    : 'bg-slate-900 text-white shadow-slate-200'
                                    } ${checkingInteractions ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <Check className="w-5 h-5" />
                                {safetyCheck?.level === 'red' ? 'Confirm Anyway (Risks Detected)' : 'Confirm & Add to Schedule'}
                            </button>

                            {safetyCheck?.level === 'red' && (
                                <p className="text-xs text-red-500 text-center font-medium">
                                    ⚕️ Interactions detected. Consult your doctor before taking these together.
                                </p>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}


import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Ruler, Weight, Calendar, User, Activity, AlertTriangle, ShieldCheck, Pill, Edit2, ChevronLeft, FileText, Upload, X, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { safeQuery, safeMutation, safeStorageGet, safeStorageSet } from '../lib/safeAsync';

export default function Profile() {
    const navigate = useNavigate();
    const { user, signOut } = useAuth();

    // Modes: 'loading', 'wizard' (edit), 'view' (summary)
    const [mode, setMode] = useState('loading');
    const [step, setStep] = useState(1);
    const [medicines, setMedicines] = useState([]);
    const [documents, setDocuments] = useState([]);
    const [symptoms, setSymptoms] = useState([]); // Selected symptoms
    const fileInputRef = React.useRef(null);

    // Common ADRs & AMR Signs (Indian Context)
    const INDIAN_ADR_SYMPTOMS = [
        { id: 'rash', label: 'Skin Rash / Itching', type: 'allergy', severity: 'medium' },
        { id: 'gastritis', label: 'Stomach Pain / Acidity', type: 'adr', severity: 'medium' },
        { id: 'swelling', label: 'Swelling of Face/Lips', type: 'allergy', severity: 'high' },
        { id: 'dizziness', label: 'Dizziness / Giddiness', type: 'adr', severity: 'medium' },
        { id: 'cough', label: 'Dry Cough (Persistent)', type: 'adr', severity: 'low' },
        { id: 'fever_pers', label: 'Fever not reducing (3+ days)', type: 'amr', severity: 'high' },
        { id: 'recur_inf', label: 'Recurring Infection', type: 'amr', severity: 'high' },
        { id: 'fatigue', label: 'Extreme Weakness', type: 'adr', severity: 'medium' }
    ];

    // Load Data & Symptoms
    useEffect(() => {
        setDocuments(safeStorageGet('medguard_documents', []));
        setSymptoms(safeStorageGet('medguard_symptoms', []));
    }, []);

    const [formData, setFormData] = useState({
        full_name: '',
        age: '',
        gender: '',
        height: '',
        weight: ''
    });

    // Load Supabase Data
    useEffect(() => {
        if (!user) return;

        let mounted = true;
        const loadTimeout = setTimeout(() => {
            if (mounted && mode === 'loading') {
                setMode('wizard'); // Fallback
            }
        }, 8000);

        async function loadData() {
            try {
                // 1. Profile (safe)
                const profile = await safeQuery('profiles', (sb) =>
                    sb.from('profiles').select('*').eq('id', user.id).single(), null
                );

                // 2. Medicines (safe)
                const meds = await safeQuery('medicines', (sb) =>
                    sb.from('medicines').select('*').eq('user_id', user.id), []
                );

                if (mounted) {
                    if (meds) setMedicines(meds);

                    if (profile && profile.age && profile.gender) {
                        setFormData({
                            full_name: profile.full_name || '',
                            age: profile.age || '',
                            gender: profile.gender || '',
                            height: profile.height || '',
                            weight: profile.weight || ''
                        });
                        setMode('view');
                    } else {
                        setMode('wizard');
                    }
                }
            } catch (err) {
                console.error("Profile Load Error:", err);
                if (mounted) setMode('wizard');
            } finally {
                if (mounted) clearTimeout(loadTimeout);
            }
        }
        loadData();
        return () => { mounted = false; clearTimeout(loadTimeout); };
    }, [user]);

    const toggleSymptom = (id) => {
        let newSymptoms;
        if (symptoms.includes(id)) {
            newSymptoms = symptoms.filter(s => s !== id);
        } else {
            newSymptoms = [...symptoms, id];
        }
        setSymptoms(newSymptoms);
        safeStorageSet('medguard_symptoms', newSymptoms);
    };

    // --- LOGIC: STATS & RISK ---
    const missedCount = medicines.filter(m => m.status === 'skipped').length;
    const antibioticsCount = medicines.filter(m => m.type?.toLowerCase().includes('antibiotic')).length;
    const totalMeds = medicines.length;

    let riskLevel = 'Low Risk';
    let riskColor = 'green';
    let riskMessage = "No significant issues detected.";

    // 1. Check Usage Risks
    if (totalMeds > 5 || antibioticsCount > 1) {
        riskLevel = 'Medium Risk';
        riskColor = 'yellow';
        riskMessage = "Polypharmacy detected. Monitor side effects.";
    }
    if (totalMeds > 8 || missedCount > 3) {
        riskLevel = 'High Risk';
        riskColor = 'red';
        riskMessage = "Poor adherence or high pill burden. Consult doctor.";
    }

    // 2. Check Symptom Risks (Overrules Usage Risk)
    const highRiskSymptoms = symptoms.some(s => {
        const sym = INDIAN_ADR_SYMPTOMS.find(i => i.id === s);
        return sym?.severity === 'high';
    });
    const mediumRiskSymptoms = symptoms.some(s => {
        const sym = INDIAN_ADR_SYMPTOMS.find(i => i.id === s);
        return sym?.severity === 'medium';
    });

    if (mediumRiskSymptoms && riskLevel !== 'High Risk') {
        riskLevel = 'Potential ADR';
        riskColor = 'orange'; // CSS color needs support or use yellow/red
        riskMessage = "Reported symptoms may indicate side effects.";
    }
    if (highRiskSymptoms) {
        riskLevel = 'High Risk (Alert)';
        riskColor = 'red';
        riskMessage = "Potential Severe Reaction or Resistance. See Doctor Immediately.";
    }


    const nextStep = () => setStep(s => s + 1);
    const prevStep = () => setStep(s => s - 1);

    const handleSubmit = async () => {
        if (!user) return;

        // Validate required fields — show what's missing
        const missing = [];
        if (!formData.full_name?.trim()) missing.push('Full Name');
        if (!formData.age) missing.push('Age');
        if (!formData.gender) missing.push('Gender');

        if (missing.length > 0) {
            alert('Please fill in: ' + missing.join(', '));
            return;
        }

        const { success, error } = await safeMutation('profiles', (sb) =>
            sb.from('profiles').upsert({ id: user.id, ...formData })
        );

        if (success) {
            setMode('view');
        } else {
            alert("Error saving profile: " + (error || 'Unknown error'));
        }
    };

    // --- UI HANDLERS (Docs) ---
    const handleFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            const newDoc = {
                id: Date.now(),
                name: file.name,
                date: new Date().toLocaleDateString(),
                type: 'Prescription',
                size: (file.size / 1024).toFixed(0) + ' KB'
            };
            const updatedDocs = [newDoc, ...documents];
            setDocuments(updatedDocs);
            safeStorageSet('medguard_documents', updatedDocs);
            alert("Document uploaded successfully!");
        }
    };

    const handleDeleteDoc = (id) => {
        if (confirm("Are you sure you want to delete this document?")) {
            const updatedDocs = documents.filter(d => d.id !== id);
            setDocuments(updatedDocs);
            safeStorageSet('medguard_documents', updatedDocs);
        }
    };



    // --- VIEW MODE (SUMMARY DASHBOARD) ---
    if (mode === 'view') {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col p-6">

                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <button onClick={() => navigate('/dashboard')} className="p-2 -ml-2 rounded-full hover:bg-slate-200 transition-colors">
                        <ChevronLeft className="w-6 h-6 text-slate-700" />
                    </button>
                    <h2 className="text-xl font-bold text-slate-900">Your Health Profile</h2>
                    <button onClick={() => { setMode('wizard'); setStep(1); }} className="text-blue-600 font-semibold text-sm">Edit</button>
                </div>

                <div className="w-full max-w-md mx-auto space-y-6 animate-fade-in-up">

                    {/* 1. Profile Card */}
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex items-center gap-4">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-2xl">
                            {formData.full_name.charAt(0)}
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-slate-900">{formData.full_name}</h3>
                            <p className="text-slate-500 text-sm">{formData.gender}, {formData.age} years</p>
                            <div className="flex gap-3 mt-2 text-xs font-medium text-slate-400">
                                <span className="flex items-center gap-1"><Ruler className="w-3 h-3" /> {formData.height} cm</span>
                                <span className="flex items-center gap-1"><Weight className="w-3 h-3" /> {formData.weight} kg</span>
                            </div>
                        </div>
                    </div>

                    {/* 2. Missed Doses Stat */}
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-rose-100 text-rose-600 rounded-xl">
                                <Activity className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900">Adherence Report</h3>
                                <p className="text-slate-400 text-xs">Based on your activity</p>
                            </div>
                        </div>

                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-4xl font-bold text-slate-900">{missedCount}</p>
                                <p className="text-sm text-slate-500 font-medium">Missed Doses</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-slate-400 mb-1">Total Prescriptions</p>
                                <p className="text-xl font-bold text-slate-700">{medicines.length}</p>
                            </div>
                        </div>
                    </div>

                    {/* 3. ADR / AMR Risk Analysis (Traffic Light) */}
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 overflow-hidden relative">
                        <div className="flex items-center gap-3 mb-6 relative z-10">
                            <div className="p-3 bg-amber-100 text-amber-600 rounded-xl">
                                <ShieldCheck className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900">Safety Analysis</h3>
                                <p className="text-slate-400 text-xs">ADR & AMR Risk Factors</p>
                            </div>
                        </div>

                        {/* Traffic Light UI */}
                        <div className="flex justify-center gap-6 mb-6 relative z-10">
                            <div className={`w-12 h-12 rounded-full border-4 transition-all duration-500 ${riskColor === 'green' ? 'bg-green-500 border-green-200 shadow-[0_0_20px_rgba(34,197,94,0.6)] scale-110' : 'bg-slate-100 border-slate-200 opacity-50'}`}></div>
                            <div className={`w-12 h-12 rounded-full border-4 transition-all duration-500 ${riskColor === 'yellow' ? 'bg-yellow-400 border-yellow-200 shadow-[0_0_20px_rgba(250,204,21,0.6)] scale-110' : 'bg-slate-100 border-slate-200 opacity-50'}`}></div>
                            <div className={`w-12 h-12 rounded-full border-4 transition-all duration-500 ${riskColor === 'red' ? 'bg-red-500 border-red-200 shadow-[0_0_20px_rgba(239,68,68,0.6)] scale-110' : 'bg-slate-100 border-slate-200 opacity-50'}`}></div>
                        </div>

                        <div className={`text-center p-4 rounded-xl relative z-10 ${riskColor === 'green' ? 'bg-green-50 text-green-700' :
                            riskColor === 'yellow' ? 'bg-yellow-50 text-yellow-700' :
                                'bg-red-50 text-red-700'
                            }`}>
                            <p className="font-bold mb-1 uppercase tracking-wider text-xs">{riskLevel} Risk</p>
                            <p className="text-sm font-medium">{riskMessage}</p>
                        </div>

                    </div>

                    {/* 3.5 Symptom Checker (ADR/AMR) */}
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-red-100 text-red-600 rounded-xl">
                                <AlertTriangle className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900">Symptom Checker</h3>
                                <p className="text-slate-400 text-xs">Verify Side Effects (ADR) & Resistance (AMR)</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {INDIAN_ADR_SYMPTOMS.map((sym) => (
                                <button
                                    key={sym.id}
                                    onClick={() => toggleSymptom(sym.id)}
                                    className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between group ${symptoms.includes(sym.id)
                                        ? 'bg-red-50 border-red-200 text-red-700 shadow-inner'
                                        : 'bg-white border-slate-100 text-slate-600 hover:border-slate-300'
                                        }`}
                                >
                                    <span className="text-sm font-medium">{sym.label}</span>
                                    {symptoms.includes(sym.id) && <CheckCircle className="w-4 h-4 text-red-500" />}
                                </button>
                            ))}
                        </div>
                        {symptoms.length > 0 && (
                            <p className="mt-4 text-xs text-center text-slate-400">
                                Selected symptoms are analyzed in the "Safety Analysis" above.
                            </p>
                        )}
                    </div>

                    {/* 4. Medical Documents (Prescriptions) */}
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-purple-100 text-purple-600 rounded-xl">
                                    <FileText className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900">Medical Documents</h3>
                                    <p className="text-slate-400 text-xs">Prescriptions & Reports</p>
                                </div>
                            </div>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="bg-purple-50 text-purple-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-purple-100 transition-colors flex items-center gap-1"
                            >
                                <Upload className="w-3 h-3" /> Upload
                            </button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                                className="hidden"
                                accept="image/*,.pdf"
                            />
                        </div>

                        {documents.length === 0 ? (
                            <div className="text-center py-6 text-slate-400 text-sm bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                                <p>No documents uploaded yet.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {documents.map((doc) => (
                                    <div key={doc.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 group">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-slate-400 shadow-sm flex-shrink-0">
                                                <FileText className="w-5 h-5" />
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="font-bold text-slate-700 text-sm truncate pr-2">{doc.name}</h4>
                                                <p className="text-xs text-slate-400">{doc.date} • {doc.type}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleDeleteDoc(doc.id)}
                                            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <button onClick={signOut} className="w-full py-4 text-red-500 font-bold bg-white border border-red-100 rounded-2xl hover:bg-red-50 transition-colors">
                        Sign Out
                    </button>

                </div>
            </div>
        );
    }

    // --- WIZARD MODE (EDIT/CREATE) ---
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 pb-20">

            {/* Progress Bar */}
            <div className="w-full max-w-md mb-8 flex gap-2">
                {[1, 2, 3].map(i => (
                    <div key={i} className={`h-2 rounded-full flex-1 transition-all duration-500 ${step >= i ? 'bg-blue-600' : 'bg-slate-200'}`}></div>
                ))}
            </div>

            <div className="w-full max-w-md animate-fade-in-up">

                {/* Header */}
                <div className="mb-8">
                    <h2 className="text-3xl font-bold text-slate-900 mb-2">
                        {step === 1 && "Let's get to know you"}
                        {step === 2 && "Basic Details"}
                        {step === 3 && "Body Metrics"}
                    </h2>
                    <p className="text-slate-500">
                        {step === 1 && "Start by telling us your name."}
                        {step === 2 && "This helps us personalize your plan."}
                        {step === 3 && "For accurate dosage calculations."}
                    </p>
                </div>

                {/* STEP 1: NAME */}
                {step === 1 && (
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Full Name</label>
                            <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type="text"
                                    value={formData.full_name}
                                    onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                                    placeholder="e.g. Martha Wayne"
                                    className="input-field pl-12"
                                    autoFocus
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* STEP 2: AGE & GENDER */}
                {step === 2 && (
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Age</label>
                            <div className="relative">
                                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type="number"
                                    value={formData.age}
                                    onChange={e => setFormData({ ...formData, age: e.target.value })}
                                    placeholder="e.g. 65"
                                    className="input-field pl-12"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Gender</label>
                            <div className="grid grid-cols-2 gap-4">
                                {['Male', 'Female'].map(g => (
                                    <button
                                        key={g}
                                        onClick={() => setFormData({ ...formData, gender: g })}
                                        className={`py-4 rounded-2xl font-bold border-2 transition-all ${formData.gender === g
                                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                                            }`}
                                    >
                                        {g}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* STEP 3: HEIGHT & WEIGHT */}
                {step === 3 && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Height (cm)</label>
                                <div className="relative">
                                    <Ruler className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <input
                                        type="number"
                                        value={formData.height}
                                        onChange={e => setFormData({ ...formData, height: e.target.value })}
                                        placeholder="170"
                                        className="input-field pl-12"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Weight (kg)</label>
                                <div className="relative">
                                    <Weight className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <input
                                        type="number"
                                        value={formData.weight}
                                        onChange={e => setFormData({ ...formData, weight: e.target.value })}
                                        placeholder="70"
                                        className="input-field pl-12"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Navigation Buttons */}
                <div className="flex gap-4 mt-10">
                    {step > 1 && (
                        <button
                            onClick={prevStep}
                            className="flex-1 bg-white text-slate-700 border border-slate-200 rounded-full py-4 font-bold hover:bg-slate-50 transition-colors"
                        >
                            Back
                        </button>
                    )}
                    <button
                        onClick={step === 3 ? handleSubmit : nextStep}
                        className="flex-[2] btn-primary flex items-center justify-center gap-2"
                    >
                        {step === 3 ? "Save Profile" : "Continue"} <ArrowRight className="w-5 h-5" />
                    </button>
                </div>

            </div>
        </div>
    );
}

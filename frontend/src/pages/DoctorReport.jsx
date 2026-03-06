import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { safeQuery, safeStorageGet } from '../lib/safeAsync';
import { ArrowLeft, Printer, FileText, Activity, AlertTriangle } from 'lucide-react';

export default function DoctorReport() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState(null);
    const [medicines, setMedicines] = useState([]);
    const [symptoms, setSymptoms] = useState([]);
    const [stats, setStats] = useState({ missed: 0, taken: 0, adherence: 0 });

    // Load Data
    useEffect(() => {
        if (!user) return;
        async function loadReportData() {
            setLoading(true);
            try {
                // 1. Profile (safe)
                const profileData = await safeQuery('profiles', (sb) =>
                    sb.from('profiles').select('*').eq('id', user.id).single(), null
                );
                setProfile(profileData);

                // 2. Medicines (safe)
                const medsData = await safeQuery('medicines', (sb) =>
                    sb.from('medicines').select('*').eq('user_id', user.id), []
                );
                setMedicines(medsData);

                // 3. Symptoms (safe localStorage)
                const savedSymptomIds = safeStorageGet('medguard_symptoms', []);
                if (savedSymptomIds.length > 0) {
                    const INDIAN_ADR_SYMPTOMS = [
                        { id: 'rash', label: 'Skin Rash / Itching', severity: 'medium' },
                        { id: 'gastritis', label: 'Stomach Pain / Acidity', severity: 'medium' },
                        { id: 'swelling', label: 'Swelling of Face/Lips', severity: 'high' },
                        { id: 'dizziness', label: 'Dizziness / Giddiness', severity: 'medium' },
                        { id: 'cough', label: 'Dry Cough (Persistent)', severity: 'low' },
                        { id: 'fever_pers', label: 'Fever not reducing (3+ days)', severity: 'high' },
                        { id: 'recur_inf', label: 'Recurring Infection', severity: 'high' },
                        { id: 'fatigue', label: 'Extreme Weakness', severity: 'medium' }
                    ];
                    const mapped = savedSymptomIds.map(id => INDIAN_ADR_SYMPTOMS.find(s => s.id === id)).filter(Boolean);
                    setSymptoms(mapped);
                }

                // 4. Calculate Stats
                if (medsData?.length > 0) {
                    const taken = medsData.filter(m => m?.status === 'taken').length;
                    const total = medsData.length;
                    const missed = medsData.filter(m => m?.status === 'skipped').length;
                    setStats({
                        taken,
                        missed,
                        adherence: total > 0 ? Math.round((taken / total) * 100) : 0
                    });
                }

            } catch (err) {
                console.error("Report Load Error:", err);
            } finally {
                setLoading(false);
            }
        }
        loadReportData();
    }, [user]);

    const handlePrint = () => {
        window.print();
    };

    if (loading) return <div className="p-10 text-center">Generating Report...</div>;

    return (
        <div className="min-h-screen bg-slate-100 p-8 print:bg-white print:p-0">

            {/* Navigation (Hidden on Print) */}
            <div className="max-w-4xl mx-auto mb-8 flex justify-between items-center print:hidden">
                <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 text-slate-600 hover:text-slate-900">
                    <ArrowLeft className="w-5 h-5" /> Back to Dashboard
                </button>
                <button
                    onClick={handlePrint}
                    className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:bg-blue-700 transition-colors"
                >
                    <Printer className="w-5 h-5" /> Print / Save as PDF
                </button>
            </div>

            {/* A4 Paper Style Container */}
            <div className="max-w-[210mm] mx-auto bg-white min-h-[297mm] shadow-2xl print:shadow-none p-12 print:p-8">

                {/* Header */}
                <div className="border-b-2 border-slate-200 pb-8 mb-8 flex justify-between items-end">
                    <div>
                        <h1 className="text-4xl font-black text-slate-900 tracking-tight">MED GUARD</h1>
                        <p className="text-slate-500 font-medium">Patient Health Summary</p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-slate-400">Report Generated</p>
                        <p className="font-bold text-slate-700">{new Date().toLocaleDateString()}</p>
                    </div>
                </div>

                {/* Patient Info */}
                <div className="mb-10">
                    <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Patient Information</h2>
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-6 grid grid-cols-2 gap-y-4">
                        <div>
                            <p className="text-xs text-slate-400">Name</p>
                            <p className="text-lg font-bold text-slate-900">{profile?.full_name || 'N/A'}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-400">Age / Gender</p>
                            <p className="text-lg font-bold text-slate-900">{profile?.age} / {profile?.gender}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-400">Height</p>
                            <p className="font-medium text-slate-700">{profile?.height} cm</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-400">Weight</p>
                            <p className="font-medium text-slate-700">{profile?.weight} kg</p>
                        </div>
                    </div>
                </div>

                {/* Adherence Stats */}
                <div className="mb-10">
                    <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Adherence Overview</h2>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="p-4 border border-slate-100 rounded-xl bg-blue-50">
                            <p className="text-xs text-slate-500 font-bold">Adherence Rate</p>
                            <p className="text-2xl font-black text-blue-600">{stats.adherence}%</p>
                        </div>
                        <div className="p-4 border border-slate-100 rounded-xl">
                            <p className="text-xs text-slate-500 font-bold">Doses Taken</p>
                            <p className="text-2xl font-bold text-green-600">{stats.taken}</p>
                        </div>
                        <div className="p-4 border border-slate-100 rounded-xl">
                            <p className="text-xs text-slate-500 font-bold">Missed/Skipped</p>
                            <p className="text-2xl font-bold text-red-500">{stats.missed}</p>
                        </div>
                    </div>
                </div>

                {/* Medicines List */}
                <div className="mb-10">
                    <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Active Prescriptions</h2>
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-200">
                                <th className="py-2 text-xs text-slate-500 font-bold">Medicine</th>
                                <th className="py-2 text-xs text-slate-500 font-bold">Dosage</th>
                                <th className="py-2 text-xs text-slate-500 font-bold">Frequency</th>
                                <th className="py-2 text-xs text-slate-500 font-bold">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {medicines.map((m) => (
                                <tr key={m.id} className="border-b border-slate-100">
                                    <td className="py-3 font-bold text-slate-800">{m.name}</td>
                                    <td className="py-3 text-sm text-slate-600">{m.dosage}</td>
                                    <td className="py-3 text-sm text-slate-600">{m.frequency}</td>
                                    <td className="py-3">
                                        <span className={`text-xs px-2 py-1 rounded font-bold ${m.status === 'taken' ? 'bg-green-100 text-green-700' :
                                            m.status === 'skipped' ? 'bg-red-100 text-red-700' :
                                                'bg-slate-100 text-slate-600'
                                            }`}>
                                            {m.status?.toUpperCase() || 'UNKNOWN'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {medicines.length === 0 && (
                                <tr>
                                    <td colSpan="4" className="py-4 text-center text-slate-400 italic">No active prescriptions found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Reported Symptoms */}
                <div className="mb-12">
                    <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Patient-Reported Side Effects</h2>
                    {symptoms.length > 0 ? (
                        <div className="space-y-2">
                            {symptoms.map((s, idx) => (
                                <div key={idx} className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-100 break-inside-avoid">
                                    <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
                                    <div>
                                        <p className="font-bold text-red-900">{s.label}</p>
                                        <p className="text-xs text-red-600 font-bold uppercase mt-1">Severity: {s.severity}</p>
                                    </div>
                                </div>
                            ))}
                            <p className="text-sm text-slate-500 mt-2 italic">
                                Note: These symptoms were self-reported by the patient via the MedGuard App.
                            </p>
                        </div>
                    ) : (
                        <div className="p-6 bg-green-50 rounded-xl border border-green-100 text-center text-green-700 font-medium">
                            <Activity className="w-5 h-5 mx-auto mb-2 opacity-50" />
                            No side effects or symptoms reported recently.
                        </div>
                    )}
                </div>

                {/* Disclaimer Footer */}
                <div className="border-t border-slate-200 pt-6 text-center">
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Med Guard // AI-Powered Adherence System</p>
                    <p className="text-[9px] text-slate-300 mt-1">This report is for informational purposes only and does not constitute a medical diagnosis.</p>
                </div>

            </div>
        </div>
    );
}

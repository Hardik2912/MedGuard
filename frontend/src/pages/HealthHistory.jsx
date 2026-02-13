
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Activity, Heart, Droplets, Brain, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { safeQuery, safeMutation } from '../lib/safeAsync';

const CONDITIONS = [
    { id: 'diabetes', name: 'Diabetes (Type 2)', icon: <Droplets /> },
    { id: 'hypertension', name: 'Hypertension', icon: <Heart /> },
    { id: 'asthma', name: 'Asthma', icon: <Activity /> },
    { id: 'migraine', name: 'Migraines', icon: <Brain /> },
];

export default function HealthHistory() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [selected, setSelected] = useState([]);
    const [loading, setLoading] = useState(true);

    // Load existing conditions
    useEffect(() => {
        if (!user) return;

        async function loadConditions() {
            setLoading(true);
            const data = await safeQuery('conditions', (sb) =>
                sb.from('conditions').select('condition_id').eq('user_id', user.id), []
            );

            if (data?.length > 0) {
                const existingIds = data.map(c => c?.condition_id).filter(Boolean);
                setSelected(existingIds);
            }
            setLoading(false);
        }
        loadConditions();
    }, [user]);

    const toggleCondition = (id) => {
        setSelected(prev =>
            prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
        );
    };

    const handleContinue = async () => {
        if (!user) return;
        setLoading(true);

        // 1. Delete all existing (simple approach for sync)
        await safeMutation('conditions', (sb) =>
            sb.from('conditions').delete().eq('user_id', user.id)
        );

        // 2. Insert new selections
        if (selected.length > 0) {
            const rows = selected.map(id => ({
                user_id: user.id,
                condition_id: id,
                condition_name: CONDITIONS.find(c => c.id === id)?.name || id,
                diagnosed_at: new Date().toISOString()
            }));

            const { success, error } = await safeMutation('conditions', (sb) =>
                sb.from('conditions').insert(rows)
            );
            if (!success) {
                console.error("Error saving conditions:", error);
                alert("Failed to save conditions.");
                setLoading(false);
                return;
            }
        }

        setLoading(false);
        navigate('/scan-prescription');
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center">Loading Conditions...</div>;

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center p-6">

            <div className="w-full max-w-md animate-fade-in-up">

                <div className="mb-8 mt-4">
                    <h2 className="text-3xl font-bold text-slate-900 mb-2">Medical History</h2>
                    <p className="text-slate-500">
                        Select any existing conditions. This helps our AI warn you about risks.
                    </p>
                </div>

                {/* Condition Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                    {CONDITIONS.map(cond => {
                        const isSelected = selected.includes(cond.id);
                        return (
                            <button
                                key={cond.id}
                                onClick={() => toggleCondition(cond.id)}
                                disabled={loading}
                                className={`p-6 rounded-3xl border-2 text-left transition-all duration-300 relative overflow-hidden ${isSelected
                                    ? 'border-blue-500 bg-blue-50 shadow-md transform scale-[1.02]'
                                    : 'border-white bg-white shadow-sm hover:border-slate-200'
                                    }`}
                            >
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${isSelected ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'
                                    }`}>
                                    {cond.icon}
                                </div>
                                <h3 className={`font-bold ${isSelected ? 'text-blue-700' : 'text-slate-700'}`}>
                                    {cond.name}
                                </h3>

                                {isSelected && (
                                    <div className="absolute top-4 right-4">
                                        <CheckCircle className="w-6 h-6 text-blue-500 fill-blue-100" />
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* None Option */}
                <button
                    onClick={() => setSelected([])}
                    className={`w-full p-4 rounded-2xl border-2 mb-8 font-medium transition-colors ${selected.length === 0
                        ? 'border-slate-400 bg-slate-100 text-slate-700'
                        : 'border-transparent bg-transparent text-slate-400 hover:text-slate-600'
                        }`}
                >
                    I have no existing conditions
                </button>

                <button
                    onClick={handleContinue}
                    disabled={loading}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                >
                    {loading ? "Saving..." : "Continue"} <ArrowRight className="w-5 h-5" />
                </button>

                <div className="mt-8 bg-amber-50 rounded-2xl p-4 flex gap-3">
                    <AlertCircle className="w-6 h-6 text-amber-500 flex-shrink-0" />
                    <p className="text-xs text-amber-700 leading-relaxed">
                        <strong>Privacy Note:</strong> Your health data is encrypted and securely stored.
                    </p>
                </div>

            </div>
        </div>
    );
}

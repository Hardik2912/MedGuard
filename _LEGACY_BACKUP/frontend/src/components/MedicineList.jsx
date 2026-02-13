
import React, { useState } from 'react';
import axios from 'axios';

const MedicineList = ({ medicines = [], loading = false, onAddClick, seniorMode = false }) => {
    const [reportingId, setReportingId] = useState(null);
    const [symptoms, setSymptoms] = useState('');
    const [submitted, setSubmitted] = useState({}); // Track submitted symptoms locally
    const [adherenceLog, setAdherenceLog] = useState({}); // Track local adherence updates

    const handleLog = async (timelineId, status) => {
        try {
            await axios.post('/medicine/log', { timeline_id: timelineId, status });
            // Optimistic update
            setAdherenceLog(prev => ({ ...prev, [timelineId]: status }));
        } catch (error) {
            console.error("Log failed", error);
        }
    };

    const handleReportSymptoms = async (timelineId) => {
        try {
            await axios.post('/medicine/symptoms', { timeline_id: timelineId, symptoms });
            setSubmitted(prev => ({ ...prev, [timelineId]: true }));
            setReportingId(null);
            setSymptoms('');
        } catch (error) {
            console.error("Report failed", error);
        }
    };

    if (loading) {
        return <div className="text-center py-10 text-gray-400">Loading medicines...</div>;
    }

    if (medicines.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4 transition-transform hover:scale-110 cursor-pointer" onClick={onAddClick}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#3B82F6" className="w-8 h-8">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                </div>
                <h3 className={`font-bold text-gray-800 mb-2 ${seniorMode ? 'text-xl' : 'text-lg'}`}>No Medicines Yet</h3>
                <p className={`text-gray-500 max-w-[200px] mb-6 ${seniorMode ? 'text-base' : 'text-sm'}`}>
                    Upload a prescription or scan a medicine strip to get started.
                </p>
                <button
                    onClick={onAddClick}
                    className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-500/30"
                >
                    Upload Prescription
                </button>
            </div>
        );
    }

    const today = new Date().toISOString().split('T')[0];

    return (
        <div className="space-y-4">
            {medicines.map((item, idx) => {
                const isEnded = item.end_date && item.end_date < today;
                const hasReported = item.symptoms || submitted[item.id];
                const loggedToday = adherenceLog[item.id];

                return (
                    <div
                        key={idx}
                        className={`bg-white border rounded-xl shadow-sm transition-all
                            ${seniorMode ? 'p-6' : 'p-4'}
                            ${isEnded ? 'bg-gray-50 border-gray-200' : 'border-gray-100 hover:shadow-md'}`}
                    >
                        {/* Header */}
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <h4 className={`font-bold text-gray-800 ${seniorMode ? 'text-xl' : 'text-base'}`}>
                                    {item.molecule}
                                </h4>
                                <div className="flex gap-2 mt-1">
                                    {item.is_antibiotic === 1 && (
                                        <span className="bg-orange-100 text-orange-700 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full">
                                            Antibiotic
                                        </span>
                                    )}
                                    <span className="text-xs text-slate-400">
                                        {isEnded ? "Completed" : `Ends: ${item.end_date || 'Ongoing'}`}
                                    </span>
                                </div>
                            </div>

                            {/* Adherence Counts */}
                            {!isEnded && (
                                <div className="text-right text-xs text-gray-400">
                                    <div className="font-bold text-gray-600">{item.taken_doses || 0} / {(item.taken_doses || 0) + (item.missed_doses || 0)}</div>
                                    <div>Taken</div>
                                </div>
                            )}
                        </div>

                        {/* Action Area */}
                        <div className="pt-2 border-t border-gray-50">

                            {/* ACTIVE COURSE: Adherence Buttons */}
                            {!isEnded && (
                                <div className="flex gap-2">
                                    {loggedToday ? (
                                        <div className={`w-full text-center py-2 rounded-lg font-bold
                                            ${loggedToday === 'taken' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {loggedToday === 'taken' ? '✅ Taken Today' : '❌ Missed Today'}
                                        </div>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => handleLog(item.id, 'taken')}
                                                className="flex-1 bg-green-50 hover:bg-green-100 text-green-700 font-bold py-2 rounded-lg transition"
                                            >
                                                Take
                                            </button>
                                            <button
                                                onClick={() => handleLog(item.id, 'missed')}
                                                className="flex-1 bg-red-50 hover:bg-red-100 text-red-700 font-bold py-2 rounded-lg transition"
                                            >
                                                Missed
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* ENDED COURSE: Symptom Reporting */}
                            {isEnded && !hasReported && reportingId !== item.id && (
                                <button
                                    onClick={() => setReportingId(item.id)}
                                    className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold py-2 rounded-lg transition"
                                >
                                    Report Symptoms
                                </button>
                            )}

                            {/* Symptom Form */}
                            {reportingId === item.id && (
                                <div className="mt-2 animate-fade-in-up">
                                    <p className="text-sm text-gray-600 mb-2 font-medium">How are you feeling after this course?</p>
                                    <textarea
                                        value={symptoms}
                                        onChange={(e) => setSymptoms(e.target.value)}
                                        placeholder="E.g., Feeling better? Any side effects?"
                                        className="w-full p-3 border border-gray-200 rounded-lg text-sm mb-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                        rows={2}
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleReportSymptoms(item.id)}
                                            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold"
                                        >
                                            Submit
                                        </button>
                                        <button
                                            onClick={() => setReportingId(null)}
                                            className="text-gray-400 px-3 py-2 text-sm"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Reported Status */}
                            {(hasReported || item.symptoms) && (
                                <div className="text-center py-2 text-sm text-gray-500 italic">
                                    Feedback submitted.
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default MedicineList;

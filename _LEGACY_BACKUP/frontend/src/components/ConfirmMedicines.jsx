import React, { useState } from 'react';
import axios from 'axios';

const ConfirmMedicines = ({ candidates = [], onConfirmComplete, onBack, seniorMode = false }) => {
    const [selected, setSelected] = useState(
        candidates.reduce((acc, curr) => ({ ...acc, [curr.drug_id]: true }), {})
    );
    const [processing, setProcessing] = useState(false);

    const toggleSelection = (drugId) => {
        setSelected(prev => ({
            ...prev,
            [drugId]: !prev[drugId]
        }));
    };

    const handleConfirm = async () => {
        const drugsToConfirm = candidates.filter(c => selected[c.drug_id]);

        if (drugsToConfirm.length === 0) {
            alert("Please select at least one medicine to confirm.");
            return;
        }

        setProcessing(true);
        try {
            // confirm each selected drug
            // in a real app, we might send a bulk request, but our API is singular for now
            for (const drug of drugsToConfirm) {
                await axios.post('/ocr/confirm', {
                    drug_id: drug.drug_id,
                    user_id: 'default'
                });
            }

            // Success!
            onConfirmComplete();
        } catch (error) {
            console.error("Error confirming medicines:", error);
            alert("Failed to confirm some medicines. Please try again.");
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className={`flex flex-col h-full bg-white ${seniorMode ? 'p-6' : 'p-4'}`}>
            {/* Header */}
            <div className="flex items-center mb-6">
                <button
                    onClick={onBack}
                    className="text-gray-600 hover:text-gray-900 p-2 -ml-2 rounded-full hover:bg-gray-100"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                    </svg>
                </button>
                <h2 className={`font-bold text-gray-800 ml-2 ${seniorMode ? 'text-2xl' : 'text-xl'}`}>
                    Confirm Medicines
                </h2>
            </div>

            <p className={`text-gray-600 mb-4 ${seniorMode ? 'text-lg' : 'text-sm'}`}>
                We found the following medicines. Please confirm to add them to your schedule.
            </p>

            {/* List */}
            <div className="flex-1 overflow-y-auto space-y-3">
                {candidates.map((drug) => (
                    <div
                        key={drug.drug_id}
                        onClick={() => toggleSelection(drug.drug_id)}
                        className={`flex items-center justify-between border rounded-xl p-4 cursor-pointer transition-colors ${selected[drug.drug_id]
                                ? 'bg-blue-50 border-blue-200'
                                : 'bg-white border-gray-200 opacity-60'
                            }`}
                    >
                        <div>
                            <h4 className={`font-bold text-gray-800 ${seniorMode ? 'text-xl' : 'text-base'}`}>{drug.molecule}</h4>
                            <p className={`text-gray-500 ${seniorMode ? 'text-base' : 'text-xs'}`}>ID: {drug.drug_id}</p>
                        </div>

                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${selected[drug.drug_id]
                                ? 'bg-blue-600 border-blue-600'
                                : 'border-gray-300'
                            }`}>
                            {selected[drug.drug_id] && (
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-4 h-4 text-white">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                </svg>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Action Button */}
            <div className="mt-4 pt-4 border-t">
                <button
                    onClick={handleConfirm}
                    disabled={processing}
                    className={`w-full bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2 ${seniorMode ? 'py-4 text-xl' : 'py-3 text-lg'
                        } ${processing ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                    {processing ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>Processing...</span>
                        </>
                    ) : (
                        <span>Confirm & Add to Schedule</span>
                    )}
                </button>
            </div>
        </div>
    );
};

export default ConfirmMedicines;

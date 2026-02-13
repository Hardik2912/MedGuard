
import React, { useState } from 'react';

const Onboarding = ({ onComplete }) => {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        name: '',
        age: 30,
        gender: '',
        weight: 70,
        height: 170,
        diet: '',
        occupation: '',
        conditions: []
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const conditionsList = [
        "Diabetes", "Hypertension", "Asthma", "Allergies",
        "Heart Disease", "Thyroid", "None"
    ];

    const nextStep = () => setStep(step + 1);
    const prevStep = () => setStep(step - 1);

    const handleConditionToggle = (condition) => {
        if (condition === "None") {
            setFormData({ ...formData, conditions: ["None"] });
            return;
        }
        let newConditions = formData.conditions.filter(c => c !== "None");
        if (newConditions.includes(condition)) {
            newConditions = newConditions.filter(c => c !== condition);
        } else {
            newConditions.push(condition);
        }
        setFormData({ ...formData, conditions: newConditions });
    };

    const handleFinish = async () => {
        console.log("Finishing onboarding with data:", formData);
        setIsSubmitting(true);
        try {
            await onComplete(formData);
        } catch (e) {
            console.error("Onboarding submission failed", e);
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-white z-40 flex flex-col font-sans">
            {/* Progress Bar */}
            <div className="w-full h-1 bg-slate-100">
                <div
                    className="h-full bg-blue-600 transition-all duration-500"
                    style={{ width: `${(step / 4) * 100}%` }}
                />
            </div>

            <div className="flex-1 flex flex-col p-6 overflow-y-auto">
                {/* Back Button */}
                {step > 1 && (
                    <button onClick={prevStep} disabled={isSubmitting} className="self-start text-slate-400 hover:text-slate-600 mb-4">
                        &larr; Back
                    </button>
                )}

                {/* STEP 1: IDENTITY & GENDER */}
                {step === 1 && (
                    <div className="animate-fade-in-up">
                        <h2 className="text-3xl font-bold text-slate-900 mb-2">Tell us about you</h2>
                        <p className="text-slate-500 mb-8">Base profile for personalized safety.</p>

                        <div className="space-y-6">
                            {/* Name Input */}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">My Name</label>
                                <input
                                    type="text"
                                    className="w-full text-2xl font-medium border-b-2 border-slate-200 focus:border-blue-600 outline-none py-2 placeholder-slate-300"
                                    placeholder="Enter your name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            {/* Gender Selection */}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-4">Gender</label>
                                <div className="grid grid-cols-2 gap-4">
                                    {['Male', 'Female'].map((g) => (
                                        <button
                                            key={g}
                                            onClick={() => setFormData({ ...formData, gender: g })}
                                            className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-3
                                                ${formData.gender === g
                                                    ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-md'
                                                    : 'border-slate-100 bg-white text-slate-400 hover:border-blue-200'}`}
                                        >
                                            <span className="text-4xl">{g === 'Male' ? '👨' : '👩'}</span>
                                            <span className="font-bold">{g}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Age Input */}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Age</label>
                                <div className="flex items-center gap-4">
                                    <input
                                        type="range" min="18" max="100"
                                        value={formData.age}
                                        onChange={(e) => setFormData({ ...formData, age: Number(e.target.value) })}
                                        className="flex-1 accent-blue-600"
                                    />
                                    <span className="text-2xl font-bold w-12 text-center">{formData.age}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* STEP 2: VITALS */}
                {step === 2 && (
                    <div className="animate-fade-in-up">
                        <h2 className="text-3xl font-bold text-slate-900 mb-2">Body Metrics</h2>
                        <p className="text-slate-500 mb-8">Used for dosage safety checks (e.g. renal function).</p>

                        <div className="space-y-8">
                            {/* Weight */}
                            <div className="bg-slate-50 p-6 rounded-2xl">
                                <label className="flex justify-between text-sm font-bold text-slate-700 mb-4">
                                    <span>Weight</span>
                                    <span className="text-blue-600">{formData.weight} kg</span>
                                </label>
                                <input
                                    type="range" min="30" max="150"
                                    value={formData.weight}
                                    onChange={(e) => setFormData({ ...formData, weight: Number(e.target.value) })}
                                    className="w-full accent-blue-600 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                                />
                            </div>

                            {/* Height */}
                            <div className="bg-slate-50 p-6 rounded-2xl">
                                <label className="flex justify-between text-sm font-bold text-slate-700 mb-4">
                                    <span>Height</span>
                                    <span className="text-blue-600">{formData.height} cm</span>
                                </label>
                                <input
                                    type="range" min="100" max="220"
                                    value={formData.height}
                                    onChange={(e) => setFormData({ ...formData, height: Number(e.target.value) })}
                                    className="w-full accent-blue-600 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* STEP 3: LIFESTYLE (Diet & Occupation) */}
                {step === 3 && (
                    <div className="animate-fade-in-up">
                        <h2 className="text-3xl font-bold text-slate-900 mb-2">Lifestyle</h2>
                        <p className="text-slate-500 mb-8">Helps us tailor advice to your daily routine.</p>

                        <div className="space-y-6">
                            {/* Diet */}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-4">Dietary Preference</label>
                                <div className="grid grid-cols-3 gap-3">
                                    {['Veg', 'Non-Veg', 'Vegan'].map((d) => (
                                        <button
                                            key={d}
                                            onClick={() => setFormData({ ...formData, diet: d })}
                                            className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2
                                                ${formData.diet === d
                                                    ? 'border-green-500 bg-green-50 text-green-700 shadow-sm'
                                                    : 'border-slate-100 bg-white text-slate-500 hover:border-green-200'}`}
                                        >
                                            <span className="text-2xl">{d === 'Veg' ? '🥗' : d === 'Non-Veg' ? '🍗' : '🌿'}</span>
                                            <span className="font-bold text-sm">{d}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Occupation */}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-4">Occupation</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {['Desk Job', 'Manual Labor', 'Student', 'Retired', 'Home Maker', 'Medical'].map((job) => (
                                        <button
                                            key={job}
                                            onClick={() => setFormData({ ...formData, occupation: job })}
                                            className={`p-3 rounded-xl border transition-all text-sm font-bold
                                                ${formData.occupation === job
                                                    ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                                                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'}`}
                                        >
                                            {job}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* STEP 4: MEDICAL HISTORY */}
                {step === 4 && (
                    <div className="animate-fade-in-up">
                        <h2 className="text-3xl font-bold text-slate-900 mb-2">Medical History</h2>
                        <p className="text-slate-500 mb-8">Do you have any existing conditions?</p>

                        <div className="flex flex-wrap gap-3">
                            {conditionsList.map((condition) => (
                                <button
                                    key={condition}
                                    onClick={() => handleConditionToggle(condition)}
                                    className={`px-4 py-3 rounded-xl font-medium border transition-all
                                        ${formData.conditions.includes(condition)
                                            ? 'bg-blue-600 text-white border-blue-600 shadow-lg'
                                            : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'}`}
                                >
                                    {condition}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex-1" />

                <button
                    onClick={step === 4 ? handleFinish : nextStep}
                    disabled={
                        isSubmitting ||
                        (step === 1 && (!formData.name || !formData.gender)) ||
                        (step === 3 && (!formData.diet || !formData.occupation))
                    }
                    className={`w-full py-4 rounded-xl font-bold text-lg text-white shadow-lg transition-all mt-6
                        ${(isSubmitting || (step === 1 && (!formData.name || !formData.gender)) || (step === 3 && (!formData.diet || !formData.occupation)))
                            ? 'bg-slate-300 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-700 active:scale-95'}`}
                >
                    {isSubmitting ? 'Saving Profile...' : (step === 4 ? 'Complete Setup' : 'Continue')}
                </button>
            </div>
        </div>
    );
};

export default Onboarding;

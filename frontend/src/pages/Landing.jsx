
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Activity, HeartPulse, ScanLine, ArrowRight } from 'lucide-react';

export default function Landing() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col relative overflow-hidden">

            {/* Background Decoration */}
            <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-100 rounded-full blur-[100px] opacity-60 pointer-events-none"></div>
            <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-teal-100 rounded-full blur-[80px] opacity-60 pointer-events-none"></div>

            {/* Navbar */}
            <nav className="flex justify-between items-center p-6 z-10">
                <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
                        <ShieldCheck className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-xl font-bold text-slate-900 tracking-tight">MedGuard</span>
                </div>
                <button
                    onClick={() => navigate('/login')}
                    className="text-slate-600 font-semibold hover:text-blue-600 transition-colors"
                >
                    Log In
                </button>
            </nav>

            {/* Hero Section */}
            <main className="flex-1 flex flex-col items-center justify-center px-6 text-center z-10 pb-20">

                <div className="inline-flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-full mb-8 shadow-sm animate-fade-in-up">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">AI-Powered Safety</span>
                </div>

                <h1 className="text-5xl md:text-7xl font-bold text-slate-900 mb-6 leading-tight tracking-tight max-w-3xl">
                    Your Personal <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-teal-500">Health Guardian.</span>
                </h1>

                <p className="text-lg md:text-xl text-slate-500 mb-12 max-w-xl leading-relaxed">
                    Scan prescriptions, track medications, and get AI-powered safety alerts. Designed for simplicity and trust.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                    <button
                        onClick={() => navigate('/login')}
                        className="btn-primary flex items-center justify-center gap-2 text-lg"
                    >
                        Get Started <ArrowRight className="w-5 h-5" />
                    </button>
                    {/* <button className="px-8 py-4 rounded-full border-2 border-slate-200 text-slate-700 font-bold hover:bg-white hover:border-slate-300 transition-all">
                        Learn More
                    </button> */}
                </div>

                {/* Features Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20 w-full max-w-5xl">
                    <FeatureCard
                        icon={<ScanLine className="w-6 h-6 text-blue-600" />}
                        title="Smart Scan"
                        desc="Instantly digitize prescriptions with our AI camera."
                    />
                    <FeatureCard
                        icon={<HeartPulse className="w-6 h-6 text-rose-500" />}
                        title="Safety Alerts"
                        desc="Get warnings about drug interactions and side effects."
                    />
                    <FeatureCard
                        icon={<ShieldCheck className="w-6 h-6 text-teal-600" />}
                        title="Adherence"
                        desc="Never miss a dose with intelligent voice reminders."
                    />
                </div>

            </main>

            {/* Footer */}
            <footer className="p-6 text-center text-slate-400 text-sm">
                © 2024 MedGuard AI. Trusted by Families.
            </footer>
        </div>
    );
}

function FeatureCard({ icon, title, desc }) {
    return (
        <div className="bg-white/60 backdrop-blur-sm p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all text-left">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-4">
                {icon}
            </div>
            <h3 className="font-bold text-slate-900 text-lg mb-2">{title}</h3>
            <p className="text-slate-500 leading-relaxed">{desc}</p>
        </div>
    );
}

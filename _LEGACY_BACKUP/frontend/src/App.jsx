
import { useState, useEffect } from 'react'
import axios from 'axios'
import SafetyStatus from './components/SafetyStatus'
import MedicineList from './components/MedicineList'
import SeniorModeToggle from './components/SeniorModeToggle'
import ScanPrescription from './components/ScanPrescription'
import ConfirmMedicines from './components/ConfirmMedicines'
import RiskAnalysis from './components/RiskAnalysis'

// Onboarding Components
import SplashScreen from './components/SplashScreen'
import Onboarding from './components/Onboarding'
import DeviceConnect from './components/DeviceConnect'

function App() {
    const [timeline, setTimeline] = useState([])
    const [loading, setLoading] = useState(true)
    const [seniorMode, setSeniorMode] = useState(false)
    const [currentScreen, setCurrentScreen] = useState('splash') // Default to splash
    const [scannedCandidates, setScannedCandidates] = useState([])
    const [userProfile, setUserProfile] = useState(null)

    // AI & Risk State
    const [safetyLevel, setSafetyLevel] = useState('green')
    const [risks, setRisks] = useState([])
    const [todaysInsight, setTodaysInsight] = useState(null)

    useEffect(() => {
        checkUserProfile()
    }, [])

    const checkUserProfile = async () => {
        try {
            const res = await axios.get('/user/profile?user_id=default')
            if (res.data.exists) {
                // User exists, skip onboarding
                setUserProfile(res.data.profile)
                // Small delay to show splash logo
                setTimeout(() => {
                    setCurrentScreen('dashboard')
                    fetchTimeline()
                    fetchDailyInsight()
                }, 2000)
            } else {
                // No user, wait for splash cleanup (handled by SplashScreen component)
            }
        } catch (error) {
            console.error("Profile check failed", error)
            // Fallback to splash -> onboarding if error
        }
    }

    const handleSplashComplete = () => {
        // If profile loaded during splash, go to dashboard
        if (userProfile) {
            setCurrentScreen('dashboard')
            fetchTimeline()
            fetchDailyInsight()
        } else {
            setCurrentScreen('onboarding')
        }
    }

    const handleOnboardingComplete = async (data) => {
        console.log("Onboarding Data:", data)
        // Save minimal profile first
        try {
            const res = await axios.post('/user/profile', {
                user_id: 'default',
                ...data
            })
            console.log("Save Profile Response:", res.data)

            setUserProfile(data) // Optimistic update
            console.log("Navigating to 'scan' screen...")
            setCurrentScreen('scan') // Go to Prescription Upload next
        } catch (error) {
            console.error("Save profile failed", error)
            const serverError = error.response?.data?.error || error.message;
            alert("Backend Error: " + serverError);
            throw error; // Let Onboarding component know it failed
        }
    }

    const handleDeviceConnectComplete = () => {
        fetchTimeline()
        fetchDailyInsight()
        setCurrentScreen('dashboard')
    }

    const fetchTimeline = async () => {
        try {
            setLoading(true)
            const res = await axios.get('/timeline?user_id=default')
            const timelineData = res.data.timeline || []
            setTimeline(timelineData)

            if (timelineData.length > 0) {
                const drugIds = timelineData.map(item => item.drug_id)
                // Risk Check
                const riskRes = await axios.post('/risk', {
                    drug_ids: drugIds,
                    user_age: userProfile?.age || 70,
                    report_alcohol: true
                })
                setSafetyLevel(riskRes.data.risk_level)
                setRisks(riskRes.data.flags || [])
            } else {
                setSafetyLevel('green')
                setRisks([])
            }
        } catch (error) {
            console.error("Error fetching timeline:", error)
        } finally {
            setLoading(false)
        }
    }

    const fetchDailyInsight = async () => {
        try {
            const res = await axios.get('/analysis/behavior?user_id=default')
            const insights = res.data.insights || []
            // Pick the most important insight (Red > Yellow > Green)
            const priority = { 'red': 3, 'yellow': 2, 'green': 1 }
            const sorted = insights.sort((a, b) => priority[b.level] - priority[a.level])
            setTodaysInsight(sorted[0] || null)
        } catch (error) {
            console.error("Error fetching insights:", error)
        }
    }

    const handleScanAnalysisComplete = (candidates) => {
        setScannedCandidates(candidates)
        setCurrentScreen('confirm')
    }

    const handleConfirmComplete = () => {
        fetchTimeline()
        fetchDailyInsight()
        // If we just finished onboarding (no drugs yet), maybe go to device connect?
        // Actually, let's always go to device connect next if we are in the "setup" flow.
        // But we don't track "setup flow" state easily here. 
        // A simple heuristic: if we are here, go to DeviceConnect.
        setCurrentScreen('device_connect')
        setScannedCandidates([])
    }

    // --- RENDER HELPERS ---

    // 1. Health Shield (The Pulsing Ring)
    const HealthShield = () => {
        const colors = {
            green: 'bg-emerald-500 shadow-emerald-500/50',
            yellow: 'bg-amber-500 shadow-amber-500/50',
            red: 'bg-rose-500 shadow-rose-500/50'
        }
        const statusText = {
            green: 'Protected',
            yellow: 'Caution',
            red: 'Action Needed'
        }

        return (
            <div className="flex flex-col items-center justify-center py-8 relative">
                {/* Shield Ring */}
                <div className={`relative w-40 h-40 rounded-full flex items-center justify-center transition-all duration-700
                    ${seniorMode ? 'bg-white border-4 border-gray-200' : 'glass-card'}`}>

                    {/* Inner Pulse */}
                    <div className={`absolute inset-0 rounded-full opacity-20 ai-pulse ${colors[safetyLevel].replace('bg-', 'bg-')}`}></div>

                    {/* Status Icon Area */}
                    <div className={`w-32 h-32 rounded-full flex flex-col items-center justify-center text-white shadow-2xl transition-colors duration-500
                        ${colors[safetyLevel]}`}>

                        <span className={`font-bold ${seniorMode ? 'text-3xl' : 'text-2xl'} tracking-tight`}>
                            {statusText[safetyLevel]}
                        </span>
                        {!seniorMode && <span className="text-xs uppercase tracking-widest opacity-80 mt-1">Status</span>}
                    </div>
                </div>

                {/* Subtext */}
                {safetyLevel !== 'green' && (
                    <button
                        onClick={() => setCurrentScreen('analysis')}
                        className={`mt-6 px-6 py-2 rounded-full font-medium transition-all transform hover:scale-105 active:scale-95
                        ${seniorMode
                                ? 'bg-blue-600 text-white text-lg shadow-md'
                                : 'glass-card text-blue-700 hover:bg-white/80'}`}
                    >
                        View Analysis &rarr;
                    </button>
                )}
            </div>
        )
    }

    // 2. Main Layout Shell
    const Layout = ({ children }) => (
        <div className={`flex justify-center h-screen font-sans transition-colors duration-500 overflow-hidden
            ${seniorMode ? 'bg-white senior-mode' : 'bg-slate-50'}`}>
            <div className="w-full max-w-md h-full flex flex-col relative shadow-2xl bg-gradient-to-br from-white to-blue-50/50">
                {children}
            </div>
        </div>
    )

    // --- SCREEN ROUTING ---

    if (currentScreen === 'splash') return <SplashScreen onComplete={handleSplashComplete} />
    if (currentScreen === 'onboarding') return <Onboarding onComplete={handleOnboardingComplete} />
    if (currentScreen === 'device_connect') return <DeviceConnect onComplete={handleDeviceConnectComplete} onSkip={handleDeviceConnectComplete} />

    if (currentScreen === 'scan') {
        return (
            <Layout>
                <ScanPrescription
                    onBack={() => setCurrentScreen('device_connect')} // Skip to next step
                    onAnalysisComplete={handleScanAnalysisComplete}
                    seniorMode={seniorMode}
                />
            </Layout>
        )
    }

    if (currentScreen === 'confirm') {
        return (
            <Layout>
                <ConfirmMedicines
                    candidates={scannedCandidates}
                    onBack={() => setCurrentScreen('scan')}
                    onConfirmComplete={handleConfirmComplete}
                    seniorMode={seniorMode}
                />
            </Layout>
        )
    }

    if (currentScreen === 'analysis') {
        return (
            <Layout>
                <RiskAnalysis
                    onBack={() => setCurrentScreen('dashboard')}
                    seniorMode={seniorMode}
                    risks={risks}
                    userAge={userProfile?.age || 70} // Passing context
                    userMode={seniorMode ? 'senior' : 'adult'}
                />
            </Layout>
        )
    }

    // DASHBOARD
    return (
        <Layout>
            {/* Header */}
            <header className={`px-6 py-4 flex justify-between items-center sticky top-0 z-20 
                ${seniorMode ? 'bg-white border-b' : 'glass-header'}`}>
                <div>
                    <h1 className={`font-bold text-slate-800 ${seniorMode ? 'text-2xl' : 'text-xl tracking-tight'}`}>
                        MED GUARD
                    </h1>
                    {!seniorMode && <p className="text-xs text-slate-500">AI Safety Monitor</p>}
                </div>

                <div className="flex items-center gap-2">
                    {/* NEW: Explicit Header Add Button */}
                    <button
                        onClick={() => setCurrentScreen('scan')}
                        className={`px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1 transition-colors
                        ${seniorMode ? 'bg-blue-100 text-blue-700' : 'bg-blue-500/10 text-blue-600'}`}
                    >
                        <span>+ Add</span>
                    </button>

                    <SeniorModeToggle
                        isSenior={seniorMode}
                        onToggle={() => setSeniorMode(!seniorMode)}
                    />
                </div>
            </header>

            <main className="flex-1 overflow-y-auto pb-24">
                {/* 1. Health Shield Section */}
                <HealthShield />

                {/* 2. Daily Insight Card (Behavioral Model) */}
                {todaysInsight && (
                    <div className="px-6 mb-6 animate-fade-in-up">
                        <div className={`p-4 rounded-2xl border-l-4 shadow-sm flex items-start gap-3
                            ${seniorMode ? 'bg-gray-50 border-gray-300' : 'glass-card border-blue-400'}`}>
                            <div className="text-2xl">
                                {todaysInsight.level === 'green' ? '🌟' : todaysInsight.level === 'red' ? '⚠️' : '💡'}
                            </div>
                            <div>
                                <h3 className={`font-bold text-slate-800 ${seniorMode ? 'text-lg' : 'text-sm uppercase tracking-wide opacity-80'}`}>
                                    {todaysInsight.title}
                                </h3>
                                <p className={`text-slate-600 mt-1 ${seniorMode ? 'text-lg leading-snug' : 'text-sm'}`}>
                                    {todaysInsight.message}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* 3. Medicines List */}
                <div className="px-6">
                    <div className="flex justify-between items-end mb-4">
                        <h3 className={`font-bold text-slate-800 ${seniorMode ? 'text-xl' : 'text-lg'}`}>
                            Your Medicines
                        </h3>
                        {!seniorMode && <span className="text-xs text-slate-400 font-medium">{timeline.length} Active</span>}
                    </div>

                    <MedicineList
                        medicines={timeline}
                        loading={loading}
                        seniorMode={seniorMode}
                        onAddClick={() => setCurrentScreen('scan')}
                    />
                </div>
            </main>

            {/* Floating Scan Button */}
            <div className={`absolute left-0 right-0 flex justify-center z-30 ${seniorMode ? 'bottom-8' : 'bottom-6'}`}>
                <button
                    onClick={() => setCurrentScreen('scan')}
                    className={`rounded-full flex items-center justify-center shadow-lg shadow-blue-500/30 transition-all transform hover:scale-105 active:scale-95
                    ${seniorMode
                            ? 'w-20 h-20 bg-blue-700 text-white'
                            : 'w-16 h-16 bg-gradient-to-r from-blue-600 to-cyan-500 text-white'}`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`${seniorMode ? 'w-10 h-10' : 'w-8 h-8'}`}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                </button>
            </div>
        </Layout>
    )
}

export default App

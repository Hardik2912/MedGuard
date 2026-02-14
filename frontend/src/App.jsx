import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Landing from './pages/Landing';
import Profile from './pages/Profile';
import HealthHistory from './pages/HealthHistory';
import ScanPrescription from './pages/ScanPrescription';
import Dashboard from './pages/Dashboard';
import AIAssistant from './pages/AIAssistant';
import SeniorDashboard from './pages/SeniorDashboard';
import DoctorReport from './pages/DoctorReport';
import Settings from './pages/Settings';
import PrivateRoute from './components/PrivateRoute';
import { useAuth } from './context/AuthContext';

function App() {
    const { user } = useAuth();

    return (
        <Router>
            <div className="bg-slate-50 min-h-screen"> {/* Re-added this div based on original structure */}
                <Routes>
                    <Route path="/" element={<Landing />} />
                    <Route path="/login" element={<Login />} />

                    {/* Protected Routes */}
                    <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
                    <Route path="/scan-prescription" element={<PrivateRoute><ScanPrescription /></PrivateRoute>} />
                    <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
                    <Route path="/health-history" element={<PrivateRoute><HealthHistory /></PrivateRoute>} />
                    <Route path="/ai-assistant" element={<PrivateRoute><AIAssistant /></PrivateRoute>} />
                    <Route path="/senior-dashboard" element={<PrivateRoute><SeniorDashboard /></PrivateRoute>} />
                    <Route path="/report" element={<PrivateRoute><DoctorReport /></PrivateRoute>} />
                    <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
                    <Route path="*" element={<Navigate to="/" replace />} /> {/* Re-added catch-all route */}
                </Routes>
            </div>
        </Router>
    );
}

export default App;
This is exactly what you should be doing right now.
You need to ** align your coder friend clearly **, otherwise you’ll both waste time.

    I’ll give you:

1. 📄 A clear explanation of the app
2. 🎯 What the smart demo should include
3. 🧠 Architecture overview
4. 👥 Role division
5. 🗺 Execution roadmap(step - by - step)
6. 🎤 How to present it

You can copy this and send to your coder friend directly.

---

# 📄 MED GUARD – Smart Demo Explanation

## 🧠 Core Idea

MedGuard is a ** medication safety and adherence monitoring platform **, with a special focus on ** Senior Mode **.

It is not a diagnostic app.
It is a behavior - aware medication companion.

The system:

* Collects user profile
    * Detects if user is elderly(age ≥ 60)
        * Switches to Senior Mode automatically
            * Allows prescription upload
                * Extracts medicines(basic demo version)
                    * Tracks missed doses
                        * Escalates risk(Green / Yellow / Red)
                            * Uses voice reminders
                                * Explains risks calmly

---

# 🎯 What We Are Building(Smart Demo Scope)

We are NOT building:

* Full OCR system
    * ML prediction model
        * Advanced AI reasoning
            * Complete medical engine

We ARE building:

### ✅ 1. Senior Mode(Fully Working)

    * Auto activation(age ≥ 60)
        * Minimal UI
            * Large buttons
                * Voice - first interaction

### ✅ 2. Prescription Upload(Basic)

    * Upload image
        * Store in Supabase Storage
            * Show mock extracted medicines
                * Save medicines in database

### ✅ 3. Medication Tracking

    * Mark dose as taken
        * Mark dose as missed

### ✅ 4. Risk Escalation Engine

Simple rule - based logic:

```
0 missed → Green
1 missed → Yellow
2+ missed → Red
If antibiotic missed → minimum Yellow
```

### ✅ 5. Voice Reminder

    * Speak reminder
        * Speak escalation
            * Slower rate for Senior Mode

That is the demo.

---

# 🏗 Architecture Overview

Frontend: React(already built basic UI)

Backend: Supabase

    * Database
    * Storage

Brain: Rule - based risk engine(inside frontend for demo)

    Later:
AI integration can replace rule engine.

---

# 🗄 Required Supabase Tables

### profiles

    * id
    * age
    * is_senior

### medicines

    * id
    * user_id
    * name
    * is_antibiotic

### adherence_log

    * id
    * medicine_id
    * taken
    * timestamp

That’s enough for demo.

---

# 👥 Team Division(Very Important)

## 👨‍💻 You

    * Senior Mode UI
        * Voice reminder logic
            * Risk color logic
                * Dashboard behavior

## 👨‍💻 Friend

    * Supabase connection
        * RLS setup
            * Save profile
                * Upload prescription image
                    * Save medicines
                        * Save adherence logs

No overlap.No confusion.

---

# 🗺 Execution Roadmap

## Phase 1 – Backend Setup(3–4 hours)

    * Connect Supabase
        * Fix RLS policies
            * Save profile
                * Test database writes

## Phase 2 – Senior Mode(2 hours)

    * If age ≥ 60 → activate
        * Switch layout
            * Bigger UI
                * Minimal design

## Phase 3 – Prescription Flow(2–3 hours)

    * Upload image to Supabase Storage
        * Show mock extracted medicines
            * Save medicines table

## Phase 4 – Risk Engine(2 hours)

    * Count missed doses
        * Change risk color
            * Display message

## Phase 5 – Voice(1–2 hours)

    * Web Speech API
        * Escalation tone
            * Replay option

Total: 8–10 focused hours.

---

# 🎤 How We Present It

Flow during demo:

1. Enter age 65
2. Senior Mode activates
3. Upload prescription
4. Medicines appear
5. Save medicines
6. Miss a dose
7. Risk turns yellow
8. Voice explains calmly

Say:

> “Currently the system uses rule - based behavioral pattern analysis.We are working toward AI - enhanced risk modeling.”

That sounds advanced.

---

# 🧠 Why This Is Smart

You are demonstrating:

* Behavioral tracking
    * Escalation logic
        * Senior - centered UX
            * Voice - first interface
                * Data persistence

That is strong for a demo.

---

# ⚠ What We Avoid Before Monday

❌ Advanced OCR
❌ Complex AI
❌ Caregiver voice upload cloud system
❌ Perfect architecture
❌ Feature creep

---

# 🎯 Final Goal

Deliver a stable, predictable demo that:

* Never crashes
    * Has smooth navigation
        * Changes risk dynamically
            * Speaks clearly
                * Shows clear concept

That’s what impresses.

---

    If you want, next I can give you:

* A 2 - minute pitch script
    * A technical explanation script
        * Or a diagram explanation for your coder friend

Tell me what you need next.

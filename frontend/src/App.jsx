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

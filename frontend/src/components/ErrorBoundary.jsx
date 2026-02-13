import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Uncaught Error:", error, errorInfo);
        this.setState({ error, errorInfo });
    }

    handleReload = () => {
        window.location.reload();
    }

    handleGoHome = () => {
        window.location.href = '/dashboard';
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
                    <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6 animate-pulse">
                        <AlertTriangle className="w-10 h-10 text-red-500" />
                    </div>

                    <h1 className="text-2xl font-bold text-slate-900 mb-2">App Paused</h1>
                    <p className="text-slate-500 mb-8 max-w-sm">
                        Just a technical hiccup. Your health data is safe! Please reload to continue.
                    </p>

                    <div className="flex flex-col gap-3 w-full max-w-xs">
                        <button
                            onClick={this.handleReload}
                            className="btn-primary flex items-center justify-center gap-2"
                        >
                            <RefreshCw className="w-4 h-4" /> Reload App
                        </button>
                        <button
                            onClick={this.handleGoHome}
                            className="bg-white text-slate-600 border border-slate-200 py-3 rounded-xl font-bold hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                        >
                            <Home className="w-4 h-4" /> Go to Dashboard
                        </button>
                    </div>

                    {/* Developer Details (Hidden in Prod usually, but good for demo) */}
                    <div className="mt-12 text-left w-full max-w-lg bg-slate-100 p-4 rounded-xl overflow-hidden">
                        <p className="text-xs font-bold text-slate-400 uppercase mb-2">Technical Details</p>
                        <code className="text-xs text-slate-600 font-mono block whitespace-pre-wrap break-words">
                            {this.state.error && this.state.error.toString()}
                        </code>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;

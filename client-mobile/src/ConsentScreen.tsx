import { useState } from 'react';
import { permissionService, type PermissionState } from './services/PermissionService';

interface ConsentScreenProps {
    onConsent: () => void;
    onBlocked: () => void;
}

type Step = 'disclosure' | 'permission' | 'done';

export function ConsentScreen({ onConsent, onBlocked }: ConsentScreenProps) {
    const [step, setStep] = useState<Step>('disclosure');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // ─── Step 1 → 2: User accepts the data disclosure ───────────────

    const handleAcceptDisclosure = async () => {
        await permissionService.giveConsent();
        setError(null);
        setStep('permission');
    };

    // ─── Step 2: Request foreground permission ──────────────────────

    const handleRequestPermission = async () => {
        setLoading(true);
        setError(null);

        const state: PermissionState = await permissionService.requestForeground();

        setLoading(false);

        if (state === 'foreground_granted' || state === 'background_granted') {
            setStep('done');
        } else if (state === 'blocked') {
            onBlocked();
        } else {
            setError('Location permission was denied. Tap "Retry" to try again.');
        }
    };

    const handleOpenSettings = async () => {
        await permissionService.openAppSettings();
    };

    // ─── Step 3: Done → enter app ───────────────────────────────────

    const handleFinish = () => {
        onConsent();
    };

    // ─── Deny on step 1 ─────────────────────────────────────────────

    const handleDenyDisclosure = () => {
        setError('Location access is required to use this app. Please accept to continue.');
    };

    // ─── Render ─────────────────────────────────────────────────────

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white p-6">
            <div className="max-w-md w-full bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-700">

                {/* ── Step indicator ─────────────────────────────── */}
                <div className="flex items-center justify-center gap-2 mb-6">
                    {(['disclosure', 'permission', 'done'] as Step[]).map((s, i) => (
                        <div key={s} className="flex items-center gap-2">
                            <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${step === s
                                        ? 'bg-gradient-to-r from-blue-500 to-teal-500 text-white shadow-lg shadow-blue-500/30'
                                        : (['disclosure', 'permission', 'done'].indexOf(step) > i
                                            ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30'
                                            : 'bg-gray-700 text-gray-500')
                                    }`}
                            >
                                {(['disclosure', 'permission', 'done'].indexOf(step) > i) ? '✓' : i + 1}
                            </div>
                            {i < 2 && (
                                <div className={`w-8 h-0.5 rounded transition-colors duration-300 ${(['disclosure', 'permission', 'done'].indexOf(step) > i
                                        ? 'bg-teal-500/50'
                                        : 'bg-gray-700')
                                    }`} />
                            )}
                        </div>
                    ))}
                </div>

                {/* ── Step 1: Data Disclosure ────────────────────── */}
                {step === 'disclosure' && (
                    <div className="animate-fadeIn">
                        <h1 className="text-2xl font-bold mb-2 text-center bg-gradient-to-r from-blue-400 to-teal-400 bg-clip-text text-transparent">
                            Data Collection Disclosure
                        </h1>
                        <p className="text-gray-400 text-sm text-center mb-6">
                            Please review what data we collect before proceeding
                        </p>

                        <div className="space-y-4 text-gray-300 mb-6">
                            <div className="bg-gray-700/50 p-4 rounded-xl border border-gray-600/30">
                                <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                                    <span className="text-blue-400">📍</span> What we collect
                                </h3>
                                <ul className="space-y-2 text-sm">
                                    <li className="flex items-start gap-2">
                                        <span className="text-teal-400 mt-0.5">•</span>
                                        <span><strong>GPS coordinates</strong> (latitude &amp; longitude)</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-teal-400 mt-0.5">•</span>
                                        <span><strong>Timestamp</strong> of each capture</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-teal-400 mt-0.5">•</span>
                                        <span><strong>Battery level</strong> (to optimise tracking)</span>
                                    </li>
                                </ul>
                            </div>

                            <div className="bg-gray-700/50 p-4 rounded-xl border border-gray-600/30">
                                <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                                    <span className="text-blue-400">🔄</span> How often
                                </h3>
                                <p className="text-sm">
                                    Location is captured periodically while tracking is active.
                                    In <strong>High Accuracy</strong> mode, every ~10 metres of movement.
                                    In <strong>Balanced</strong> mode, every ~50 metres.
                                </p>
                            </div>

                            <div className="bg-gray-700/50 p-4 rounded-xl border border-gray-600/30">
                                <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                                    <span className="text-blue-400">🔒</span> Your control
                                </h3>
                                <p className="text-sm">
                                    You can stop tracking at any time. You can revoke location permission
                                    in your device settings. Data stored locally can be cleared from the app.
                                </p>
                            </div>
                        </div>

                        {error && (
                            <div className="bg-red-500/20 text-red-200 p-3 rounded-lg mb-4 text-sm text-center border border-red-500/50">
                                {error}
                            </div>
                        )}

                        <div className="flex flex-col space-y-3">
                            <button
                                onClick={handleAcceptDisclosure}
                                className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-500 hover:to-teal-500 font-semibold shadow-lg shadow-blue-900/30 transition-all active:scale-95"
                            >
                                I Understand — Continue
                            </button>
                            <button
                                onClick={handleDenyDisclosure}
                                className="w-full py-3.5 px-6 rounded-xl bg-gray-700 hover:bg-gray-600 font-medium text-gray-300 transition-all active:scale-95"
                            >
                                Decline
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Step 2: Foreground Permission ─────────────── */}
                {step === 'permission' && (
                    <div className="animate-fadeIn">
                        <h1 className="text-2xl font-bold mb-2 text-center bg-gradient-to-r from-blue-400 to-teal-400 bg-clip-text text-transparent">
                            Location Permission
                        </h1>
                        <p className="text-gray-400 text-sm text-center mb-6">
                            Grant access so we can capture your location
                        </p>

                        <div className="bg-gray-700/50 p-5 rounded-xl border border-gray-600/30 mb-6">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-xl">
                                    📍
                                </div>
                                <div>
                                    <p className="text-white font-semibold text-sm">Allow while using the app</p>
                                    <p className="text-gray-400 text-xs">Required for foreground tracking</p>
                                </div>
                            </div>
                            <p className="text-gray-400 text-xs">
                                When you tap "Allow", your device will show a system permission dialog.
                                Select <strong>"Allow while using the app"</strong> or <strong>"Allow only this time"</strong> to proceed.
                            </p>
                        </div>

                        {error && (
                            <div className="bg-red-500/20 text-red-200 p-3 rounded-lg mb-4 text-sm text-center border border-red-500/50">
                                {error}
                                <button
                                    onClick={handleOpenSettings}
                                    className="block w-full mt-2 text-blue-400 hover:text-blue-300 text-xs underline"
                                >
                                    Open Settings to grant manually
                                </button>
                            </div>
                        )}

                        <div className="flex flex-col space-y-3">
                            <button
                                onClick={handleRequestPermission}
                                disabled={loading}
                                className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-500 hover:to-teal-500 font-semibold shadow-lg shadow-blue-900/30 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Requesting…
                                    </span>
                                ) : (error ? 'Retry Permission' : 'Allow Location Access')}
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Step 3: Done ──────────────────────────────── */}
                {step === 'done' && (
                    <div className="animate-fadeIn text-center">
                        <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center text-3xl mx-auto mb-4 border border-green-500/30">
                            ✓
                        </div>
                        <h1 className="text-2xl font-bold mb-2 bg-gradient-to-r from-green-400 to-teal-400 bg-clip-text text-transparent">
                            Location Access Granted
                        </h1>
                        <p className="text-gray-400 text-sm mb-2">
                            Foreground tracking is ready to go.
                        </p>
                        <p className="text-gray-500 text-xs mb-6 px-4">
                            You can enable <strong>background tracking</strong> later from the main screen.
                            This requires a separate permission ("Allow all the time").
                        </p>

                        <button
                            onClick={handleFinish}
                            className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-500 hover:to-teal-500 font-semibold shadow-lg shadow-green-900/30 transition-all active:scale-95"
                        >
                            Enter App
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

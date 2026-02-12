import { useState } from 'react';
import { permissionService, type PermissionState } from './services/PermissionService';

interface PermissionDeniedScreenProps {
    onRecovered: () => void;
}

/**
 * Full-screen blocker shown when the user has permanently denied
 * location permission ("Don't ask again" on Android).
 *
 * Provides a deep-link to Settings and a retry button that re-checks
 * whether permission was granted externally.
 */
export function PermissionDeniedScreen({ onRecovered }: PermissionDeniedScreenProps) {
    const [checking, setChecking] = useState(false);

    const handleOpenSettings = async () => {
        await permissionService.openAppSettings();
    };

    const handleRetry = async () => {
        setChecking(true);
        const state: PermissionState = await permissionService.checkCurrentState();
        setChecking(false);

        if (state === 'foreground_granted' || state === 'background_granted') {
            onRecovered();
        }
    };

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white p-6">
            <div className="max-w-md w-full bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-700 text-center">

                {/* Icon */}
                <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center text-3xl mx-auto mb-5 border border-red-500/30">
                    🚫
                </div>

                <h1 className="text-2xl font-bold mb-2 bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
                    Permission Blocked
                </h1>

                <p className="text-gray-400 text-sm mb-6">
                    Location permission has been permanently denied.
                    This app requires location access to function.
                </p>

                <div className="bg-gray-700/50 p-4 rounded-xl border border-gray-600/30 mb-6 text-left">
                    <p className="text-gray-300 text-sm mb-2 font-medium">
                        To fix this:
                    </p>
                    <ol className="text-gray-400 text-sm space-y-2 list-decimal pl-5">
                        <li>Open <strong>Settings</strong> using the button below</li>
                        <li>Go to <strong>Permissions → Location</strong></li>
                        <li>Select <strong>"Allow while using the app"</strong></li>
                        <li>Return to this app and tap <strong>"Check Again"</strong></li>
                    </ol>
                </div>

                <div className="flex flex-col space-y-3">
                    <button
                        onClick={handleOpenSettings}
                        className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-500 hover:to-teal-500 font-semibold shadow-lg shadow-blue-900/30 transition-all active:scale-95"
                    >
                        Open Settings
                    </button>
                    <button
                        onClick={handleRetry}
                        disabled={checking}
                        className="w-full py-3.5 px-6 rounded-xl bg-gray-700 hover:bg-gray-600 font-medium text-gray-300 transition-all active:scale-95 disabled:opacity-50"
                    >
                        {checking ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Checking…
                            </span>
                        ) : 'Check Again'}
                    </button>
                </div>
            </div>
        </div>
    );
}

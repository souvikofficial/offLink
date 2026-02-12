import { useState } from 'react';
import { permissionService } from './services/PermissionService';

interface BackgroundPermissionScreenProps {
    onGranted: () => void;
    onDismiss: () => void;
}

/**
 * Modal overlay shown when the user toggles "Enable Background Mode"
 * but hasn't yet granted ACCESS_BACKGROUND_LOCATION.
 *
 * Google Play policy requires a prominent in-app disclosure before
 * requesting background location.
 */
export function BackgroundPermissionScreen({ onGranted, onDismiss }: BackgroundPermissionScreenProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleAllow = async () => {
        setLoading(true);
        setError(null);

        const granted = await permissionService.requestBackground();

        setLoading(false);

        if (granted) {
            onGranted();
        } else {
            setError('Background permission was not granted. You may need to enable it manually in Settings.');
        }
    };

    const handleOpenSettings = async () => {
        await permissionService.openAppSettings();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="max-w-md w-full bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 p-6 transform transition-all animate-slideUp">

                {/* Header */}
                <div className="flex items-center gap-3 mb-5">
                    <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-2xl border border-blue-500/30">
                        🌐
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white">Background Location Access</h2>
                        <p className="text-gray-400 text-xs">Additional permission required</p>
                    </div>
                </div>

                {/* Disclosure */}
                <div className="bg-gray-700/50 rounded-xl p-4 mb-5 border border-gray-600/30">
                    <p className="text-gray-300 text-sm mb-3">
                        To track your location <strong>while the app is minimised or the screen is off</strong>,
                        we need the <strong>"Allow all the time"</strong> permission.
                    </p>
                    <div className="space-y-2 text-sm text-gray-400">
                        <div className="flex items-start gap-2">
                            <span className="text-blue-400 mt-0.5">•</span>
                            <span>Required for <strong>offline route recording</strong></span>
                        </div>
                        <div className="flex items-start gap-2">
                            <span className="text-blue-400 mt-0.5">•</span>
                            <span>Uses a foreground service notification so you know tracking is active</span>
                        </div>
                        <div className="flex items-start gap-2">
                            <span className="text-blue-400 mt-0.5">•</span>
                            <span>You can disable background mode at any time</span>
                        </div>
                    </div>
                </div>

                {/* Warning banner */}
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mb-5">
                    <p className="text-amber-300 text-xs">
                        ⚠ Your device will show a system dialog. Select <strong>"Allow all the time"</strong> to enable background tracking.
                    </p>
                </div>

                {/* Error */}
                {error && (
                    <div className="bg-red-500/20 text-red-200 p-3 rounded-lg mb-4 text-sm text-center border border-red-500/50">
                        {error}
                        <button
                            onClick={handleOpenSettings}
                            className="block w-full mt-2 text-blue-400 hover:text-blue-300 text-xs underline"
                        >
                            Open Settings
                        </button>
                    </div>
                )}

                {/* Actions */}
                <div className="flex flex-col space-y-3">
                    <button
                        onClick={handleAllow}
                        disabled={loading}
                        className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-500 hover:to-teal-500 font-semibold shadow-lg shadow-blue-900/30 transition-all active:scale-95 disabled:opacity-50"
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Requesting…
                            </span>
                        ) : 'Allow Background Access'}
                    </button>
                    <button
                        onClick={onDismiss}
                        disabled={loading}
                        className="w-full py-3 px-6 rounded-xl bg-gray-700 hover:bg-gray-600 font-medium text-gray-300 transition-all active:scale-95 disabled:opacity-50"
                    >
                        Not Now
                    </button>
                </div>
            </div>
        </div>
    );
}

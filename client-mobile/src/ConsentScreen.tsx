import { useState } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { Preferences } from '@capacitor/preferences';

interface ConsentScreenProps {
    onConsent: () => void;
}

export function ConsentScreen({ onConsent }: ConsentScreenProps) {
    const [error, setError] = useState<string | null>(null);

    const handleAllow = async () => {
        try {
            // 1. Request Permission
            const permission = await Geolocation.requestPermissions();

            if (permission.location === 'granted') {
                // 2. Save Consent locally
                await Preferences.set({
                    key: 'has_consented',
                    value: 'true',
                });
                onConsent();
            } else {
                setError('Location permission is required to use this app.');
            }
        } catch (err: any) {
            setError('Failed to request permission: ' + err.message);
        }
    };

    const handleDeny = () => {
        // Logic for denial - maybe show a message or exit app (if possible)
        // For now, simple message
        setError('You must allow location access to proceed.');
    };

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white p-6">
            <div className="max-w-md w-full bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-700">
                <h1 className="text-3xl font-bold mb-6 text-center bg-gradient-to-r from-blue-400 to-teal-400 bg-clip-text text-transparent">Location Access</h1>

                <div className="space-y-4 text-gray-300 mb-8">
                    <p>
                        To provide you with offline sync capabilities, this app needs access to your device's location.
                    </p>
                    <div className="bg-gray-700/50 p-4 rounded-lg">
                        <h3 className="font-semibold text-white mb-2">What we collect:</h3>
                        <ul className="list-disc pl-5 space-y-1 text-sm">
                            <li>Latitude & Longitude</li>
                            <li>Timestamp of capture</li>
                            <li>Device battery level</li>
                        </ul>
                    </div>
                    <p className="text-sm text-gray-400">
                        Data is collected only when the app is active. You can revoke this permission at any time in your device settings.
                    </p>
                </div>

                {error && (
                    <div className="bg-red-500/20 text-red-200 p-3 rounded-lg mb-6 text-sm text-center border border-red-500/50">
                        {error}
                    </div>
                )}

                <div className="flex flex-col space-y-3">
                    <button
                        onClick={handleAllow}
                        className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-500 hover:to-teal-500 font-semibold shadow-lg shadow-blue-900/30 transition-all active:scale-95"
                    >
                        Allow Location Access
                    </button>
                    <button
                        onClick={handleDeny}
                        className="w-full py-3.5 px-6 rounded-xl bg-gray-700 hover:bg-gray-600 font-medium text-gray-300 transition-all active:scale-95"
                    >
                        Deny
                    </button>
                </div>
            </div>
        </div>
    );
}

import { useState, useEffect } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';
import { ConsentScreen } from './ConsentScreen';
import { BackgroundPermissionScreen } from './BackgroundPermissionScreen';
import { PermissionDeniedScreen } from './PermissionDeniedScreen';
import { permissionService, type PermissionState } from './services/PermissionService';
import { locationService } from './services/LocationService';
import { databaseService } from './services/DatabaseService';
import { deviceService } from './services/DeviceService';
import { syncService } from './services/SyncService';
import { Share } from '@capacitor/share';
import { registerPlugin } from '@capacitor/core';
const NativeSms = registerPlugin<any>('NativeSms');
import { loadAccuracyMode, type AccuracyMode } from './services/LocationConfig';
import './App.css';

type OneShotLocation = {
  lat: number;
  lng: number;
  accuracyM: number;
  capturedAt: string;
  provider: string;
};

function App() {
  const [permState, setPermState] = useState<PermissionState | null>(null);
  const [isBackground, setIsBackground] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [lastCaptured, setLastCaptured] = useState<string | null>(null);
  const [clearOnStop, setClearOnStop] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [accuracyMode, setAccuracyMode] = useState<AccuracyMode>('high_accuracy');
  const [currentProvider, setCurrentProvider] = useState<string | null>(null);
  const [isFallback, setIsFallback] = useState(false);
  const [showBgPermModal, setShowBgPermModal] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<OneShotLocation | null>(null);
  const [currentLocationError, setCurrentLocationError] = useState<string | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [savedNumber, setSavedNumber] = useState<string | null>(null);

  // ─── Check permission state on mount + app resume ─────────────────

  useEffect(() => {
    const init = async () => {
      const state = await permissionService.checkCurrentState();
      setPermState(state);
    };
    init();

    // Re-check permissions when app comes back from Settings (native only)
    let listenerHandle: any = null;
    if (Capacitor.isNativePlatform()) {
      listenerHandle = CapApp.addListener('resume', async () => {
        const state = await permissionService.onAppResume();
        setPermState(state);
      });
    }

    // Also subscribe to PermissionService state changes
    const removePerm = permissionService.addListener((state) => {
      setPermState(state);
    });

    return () => {
      if (listenerHandle) listenerHandle.then((h: any) => h.remove());
      removePerm();
    };
  }, []);

  // ─── Initialise services once we have foreground permission ───────

  useEffect(() => {
    if (permState !== 'foreground_granted' && permState !== 'background_granted') return;

    loadAccuracyMode().then(setAccuracyMode);

    const initDb = async () => {
      await deviceService.init();
      await databaseService.init();
      console.log('SyncService initialized:', !!syncService);
      try {
        const saved = await NativeSms.getSavedNumber();
        setSavedNumber(saved?.number ?? null);
      } catch (e) {
        // ignore
      }
    };
    initDb();

    // Monitor network
    Network.getStatus().then(status => setIsOnline(status.connected));
    Network.addListener('networkStatusChange', status => setIsOnline(status.connected));

    // Poll pending count
    const interval = setInterval(async () => {
      const count = await databaseService.getPendingCount();
      setPendingCount(count);
    }, 2000);

    const removeListener = locationService.addListener((point) => {
      setLastCaptured(new Date(point.capturedAt).toLocaleTimeString());
      setCurrentProvider(point.provider);
      setIsFallback(locationService.isGpsFallbackActive());
      databaseService.getPendingCount().then(setPendingCount);
    });

    return () => {
      removeListener();
      clearInterval(interval);
      Network.removeAllListeners();
    };
  }, [permState]);

  // ─── Background Mode Toggle ───────────────────────────────────────

  const toggleBackgroundMode = async () => {
    if (!isBackground) {
      // Turning ON → check if we have background permission
      const hasBgPerm = await permissionService.hasBackgroundPermission();
      if (!hasBgPerm) {
        // Show the background permission disclosure modal
        setShowBgPermModal(true);
        return;
      }
    }

    const newMode = !isBackground;
    setIsBackground(newMode);
    await locationService.setMode(newMode ? 'background' : 'foreground');
  };

  const handleBgPermGranted = async () => {
    setShowBgPermModal(false);
    setIsBackground(true);
    await locationService.setMode('background');
  };

  const handleBgPermDismiss = () => {
    setShowBgPermModal(false);
    // Toggle stays off
  };

  // ─── Accuracy Mode Toggle ─────────────────────────────────────────

  const toggleAccuracyMode = async () => {
    const newMode: AccuracyMode = accuracyMode === 'high_accuracy' ? 'balanced_power' : 'high_accuracy';
    setAccuracyMode(newMode);
    setIsFallback(false);
    await locationService.setAccuracyMode(newMode);
  };

  // ─── Tracking Toggle ──────────────────────────────────────────────

  const toggleTracking = async () => {
    if (isTracking) {
      await locationService.stopTracking();
      if (clearOnStop) {
        await deviceService.clearCredentials();
      }
      setIsTracking(false);
      setCurrentProvider(null);
      setIsFallback(false);
    } else {
      await locationService.startTracking();
      setIsTracking(true);
    }
  };

  // ─── One-shot Location (Offline Capable) ─────────────────────────

  const handleGetCurrentLocation = async () => {
    setIsGettingLocation(true);
    setCurrentLocationError(null);

    try {
      let state = await permissionService.checkCurrentState();
      if (state !== 'foreground_granted' && state !== 'background_granted') {
        state = await permissionService.requestForeground();
        setPermState(state);
      }

      if (state !== 'foreground_granted' && state !== 'background_granted') {
        setCurrentLocationError('Location permission not granted.');
        setCurrentLocation(null);
        return;
      }

      const enabled = await locationService.ensureLocationEnabled();
      if (!enabled) {
        setCurrentLocationError('Location services are off. Please enable them in Settings and try again.');
        setCurrentLocation(null);
        return;
      }

      const point = await locationService.getCurrentOrLastLocation(120_000);
      if (!point) {
        setCurrentLocationError('Unable to obtain a location fix.');
        setCurrentLocation(null);
        return;
      }

      setCurrentLocation({
        lat: point.lat,
        lng: point.lng,
        accuracyM: point.accuracyM,
        capturedAt: point.capturedAt,
        provider: point.provider,
      });
    } catch (err) {
      console.error('Failed to get current location', err);
      setCurrentLocationError('Failed to get location.');
      setCurrentLocation(null);
    } finally {
      setIsGettingLocation(false);
    }
  };

  // ─── Consent flow callbacks ───────────────────────────────────────

  const handleConsentComplete = async () => {
    const state = await permissionService.checkCurrentState();
    setPermState(state);
  };

  const handlePermRecovered = async () => {
    const state = await permissionService.checkCurrentState();
    setPermState(state);
  };

  const handleBlocked = () => {
    setPermState('blocked');
  };

  // ─── Provider display helpers ─────────────────────────────────────

  const providerBadge = () => {
    if (!currentProvider) return null;

    const map: Record<string, { label: string; color: string }> = {
      gps: { label: 'GPS', color: 'text-emerald-400 bg-emerald-500/20' },
      network: { label: 'Network', color: 'text-blue-400 bg-blue-500/20' },
      fused: { label: 'Fused', color: 'text-purple-400 bg-purple-500/20' },
      network_fallback: { label: 'Network ⚠', color: 'text-amber-400 bg-amber-500/20' },
    };

    const info = map[currentProvider] ?? { label: currentProvider, color: 'text-gray-400 bg-gray-500/20' };

    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${info.color}`}>
        {info.label}
      </span>
    );
  };

  const accuracyLabel = accuracyMode === 'high_accuracy'
    ? 'High Accuracy (GPS)'
    : 'Balanced Power (Network)';

  // ─── Render: Loading ──────────────────────────────────────────────

  if (permState === null) {
    return <div className="h-screen bg-gray-900 flex items-center justify-center text-white">Loading...</div>;
  }

  // ─── Render: Consent / Permission flow ────────────────────────────

  if (permState === 'idle' || permState === 'consent_given') {
    return <ConsentScreen onConsent={handleConsentComplete} onBlocked={handleBlocked} />;
  }

  if (permState === 'blocked') {
    return <PermissionDeniedScreen onRecovered={handlePermRecovered} />;
  }

  if (permState === 'denied') {
    return <ConsentScreen onConsent={handleConsentComplete} onBlocked={handleBlocked} />;
  }

  // ─── Render: Main App ─────────────────────────────────────────────

  return (
    <div className="h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Permission Modal */}
      {showBgPermModal && (
        <BackgroundPermissionScreen
          onGranted={handleBgPermGranted}
          onDismiss={handleBgPermDismiss}
        />
      )}

      {/* Background Glow */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="z-10 flex flex-col items-center w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-green-400 to-teal-400 bg-clip-text text-transparent mb-2">
            Offsync Active
          </h1>
          <p className="text-gray-400 text-sm">
            Device ID: <span className="font-mono text-gray-500">{deviceService.getDeviceId() || 'Not registered'}</span>
          </p>
        </div>

        {/* Status Card */}
        <div className={`w-full p-6 rounded-2xl border backdrop-blur-sm transition-all duration-300 ${isTracking ? 'bg-green-500/10 border-green-500/30 shadow-[0_0_30px_-5px_rgba(34,197,94,0.3)]' : 'bg-gray-800/50 border-gray-700'}`}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-gray-300 font-medium">Status</span>
            <div className={`flex items-center px-3 py-1 rounded-full text-xs font-bold ${isTracking ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
              {isTracking ? 'TRACKING' : 'IDLE'}
              {isTracking && <span className="ml-2 w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-sm">Mode</span>
              <span className="text-white text-sm font-medium">{isBackground ? 'Background (Service)' : 'Foreground'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-sm">Accuracy</span>
              <span className="text-white text-sm font-medium">{accuracyLabel}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-sm">Provider</span>
              <span className="text-sm font-medium">{isTracking ? providerBadge() ?? <span className="text-gray-500">Waiting…</span> : <span className="text-gray-500">—</span>}</span>
            </div>
            {isFallback && (
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <span className="text-amber-400 text-xs">⚠ GPS unavailable — using network fallback</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-sm">Last Captured</span>
              <span className="text-white text-sm font-medium font-mono">{lastCaptured || 'None'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-sm">Network</span>
              <span className={`text-sm font-medium ${isOnline ? 'text-green-400' : 'text-red-400'}`}>
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-sm">Pending Uploads</span>
              <span className={`text-sm font-medium font-mono ${pendingCount > 0 ? 'text-amber-400' : 'text-gray-500'}`}>
                {pendingCount}
              </span>
            </div>
            {/* Offline queued notice */}
            {pendingCount > 0 && !isOnline && (
              <div className="mt-3 p-3 bg-gray-800/20 border border-gray-700 rounded-lg text-sm text-amber-200">
                <div className="flex items-center justify-between">
                  <span>Queued for upload when online</span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={async () => {
                        try {
                          const point = await locationService.getCurrentOrLastLocation(120_000);
                          if (!point) return;
                          const body = `I'm here: https://maps.google.com/?q=${point.lat},${point.lng} (accuracy ${Math.round(point.accuracyM)}m) at ${new Date(point.capturedAt).toLocaleString()}`;
                          await Share.share({ text: body });
                        } catch (e) {
                          console.warn('Share via SMS failed', e);
                        }
                      }}
                      className="py-1 px-2 bg-blue-600/20 text-blue-400 text-xs rounded"
                    >
                      Share via SMS
                    </button>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={async () => {
                          try {
                            const point = await locationService.getCurrentOrLastLocation(120_000);
                            if (!point) return;
                            const body = `I'm here: https://maps.google.com/?q=${point.lat},${point.lng} (accuracy ${Math.round(point.accuracyM)}m) at ${new Date(point.capturedAt).toLocaleString()}`;

                            // Ensure permission
                            let perm = await NativeSms.hasSendSmsPermission();
                            if (!perm || !perm.value) {
                              const res = await NativeSms.requestSendSmsPermission();
                              if (!res || !res.granted) {
                                alert('SEND_SMS permission required for silent send');
                                return;
                              }
                            }

                            // Try saved number
                            const saved = await NativeSms.getSavedNumber();
                            let number = saved?.number;
                            if (!number) {
                              const pick = await NativeSms.pickContact();
                              number = pick?.number;
                              if (!number) return;
                              setSavedNumber(number);
                            }

                            await NativeSms.sendSmsSilent({ number, message: body });
                            alert('SMS sent (silent)');
                          } catch (e) {
                            console.warn('Silent SMS failed', e);
                            alert('Silent SMS failed; falling back to composer.');
                          }
                        }}
                        className="py-1 px-2 bg-gray-700 text-gray-200 text-xs rounded"
                      >
                        {savedNumber ? `Silent SMS → ${savedNumber}` : 'Silent SMS'}
                      </button>

                      <button
                        onClick={async () => {
                          try {
                            const pick = await NativeSms.pickContact();
                            const num = pick?.number;
                            if (num) setSavedNumber(num);
                          } catch (e) {
                            console.warn('Contact pick failed', e);
                          }
                        }}
                        className="py-1 px-2 bg-gray-700 text-gray-200 text-xs rounded"
                      >
                        Change
                      </button>

                      {savedNumber && (
                        <button
                          onClick={async () => {
                            try {
                              await NativeSms.clearSavedNumber();
                              setSavedNumber(null);
                            } catch (e) {
                              console.warn('Clear saved number failed', e);
                            }
                          }}
                          className="py-1 px-2 bg-red-600/20 text-red-300 text-xs rounded"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {pendingCount > 0 && isOnline && (
              <button
                onClick={() => syncService.retrySync()}
                className="w-full mt-2 py-2 bg-blue-600/20 text-blue-400 text-xs rounded-lg hover:bg-blue-600/30 transition-colors"
              >
                Force Sync Now
              </button>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="w-full space-y-4">
          <button
            onClick={toggleTracking}
            className={`w-full py-4 rounded-xl font-bold shadow-lg transition-all active:scale-95 ${isTracking
              ? 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20'
              : 'bg-gradient-to-r from-blue-600 to-teal-600 text-white shadow-blue-900/20 hover:from-blue-500 hover:to-teal-500'
              }`}
          >
            {isTracking ? 'Stop Tracking' : 'Start Tracking'}
          </button>

          {/* One-shot location */}
          <button
            onClick={handleGetCurrentLocation}
            disabled={isGettingLocation}
            className="w-full py-3.5 rounded-xl font-semibold bg-gray-800/50 border border-gray-700 hover:bg-gray-800/70 transition-all active:scale-95 disabled:opacity-50"
          >
            {isGettingLocation ? 'Getting location…' : 'Get current location (offline capable)'}
          </button>

          {currentLocation && (
            <div className="w-full p-4 bg-gray-800/30 rounded-xl border border-gray-700/50 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Latitude</span>
                <span className="font-mono text-white">{currentLocation.lat.toFixed(6)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Longitude</span>
                <span className="font-mono text-white">{currentLocation.lng.toFixed(6)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Accuracy</span>
                <span className="font-mono text-white">{Math.round(currentLocation.accuracyM)} m</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Captured</span>
                <span className="font-mono text-white">
                  {new Date(currentLocation.capturedAt).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Source</span>
                <span className="text-white text-xs font-semibold uppercase">{currentLocation.provider}</span>
              </div>
            </div>
          )}

          {currentLocationError && (
            <div className="w-full p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-200 text-xs">
              {currentLocationError}
            </div>
          )}

          {/* Accuracy Mode Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-800/30 rounded-xl border border-gray-700/50">
            <div className="flex flex-col">
              <span className="text-gray-300 text-sm font-medium">Accuracy Mode</span>
              <span className="text-gray-500 text-xs mt-0.5">
                {accuracyMode === 'high_accuracy' ? 'Best precision · higher battery' : 'Wi-Fi/cell · lower battery'}
              </span>
            </div>
            <button
              onClick={toggleAccuracyMode}
              className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${accuracyMode === 'high_accuracy' ? 'bg-emerald-500' : 'bg-blue-500'}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform duration-300 ${accuracyMode === 'high_accuracy' ? 'translate-x-6' : 'translate-x-0'}`}></div>
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-800/30 rounded-xl border border-gray-700/50">
            <span className="text-gray-300 text-sm font-medium">Clear tokens on stop</span>
            <button
              onClick={() => setClearOnStop(!clearOnStop)}
              className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${clearOnStop ? 'bg-red-500' : 'bg-gray-600'}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform duration-300 ${clearOnStop ? 'translate-x-6' : 'translate-x-0'}`}></div>
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-800/30 rounded-xl border border-gray-700/50">
            <div className="flex flex-col">
              <span className="text-gray-300 text-sm font-medium">Enable Background Mode</span>
              {isBackground && (
                <span className="text-green-400 text-xs mt-0.5">Background permission active</span>
              )}
            </div>
            <button
              onClick={toggleBackgroundMode}
              className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${isBackground ? 'bg-blue-500' : 'bg-gray-600'}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform duration-300 ${isBackground ? 'translate-x-6' : 'translate-x-0'}`}></div>
            </button>
          </div>
          <p className="text-xs text-gray-500 text-center px-4">
            Background mode uses a foreground service to keep tracking even when the app is closed.
            Requires "Allow all the time" location permission.
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;

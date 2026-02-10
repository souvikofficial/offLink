import { useState, useEffect } from 'react';
import { Preferences } from '@capacitor/preferences';
import { Network } from '@capacitor/network';
import { ConsentScreen } from './ConsentScreen';
import { locationService } from './services/LocationService';
import { databaseService } from './services/DatabaseService';
import { deviceService } from './services/DeviceService';
import { syncService } from './services/SyncService'; // Initialize sync service
import './App.css';

function App() {
  const [hasConsented, setHasConsented] = useState<boolean | null>(null);
  const [isBackground, setIsBackground] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [lastCaptured, setLastCaptured] = useState<string | null>(null);
  const [clearOnStop, setClearOnStop] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const checkConsent = async () => {
      const { value } = await Preferences.get({ key: 'has_consented' });
      setHasConsented(value === 'true');
    };
    checkConsent();
  }, []);

  useEffect(() => {
    const initDb = async () => {
      await databaseService.init();
      console.log('SyncService initialized:', !!syncService);
    };
    initDb();

    // Monitor Network Status
    Network.getStatus().then(status => setIsOnline(status.connected));
    Network.addListener('networkStatusChange', status => setIsOnline(status.connected));

    // Poll for pending count
    const interval = setInterval(async () => {
      const count = await databaseService.getPendingCount();
      setPendingCount(count);
    }, 2000);

    const removeListener = locationService.addListener((point) => {
      setLastCaptured(new Date(point.capturedAt).toLocaleTimeString());
      // Update count immediately when new point added
      databaseService.getPendingCount().then(setPendingCount);
    });

    return () => {
      removeListener();
      clearInterval(interval);
      Network.removeAllListeners();
    };
  }, []);

  const toggleBackgroundMode = async () => {
    const newMode = !isBackground;
    setIsBackground(newMode);
    await locationService.setMode(newMode ? 'background' : 'foreground');
  };

  const toggleTracking = async () => {
    if (isTracking) {
      await locationService.stopTracking();
      if (clearOnStop) {
        await deviceService.clearCredentials();
      }
      setIsTracking(false);
    } else {
      await locationService.startTracking();
      setIsTracking(true);
    }
  };

  if (hasConsented === null) {
    return <div className="h-screen bg-gray-900 flex items-center justify-center text-white">Loading...</div>;
  }

  if (!hasConsented) {
    return <ConsentScreen onConsent={() => setHasConsented(true)} />;
  }

  return (
    <div className="h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4 relative overflow-hidden">
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
            Device ID: <span className="font-mono text-gray-500">test-device-id</span>
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
              <span className="text-white text-sm font-medium">{isBackground ? 'Background (Service)' : 'Foreground (High Acc)'}</span>
            </div>
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
            <span className="text-gray-300 text-sm font-medium">Enable Background Mode</span>
            <button
              onClick={toggleBackgroundMode}
              className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${isBackground ? 'bg-blue-500' : 'bg-gray-600'}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform duration-300 ${isBackground ? 'translate-x-6' : 'translate-x-0'}`}></div>
            </button>
          </div>
          <p className="text-xs text-gray-500 text-center px-4">
            Background mode uses a foreground service to keep tracking even when the app is closed.
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;

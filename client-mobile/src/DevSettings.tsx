import React, { useEffect, useState } from 'react';
import { getServerUrl, setServerUrl, clearServerUrl } from './services/RuntimeConfig';

export default function DevSettings({ onClose }: { onClose: () => void }) {
  const [url, setUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [developerMode, setDeveloperModeState] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      const u = await getServerUrl();
      setUrl(u ?? '');
      const dm = await getDeveloperMode();
      setDeveloperModeState(!!dm);
    })();
  }, []);

  const save = async () => {
    setLoading(true);
    try {
      await setServerUrl(url);
      alert('Saved runtime server URL');
    } catch (e) {
      console.warn(e);
      alert('Failed to save');
    } finally {
      setLoading(false);
    }
  };

  const clear = async () => {
    setLoading(true);
    try {
      await clearServerUrl();
      setUrl('');
      alert('Cleared runtime server URL');
    } catch (e) {
      console.warn(e);
      alert('Failed to clear');
    } finally {
      setLoading(false);
    }
  };

  const toggleDeveloperMode = async (val: boolean) => {
    setLoading(true);
    try {
      await setDeveloperMode(val);
      setDeveloperModeState(val);
      alert(`Developer mode ${val ? 'enabled' : 'disabled'}`);
    } catch (e) {
      console.warn(e);
      alert('Failed to change developer mode');
    } finally {
      setLoading(false);
    }
  };

  const notify = async () => {
    setLoading(true);
    try {
      await createDevNotification();
      alert('Dev notification posted');
    } catch (e) {
      console.warn(e);
      alert('Failed to create dev notification');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose}></div>
      <div className="z-60 w-full max-w-md p-6 rounded-lg bg-gray-900 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">Developer Settings (Android)</h3>
          <button onClick={onClose} className="text-sm text-gray-400">Close</button>
        </div>
        <label className="text-xs text-gray-400 mb-2">Runtime server URL</label>
        <div className="flex gap-2 mb-4">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-server.example"
            className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
          />
        </div>
        <div className="flex gap-2">
          <button onClick={save} disabled={loading} className="py-2 px-3 bg-blue-600/20 text-blue-300 rounded text-sm">Save</button>
          <button onClick={clear} disabled={loading} className="py-2 px-3 bg-red-600/10 text-red-300 rounded text-sm">Clear</button>
          <button onClick={() => toggleDeveloperMode(!developerMode)} disabled={loading} className="py-2 px-3 bg-amber-600/10 text-amber-300 rounded text-sm">
            {developerMode ? 'Disable Dev Mode' : 'Enable Dev Mode'}
          </button>
          <button onClick={notify} disabled={loading} className="py-2 px-3 bg-yellow-600/10 text-yellow-300 rounded text-sm">
            Create Dev Notification
          </button>
          <button onClick={onClose} className="py-2 px-3 bg-gray-700 text-gray-200 rounded text-sm ml-auto">Done</button>
        </div>
      </div>
    </div>
  );
}

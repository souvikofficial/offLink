import { Preferences } from '@capacitor/preferences';

const KEY = 'runtime_offsync_server_url';

export async function getServerUrl(): Promise<string | null> {
  const ret = await Preferences.get({ key: KEY });
  if (ret && ret.value) return ret.value;

  // if on native Android, also ask NativeSync plugin
  try {
    const plugins = (window as any).Capacitor?.Plugins || (window as any).Capacitor;
    if (plugins && plugins.NativeSync && typeof plugins.NativeSync.getServerUrl === 'function') {
      const r = await plugins.NativeSync.getServerUrl();
      if (r && r.url) return r.url;
    }
  } catch (e) {
    // ignore
  }

  return null;
}

export async function setServerUrl(url: string) {
  await Preferences.set({ key: KEY, value: url });
  try {
    const plugins = (window as any).Capacitor?.Plugins || (window as any).Capacitor;
    if (plugins && plugins.NativeSync && typeof plugins.NativeSync.setServerUrl === 'function') {
      await plugins.NativeSync.setServerUrl({ url });
    }
  } catch (e) {
    // ignore
  }
}

export async function clearServerUrl() {
  await Preferences.remove({ key: KEY });
  try {
    const plugins = (window as any).Capacitor?.Plugins || (window as any).Capacitor;
    if (plugins && plugins.NativeSync && typeof plugins.NativeSync.clearServerUrl === 'function') {
      await plugins.NativeSync.clearServerUrl();
    }
  } catch (e) {
    // ignore
  }
}

const DEV_KEY = 'developer_mode';

export async function getDeveloperMode(): Promise<boolean> {
  const r = await Preferences.get({ key: DEV_KEY });
  if (r && r.value) return r.value === 'true';
  try {
    const plugins = (window as any).Capacitor?.Plugins || (window as any).Capacitor;
    if (plugins && plugins.NativeSync && typeof plugins.NativeSync.getDeveloperMode === 'function') {
      const res = await plugins.NativeSync.getDeveloperMode();
      return !!res?.developerMode;
    }
  } catch (e) {
    // ignore
  }
  return false;
}

export async function setDeveloperMode(enabled: boolean) {
  await Preferences.set({ key: DEV_KEY, value: enabled ? 'true' : 'false' });
  try {
    const plugins = (window as any).Capacitor?.Plugins || (window as any).Capacitor;
    if (plugins && plugins.NativeSync && typeof plugins.NativeSync.setDeveloperMode === 'function') {
      await plugins.NativeSync.setDeveloperMode({ enabled });
    }
  } catch (e) {
    // ignore
  }
}

export async function createDevNotification() {
  try {
    const plugins = (window as any).Capacitor?.Plugins || (window as any).Capacitor;
    if (plugins && plugins.NativeSync && typeof plugins.NativeSync.createDevNotification === 'function') {
      await plugins.NativeSync.createDevNotification();
    }
  } catch (e) {
    // ignore
  }
}

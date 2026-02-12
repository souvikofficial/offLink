import { registerPlugin } from '@capacitor/core';

/**
 * Tiny Capacitor plugin wrapper to open the Android application
 * settings page (Settings → Apps → <this app>).
 *
 * The native side is handled automatically by Capacitor's intent system.
 * On Android, we use `ACTION_APPLICATION_DETAILS_SETTINGS` with the
 * app's package URI. On iOS / Web this is a no-op.
 */
export interface NativeSettingsPlugin {
    openSettings(): Promise<void>;
    openLocationSettings(): Promise<void>;
    isLocationEnabled(): Promise<{ enabled: boolean }>;
}

/**
 * On Android, the Capacitor Geolocation plugin doesn't expose a
 * direct "open app settings" method. We register a custom plugin
 * that resolves to the standard Android settings intent.
 *
 * Fallback: if the native plugin is not registered (e.g. on web),
 * we simply log a warning.
 */
const NativeSettings = registerPlugin<NativeSettingsPlugin>('NativeSettings', {
    web: () => ({
        openSettings: async () => {
            console.warn('NativeSettings.openSettings is not available on web');
        },
        openLocationSettings: async () => {
            console.warn('NativeSettings.openLocationSettings is not available on web');
        },
        isLocationEnabled: async () => ({ enabled: true }),
    }) as any,
});

export { NativeSettings };

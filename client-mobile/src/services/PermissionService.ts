import { Geolocation } from '@capacitor/geolocation';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';

// ─── Permission States ──────────────────────────────────────────────

export type PermissionState =
    | 'idle'                // No consent given yet
    | 'consent_given'       // User accepted data-disclosure, but OS permission not yet requested
    | 'foreground_granted'  // Foreground location granted
    | 'background_granted'  // Background location also granted
    | 'denied'              // User denied — can still re-ask
    | 'blocked';            // User permanently denied ("Don't ask again")

// ─── Preference Keys ────────────────────────────────────────────────

const CONSENT_KEY = 'has_consented';
const CONSENT_TS_KEY = 'consent_timestamp';

// ─── Service ────────────────────────────────────────────────────────

class PermissionService {
    private state: PermissionState = 'idle';
    private listeners: ((state: PermissionState) => void)[] = [];

    // ─── Listeners ──────────────────────────────────────────────────

    public addListener(cb: (state: PermissionState) => void) {
        this.listeners.push(cb);
        return () => {
            this.listeners = this.listeners.filter(l => l !== cb);
        };
    }

    private notify() {
        this.listeners.forEach(cb => cb(this.state));
    }

    // ─── State ──────────────────────────────────────────────────────

    public getState(): PermissionState {
        return this.state;
    }

    /**
     * Determine the current permission state from OS + persisted consent.
     * Call this on app startup and whenever the app resumes from background.
     */
    public async checkCurrentState(): Promise<PermissionState> {
        // 1. Check if user ever gave in-app consent
        const { value: consented } = await Preferences.get({ key: CONSENT_KEY });

        if (consented !== 'true') {
            this.state = 'idle';
            this.notify();
            return this.state;
        }

        // 2. User consented — check OS permission status
        try {
            if (!Capacitor.isNativePlatform()) {
                // Web: use the Permissions API for accurate state
                const webState = await this.checkWebPermission();
                this.state = webState;
            } else {
                const status = await Geolocation.checkPermissions();

                if (status.location === 'granted') {
                    if (status.coarseLocation === 'granted') {
                        this.state = 'background_granted';
                    } else {
                        this.state = 'foreground_granted';
                    }
                } else if (status.location === 'denied') {
                    this.state = 'denied';
                } else if (status.location === 'prompt' || status.location === 'prompt-with-rationale') {
                    this.state = 'consent_given';
                } else {
                    this.state = 'consent_given';
                }
            }
        } catch {
            // If checking fails, treat as consent_given so the wizard can proceed
            this.state = 'consent_given';
        }

        this.notify();
        return this.state;
    }

    /**
     * Web-specific permission check using the Permissions API.
     * Capacitor's checkPermissions returns unreliable results on web.
     */
    private async checkWebPermission(): Promise<PermissionState> {
        try {
            if ('permissions' in navigator) {
                const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
                if (result.state === 'granted') return 'foreground_granted';
                if (result.state === 'denied') return 'blocked';
                return 'consent_given'; // 'prompt'
            }
            // Fallback: assume consent_given and let the browser prompt
            return 'consent_given';
        } catch {
            return 'consent_given';
        }
    }

    // ─── Consent Management ─────────────────────────────────────────

    /**
     * Record that the user has read and accepted the data-disclosure screen.
     * This does NOT trigger any OS permission dialog.
     */
    public async giveConsent(): Promise<void> {
        await Preferences.set({ key: CONSENT_KEY, value: 'true' });
        await Preferences.set({ key: CONSENT_TS_KEY, value: new Date().toISOString() });
        this.state = 'consent_given';
        this.notify();
    }

    /**
     * Revoke in-app consent (for "withdraw consent" flows).
     */
    public async revokeConsent(): Promise<void> {
        await Preferences.remove({ key: CONSENT_KEY });
        await Preferences.remove({ key: CONSENT_TS_KEY });
        this.state = 'idle';
        this.notify();
    }

    public async hasConsented(): Promise<boolean> {
        const { value } = await Preferences.get({ key: CONSENT_KEY });
        return value === 'true';
    }

    // ─── Foreground Permission ──────────────────────────────────────

    /**
     * Request foreground location permission from the OS.
     * Returns the resulting state.
     */
    public async requestForeground(): Promise<PermissionState> {
        try {
            if (!Capacitor.isNativePlatform()) {
                // Web: trigger the browser location prompt by requesting a position
                try {
                    await new Promise<GeolocationPosition>((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
                    });
                    // If we got here, permission was granted
                    this.state = 'foreground_granted';
                } catch (geoErr: any) {
                    if (geoErr?.code === 1) {
                        // PERMISSION_DENIED
                        this.state = 'blocked';
                    } else {
                        // Position unavailable or timeout — permission may still be granted
                        const webState = await this.checkWebPermission();
                        this.state = webState === 'foreground_granted' ? 'foreground_granted' : 'denied';
                    }
                }
            } else {
                // Native: use Capacitor's permission request
                const result = await Geolocation.requestPermissions();

                if (result.location === 'granted') {
                    this.state = 'foreground_granted';
                } else if (result.location === 'denied') {
                    const recheck = await Geolocation.checkPermissions();
                    if (recheck.location === 'denied') {
                        this.state = 'blocked';
                    } else {
                        this.state = 'denied';
                    }
                } else {
                    this.state = 'denied';
                }
            }
        } catch (err) {
            console.error('Failed to request foreground permission:', err);
            this.state = 'denied';
        }

        this.notify();
        return this.state;
    }

    // ─── Background Permission ──────────────────────────────────────

    /**
     * Request background location permission.
     * MUST only be called after foreground permission is already granted.
     *
     * On Android 10+, this triggers the "Allow all the time" dialog.
     * Returns true if background permission was granted.
     */
    public async requestBackground(): Promise<boolean> {
        if (this.state !== 'foreground_granted' && this.state !== 'background_granted') {
            console.warn('Cannot request background permission without foreground grant');
            return false;
        }

        try {
            // On Android, requesting permissions again after foreground is granted
            // should trigger the background location dialog
            const result = await Geolocation.requestPermissions();

            // After the request, re-check the actual state
            const status = await Geolocation.checkPermissions();

            if (status.coarseLocation === 'granted' && status.location === 'granted') {
                this.state = 'background_granted';
                this.notify();
                return true;
            }

            // Still only foreground
            console.log('Background permission not granted. Status:', result);
            return false;
        } catch (err) {
            console.error('Failed to request background permission:', err);
            return false;
        }
    }

    /**
     * Quick check: does the app currently have background location permission?
     */
    public async hasBackgroundPermission(): Promise<boolean> {
        if (!Capacitor.isNativePlatform()) {
            // Web has no background/foreground distinction
            return true;
        }
        try {
            const status = await Geolocation.checkPermissions();
            return status.coarseLocation === 'granted' && status.location === 'granted';
        } catch {
            return false;
        }
    }

    // ─── Settings Deep-Link ─────────────────────────────────────────

    /**
     * Open the OS app-settings page so the user can manually grant permissions.
     * On Android this uses a native intent via the Capacitor bridge.
     */
    public async openAppSettings(): Promise<void> {
        if (Capacitor.isNativePlatform()) {
            try {
                // Use the native bridge to send the user to this app's Android settings page
                const { NativeSettings } = await import('./NativeSettingsPlugin');
                await NativeSettings.openSettings();
            } catch {
                console.warn('Could not open app settings');
            }
        }
    }

    // ─── App Resume Hook ────────────────────────────────────────────

    /**
     * Call this when the app resumes from background.
     * Re-checks permissions in case the user changed them in Settings.
     */
    public async onAppResume(): Promise<PermissionState> {
        return this.checkCurrentState();
    }
}

export const permissionService = new PermissionService();

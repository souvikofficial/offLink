import { Preferences } from '@capacitor/preferences';

// ─── Accuracy Mode ───────────────────────────────────────────────────
export type AccuracyMode = 'high_accuracy' | 'balanced_power';

const PREF_KEY = 'accuracy_mode';

// ─── Per-mode configuration ──────────────────────────────────────────
export interface LocationOptions {
    enableHighAccuracy: boolean;
    timeout: number;       // ms – max time to wait for a fix
    maximumAge: number;    // ms – accept cached positions up to this age
    distanceFilter: number; // metres – min movement before a BG update fires
    providerLabel: string; // human-readable label stored alongside each point
}

const HIGH_ACCURACY_FG: LocationOptions = {
    enableHighAccuracy: true,
    timeout: 15_000,
    maximumAge: 0,
    distanceFilter: 10,
    providerLabel: 'gps',
};

const HIGH_ACCURACY_BG: LocationOptions = {
    enableHighAccuracy: true,
    timeout: 15_000,
    maximumAge: 0,
    distanceFilter: 10,
    providerLabel: 'gps',
};

const BALANCED_FG: LocationOptions = {
    enableHighAccuracy: false,
    timeout: 30_000,
    maximumAge: 60_000,
    distanceFilter: 50,
    providerLabel: 'network',
};

const BALANCED_BG: LocationOptions = {
    enableHighAccuracy: false,
    timeout: 30_000,
    maximumAge: 60_000,
    distanceFilter: 50,
    providerLabel: 'network',
};

// ─── Public helpers ──────────────────────────────────────────────────

/**
 * Return the concrete Capacitor option set for a given accuracy mode
 * and foreground/background context.
 */
export function getConfigForMode(
    mode: AccuracyMode,
    isForeground: boolean,
): LocationOptions {
    if (mode === 'high_accuracy') {
        return isForeground ? HIGH_ACCURACY_FG : HIGH_ACCURACY_BG;
    }
    return isForeground ? BALANCED_FG : BALANCED_BG;
}

/** Persist the user's choice across app restarts. */
export async function saveAccuracyMode(mode: AccuracyMode): Promise<void> {
    await Preferences.set({ key: PREF_KEY, value: mode });
}

/** Load persisted accuracy mode (defaults to `high_accuracy`). */
export async function loadAccuracyMode(): Promise<AccuracyMode> {
    const { value } = await Preferences.get({ key: PREF_KEY });
    if (value === 'balanced_power') return 'balanced_power';
    return 'high_accuracy'; // default
}

import { registerPlugin, Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { Device } from '@capacitor/device';

import type { BackgroundGeolocationPlugin } from '@capacitor-community/background-geolocation';
const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');

import {
    type AccuracyMode,
    getConfigForMode,
    loadAccuracyMode,
    saveAccuracyMode,
} from './LocationConfig';
import { databaseService } from './DatabaseService';
import { syncService } from './SyncService';
import { permissionService } from './PermissionService';
const NativeSync = registerPlugin<any>('NativeSync');

// ─── Types ───────────────────────────────────────────────────────────

interface LocationPoint {
    capturedAt: string;
    lat: number;
    lng: number;
    accuracyM: number;
    provider: string;
    batteryPct?: number;
    isCharging?: boolean;
    accuracyMode?: AccuracyMode;
}

// ─── Service ─────────────────────────────────────────────────────────

export class LocationService {
    private isTracking = false;
    private mode: 'foreground' | 'background' = 'foreground';
    private accuracyMode: AccuracyMode = 'high_accuracy';
    private watchId: string | null = null;
    private bgWatchId: string | null = null;

    private buffer: LocationPoint[] = [];
    private listeners: ((point: LocationPoint) => void)[] = [];

    // Configuration
    private BATCH_SIZE = 5;
    private FLUSH_INTERVAL = 10000; // 10 seconds
    private flushIntervalId: any = null;

    // Fallback tracking
    private gpsFallbackActive = false;
    private GPS_TIMEOUT_MS = 20_000; // if no GPS fix within this, fallback

    constructor() {
        this.startFlushing();
        // Load persisted accuracy mode on init
        loadAccuracyMode().then(mode => {
            this.accuracyMode = mode;
        });
    }

    private startFlushing() {
        if (this.flushIntervalId) clearInterval(this.flushIntervalId);
        this.flushIntervalId = setInterval(() => this.flush(), this.FLUSH_INTERVAL);
    }

    // ─── Listeners ───────────────────────────────────────────────────

    public addListener(callback: (point: LocationPoint) => void) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    // ─── Getters / Setters ───────────────────────────────────────────

    public getMode() {
        return this.mode;
    }

    public getAccuracyMode(): AccuracyMode {
        return this.accuracyMode;
    }

    public isGpsFallbackActive(): boolean {
        return this.gpsFallbackActive;
    }

    public async setMode(mode: 'foreground' | 'background') {
        if (this.mode === mode) return;
        console.log(`Switching mode to ${mode}`);
        this.mode = mode;
        if (this.isTracking) {
            await this.stopTracking();
            await this.startTracking();
        }
    }

    /**
     * Switch accuracy mode. Persists the choice and restarts tracking
     * if currently active so the new options take effect immediately.
     */
    public async setAccuracyMode(mode: AccuracyMode) {
        if (this.accuracyMode === mode) return;
        console.log(`Switching accuracy mode to ${mode}`);
        this.accuracyMode = mode;
        this.gpsFallbackActive = false;
        await saveAccuracyMode(mode);
        if (this.isTracking) {
            await this.stopTracking();
            await this.startTracking();
        }
    }

    // ─── Start / Stop ────────────────────────────────────────────────

    public async startTracking() {
        if (this.isTracking) return;

        // Guard: ensure we have at least foreground permission
        const state = await permissionService.checkCurrentState();
        if (state !== 'foreground_granted' && state !== 'background_granted') {
            console.warn('Cannot start tracking — permission not granted (state: ' + state + ')');
            return;
        }

        this.isTracking = true;
        this.gpsFallbackActive = false;
        const opts = getConfigForMode(this.accuracyMode, this.mode === 'foreground');
        console.log(`Starting tracking [mode=${this.mode}, accuracy=${this.accuracyMode}]`, opts);

        if (this.mode === 'background') {
            await this.startBackgroundTracking(opts.distanceFilter);
        } else {
            await this.startForegroundTracking();
        }
    }

    public async stopTracking() {
        if (!this.isTracking) return;
        console.log('Stopping tracking');

        try {
            if (this.bgWatchId) {
                await BackgroundGeolocation.removeWatcher({ id: this.bgWatchId });
                this.bgWatchId = null;
            }
            if (this.watchId) {
                await Geolocation.clearWatch({ id: this.watchId });
                this.watchId = null;
            }
        } catch (e) {
            console.error('Error stopping tracking', e);
        }

        this.isTracking = false;
    }

    // ─── Foreground tracking ─────────────────────────────────────────

    private async startForegroundTracking() {
        const opts = getConfigForMode(this.accuracyMode, true);

        try {
            const id = await Geolocation.watchPosition(
                {
                    enableHighAccuracy: opts.enableHighAccuracy,
                    timeout: opts.timeout,
                    maximumAge: opts.maximumAge,
                },
                (position, err) => {
                    if (err) {
                        console.warn('Foreground watch error:', err.message);
                        // If GPS was requested but failed, attempt fallback
                        if (this.accuracyMode === 'high_accuracy' && !this.gpsFallbackActive) {
                            this.triggerGpsFallback();
                        }
                        return;
                    }
                    if (!position) return;

                    const provider = this.gpsFallbackActive
                        ? 'network_fallback'
                        : opts.providerLabel;

                    this.enrichAndHandle({
                        capturedAt: new Date(position.timestamp).toISOString(),
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        accuracyM: position.coords.accuracy,
                        provider,
                        accuracyMode: this.accuracyMode,
                    });
                },
            );
            this.watchId = id;

            // If high_accuracy, arm a fallback timer in case GPS never fires
            if (this.accuracyMode === 'high_accuracy') {
                this.armGpsFallbackTimer();
            }
        } catch (e) {
            console.error('Failed to start foreground watcher', e);
            // Immediate fallback on total failure (e.g. GPS hardware unavailable)
            if (this.accuracyMode === 'high_accuracy') {
                this.triggerGpsFallback();
            }
        }
    }

    // ─── Background tracking ─────────────────────────────────────────

    private async startBackgroundTracking(distanceFilter: number) {
        try {
            this.bgWatchId = await BackgroundGeolocation.addWatcher(
                {
                    backgroundMessage: 'Tracking your location for Offsync.',
                    backgroundTitle: 'Offsync Active',
                    requestPermissions: false, // Permissions already handled by PermissionService
                    stale: false,
                    distanceFilter,
                },
                (location, error) => {
                    if (error || !location) return;
                    this.enrichAndHandle({
                        capturedAt: new Date(location.time || Date.now()).toISOString(),
                        lat: location.latitude,
                        lng: location.longitude,
                        accuracyM: location.accuracy,
                        provider: 'fused',
                        accuracyMode: this.accuracyMode,
                    });
                },
            );
        } catch (e) {
            console.error('Failed to start background watcher', e);
        }
    }

    // ─── GPS Fallback ────────────────────────────────────────────────

    private gpsFallbackTimerId: any = null;
    private firstFixReceived = false;

    /**
     * Arms a timer; if no GPS fix is received within GPS_TIMEOUT_MS,
     * the watcher is restarted with balanced_power options.
     */
    private armGpsFallbackTimer() {
        this.firstFixReceived = false;
        this.gpsFallbackTimerId = setTimeout(() => {
            if (!this.firstFixReceived && this.isTracking && !this.gpsFallbackActive) {
                console.warn('GPS fix timeout — falling back to network provider');
                this.triggerGpsFallback();
            }
        }, this.GPS_TIMEOUT_MS);
    }

    private async triggerGpsFallback() {
        if (this.gpsFallbackActive) return;
        this.gpsFallbackActive = true;

        console.warn('GPS fallback activated → restarting with balanced_power options');

        // Stop current foreground watcher
        if (this.watchId) {
            await Geolocation.clearWatch({ id: this.watchId });
            this.watchId = null;
        }

        // Restart with balanced options but keep accuracyMode as high_accuracy
        // so the user's preference is preserved. Only the runtime options change.
        const balancedOpts = getConfigForMode('balanced_power', true);

        try {
            const id = await Geolocation.watchPosition(
                {
                    enableHighAccuracy: balancedOpts.enableHighAccuracy,
                    timeout: balancedOpts.timeout,
                    maximumAge: balancedOpts.maximumAge,
                },
                (position, err) => {
                    if (err || !position) return;
                    this.enrichAndHandle({
                        capturedAt: new Date(position.timestamp).toISOString(),
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        accuracyM: position.coords.accuracy,
                        provider: 'network_fallback',
                        accuracyMode: this.accuracyMode,
                    });
                },
            );
            this.watchId = id;
        } catch (e) {
            console.error('Even fallback watcher failed', e);
        }
    }

    // ─── Battery enrichment ──────────────────────────────────────────

    private async enrichAndHandle(point: LocationPoint) {
        // Mark first GPS fix so fallback timer can cancel
        if (!this.firstFixReceived) {
            this.firstFixReceived = true;
            if (this.gpsFallbackTimerId) {
                clearTimeout(this.gpsFallbackTimerId);
                this.gpsFallbackTimerId = null;
            }
        }

        try {
            const battery = await Device.getBatteryInfo();
            point.batteryPct = battery.batteryLevel != null
                ? Math.round(battery.batteryLevel * 100)
                : undefined;
            point.isCharging = battery.isCharging ?? undefined;
        } catch {
            // Battery API may not be available on all platforms; ignore
        }

        this.handleLocation(point);
    }

    // ─── Core handler ────────────────────────────────────────────────

    private async handleLocation(point: LocationPoint) {
        console.log('Location captured:', point);

        // Notify listeners
        this.listeners.forEach(listener => listener(point));

        // 1. Save to local DB first
        try {
            await databaseService.addLocation(point);
            // Also persist natively (Room) and trigger native WorkManager sync on Android
            try {
                if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
                    NativeSync.saveLocation({
                        capturedAt: point.capturedAt,
                        lat: point.lat,
                        lng: point.lng,
                        accuracyM: point.accuracyM,
                        provider: point.provider,
                        batteryPct: point.batteryPct,
                        isCharging: point.isCharging,
                        accuracyMode: point.accuracyMode,
                    }).catch((e: any) => console.warn('[NativeSync] saveLocation failed', e));
                }
            } catch (e) {
                console.warn('[LocationService] Native sync call failed', e);
            }
        } catch (e) {
            console.error('Failed to save location locally', e);
        }

        // 2. Buffer → trigger sync after BATCH_SIZE items
        this.buffer.push(point);
        if (this.buffer.length >= this.BATCH_SIZE) {
            this.buffer = [];
            this.flush();
        }
    }

    private async flush() {
        console.log('Triggering background sync...');
        syncService.triggerSync();
    }
    // ─── System Location Settings ────────────────────────────────────

    /**
     * Checks if system location services are enabled.
     * If disabled on Android, opens Location Settings.
     * Returns true if enabled, false if disabled.
     */
    public async ensureLocationEnabled(): Promise<boolean> {
        try {
            if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
                return true;
            }

            const { NativeSettings } = await import('./NativeSettingsPlugin');
            const { enabled } = await NativeSettings.isLocationEnabled();
            if (!enabled) {
                await NativeSettings.openLocationSettings();
                return false;
            }
            return true;
        } catch (err) {
            console.warn('[LocationService] ensureLocationEnabled failed', err);
            return false;
        }
    }

    // ─── One-shot Location ───────────────────────────────────────────

    /**
     * 2-step strategy:
     * 1. Try last known location (fast, maxAgeMs).
     * 2. If null/old, request a fresh fix (high accuracy).
     */
    public async getCurrentOrLastLocation(maxAgeMs = 120_000): Promise<LocationPoint | null> {
        // 1. Try last known / cached
        try {
            const last = await Geolocation.getCurrentPosition({
                enableHighAccuracy: false,
                timeout: 3000,
                maximumAge: maxAgeMs,
            });

            if (last) {
                const age = Date.now() - last.timestamp;
                if (age <= maxAgeMs) {
                    console.log(`[LocationService] Using cached location (age: ${age}ms)`);
                    return this.mapToLocationPoint(last, 'last_known');
                }
            }
        } catch (e) {
            console.warn('[LocationService] Cached location unavailable or stale', e);
        }

        // 2. Request fresh fix
        try {
            console.log('[LocationService] Requesting fresh fix...');
            const fresh = await Geolocation.getCurrentPosition({
                enableHighAccuracy: true,
                timeout: 15_000,
                maximumAge: 0,
            });
            return this.mapToLocationPoint(fresh, 'gps_fresh');
        } catch (e) {
            console.error('[LocationService] Fresh fix failed', e);
            return null;
        }
    }

    private mapToLocationPoint(position: GeolocationPosition, providerLabel: string): LocationPoint {
        return {
            capturedAt: new Date(position.timestamp).toISOString(),
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracyM: position.coords.accuracy,
            provider: providerLabel,
            accuracyMode: this.accuracyMode,
        };
    }
}

export const locationService = new LocationService();


import { registerPlugin } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';


// Define the BackgroundGeolocation plugin interface
// Since we are using @capacitor-community/background-geolocation, we need to declare it properly
// or import the type if the package exports it.
import type { BackgroundGeolocationPlugin } from '@capacitor-community/background-geolocation';
const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');

interface LocationPoint {
    capturedAt: string;
    lat: number;
    lng: number;
    accuracyM: number;
    provider: string;
    batteryPct?: number;
    isCharging?: boolean;
}

import { databaseService } from './DatabaseService';
import { syncService } from './SyncService';

export class LocationService {
    private isTracking = false;
    private mode: 'foreground' | 'background' = 'foreground';
    private watchId: string | null = null;
    private bgWatchId: string | null = null;

    private buffer: LocationPoint[] = [];
    private listeners: ((point: LocationPoint) => void)[] = [];

    // Configuration
    private BATCH_SIZE = 5;
    private FLUSH_INTERVAL = 10000; // 10 seconds
    private flushIntervalId: any = null;

    constructor() {
        this.startFlushing();
    }

    private startFlushing() {
        if (this.flushIntervalId) clearInterval(this.flushIntervalId);
        this.flushIntervalId = setInterval(() => this.flush(), this.FLUSH_INTERVAL);
    }

    public addListener(callback: (point: LocationPoint) => void) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    public getMode() {
        return this.mode;
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

    public async startTracking() {
        if (this.isTracking) return;
        this.isTracking = true;
        console.log(`Starting tracking in ${this.mode} mode`);

        if (this.mode === 'background') {
            // Background Mode
            try {
                this.bgWatchId = await BackgroundGeolocation.addWatcher(
                    {
                        backgroundMessage: "Tracking your location for Offsync.",
                        backgroundTitle: "Offsync Active",
                        requestPermissions: true,
                        stale: false,
                        distanceFilter: 10,
                    },
                    (location, error) => {
                        if (error || !location) return;
                        this.handleLocation({
                            capturedAt: new Date(location.time || Date.now()).toISOString(),
                            lat: location.latitude,
                            lng: location.longitude,
                            accuracyM: location.accuracy,
                            provider: 'fused',
                        });
                    }
                );
            } catch (e) {
                console.error("Failed to start background watcher", e);
            }
        } else {
            // Foreground Mode
            const id = await Geolocation.watchPosition(
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0,
                },
                (position, err) => {
                    if (err || !position) return;
                    this.handleLocation({
                        capturedAt: new Date(position.timestamp).toISOString(),
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        accuracyM: position.coords.accuracy,
                        provider: 'gps',
                    });
                }
            );
            this.watchId = id;
        }
    }

    public async stopTracking() {
        if (!this.isTracking) return;
        console.log(`Stopping tracking`);

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
            console.error("Error stopping tracking", e);
        }

        this.isTracking = false;
    }

    private async handleLocation(point: LocationPoint) {
        console.log('Location captured:', point);

        // Notify listeners
        this.listeners.forEach(listener => listener(point));

        // 1. Save to local DB first
        try {
            await databaseService.addLocation(point);
        } catch (e) {
            console.error('Failed to save location locally', e);
        }

        // 2. Add to buffer is not strictly necessary for batching anymore since SyncService pulls from DB,
        // but we can use it to trigger syncs after N items.
        this.buffer.push(point);
        if (this.buffer.length >= this.BATCH_SIZE) {
            this.buffer = []; // clear buffer
            this.flush();
        }
    }

    private async flush() {
        console.log('Triggering background sync...');
        // We don't wait for it, just trigger it
        syncService.triggerSync();
    }
}

export const locationService = new LocationService();

import { Network } from '@capacitor/network';
import { databaseService } from './DatabaseService';
import { apiClient } from '../api/client';

class SyncService {
    private isSyncing = false;
    private isOnline = true;
    private syncIntervalId: any = null;
    private consecutiveFailures = 0;
    private MAX_FAILURES = 3;
    private BATCH_SIZE = 50;
    private SYNC_INTERVAL_MS = 30000; // 30 seconds

    constructor() {
        this.initNetworkListener();
        this.startSyncLoop();
    }

    private async initNetworkListener() {
        const checkStatus = async () => {
            const status = await Network.getStatus();
            this.isOnline = status.connected;
            if (this.isOnline) {
                console.log('Network is online. Triggering sync.');
                this.consecutiveFailures = 0; // Reset failures on reconnect
                this.triggerSync();
            } else {
                console.log('Network is offline.');
            }
        };

        await checkStatus();
        Network.addListener('networkStatusChange', (status) => {
            console.log('Network status changed:', status);
            this.isOnline = status.connected;
            if (this.isOnline) {
                this.consecutiveFailures = 0;
                this.triggerSync();
            }
        });
    }

    private startSyncLoop() {
        if (this.syncIntervalId) clearInterval(this.syncIntervalId);
        this.syncIntervalId = setInterval(() => {
            if (this.isOnline && this.consecutiveFailures < this.MAX_FAILURES) {
                this.triggerSync();
            }
        }, this.SYNC_INTERVAL_MS);
    }

    public async triggerSync() {
        if (this.isSyncing || !this.isOnline) return;
        if (this.consecutiveFailures >= this.MAX_FAILURES) {
            console.log('Sync paused due to consecutive failures. Waiting for network change or manual trigger.');
            return;
        }

        this.isSyncing = true;

        try {
            await this.processBatch();
        } catch (error) {
            console.error('Sync error:', error);
            this.consecutiveFailures++;
        } finally {
            this.isSyncing = false;
            // If we processed a batch successfully/partially, there might be more.
            // But we let the loop handle it to be nice to the battery, unless we want aggressive sync.
            // For now, simple loop is fine.
        }
    }

    private async processBatch() {
        // 1. Get pending locations
        const pending = await databaseService.getPendingLocations(this.BATCH_SIZE);
        if (pending.length === 0) return;

        console.log(`Syncing batch of ${pending.length} locations...`);

        // 2. Upload
        // Note: apiClient already handles 401 retry via interceptors
        await apiClient.post('/ingest/locations', pending);

        console.log(`Batch uploaded successfully.`);

        // 3. Mark as uploaded
        // Optimize: could add a bulk update method to DatabaseService
        for (const point of pending) {
            if (point.id) {
                await databaseService.markAsUploaded(point.id);
            }
        }

        this.consecutiveFailures = 0; // Reset on success

        // If we filled a batch, there might be more, so trigger another sync immediately
        if (pending.length === this.BATCH_SIZE) {
            this.triggerSync();
        }
    }

    /**
     * Call this to manually retry after failure limit reached
     */
    public retrySync() {
        this.consecutiveFailures = 0;
        this.triggerSync();
    }
}

export const syncService = new SyncService();

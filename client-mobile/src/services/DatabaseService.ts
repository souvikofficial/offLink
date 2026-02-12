import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Capacitor } from '@capacitor/core';

const DB_NAME = 'offsync_db';

export interface LocationPoint {
    id?: number;
    capturedAt: string;
    lat: number;
    lng: number;
    accuracyM: number;
    provider: string;
    batteryPct?: number;
    isCharging?: boolean;
    accuracyMode?: string;
    isUploaded: number; // 0 = false, 1 = true
}

class DatabaseService {
    private sqlite: SQLiteConnection;
    private db: SQLiteDBConnection | null = null;
    private isWeb = false;

    // In-memory fallback for web (SQLite plugin is native-only)
    private memoryStore: LocationPoint[] = [];
    private nextId = 1;

    constructor() {
        this.sqlite = new SQLiteConnection(CapacitorSQLite);
        this.isWeb = !Capacitor.isNativePlatform();
    }

    async init() {
        if (this.isWeb) {
            console.log('Database: using in-memory fallback (web mode)');
            return;
        }

        try {
            // Create connection
            this.db = await this.sqlite.createConnection(
                DB_NAME,
                false,
                'no-encryption',
                1,
                false
            );

            // Open connection
            await this.db.open();

            // Create tables
            const createQuery = `
                CREATE TABLE IF NOT EXISTS pending_location_points (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    capturedAt TEXT NOT NULL,
                    lat REAL NOT NULL,
                    lng REAL NOT NULL,
                    accuracyM REAL NOT NULL,
                    provider TEXT,
                    batteryPct REAL,
                    isCharging INTEGER,
                    accuracyMode TEXT,
                    isUploaded INTEGER DEFAULT 0
                );
            `;

            // Migration guard: add accuracyMode column for existing installs
            const migrationQuery = `
                ALTER TABLE pending_location_points ADD COLUMN accuracyMode TEXT;
            `;
            await this.db.execute(createQuery);

            // Run migration — silently ignore if column already exists
            try {
                await this.db.execute(migrationQuery);
            } catch (_migrationErr) {
                // Column already exists — safe to ignore
            }

            console.log('Database initialized');

        } catch (error) {
            console.error('Error initializing database', error);
        }
    }

    async addLocation(location: Omit<LocationPoint, 'id' | 'isUploaded'>) {
        if (this.isWeb) {
            const point: LocationPoint = { ...location, id: this.nextId++, isUploaded: 0 };
            this.memoryStore.push(point);
            console.log(`[Web] Location saved in memory with ID: ${point.id}`);
            return point.id;
        }

        if (!this.db) {
            console.error('Database not initialized');
            return;
        }

        const query = `
            INSERT INTO pending_location_points (capturedAt, lat, lng, accuracyM, provider, batteryPct, isCharging, accuracyMode, isUploaded)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
        `;
        const values = [
            location.capturedAt,
            location.lat,
            location.lng,
            location.accuracyM,
            location.provider,
            location.batteryPct,
            location.isCharging ? 1 : 0,
            location.accuracyMode ?? null,
        ];

        try {
            const res = await this.db.run(query, values);
            if (res.changes && res.changes.lastId) {
                console.log(`Location saved locally with ID: ${res.changes.lastId}`);
                return res.changes.lastId;
            }
        } catch (error) {
            console.error('Error saving location locally', error);
        }
    }

    async markAsUploaded(id: number) {
        if (this.isWeb) {
            const point = this.memoryStore.find(p => p.id === id);
            if (point) point.isUploaded = 1;
            return;
        }
        if (!this.db) return;
        const query = `UPDATE pending_location_points SET isUploaded = 1 WHERE id = ?`;
        await this.db.run(query, [id]);
    }

    async markBatchAsUploaded(ids: number[]) {
        if (this.isWeb) {
            this.memoryStore.forEach(p => { if (ids.includes(p.id!)) p.isUploaded = 1; });
            return;
        }
        if (!this.db || ids.length === 0) return;
        const placeholders = ids.map(() => '?').join(',');
        const query = `UPDATE pending_location_points SET isUploaded = 1 WHERE id IN (${placeholders})`;
        await this.db.run(query, ids);
    }

    async getPendingLocations(limit?: number): Promise<LocationPoint[]> {
        if (this.isWeb) {
            const pending = this.memoryStore.filter(p => p.isUploaded === 0);
            return limit ? pending.slice(0, limit) : pending;
        }
        if (!this.db) return [];
        let query = `SELECT * FROM pending_location_points WHERE isUploaded = 0 ORDER BY capturedAt ASC`;
        if (limit) {
            query += ` LIMIT ${limit}`;
        }
        const res = await this.db.query(query);
        return (res.values as LocationPoint[]) || [];
    }

    async getPendingCount(): Promise<number> {
        if (this.isWeb) {
            return this.memoryStore.filter(p => p.isUploaded === 0).length;
        }
        if (!this.db) return 0;
        const query = `SELECT COUNT(*) as count FROM pending_location_points WHERE isUploaded = 0`;
        const res = await this.db.query(query);
        if (res.values && res.values.length > 0) {
            return res.values[0].count;
        }
        return 0;
    }

    async close() {
        if (this.isWeb) {
            this.memoryStore = [];
            return;
        }
        if (this.db) {
            await this.sqlite.closeConnection(DB_NAME, false);
            this.db = null;
        }
    }
}

export const databaseService = new DatabaseService();

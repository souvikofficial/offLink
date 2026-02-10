import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';

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
    isUploaded: number; // 0 = false, 1 = true
}

class DatabaseService {
    private sqlite: SQLiteConnection;
    private db: SQLiteDBConnection | null = null;

    constructor() {
        this.sqlite = new SQLiteConnection(CapacitorSQLite);
    }

    async init() {
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
            const query = `
                CREATE TABLE IF NOT EXISTS pending_location_points (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    capturedAt TEXT NOT NULL,
                    lat REAL NOT NULL,
                    lng REAL NOT NULL,
                    accuracyM REAL NOT NULL,
                    provider TEXT,
                    batteryPct REAL,
                    isCharging INTEGER,
                    isUploaded INTEGER DEFAULT 0
                );
            `;
            await this.db.execute(query);
            console.log('Database initialized');

        } catch (error) {
            console.error('Error initializing database', error);
        }
    }

    async addLocation(location: Omit<LocationPoint, 'id' | 'isUploaded'>) {
        if (!this.db) {
            console.error('Database not initialized');
            return;
        }

        const query = `
            INSERT INTO pending_location_points (capturedAt, lat, lng, accuracyM, provider, batteryPct, isCharging, isUploaded)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0)
        `;
        const values = [
            location.capturedAt,
            location.lat,
            location.lng,
            location.accuracyM,
            location.provider,
            location.batteryPct,
            location.isCharging ? 1 : 0
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
        if (!this.db) return;
        const query = `UPDATE pending_location_points SET isUploaded = 1 WHERE id = ?`;
        await this.db.run(query, [id]);
    }

    async getPendingLocations(limit?: number): Promise<LocationPoint[]> {
        if (!this.db) return [];
        let query = `SELECT * FROM pending_location_points WHERE isUploaded = 0 ORDER BY capturedAt ASC`;
        if (limit) {
            query += ` LIMIT ${limit}`;
        }
        const res = await this.db.query(query);
        return (res.values as LocationPoint[]) || [];
    }

    async getPendingCount(): Promise<number> {
        if (!this.db) return 0;
        const query = `SELECT COUNT(*) as count FROM pending_location_points WHERE isUploaded = 0`;
        const res = await this.db.query(query);
        if (res.values && res.values.length > 0) {
            return res.values[0].count;
        }
        return 0;
    }

    async close() {
        if (this.db) {
            await this.sqlite.closeConnection(DB_NAME, false);
            this.db = null;
        }
    }
}

export const databaseService = new DatabaseService();

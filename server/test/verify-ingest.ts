import axios from 'axios';

const BASE_URL = 'http://localhost:3000';
const DEVICE_ID = 'verification-device-id';

async function verify() {
    console.log('Starting verification...');

    // 1. Ingest Data
    const ingestPayload = [
        {
            capturedAt: new Date().toISOString(),
            lat: 40.7128,
            lng: -74.0060,
            accuracyM: 5.5,
            provider: 'gps',
            batteryPct: 90,
            isCharging: true,
        },
    ];

    try {
        console.log('1. Ingesting locations...');
        await axios.post(`${BASE_URL}/ingest/locations`, ingestPayload, {
            headers: { 'x-device-id': DEVICE_ID },
        });
        console.log('   Ingest successful.');


        // 2. Retrieval
        console.log('2. Testing Retrieval...');
        const lastLoc = await axios.get(`${BASE_URL}/devices/${DEVICE_ID}/last-location`);
        if (lastLoc.data) console.log('   Last location fetched.');


        // 3. Rate Limiting Test
        console.log('3. Testing Rate Limiting (sending 15 requests)...');
        let successCount = 0;
        let failureCount = 0;

        for (let i = 0; i < 15; i++) {
            try {
                await axios.get(`${BASE_URL}/devices/${DEVICE_ID}/last-location`);
                successCount++;
            } catch (error: any) {
                if (error.response?.status === 429) {
                    failureCount++;
                    console.log(`   Request ${i + 1}: 429 Too Many Requests (Expected)`);
                } else {
                    console.error(`   Request ${i + 1}: Error ${error.response?.status}`);
                }
            }
        }

        if (failureCount > 0) {
            console.log(`   VERIFIED: Rate limiting active. Success: ${successCount}, Throttled: ${failureCount}`);
        } else {
            console.warn('   WARNING: Rate limiting did not trigger (might be per IP and limit > 15?).');
        }


    } catch (error: any) {
        console.error('Verification failed:', error.response?.data || error.message);
    }
}

verify();

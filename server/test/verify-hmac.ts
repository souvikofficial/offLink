import * as crypto from 'crypto';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const DEVICE_ID = process.env.DEVICE_ID || 'test-device-id';
const DEVICE_TOKEN = process.env.DEVICE_TOKEN || 'test-device-token-secret';

function signPayload(deviceToken: string, method: string, path: string, timestamp: string, body: string) {
  const toSign = `${method}:${path}:${timestamp}:${body}`;
  return crypto.createHmac('sha256', deviceToken).update(toSign).digest('hex');
}

async function run() {
  // Import axios dynamically to avoid ESM/CommonJS interop issues in different runtimes
  const _axios = await import('axios').catch(() => null);
  // axios may be the default export or the module itself depending on bundler/runtime
  const axios = (_axios && (_axios.default ?? _axios)) as any;
  if (!axios) {
    throw new Error('axios module not found. Run `npm install axios` in the server folder and try again.');
  }
  const payload = [
    {
      capturedAt: new Date().toISOString(),
      lat: 12.34,
      lng: 56.78,
      accuracyM: 5,
      provider: 'gps',
    }
  ];

  const body = JSON.stringify(payload);
  const timestamp = String(Date.now());
  const sig = signPayload(DEVICE_TOKEN, 'POST', '/ingest/locations', timestamp, body);

  try {
    console.log('Sending signed ingest...');
    const res = await axios.post(`${BASE_URL}/ingest/locations`, payload, {
      headers: {
        'x-device-id': DEVICE_ID,
        'x-device-token': DEVICE_TOKEN,
        'x-timestamp': timestamp,
        'x-signature': sig,
        'Content-Type': 'application/json'
      }
    });
    console.log('Ingest response status:', res.status);

    console.log('Fetching last-location...');
    const last = await axios.get(`${BASE_URL}/devices/${DEVICE_ID}/last-location`);
    console.log('Last location:', last.data);
  } catch (err: any) {
    console.error('Error in verify-hmac:', err.response?.data || err.message);
  }
}

run();

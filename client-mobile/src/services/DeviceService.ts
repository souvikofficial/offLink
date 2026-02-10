import { Preferences } from '@capacitor/preferences';

const KEY_DEVICE_ID = 'device_id';
const KEY_DEVICE_TOKEN = 'device_token';

// Fallback/Initial values for testing
const DEFAULT_DEVICE_ID = 'test-device-id';
const DEFAULT_DEVICE_TOKEN = 'test-device-token-secret';

class DeviceService {
    private deviceId: string | null = null;
    private deviceToken: string | null = null;

    async init() {
        const id = await Preferences.get({ key: KEY_DEVICE_ID });
        const token = await Preferences.get({ key: KEY_DEVICE_TOKEN });

        this.deviceId = id.value || DEFAULT_DEVICE_ID;
        this.deviceToken = token.value || DEFAULT_DEVICE_TOKEN;

        // Persist defaults if not present
        if (!id.value) {
            await this.setDeviceId(this.deviceId);
        }
        if (!token.value) {
            await this.setDeviceToken(this.deviceToken);
        }
    }

    getDeviceId(): string {
        return this.deviceId || DEFAULT_DEVICE_ID;
    }

    getDeviceToken(): string {
        return this.deviceToken || DEFAULT_DEVICE_TOKEN;
    }

    async setDeviceId(id: string) {
        this.deviceId = id;
        await Preferences.set({ key: KEY_DEVICE_ID, value: id });
    }

    async setDeviceToken(token: string) {
        this.deviceToken = token;
        await Preferences.set({ key: KEY_DEVICE_TOKEN, value: token });
    }

    /**
     * Simulates an enrollment call.
     * In a real app, this would hit the server to exchange a registration code or refresh token.
     * For now, we just pretend to get a new token.
     */
    async enroll(): Promise<boolean> {
        console.log('Attempting re-enrollment...');

        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Generate a pseudo-random token to verify rotation
        const newToken = `refreshed-token-${Date.now()}`;
        await this.setDeviceToken(newToken);

        console.log(`Re-enrollment successful. New token: ${newToken}`);
        return true;
    }

    async clearCredentials() {
        this.deviceId = null;
        this.deviceToken = null;
        await Preferences.remove({ key: KEY_DEVICE_ID });
        await Preferences.remove({ key: KEY_DEVICE_TOKEN });
        console.log('Credentials cleared');
    }
}

export const deviceService = new DeviceService();

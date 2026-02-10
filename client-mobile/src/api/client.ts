
import axios from 'axios';
import axiosRetry from 'axios-retry';
import { generateSignature } from './signing';

import { deviceService } from '../services/DeviceService';

// Configuration
// Dynamic values from DeviceService


const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const apiClient = axios.create({
    baseURL: BASE_URL,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Configure Retries: Exponential backoff
axiosRetry(apiClient, {
    retries: 3,
    retryDelay: axiosRetry.exponentialDelay, // 1000ms, 2000ms, 4000ms...
    retryCondition: (error: any) => {
        // Retry on network errors or 429 Too Many Requests
        return axiosRetry.isNetworkOrIdempotentRequestError(error) || error.response?.status === 429;
    }
});

// Request Interceptor: Add Signing Headers
apiClient.interceptors.request.use((config) => {
    const timestamp = Date.now();
    const method = config.method?.toUpperCase() || 'GET';
    // config.url is the relative path (e.g. '/ingest/locations') since baseURL is set
    const path = config.url || '';
    const body = config.data;

    const deviceId = deviceService.getDeviceId();
    const deviceToken = deviceService.getDeviceToken();

    // Generate Signature
    const signature = generateSignature(method, path, timestamp, body, deviceToken);

    // Attach Headers
    config.headers['x-device-id'] = deviceId;
    config.headers['x-device-token'] = deviceToken;
    config.headers['x-timestamp'] = timestamp.toString();
    config.headers['x-signature'] = signature;

    return config;
}, (error) => {
    return Promise.reject(error);
});

// Response Interceptor: Handle 401 Unauthorized
apiClient.interceptors.response.use((response) => {
    return response;
}, async (error) => {
    const originalRequest = error.config;

    // Check if error is 401 and we haven't retried yet for this specific reason
    if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;

        try {
            console.warn('Received 401 Unauthorized. Attempting re-enrollment...');
            const enrollmentSuccess = await deviceService.enroll();

            if (enrollmentSuccess) {
                // Retry the original request with new token (interceptor will pick up new values)
                return apiClient(originalRequest);
            }
        } catch (enrollError) {
            console.error('Re-enrollment failed', enrollError);
            return Promise.reject(enrollError);
        }
    }

    return Promise.reject(error);
});


import HmacSHA256 from 'crypto-js/hmac-sha256';
import Hex from 'crypto-js/enc-hex';

/**
 * Generates an HMAC-SHA256 signature for a request.
 * Payload format: METHOD:PATH:TIMESTAMP:BODY_JSON
 */
export function generateSignature(
    method: string,
    path: string,
    timestamp: number,
    body: any,
    secret: string
): string {
    // Ensure body is consistent. If body is undefined/null, use empty string.
    // If it's an object, stringify it.
    const stringBody = body ? JSON.stringify(body) : '';

    // Normalize method
    const normalizedMethod = method.toUpperCase();

    // Construct payload
    const payload = `${normalizedMethod}:${path}:${timestamp}:${stringBody}`;

    // Generate signature
    const signature = HmacSHA256(payload, secret).toString(Hex);

    return signature;
}

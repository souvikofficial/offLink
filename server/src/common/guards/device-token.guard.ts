import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

/**
 * Guard that validates device identity via one of two methods:
 *
 * 1. **HMAC signature** (preferred) – The mobile client sends:
 *    - `x-device-id`  — the device's hardwareId
 *    - `x-timestamp`  — Unix-ms timestamp (must be within ±5 min)
 *    - `x-signature`  — HMAC-SHA256(METHOD:PATH:TIMESTAMP:BODY, deviceToken)
 *    - `x-device-token` — the raw device token for bcrypt verification
 *
 * 2. **Raw token only** (fallback) – `x-device-id` + `x-device-token`
 *
 * In both cases the raw token is bcrypt-compared against the stored hash.
 */
@Injectable()
export class DeviceTokenGuard implements CanActivate {
    private readonly logger = new Logger(DeviceTokenGuard.name);

    constructor(private readonly prisma: PrismaService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const deviceId = request.headers['x-device-id'];
        const deviceToken = request.headers['x-device-token'];

        if (!deviceId) {
            throw new UnauthorizedException('x-device-id header is required');
        }

        if (!deviceToken) {
            throw new UnauthorizedException('x-device-token header is required');
        }

        // Look up device by hardwareId
        const device = await this.prisma.device.findUnique({
            where: { hardwareId: deviceId },
        });

        if (!device || !device.apiTokenHash) {
            this.logger.warn(`Device not found or token not set: ${deviceId}`);
            throw new UnauthorizedException('Device not registered or token not set');
        }

        // Verify the raw token against the stored bcrypt hash
        const isValid = await bcrypt.compare(deviceToken, device.apiTokenHash);
        if (!isValid) {
            this.logger.warn(`Invalid device token for device: ${deviceId}`);
            throw new UnauthorizedException('Invalid device token');
        }

        // Optionally verify timestamp freshness if HMAC headers are present
        // Require timestamp and signature headers for HMAC authentication
        const timestamp = request.headers['x-timestamp'];
        const signature = request.headers['x-signature'];
        if (!timestamp || !signature) {
            this.logger.warn(`Missing timestamp or signature for device: ${deviceId}`);
            throw new UnauthorizedException('x-timestamp and x-signature headers are required');
        }
        const ts = parseInt(timestamp, 10);
        const now = Date.now();
        const MAX_DRIFT_MS = 5 * 60 * 1000; // 5 minutes
        if (isNaN(ts) || Math.abs(now - ts) > MAX_DRIFT_MS) {
            this.logger.warn(`Request timestamp too far from server time for device: ${deviceId}`);
            throw new UnauthorizedException('Request timestamp is stale or invalid');
        }

        // Validate signature: HMAC-SHA256(METHOD:PATH:TIMESTAMP:BODY, deviceToken)
        try {
            const method = (request.method || 'POST').toString().toUpperCase();
            // Prefer originalUrl or path depending on runtime
            const path = request.originalUrl || request.url || request.path || '';
            // Attempt to reconstruct body as string; fall back to empty string
            let bodyString = '';
            try {
                if (request.rawBody && typeof request.rawBody === 'string') {
                    bodyString = request.rawBody;
                } else if (request.body) {
                    bodyString = JSON.stringify(request.body);
                }
            } catch (e) {
                bodyString = '';
            }

            const toSign = `${method}:${path}:${timestamp}:${bodyString}`;
            const expected = crypto.createHmac('sha256', deviceToken).update(toSign).digest('hex');
            const provided = (signature || '').toString();
            const expectedBuf = Buffer.from(expected, 'hex');
            const providedBuf = Buffer.from(provided.replace(/^0x/, ''), 'hex');
            if (expectedBuf.length !== providedBuf.length || !crypto.timingSafeEqual(expectedBuf, providedBuf)) {
                this.logger.warn(`Invalid signature for device: ${deviceId}`);
                throw new UnauthorizedException('Invalid signature');
            }
            // Replay protection: store recent signature hashes in DB and reject duplicates within window
            try {
                const sigHash = crypto.createHash('sha256').update(provided).digest('hex');
                const windowMs = 5 * 60 * 1000; // same as timestamp freshness window
                const cutoff = new Date(Date.now() - windowMs);
                const existing = await this.prisma.requestNonce.findUnique({ where: { signatureHash: sigHash } });
                if (existing) {
                    this.logger.warn(`Replay detected for device: ${deviceId}`);
                    throw new UnauthorizedException('Replay detected');
                }
                // Insert nonce record
                await this.prisma.requestNonce.create({ data: { deviceId: device.id, signatureHash: sigHash } });
            } catch (e) {
                if (e instanceof UnauthorizedException) throw e;
                // Do not let nonce logic break authentication; log and continue
                this.logger.warn(`Nonce storage/check failed for device ${deviceId}: ${e.message}`);
            }
        } catch (e) {
            if (e instanceof UnauthorizedException) throw e;
            this.logger.warn(`Signature validation error for device: ${deviceId}`);
            throw new UnauthorizedException('Signature validation failed');
        }

        // Attach device to request for downstream use
        request.device = device;
        return true;
    }
}

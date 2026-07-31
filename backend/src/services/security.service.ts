import crypto from 'crypto';
import { config } from '../config';
import { logger } from '../utils/logger';

/**
 * Security service providing authenticated encryption (AES-256-GCM) for sensitive data.
 * Uses a key derived from the JWT secret; in production use a dedicated KMS key.
 */
export class SecurityService {
  private algorithm = 'aes-256-gcm';
  private key = crypto.scryptSync(config.jwtSecret, 'salt', 32);

  /**
   * Encrypt plaintext using AES-256-GCM with a random IV and authentication tag.
   * Returns format: `iv:authTag:ciphertext` (all hex-encoded).
   */
  encrypt(text: string): string {
    const iv = crypto.randomBytes(12); // 96-bit IV for GCM
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv) as crypto.CipherGCM;

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt ciphertext encrypted with `encrypt()`.
   * Verifies the authentication tag before returning plaintext.
   */
  decrypt(hash: string): string {
    try {
      const parts = hash.split(':');
      if (parts.length !== 3) throw new Error('Invalid encrypted format');

      const [ivHex, authTagHex, encryptedHex] = parts;
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');

      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv) as crypto.DecipherGCM;
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error: any) {
      logger.error('[SecurityService] Decryption failed', error);
      throw new Error('Decryption failed — data may be corrupted or tampered with');
    }
  }

  /**
   * Hash a password using bcrypt (already used in auth.service for user passwords).
   * This is a convenience wrapper for other sensitive string hashing needs.
   */
  async hashPassword(password: string, rounds: number = 12): Promise<string> {
    const bcrypt = await import('bcryptjs');
    const salt = await bcrypt.genSalt(rounds);
    return bcrypt.hash(password, salt);
  }

  /**
   * Verify a password against a bcrypt hash.
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    const bcrypt = await import('bcryptjs');
    return bcrypt.compare(password, hash);
  }
}

export const securityService = new SecurityService();

import crypto from 'crypto';
import { config } from '../config';
import { logger } from '../utils/logger';

export class SecurityService {
  private algorithm = 'aes-256-cbc';
  // Use JWT secret as base key, in production use a dedicated KMS key
  private key = crypto.scryptSync(config.jwtSecret, 'salt', 32);

  encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return `${iv.toString('hex')}:${encrypted}`;
  }

  decrypt(hash: string): string {
    try {
      const [ivHex, encryptedHex] = hash.split(':');
      if (!ivHex || !encryptedHex) throw new Error('Invalid encrypted format');

      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      
      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      logger.error('Decryption failed', error);
      throw new Error('Decryption failed');
    }
  }
}

export const securityService = new SecurityService();

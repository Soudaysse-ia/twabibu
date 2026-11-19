import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Application-level encryption of medical free text (SPEC-13 §Principes 3).
 * Format: `v1:<iv base64>:<tag base64>:<ciphertext base64>`, AES-256-GCM, key = SHA-256(ENCRYPTION_KEY).
 * A database dump alone never reveals consultation notes.
 */
export class FieldCrypto {
  private readonly key: Buffer;

  constructor(secret: string) {
    this.key = createHash('sha256').update(secret).digest();
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return `v1:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${data.toString('base64')}`;
  }

  decrypt(value: string): string {
    const [version, iv, tag, data] = value.split(':');
    if (version !== 'v1' || !iv || !tag || data === undefined) throw new Error('Unknown encrypted format');
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
  }

  encryptJson(value: unknown): string {
    return this.encrypt(JSON.stringify(value));
  }

  decryptJson<T>(value: string): T {
    return JSON.parse(this.decrypt(value)) as T;
  }
}

export const FIELD_CRYPTO = Symbol('FIELD_CRYPTO');

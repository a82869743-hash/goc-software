import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const SECRET = process.env.JWT_SECRET || 'goc_studio_default_encryption_secret_key_32bytes';

// Generate a 32-byte key from the SECRET
const KEY = crypto.createHash('sha256').update(SECRET).digest();

/**
 * Encrypt a text string to hex string format prepended with initialization vector
 */
export function encrypt(text: string): string {
  if (!text) return '';
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  } catch (err: any) {
    console.error('[Encryption] Encryption failed:', err.message);
    return '';
  }
}

/**
 * Decrypt an iv-prepended hex string back to plain text
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) return '';
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 2) return '';
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err: any) {
    console.error('[Encryption] Decryption failed:', err.message);
    return '';
  }
}

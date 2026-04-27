import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly key: Buffer;
  private readonly algorithm = 'aes-256-gcm';

  constructor() {
    const hex = process.env['ENCRYPTION_KEY'] ?? '';
    this.key = Buffer.from(hex, 'hex');
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv(this.algorithm, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  decrypt(ciphertext: string): string {
    const [ivHex, tagHex, dataHex] = ciphertext.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const data = Buffer.from(dataHex, 'hex');
    const decipher = createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }
}

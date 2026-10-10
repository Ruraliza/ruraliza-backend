import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { PasswordHasher, ResetTokens } from '../../domain/passwords';

const SALT_BYTES = 16;
const KEY_BYTES = 64;

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_BYTES, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

// Senha guardada como `scrypt$<sal base64>$<chave base64>` (parâmetros padrão do Node: N=16384, r=8, p=1).
export const scryptPasswordHasher: PasswordHasher = {
  async hash(password) {
    const salt = randomBytes(SALT_BYTES);
    const key = await deriveKey(password, salt);
    return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
  },

  async verify(password, hash) {
    const [scheme, salt, key] = hash.split('$');
    if (scheme !== 'scrypt' || salt === undefined || key === undefined) return false;
    const expected = Buffer.from(key, 'base64');
    const actual = await deriveKey(password, Buffer.from(salt, 'base64'));
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
};

// 32 bytes aleatórios (base64url, cabe numa URL); guardado como SHA-256.
export const randomResetTokens: ResetTokens = {
  create() {
    const token = randomBytes(32).toString('base64url');
    return { token, digest: this.digest(token) };
  },

  digest(token) {
    return createHash('sha256').update(token).digest('hex');
  }
};

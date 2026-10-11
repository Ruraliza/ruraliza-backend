import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { Clock } from '../../domain/clock';
import type { PasswordHasher, ResetTokens } from '../../domain/passwords';
import { SESSION_TOKEN_TTL_MS, type SessionTokens, type TokenSubject } from '../../domain/tokens';

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

// Token de sessão `<payload base64url>.<HMAC-SHA256 base64url>`, com o payload { kind, id, exp }.
// Sem estado no servidor: quem tem o segredo confere a assinatura e a validade.
// Trocar o segredo (AUTH_TOKEN_SECRET) derruba todas as sessões.
export function createHmacSessionTokens(secret: string, clock: Clock, ttlMs = SESSION_TOKEN_TTL_MS): SessionTokens {
  const sign = (payload: string): string => createHmac('sha256', secret).update(payload).digest('base64url');

  return {
    issue(subject) {
      const exp = Date.parse(clock.now()) + ttlMs;
      const payload = Buffer.from(JSON.stringify({ kind: subject.kind, id: subject.id, exp })).toString('base64url');
      return `${payload}.${sign(payload)}`;
    },

    verify(token) {
      const [payload, signature, ...rest] = token.split('.');
      if (payload === undefined || signature === undefined || rest.length > 0) return null;

      const expected = Buffer.from(sign(payload));
      const actual = Buffer.from(signature);
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

      const data = parsePayload(payload);
      if (data === null || data.exp <= Date.parse(clock.now())) return null;
      return { kind: data.kind, id: data.id };
    }
  };
}

function parsePayload(payload: string): (TokenSubject & { exp: number }) | null {
  try {
    const data: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof data !== 'object' || data === null) return null;
    const { kind, id, exp } = data as Record<string, unknown>;
    if ((kind !== 'account' && kind !== 'system') || !Number.isInteger(id) || typeof exp !== 'number') return null;
    return { kind, id: id as number, exp };
  } catch {
    return null;
  }
}

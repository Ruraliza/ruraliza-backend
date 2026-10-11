import { randomInt } from 'node:crypto';
import type { CertificateCodes } from '../domain/certificate';

// Sem 0/O, 1/I/L: o código é lido e digitado por pessoas.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

// RZ-XXXX-XXXX-XX: 10 caracteres aleatórios (~49 bits), gerados com o CSPRNG do Node.
export const randomCertificateCodes: CertificateCodes = {
  create() {
    const chars = Array.from({ length: 10 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
    return `RZ-${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8)}`;
  }
};

import { createHash } from 'node:crypto';
import { type CertificateHasher, certificateHashText } from '../domain/certificate';

export const sha256CertificateHasher: CertificateHasher = {
  hash: (data) => createHash('sha256').update(certificateHashText(data), 'utf8').digest('hex')
};

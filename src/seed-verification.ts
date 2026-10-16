import sharp from 'sharp';
import type { ImageStore } from '#shared/domain/images';
import type { Repositories } from './repositories';

// Verificação de identidade de demonstração: o João (produtor) já verificado, e o Pedro na fila da
// equipe com uma imagem de EXEMPLO no lugar do documento (não imita nenhum documento oficial).
// Sem o armazenamento das fotos (`idDocuments`), o pedido do Pedro fica de fora.

function exampleDocument(name: string, cpf: string): string {
  const masked = `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="760" viewBox="0 0 1200 760">
  <rect width="1200" height="760" rx="36" fill="#EEF3EC"/>
  <rect x="24" y="24" width="1152" height="712" rx="24" fill="none" stroke="#9DB39A" stroke-width="4" stroke-dasharray="18 12"/>
  <text x="80" y="120" font-family="Arial, Helvetica, sans-serif" font-size="44" font-weight="700" fill="#1F3D2B">DOCUMENTO DE EXEMPLO</text>
  <text x="80" y="170" font-family="Arial, Helvetica, sans-serif" font-size="28" fill="#4B6352">Imagem da demonstração do Ruraliza. Não é um documento real.</text>
  <rect x="80" y="230" width="300" height="380" rx="16" fill="#C9D6C6"/>
  <circle cx="230" cy="360" r="70" fill="#AFC0AB"/>
  <rect x="140" y="450" width="180" height="120" rx="60" fill="#AFC0AB"/>
  <text x="440" y="290" font-family="Arial, Helvetica, sans-serif" font-size="26" fill="#4B6352">NOME</text>
  <text x="440" y="336" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="700" fill="#1F3D2B">${name}</text>
  <text x="440" y="420" font-family="Arial, Helvetica, sans-serif" font-size="26" fill="#4B6352">CPF</text>
  <text x="440" y="466" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="700" fill="#1F3D2B">${masked}</text>
  <text x="440" y="550" font-family="Arial, Helvetica, sans-serif" font-size="26" fill="#4B6352">DATA DE NASCIMENTO</text>
  <text x="440" y="596" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="700" fill="#1F3D2B">01/01/1990</text>
</svg>`;
}

export interface VerificationPeople {
  farmerId: number;
  farmerName: string;
  pedroEmail: string;
}

export async function seedVerifications(repos: Repositories, now: string, people: VerificationPeople, idDocuments?: ImageStore): Promise<void> {
  const daysAgo = (days: number): string => new Date(Date.parse(now) - days * 86_400_000).toISOString();
  await repos.verifications.create({
    role: 'farmer', profile_id: people.farmerId, document_type: 'cnh', document_id: null, status: 'approved',
    submitted_at: daysAgo(3), reviewed_at: daysAgo(2), rejection_reason: null, verified_name: people.farmerName
  });

  const [pedro] = await repos.workers.find({ email: people.pedroEmail });
  if (!pedro || !idDocuments) return;
  const data = await sharp(Buffer.from(exampleDocument(pedro.name, pedro.cpf))).webp({ quality: 80 }).toBuffer({ resolveWithObject: true });
  const documentId = await idDocuments.save({ bytes: new Uint8Array(data.data), contentType: 'image/webp', width: data.info.width, height: data.info.height });
  await repos.verifications.create({
    role: 'worker', profile_id: pedro.id, document_type: 'rg', document_id: documentId, status: 'pending',
    submitted_at: new Date(Date.parse(now) - 4 * 3_600_000).toISOString(), reviewed_at: null, rejection_reason: null, verified_name: null
  });
}

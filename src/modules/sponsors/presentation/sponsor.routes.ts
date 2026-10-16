import type { AccessPolicies } from '#modules/auth';
import type { CoreSchemaName } from '#shared/infra/docs/core.schemas';
import { IMAGE_UPLOAD, TAGS, operation, pathParam, queryParam } from '#shared/infra/docs/operations';
import { PUBLIC_ROUTE } from '#shared/infra/http/access';
import { type RouteDef, route } from '#shared/infra/http/route';
import type { SponsorController } from './sponsor.controller';
import type { SponsorSchemaName } from './sponsor.schemas';

const sponsorOperation = operation<SponsorSchemaName | CoreSchemaName>;
const sponsorId = pathParam('id', 'ID do patrocínio.');

export interface SponsorRoutes {
  public: readonly RouteDef[]; // em /api/sponsors
  admin: readonly RouteDef[]; // em /api/admin (equipe com a permissão content:manage)
}

export function sponsorRoutes(sponsors: SponsorController, access: AccessPolicies): SponsorRoutes {
  const manageContent = access.system('content:manage');
  return {
    public: [
      route('get', '/slot', sponsors.sponsorSlot, sponsorOperation({
        tag: TAGS.sponsors,
        summary: 'Patrocínio da vez',
        description:
          'Entre os patrocínios ativos, no período, para o público pedido, na UF (quando o patrocínio é segmentado por UF) e nos ' +
          'interesses do trabalhador (quando segmentado por categoria), o que menos apareceu até agora; conta a aparição. ' +
          'Pública e sem dados de quem pede: a UF e as categorias vêm na própria URL.',
        params: [
          queryParam('audience', 'Quem vê: `farmer` ou `worker` (obrigatório).', { type: 'string', enum: ['farmer', 'worker'] }),
          queryParam('state', 'UF de quem vê (ex.: a das fazendas do produtor).', { type: 'string', example: 'RJ' }),
          queryParam('categories', 'Interesses do trabalhador, separados por vírgula.', { type: 'string', example: 'Colheita,Plantio' })
        ],
        success: { status: 200, description: 'O cartão (ou `card: null`).', schema: 'SponsorSlotResponse' },
        errors: { 400: '`audience` faltando ou inválido.' }
      }), PUBLIC_ROUTE),

      route('post', '/:id/click', sponsors.sponsorClick, sponsorOperation({
        tag: TAGS.sponsors,
        summary: 'Contar clique no patrocínio',
        description: 'O app chama ao abrir o link do cartão (o endereço abre direto, sem passar pela API).',
        params: [sponsorId],
        success: { status: 200, description: 'Clique contado.', schema: 'MessageResponse' },
        errors: { 404: 'Patrocínio não encontrado.' }
      }), PUBLIC_ROUTE)
    ],
    admin: [
      route('get', '/sponsors', sponsors.listSponsors, sponsorOperation({
        tag: TAGS.sponsors,
        summary: 'Patrocínios (gestão)',
        description: 'Todos, com as aparições e os cliques; o atualizado por último primeiro.',
        success: { status: 200, description: 'Patrocínios.', schema: { listOf: 'Sponsor' } }
      }), manageContent),

      route('post', '/sponsors', sponsors.createSponsor, sponsorOperation({
        tag: TAGS.sponsors,
        summary: 'Criar patrocínio',
        description: 'Ativo por padrão. A logo vai depois, em POST /api/admin/sponsors/{id}/image.',
        body: 'SponsorInput',
        success: { status: 201, description: 'Patrocínio criado.', schema: 'SponsorResponse' },
        errors: { 400: 'Campo faltando ou inválido; endereço sem https://; palavrão; período fora de ordem.' }
      }), manageContent),

      route('patch', '/sponsors/:id', sponsors.updateSponsor, sponsorOperation({
        tag: TAGS.sponsors,
        summary: 'Editar patrocínio',
        params: [sponsorId],
        body: 'SponsorUpdate',
        success: { status: 200, description: 'Patrocínio salvo.', schema: 'SponsorResponse' },
        errors: { 400: 'Nenhum campo; campo inválido; período fora de ordem.', 404: 'Patrocínio não encontrado.' }
      }), manageContent),

      route('delete', '/sponsors/:id', sponsors.deleteSponsor, sponsorOperation({
        tag: TAGS.sponsors,
        summary: 'Apagar patrocínio',
        params: [sponsorId],
        success: { status: 200, description: 'Patrocínio apagado (com a imagem).', schema: 'MessageResponse' },
        errors: { 404: 'Patrocínio não encontrado.' }
      }), manageContent),

      route('post', '/sponsors/:id/image', sponsors.uploadSponsorImage, sponsorOperation({
        tag: TAGS.sponsors,
        summary: 'Enviar logo do patrocínio',
        description: 'Troca a anterior. Reduzida para no máximo 1000px e convertida para WebP, sem metadados.',
        params: [sponsorId],
        body: IMAGE_UPLOAD,
        success: { status: 200, description: 'Imagem salva.', schema: 'SponsorResponse' },
        errors: { 400: 'Corpo vazio ou que não é imagem.', 404: 'Patrocínio não encontrado.', 413: 'Arquivo maior que 10 MB.' }
      }), manageContent),

      route('delete', '/sponsors/:id/image', sponsors.deleteSponsorImage, sponsorOperation({
        tag: TAGS.sponsors,
        summary: 'Tirar a logo do patrocínio',
        params: [sponsorId],
        success: { status: 200, description: 'Imagem removida.', schema: 'SponsorResponse' },
        errors: { 404: 'Patrocínio não encontrado.' }
      }), manageContent)
    ]
  };
}

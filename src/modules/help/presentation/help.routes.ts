import type { AccessPolicies } from '#modules/auth';
import type { CoreSchemaName } from '#shared/infra/docs/core.schemas';
import { TAGS, operation, pathParam } from '#shared/infra/docs/operations';
import { PUBLIC_ROUTE } from '#shared/infra/http/access';
import { type RouteDef, route } from '#shared/infra/http/route';
import type { HelpController } from './help.controller';
import type { HelpSchemaName } from './help.schemas';

const articleId = pathParam('id', 'ID da pergunta.');
const helpOperation = operation<HelpSchemaName | CoreSchemaName>;

export interface HelpRoutes {
  public: readonly RouteDef[]; // em /api/help
  admin: readonly RouteDef[]; // em /api/admin (equipe com a permissão content:manage)
}

export function helpRoutes(help: HelpController, access: AccessPolicies): HelpRoutes {
  const manageContent = access.system('content:manage');
  return {
    public: [
      route('get', '/', help.listHelp, helpOperation({
        tag: TAGS.help,
        summary: 'Central de ajuda',
        description: 'Perguntas frequentes publicadas, por tema e na ordem da tela. Pública: aparece também para quem não entrou.',
        success: { status: 200, description: 'Perguntas publicadas.', schema: { listOf: 'HelpArticle' } }
      }), PUBLIC_ROUTE)
    ],
    admin: [
      route('get', '/help', help.listHelpAdmin, helpOperation({
        tag: TAGS.help,
        summary: 'Todas as perguntas (gestão)',
        description: 'Inclusive os rascunhos.',
        success: { status: 200, description: 'Perguntas.', schema: { listOf: 'HelpArticle' } }
      }), manageContent),

      route('post', '/help', help.createHelpArticle, helpOperation({
        tag: TAGS.help,
        summary: 'Criar pergunta',
        description: 'Entra no fim do tema escolhido. Publicada por padrão.',
        body: 'HelpArticleInput',
        success: { status: 201, description: 'Pergunta criada.', schema: 'HelpArticleResponse' },
        errors: { 400: 'Campo faltando; texto longo demais; tema inválido.' }
      }), manageContent),

      route('patch', '/help/:id', help.updateHelpArticle, helpOperation({
        tag: TAGS.help,
        summary: 'Editar pergunta',
        description: 'Muda só os campos enviados. Mudou de tema: vai para o fim do tema novo.',
        params: [articleId],
        body: 'HelpArticleUpdate',
        success: { status: 200, description: 'Pergunta salva.', schema: 'HelpArticleResponse' },
        errors: { 400: 'Nenhum campo enviado; texto vazio ou longo demais; tema inválido.', 404: 'Pergunta não encontrada.' }
      }), manageContent),

      route('patch', '/help/:id/move', help.moveHelpArticle, helpOperation({
        tag: TAGS.help,
        summary: 'Mudar a ordem da pergunta',
        description: 'Troca de lugar com a pergunta de cima (`up`) ou de baixo (`down`) no mesmo tema. Na ponta, nada muda.',
        params: [articleId],
        body: 'HelpArticleMoveInput',
        success: { status: 200, description: 'Ordem salva.', schema: 'HelpArticleResponse' },
        errors: { 400: '`direction` inválida.', 404: 'Pergunta não encontrada.' }
      }), manageContent),

      route('delete', '/help/:id', help.deleteHelpArticle, helpOperation({
        tag: TAGS.help,
        summary: 'Apagar pergunta',
        params: [articleId],
        success: { status: 200, description: 'Pergunta apagada.', schema: 'MessageResponse' },
        errors: { 404: 'Pergunta não encontrada.' }
      }), manageContent)
    ]
  };
}

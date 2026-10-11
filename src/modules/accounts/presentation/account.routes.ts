import type { AccessPolicies } from '#modules/auth';
import { TAGS, operation, pathParam } from '#shared/infra/docs/operations';
import { type RouteDef, route } from '#shared/infra/http/route';
import type { AccountController } from './account.controller';
import type { AccountSchemaName } from './account.schemas';

const accountId = pathParam('id', 'ID da conta (`account_id` da sessão).');
const accountOperation = operation<AccountSchemaName>;

// Montadas em /api/accounts. Uma conta tem um e-mail, uma senha e até um perfil de cada tipo.
export function accountRoutes(accounts: AccountController, pushRoutes: readonly RouteDef[], access: AccessPolicies): readonly RouteDef[] {
  return [
    route('get', '/:id', accounts.getAccount, accountOperation({
      tag: TAGS.auth,
      summary: 'Sessão da conta',
      description: 'Os perfis da conta e o painel aberto, no mesmo formato do login.',
      params: [accountId],
      success: { status: 200, description: 'Sessão atual.', schema: 'SessionUser' },
      errors: { 404: 'Conta não encontrada.' }
    }), access.ownAccount()),

    route('post', '/:id/profiles', accounts.createAccountProfile, accountOperation({
      tag: TAGS.auth,
      summary: 'Criar o outro perfil na conta',
      description:
        'Produtor que também quer ser trabalhador (ou o contrário). O e-mail e a senha são os da conta. ' +
        'O novo perfil passa a ser o painel aberto.',
      params: [accountId],
      body: 'ProfileCreateInput',
      success: { status: 201, description: 'Perfil criado; sessão já com o painel novo.', schema: 'SessionResponse' },
      errors: {
        400: 'Campo obrigatório faltando; `role` inválido; CPF inválido; enviou `email` ou `password`; texto longo demais.',
        404: 'Conta não encontrada.',
        409: 'A conta já tem esse perfil; CPF de outra conta.'
      }
    }), access.ownAccount()),

    route('patch', '/:id/active-role', accounts.setActiveRole, accountOperation({
      tag: TAGS.auth,
      summary: 'Trocar o painel aberto',
      description: 'Também define o painel que abre no próximo login.',
      params: [accountId],
      body: 'ActiveRoleInput',
      success: { status: 200, description: 'Painel trocado.', schema: 'SessionResponse' },
      errors: { 400: '`role` faltando ou inválido.', 404: 'Conta não encontrada, ou ela ainda não tem esse perfil.' }
    }), access.ownAccount()),

    // Inscrições de push (src/modules/notifications).
    ...pushRoutes
  ];
}

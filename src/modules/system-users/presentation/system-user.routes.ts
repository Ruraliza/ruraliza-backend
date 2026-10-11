import type { AccessPolicies } from '#modules/auth';
import { TAGS, operation, pathParam } from '#shared/infra/docs/operations';
import { PUBLIC_ROUTE } from '#shared/infra/http/access';
import { type RouteDef, route } from '#shared/infra/http/route';
import type { SystemUserController } from './system-user.controller';
import type { SystemUserSchemaName } from './system-user.schemas';

const systemUserIdParam = pathParam('id', 'ID do usuário de sistema.');
// 'LoginInput' é do módulo de acesso (o corpo do login da equipe é o mesmo do app).
const systemUserOperation = operation<SystemUserSchemaName | 'LoginInput'>;

export interface SystemUserRoutes {
  // Em /api/auth: login e perfil próprio da equipe.
  auth: readonly RouteDef[];
  // Em /api/admin: cadastro e edição da equipe pelo administrador.
  admin: readonly RouteDef[];
}

export function systemUserRoutes(systemUsers: SystemUserController, access: AccessPolicies): SystemUserRoutes {
  const manageStaff = access.system('system-users:manage');

  return {
    auth: [
      route('post', '/system/login', systemUsers.systemLogin, systemUserOperation({
        tag: TAGS.auth,
        summary: 'Entrar como usuário de sistema',
        description:
          'Login da equipe do Ruraliza (administradores e tutores), separado das contas do app. Não há cadastro público: ' +
          'quem cria usuários de sistema é um administrador. O `token` vale 12 horas.',
        body: 'LoginInput',
        success: { status: 200, description: 'E-mail e senha conferem.', schema: 'SystemLoginResponse' },
        errors: {
          400: 'Campo obrigatório faltando.',
          401: 'E-mail ou senha incorretos (a mesma mensagem nos dois casos).'
        }
      }), PUBLIC_ROUTE),

      route('get', '/system/me', systemUsers.getSystemSession, systemUserOperation({
        tag: TAGS.auth,
        summary: 'Sessão do usuário de sistema',
        description: 'Quem é o dono do token, com o cargo atual.',
        success: { status: 200, description: 'Usuário de sistema.', schema: 'SystemUser' }
      }), access.anySystemUser),

      route('patch', '/system/me', systemUsers.updateSystemProfile, systemUserOperation({
        tag: TAGS.auth,
        summary: 'Editar o próprio perfil de usuário de sistema',
        description: 'Nome e e-mail. O cargo só um administrador muda (PATCH /api/admin/system-users/:id); a senha não muda por aqui.',
        body: 'SystemUserUpdate',
        success: { status: 200, description: 'Perfil atualizado.', schema: 'SystemUserResponse' },
        errors: {
          400: 'Enviou `id`, `role` ou `password`; e-mail inválido; nome vazio ou longo demais.',
          409: 'Já existe um usuário de sistema com este e-mail.'
        }
      }), access.anySystemUser)
    ],
    admin: [
      route('get', '/system-users', systemUsers.listSystemUsers, systemUserOperation({
        tag: TAGS.admin,
        summary: 'Listar usuários de sistema',
        success: { status: 200, description: 'Administradores e tutores.', schema: { listOf: 'SystemUser' } }
      }), manageStaff),

      route('post', '/system-users', systemUsers.createSystemUser, systemUserOperation({
        tag: TAGS.admin,
        summary: 'Cadastrar usuário de sistema',
        description: 'Único jeito de criar um usuário de sistema (não há cadastro público). Ele entra por `POST /api/auth/system/login`.',
        body: 'SystemUserInput',
        success: { status: 201, description: 'Usuário de sistema criado.', schema: 'SystemUserResponse' },
        errors: {
          400: 'Campo obrigatório faltando; e-mail inválido; `role` diferente de admin e tutor; senha fora do tamanho (8 a 128).',
          409: 'Já existe um usuário de sistema com este e-mail.'
        }
      }), manageStaff),

      route('get', '/system-users/:id', systemUsers.getSystemUser, systemUserOperation({
        tag: TAGS.admin,
        summary: 'Detalhe de um usuário de sistema',
        params: [systemUserIdParam],
        success: { status: 200, description: 'Usuário de sistema.', schema: 'SystemUser' },
        errors: { 404: 'Usuário de sistema não encontrado.' }
      }), manageStaff),

      route('patch', '/system-users/:id', systemUsers.updateSystemUser, systemUserOperation({
        tag: TAGS.admin,
        summary: 'Editar usuário de sistema',
        description:
          'Edição parcial de nome, e-mail e cargo. O administrador não muda o próprio cargo (a equipe não pode ficar sem ' +
          'administrador); a senha não muda por aqui.',
        params: [systemUserIdParam],
        body: 'AdminSystemUserUpdate',
        success: { status: 200, description: 'Usuário de sistema atualizado.', schema: 'SystemUserResponse' },
        errors: {
          400: 'Enviou `id` ou `password`; e-mail inválido; nome vazio ou longo demais; `role` diferente de admin e tutor.',
          404: 'Usuário de sistema não encontrado.',
          409: 'E-mail já usado por outro usuário de sistema; tentou mudar o próprio cargo.'
        }
      }), manageStaff)
    ]
  };
}

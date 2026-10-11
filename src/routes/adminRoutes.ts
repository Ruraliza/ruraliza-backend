import type { AdminController } from '../controllers/AdminController';
import { TAGS, operation, pathParam } from '../docs/operations';
import type { AccessPolicies } from '../http/access';
import { type RouteDef, route } from '#shared/infra/http/route';

const accountId = pathParam('id', 'ID da conta (`account_id`).');
const farmerId = pathParam('id', 'ID do produtor.');
const workerId = pathParam('id', 'ID do trabalhador.');
const systemUserIdParam = pathParam('id', 'ID do usuário de sistema.');
const inProgress = 'Há serviço em andamento (o pagamento precisa ser concluído antes).';

// Montadas em /api/admin. Só usuários de sistema com cargo que tenha a permissão (hoje, o admin).
// Editar e remover perfis seguem as mesmas regras de quando o próprio usuário faz.
export function adminRoutes(admin: AdminController, access: AccessPolicies): readonly RouteDef[] {
  const manageUsers = access.system('users:manage');
  const manageStaff = access.system('system-users:manage');

  return [
    // --- CONTAS DO APP ---

    route('get', '/users', admin.listUsers, operation({
      tag: TAGS.admin,
      summary: 'Listar contas do app',
      description: 'Todas as contas, as mais novas primeiro, com os perfis de produtor e trabalhador (CPF mascarado).',
      success: { status: 200, description: 'Contas.', schema: { listOf: 'AdminUser' } }
    }), manageUsers),

    route('get', '/users/:id', admin.getUser, operation({
      tag: TAGS.admin,
      summary: 'Detalhe de uma conta',
      description: 'A conta com os perfis completos (CPF sem máscara).',
      params: [accountId],
      success: { status: 200, description: 'Conta.', schema: 'AdminUser' },
      errors: { 404: 'Conta não encontrada.' }
    }), manageUsers),

    route('delete', '/users/:id', admin.deleteUser, operation({
      tag: TAGS.admin,
      summary: 'Remover conta',
      description:
        'Remove os dois perfis (com fazendas, serviços, candidaturas, fotos e currículo) e a conta. ' +
        'Os pagamentos ficam como histórico. Nada é removido se algum perfil tiver serviço em andamento.',
      params: [accountId],
      success: { status: 200, description: 'Conta removida.', schema: 'MessageResponse' },
      errors: { 404: 'Conta não encontrada.', 409: inProgress }
    }), manageUsers),

    route('patch', '/farmers/:id', admin.adminUpdateFarmer, operation({
      tag: TAGS.admin,
      summary: 'Editar perfil de produtor',
      description: 'Mesmas regras de `PATCH /api/farmers/:id`. Trocar o e-mail troca o da conta e o do outro perfil.',
      params: [farmerId],
      body: 'FarmerUpdate',
      success: { status: 200, description: 'Produtor atualizado.', schema: 'FarmerResponse' },
      errors: {
        400: 'Tentou alterar `id`, `cpf` ou `password`; e-mail inválido; campo vazio.',
        404: 'Produtor não encontrado.',
        409: 'E-mail já usado por outra conta.'
      }
    }), manageUsers),

    route('delete', '/farmers/:id', admin.adminDeleteFarmer, operation({
      tag: TAGS.admin,
      summary: 'Remover perfil de produtor',
      description: 'Remove o perfil com fazendas, serviços e candidaturas. A conta continua se tiver o perfil de trabalhador.',
      params: [farmerId],
      success: { status: 200, description: 'Perfil removido.', schema: 'MessageResponse' },
      errors: { 404: 'Produtor não encontrado.', 409: inProgress }
    }), manageUsers),

    route('delete', '/farmers/:id/photo', admin.adminDeleteFarmerPhoto, operation({
      tag: TAGS.admin,
      summary: 'Remover foto de perfil do produtor',
      description: 'Para fotos impróprias. A imagem é apagada; o produtor pode enviar outra depois.',
      params: [farmerId],
      success: { status: 200, description: 'Foto removida (`photo_url` = null).', schema: 'FarmerResponse' },
      errors: { 404: 'Produtor não encontrado.' }
    }), manageUsers),

    route('patch', '/workers/:id', admin.adminUpdateWorker, operation({
      tag: TAGS.admin,
      summary: 'Editar perfil de trabalhador',
      description: 'Mesmas regras de `PATCH /api/workers/:id`. Trocar o e-mail troca o da conta e o do outro perfil.',
      params: [workerId],
      body: 'WorkerUpdate',
      success: { status: 200, description: 'Trabalhador atualizado.', schema: 'WorkerResponse' },
      errors: {
        400: 'Tentou alterar `id`, `cpf` ou `password`; e-mail inválido; campo vazio; texto longo demais.',
        404: 'Trabalhador não encontrado.',
        409: 'E-mail já usado por outra conta.'
      }
    }), manageUsers),

    route('delete', '/workers/:id', admin.adminDeleteWorker, operation({
      tag: TAGS.admin,
      summary: 'Remover perfil de trabalhador',
      description: 'Remove o perfil com as candidaturas, a foto e o currículo. A conta continua se tiver o perfil de produtor.',
      params: [workerId],
      success: { status: 200, description: 'Perfil removido.', schema: 'MessageResponse' },
      errors: { 404: 'Trabalhador não encontrado.', 409: 'Há serviço em andamento atribuído a este trabalhador.' }
    }), manageUsers),

    route('delete', '/workers/:id/photo', admin.adminDeleteWorkerPhoto, operation({
      tag: TAGS.admin,
      summary: 'Remover foto de perfil do trabalhador',
      description: 'Para fotos impróprias. A imagem é apagada; o trabalhador pode enviar outra depois.',
      params: [workerId],
      success: { status: 200, description: 'Foto removida (`photo_url` = null).', schema: 'WorkerResponse' },
      errors: { 404: 'Trabalhador não encontrado.' }
    }), manageUsers),

    // --- EQUIPE (USUÁRIOS DE SISTEMA) ---

    route('get', '/system-users', admin.listSystemUsers, operation({
      tag: TAGS.admin,
      summary: 'Listar usuários de sistema',
      success: { status: 200, description: 'Administradores e tutores.', schema: { listOf: 'SystemUser' } }
    }), manageStaff),

    route('post', '/system-users', admin.createSystemUser, operation({
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

    route('get', '/system-users/:id', admin.getSystemUser, operation({
      tag: TAGS.admin,
      summary: 'Detalhe de um usuário de sistema',
      params: [systemUserIdParam],
      success: { status: 200, description: 'Usuário de sistema.', schema: 'SystemUser' },
      errors: { 404: 'Usuário de sistema não encontrado.' }
    }), manageStaff),

    route('patch', '/system-users/:id', admin.updateSystemUser, operation({
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
  ];
}

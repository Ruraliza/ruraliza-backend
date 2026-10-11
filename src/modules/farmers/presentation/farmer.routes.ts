import { TAGS, operation, pathParam } from '#shared/infra/docs/operations';
import { type RouteDef, route } from '#shared/infra/http/route';
import { type AccessPolicies, PUBLIC_ROUTE } from '../../../http/access';
import type { FarmerController } from './farmer.controller';
import type { FarmerSchemaName } from './farmer.schemas';

// Montadas em /api/farmers, depois das rotas '/services/...' (ver src/routes/index.ts).

const farmerId = pathParam('id', 'ID do produtor.');
const farmerOperation = operation<FarmerSchemaName>;

export function farmerRoutes(farmers: FarmerController, access: AccessPolicies): readonly RouteDef[] {
  return [
    route('get', '/', farmers.listFarmers, farmerOperation({
      tag: TAGS.farmers,
      summary: 'Listar produtores',
      success: { status: 200, description: 'Produtores com CPF mascarado.', schema: { listOf: 'Farmer' } }
    }), access.system('users:manage')),

    route('post', '/', farmers.createFarmer, farmerOperation({
      tag: TAGS.farmers,
      summary: 'Cadastrar produtor',
      body: 'FarmerInput',
      success: { status: 201, description: 'Produtor cadastrado.', schema: 'FarmerSignupResponse' },
      errors: {
        400: 'Campo obrigatório faltando; e-mail inválido; CPF inválido; senha fora do tamanho (8 a 128).',
        409: 'Já existe uma conta com este e-mail ou CPF (para ter os dois perfis, use POST /api/accounts/:id/profiles).'
      }
    }), PUBLIC_ROUTE),

    route('get', '/:id', farmers.getFarmer, farmerOperation({
      tag: TAGS.farmers,
      summary: 'Perfil do produtor',
      params: [farmerId],
      success: { status: 200, description: 'Perfil completo (CPF sem máscara).', schema: 'Farmer' },
      errors: { 404: 'Produtor não encontrado.' }
    }), access.ownFarmer()),

    route('patch', '/:id', farmers.updateFarmer, farmerOperation({
      tag: TAGS.farmers,
      summary: 'Editar produtor',
      description: '`id` e `cpf` não podem ser alterados; a senha muda em `PATCH /:id/password`.',
      params: [farmerId],
      body: 'FarmerUpdate',
      success: { status: 200, description: 'Produtor atualizado.', schema: 'FarmerResponse' },
      errors: {
        400: 'Tentou alterar `id`, `cpf` ou `password`; e-mail inválido.',
        404: 'Produtor não encontrado.',
        409: 'E-mail já usado por outra conta.'
      }
    }), access.ownFarmer()),

    route('delete', '/:id', farmers.deleteFarmer, farmerOperation({
      tag: TAGS.farmers,
      summary: 'Remover produtor',
      description: 'Remove também as fazendas, os serviços e as candidaturas desses serviços. Pagamentos ficam como histórico.',
      params: [farmerId],
      success: { status: 200, description: 'Produtor removido.', schema: 'MessageResponse' },
      errors: { 404: 'Produtor não encontrado.', 409: 'O produtor tem serviço `In Progress`.' }
    }), access.ownFarmer())
  ];
}

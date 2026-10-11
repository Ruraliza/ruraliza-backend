import { TAGS, operation, pathParam } from '#shared/infra/docs/operations';
import { type RouteDef, route } from '#shared/infra/http/route';
import type { AccessPolicies } from '../../../http/access';
import type { FarmSchemaName } from './farm.schemas';
import type { FarmController } from './farm.controller';

// Montadas em /api/farmers (junto com as do produtor, ver src/routes/farmerRoutes.ts).

const farmerId = pathParam('id', 'ID do produtor.');
const farmId = pathParam('farmId', 'ID da fazenda (ativa e do produtor da rota).');
const farmOperation = operation<FarmSchemaName>;

export function farmRoutes(farms: FarmController, access: AccessPolicies): readonly RouteDef[] {
  return [
    route('get', '/:id/farms', farms.listFarms, farmOperation({
      tag: TAGS.farms,
      summary: 'Fazendas do produtor',
      description: 'Só as fazendas ativas (as removidas não aparecem).',
      params: [farmerId],
      success: { status: 200, description: 'Fazendas ativas.', schema: { listOf: 'Farm' } },
      errors: { 404: 'Produtor não encontrado.' }
    }), access.ownFarmer()),

    route('post', '/:id/farms', farms.createFarm, farmOperation({
      tag: TAGS.farms,
      summary: 'Cadastrar fazenda',
      params: [farmerId],
      body: 'FarmInput',
      success: { status: 201, description: 'Fazenda cadastrada e adicionada a `farmer.farms`.', schema: 'FarmResponse' },
      errors: { 400: 'Campo obrigatório faltando; latitude/longitude fora da faixa ou não numéricas.', 404: 'Produtor não encontrado.' }
    }), access.ownFarmer()),

    route('patch', '/:id/farms/:farmId', farms.updateFarm, farmOperation({
      tag: TAGS.farms,
      summary: 'Editar fazenda',
      params: [farmerId, farmId],
      body: 'FarmUpdate',
      success: { status: 200, description: 'Fazenda atualizada.', schema: 'FarmResponse' },
      errors: {
        400: 'Tentou alterar `id` ou `farmer_id`; campo enviado vazio; latitude sem longitude (ou o contrário); coordenadas inválidas.',
        404: 'Produtor não encontrado; fazenda não encontrada, removida ou de outro produtor.'
      }
    }), access.ownFarmer()),

    route('delete', '/:id/farms/:farmId', farms.deleteFarm, farmOperation({
      tag: TAGS.farms,
      summary: 'Remover fazenda',
      description:
        'A fazenda é arquivada (`deleted_at`): sai das listas e de `farmer.farms` e não recebe mais serviços, ' +
        'mas os serviços encerrados continuam mostrando onde aconteceram.',
      params: [farmerId, farmId],
      success: { status: 200, description: 'Fazenda removida.', schema: 'MessageResponse' },
      errors: {
        404: 'Produtor não encontrado; fazenda não encontrada, já removida ou de outro produtor.',
        409: 'A fazenda tem serviço `Pending` ou `In Progress`.'
      }
    }), access.ownFarmer())
  ];
}

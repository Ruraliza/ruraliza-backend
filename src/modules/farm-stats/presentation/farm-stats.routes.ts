import type { AccessPolicies } from '#modules/auth';
import type { CoreSchemaName } from '#shared/infra/docs/core.schemas';
import { TAGS, operation, pathParam } from '#shared/infra/docs/operations';
import { type RouteDef, route } from '#shared/infra/http/route';
import type { FarmStatsController } from './farm-stats.controller';
import type { FarmStatsSchemaName } from './farm-stats.schemas';

const statsOperation = operation<FarmStatsSchemaName | CoreSchemaName>;

// Em /api/farmers (antes de '/:id').
export function farmStatsRoutes(stats: FarmStatsController, access: AccessPolicies): readonly RouteDef[] {
  return [
    route('get', '/:id/stats', stats.farmerStats, statsOperation({
      tag: TAGS.farmers,
      summary: 'Painel da fazenda',
      description:
        'Horas e serviços concluídos (com o pagamento liberado, quando o trabalho fica validado), quanto foi pago, quem já ' +
        'trabalhou com o produtor e quem voltou, a nota das fazendas, os últimos 6 meses e as categorias.',
      params: [pathParam('id', 'ID do produtor.')],
      success: { status: 200, description: 'Os números do produtor.', schema: 'FarmerStats' },
      errors: { 404: 'Produtor não encontrado.' }
    }), access.ownFarmer())
  ];
}

import { sendFailure, toId } from '#shared/infra/http/respond';
import type { Handler, IdParams } from '#shared/infra/http/types';
import type { GetFarmerStatsUseCase } from '../application/get-farmer-stats.usecase';
import type { FarmerStats } from '../farm-stats.contract';

export interface FarmStatsController {
  farmerStats: Handler<FarmerStats, IdParams>;
}

export function createFarmStatsController(stats: GetFarmerStatsUseCase): FarmStatsController {
  // GET /api/farmers/:id/stats - Os números da fazenda
  const farmerStats: Handler<FarmerStats, IdParams> = async (req, res) => {
    const result = await stats.execute({ farmerId: toId(req.params.id) });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json(result.value);
  };
  return { farmerStats };
}

import type { MessageResponse } from '#shared/contracts/api';
import { toBody } from '#shared/infra/http/body';
import { sendFailure, toId } from '#shared/infra/http/respond';
import type { FarmParams, Handler, IdParams } from '#shared/infra/http/types';
import type { Farm, FarmResponse } from '../farm.contract';
import type { FarmUseCases } from '../farms.module';
import { parseFarmInput, parseFarmUpdate } from './farm.parsers';

// HTTP das fazendas do produtor.
export interface FarmController {
  listFarms: Handler<Farm[], IdParams>;
  createFarm: Handler<FarmResponse, IdParams>;
  updateFarm: Handler<FarmResponse, FarmParams>;
  deleteFarm: Handler<MessageResponse, FarmParams>;
}

export function createFarmController(farms: FarmUseCases): FarmController {
  // GET /api/farmers/:id/farms - Fazendas ativas do produtor
  const listFarms: Handler<Farm[], IdParams> = async (req, res) => {
    const result = await farms.listFarms.execute({ farmerId: toId(req.params.id) });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json(result.value);
  };

  // POST /api/farmers/:id/farms - Cadastra uma nova fazenda para um produtor
  const createFarm: Handler<FarmResponse, IdParams> = async (req, res) => {
    const input = parseFarmInput(toBody(req.body));
    if (!input.ok) { sendFailure(res, input); return; }

    const result = await farms.createFarm.execute({ farmerId: toId(req.params.id), input: input.value });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(201).json({ message: 'Farm registered successfully!', farm: result.value });
  };

  // PATCH /api/farmers/:id/farms/:farmId - Edita a fazenda (address, city, state)
  const updateFarm: Handler<FarmResponse, FarmParams> = async (req, res) => {
    const changes = parseFarmUpdate(toBody(req.body));
    if (!changes.ok) { sendFailure(res, changes); return; }

    const result = await farms.updateFarm.execute({ farmerId: toId(req.params.id), farmId: toId(req.params.farmId), changes: changes.value });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Farm updated successfully!', farm: result.value });
  };

  // DELETE /api/farmers/:id/farms/:farmId - Remove a fazenda (arquiva, guardando o histórico)
  const deleteFarm: Handler<MessageResponse, FarmParams> = async (req, res) => {
    const result = await farms.deleteFarm.execute({ farmerId: toId(req.params.id), farmId: toId(req.params.farmId) });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Farm deleted successfully!' });
  };

  return { listFarms, createFarm, updateFarm, deleteFarm };
}

import type { Farmer, FarmerResponse, MessageResponse } from '../contracts';
import { toBody } from '../http/body';
import { parseProfileInput, parseProfileUpdate } from '../http/parsers';
import { sendFailure, toId } from '../http/respond';
import type { Handler, IdParams } from '../http/types';
import type { FarmerUseCases } from '../usecases/FarmerUseCases';

// HTTP do cadastro de produtores: lê a requisição, chama o caso de uso, responde.
export interface FarmerController {
  listFarmers: Handler<Farmer[]>;
  createFarmer: Handler<FarmerResponse>;
  getFarmer: Handler<Farmer, IdParams>;
  updateFarmer: Handler<FarmerResponse, IdParams>;
  deleteFarmer: Handler<MessageResponse, IdParams>;
}

export function createFarmerController(farmers: FarmerUseCases): FarmerController {
  // GET /api/farmers - Lista os produtores (CPF mascarado)
  const listFarmers: Handler<Farmer[]> = async (_req, res) => {
    res.status(200).json(await farmers.list());
  };

  // POST /api/farmers - Cadastra um novo produtor
  const createFarmer: Handler<FarmerResponse> = async (req, res) => {
    const input = parseProfileInput(toBody(req.body));
    if (!input.ok) { sendFailure(res, input); return; }

    const result = await farmers.create(input.value);
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(201).json({ message: 'Farmer created successfully!', farmer: result.value });
  };

  // GET /api/farmers/:id - Perfil completo do próprio produtor
  const getFarmer: Handler<Farmer, IdParams> = async (req, res) => {
    const result = await farmers.get(toId(req.params.id));
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json(result.value);
  };

  // PATCH /api/farmers/:id - Edita o produtor (id e cpf não podem ser alterados)
  const updateFarmer: Handler<FarmerResponse, IdParams> = async (req, res) => {
    const changes = parseProfileUpdate(toBody(req.body));
    if (!changes.ok) { sendFailure(res, changes); return; }

    const result = await farmers.update(toId(req.params.id), changes.value);
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Farmer updated successfully!', farmer: result.value });
  };

  // DELETE /api/farmers/:id - Remove o produtor (com fazendas, serviços e candidaturas)
  const deleteFarmer: Handler<MessageResponse, IdParams> = async (req, res) => {
    const result = await farmers.delete(toId(req.params.id));
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Farmer deleted successfully!' });
  };

  return { listFarmers, createFarmer, getFarmer, updateFarmer, deleteFarmer };
}

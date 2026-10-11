import { accountToken, parseProfileInput, parseProfileUpdate } from '#modules/accounts';
import type { SessionTokens } from '#shared/domain/tokens';
import { toBody } from '#shared/infra/http/body';
import { sendFailure, toId } from '#shared/infra/http/respond';
import type { Handler, IdParams } from '#shared/infra/http/types';
import type { MessageResponse } from '../../../contracts';
import type { Farmer, FarmerResponse, FarmerSignupResponse } from '../farmer.contract';
import type { FarmerUseCases } from '../farmers.module';

// HTTP do cadastro de produtores: lê a requisição, chama o caso de uso, responde.
export interface FarmerController {
  listFarmers: Handler<Farmer[]>;
  createFarmer: Handler<FarmerSignupResponse>;
  getFarmer: Handler<Farmer, IdParams>;
  updateFarmer: Handler<FarmerResponse, IdParams>;
  deleteFarmer: Handler<MessageResponse, IdParams>;
}

export function createFarmerController(farmers: FarmerUseCases, tokens: SessionTokens): FarmerController {
  // GET /api/farmers - Lista os produtores (CPF mascarado)
  const listFarmers: Handler<Farmer[]> = async (_req, res) => {
    res.status(200).json(await farmers.listFarmers.execute());
  };

  // POST /api/farmers - Cadastra um novo produtor
  const createFarmer: Handler<FarmerSignupResponse> = async (req, res) => {
    const input = parseProfileInput(toBody(req.body));
    if (!input.ok) { sendFailure(res, input); return; }

    const result = await farmers.registerFarmer.execute(input.value);
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(201).json({ message: 'Farmer created successfully!', farmer: result.value.farmer, user: result.value.user, token: accountToken(tokens, result.value.user) });
  };

  // GET /api/farmers/:id - Perfil completo do próprio produtor
  const getFarmer: Handler<Farmer, IdParams> = async (req, res) => {
    const result = await farmers.getFarmer.execute({ farmerId: toId(req.params.id) });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json(result.value);
  };

  // PATCH /api/farmers/:id - Edita o produtor (id e cpf não podem ser alterados)
  const updateFarmer: Handler<FarmerResponse, IdParams> = async (req, res) => {
    const changes = parseProfileUpdate(toBody(req.body));
    if (!changes.ok) { sendFailure(res, changes); return; }

    const result = await farmers.updateFarmer.execute({ farmerId: toId(req.params.id), changes: changes.value });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Farmer updated successfully!', farmer: result.value });
  };

  // DELETE /api/farmers/:id - Remove o produtor (com fazendas, serviços e candidaturas)
  const deleteFarmer: Handler<MessageResponse, IdParams> = async (req, res) => {
    const result = await farmers.deleteFarmer.execute({ farmerId: toId(req.params.id) });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Farmer deleted successfully!' });
  };

  return { listFarmers, createFarmer, getFarmer, updateFarmer, deleteFarmer };
}

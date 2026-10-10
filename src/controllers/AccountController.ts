import type { SessionResponse, SessionUser } from '../contracts';
import { toBody } from '../http/body';
import { parseActiveRole, parseProfileCreate } from '../http/parsers';
import { sendFailure, toId } from '../http/respond';
import type { Handler, IdParams } from '../http/types';
import type { AccountUseCases } from '../usecases/AccountUseCases';

// HTTP da conta: sessão atual, segundo perfil e troca de painel.
export interface AccountController {
  getAccount: Handler<SessionUser, IdParams>;
  createAccountProfile: Handler<SessionResponse, IdParams>;
  setActiveRole: Handler<SessionResponse, IdParams>;
}

export function createAccountController(accounts: AccountUseCases): AccountController {
  // GET /api/accounts/:id - Sessão da conta (perfis e painel aberto)
  const getAccount: Handler<SessionUser, IdParams> = async (req, res) => {
    const result = await accounts.get(toId(req.params.id));
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json(result.value);
  };

  // POST /api/accounts/:id/profiles - Cria o outro perfil (produtor ou trabalhador) na mesma conta
  const createAccountProfile: Handler<SessionResponse, IdParams> = async (req, res) => {
    const input = parseProfileCreate(toBody(req.body));
    if (!input.ok) { sendFailure(res, input); return; }

    const result = await accounts.addProfile(toId(req.params.id), input.value);
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(201).json({ message: 'Profile created successfully!', user: result.value });
  };

  // PATCH /api/accounts/:id/active-role - Troca o painel aberto
  const setActiveRole: Handler<SessionResponse, IdParams> = async (req, res) => {
    const input = parseActiveRole(toBody(req.body));
    if (!input.ok) { sendFailure(res, input); return; }

    const result = await accounts.setActiveRole(toId(req.params.id), input.value.role);
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Active profile changed successfully!', user: result.value });
  };

  return { getAccount, createAccountProfile, setActiveRole };
}

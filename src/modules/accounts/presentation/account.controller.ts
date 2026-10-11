import { toBody } from '#shared/infra/http/body';
import { sendFailure, toId } from '#shared/infra/http/respond';
import type { Handler, IdParams } from '#shared/infra/http/types';
import type { SessionResponse, SessionUser } from '../accounts.contract';
import type { AccountUseCases } from '../accounts.module';
import { parseActiveRole, parseProfileCreate } from './account.parsers';

// HTTP da conta: sessão atual, segundo perfil e troca de painel. As inscrições de push ficam em src/modules/notifications.
export interface AccountController {
  getAccount: Handler<SessionUser, IdParams>;
  createAccountProfile: Handler<SessionResponse, IdParams>;
  setActiveRole: Handler<SessionResponse, IdParams>;
}

export function createAccountController(accounts: AccountUseCases): AccountController {
  // GET /api/accounts/:id - Sessão da conta (perfis e painel aberto)
  const getAccount: Handler<SessionUser, IdParams> = async (req, res) => {
    const result = await accounts.getAccount.execute({ accountId: toId(req.params.id) });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json(result.value);
  };

  // POST /api/accounts/:id/profiles - Cria o outro perfil (produtor ou trabalhador) na mesma conta
  const createAccountProfile: Handler<SessionResponse, IdParams> = async (req, res) => {
    const input = parseProfileCreate(toBody(req.body));
    if (!input.ok) { sendFailure(res, input); return; }

    const result = await accounts.addProfile.execute({ accountId: toId(req.params.id), input: input.value });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(201).json({ message: 'Profile created successfully!', user: result.value });
  };

  // PATCH /api/accounts/:id/active-role - Troca o painel aberto
  const setActiveRole: Handler<SessionResponse, IdParams> = async (req, res) => {
    const input = parseActiveRole(toBody(req.body));
    if (!input.ok) { sendFailure(res, input); return; }

    const result = await accounts.setActiveRole.execute({ accountId: toId(req.params.id), role: input.value.role });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Active profile changed successfully!', user: result.value });
  };

  return { getAccount, createAccountProfile, setActiveRole };
}

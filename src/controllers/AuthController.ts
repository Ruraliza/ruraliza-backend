import type { LoginResponse, MessageResponse, PasswordResetRequestResponse, SessionUser, SystemLoginResponse, SystemUser, UserRole } from '../contracts';
import type { SessionTokens } from '../domain/tokens';
import { toBody } from '../http/body';
import { parseLoginInput, parsePasswordChange, parsePasswordReset, parsePasswordResetRequest } from '../http/parsers';
import { sendFailure, toId } from '../http/respond';
import type { Handler, IdParams } from '../http/types';
import type { AuthUseCases } from '../usecases/AuthUseCases';
import type { SystemUserUseCases } from '../usecases/SystemUserUseCases';

// HTTP do acesso: login (do app e da equipe), "esqueci a senha" e troca de senha.
export interface AuthController {
  login: Handler<LoginResponse>;
  requestPasswordReset: Handler<PasswordResetRequestResponse>;
  resetPassword: Handler<LoginResponse>;
  changeFarmerPassword: Handler<MessageResponse, IdParams>;
  changeWorkerPassword: Handler<MessageResponse, IdParams>;
  systemLogin: Handler<SystemLoginResponse>;
  getSystemSession: Handler<SystemUser>;
}

// Token da conta aberta (vale para os dois perfis dela).
export function accountToken(tokens: SessionTokens, user: SessionUser): string {
  return tokens.issue({ kind: 'account', id: user.account_id });
}

export function createAuthController(auth: AuthUseCases, systemUsers: SystemUserUseCases, tokens: SessionTokens): AuthController {
  // POST /api/auth/login - Confere e-mail e senha do perfil
  const login: Handler<LoginResponse> = async (req, res) => {
    const input = parseLoginInput(toBody(req.body));
    if (!input.ok) { sendFailure(res, input); return; }

    const result = await auth.login(input.value);
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Logged in successfully!', user: result.value, token: accountToken(tokens, result.value) });
  };

  // POST /api/auth/password-reset - Pede a redefinição (o token iria por e-mail)
  const requestPasswordReset: Handler<PasswordResetRequestResponse> = async (req, res) => {
    const input = parsePasswordResetRequest(toBody(req.body));
    if (!input.ok) { sendFailure(res, input); return; }

    const result = await auth.requestReset(input.value);
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Password reset requested (simulation: the e-mail was not sent).', reset_token: result.value.reset_token });
  };

  // POST /api/auth/password-reset/confirm - Cria a nova senha com o token
  const resetPassword: Handler<LoginResponse> = async (req, res) => {
    const input = parsePasswordReset(toBody(req.body));
    if (!input.ok) { sendFailure(res, input); return; }

    const result = await auth.resetPassword(input.value);
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Password reset successfully!', user: result.value, token: accountToken(tokens, result.value) });
  };

  // PATCH /api/{farmers|workers}/:id/password - Troca a senha confirmando a atual
  type ChangePassword = Handler<MessageResponse, IdParams>;
  const changePassword = async (role: UserRole, req: Parameters<ChangePassword>[0], res: Parameters<ChangePassword>[1]): Promise<void> => {
    const input = parsePasswordChange(toBody(req.body));
    if (!input.ok) { sendFailure(res, input); return; }

    const result = await auth.changePassword(role, toId(req.params.id), input.value);
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Password changed successfully!' });
  };
  // Uma const nomeada por rota: o nome vira o operationId da documentação.
  const changeFarmerPassword: ChangePassword = (req, res) => changePassword('farmer', req, res);
  const changeWorkerPassword: ChangePassword = (req, res) => changePassword('worker', req, res);

  // POST /api/auth/system/login - Login da equipe (administradores e tutores)
  const systemLogin: Handler<SystemLoginResponse> = async (req, res) => {
    const input = parseLoginInput(toBody(req.body));
    if (!input.ok) { sendFailure(res, input); return; }

    const result = await systemUsers.login(input.value);
    if (!result.ok) { sendFailure(res, result); return; }
    const token = tokens.issue({ kind: 'system', id: result.value.id });
    res.status(200).json({ message: 'Logged in successfully!', user: result.value, token });
  };

  // GET /api/auth/system/me - Quem é o usuário de sistema do token (cargo atualizado)
  const getSystemSession: Handler<SystemUser> = async (_req, res) => {
    const principal = res.locals.principal;
    if (principal?.kind !== 'system') throw new Error('GET /auth/system/me sem usuário de sistema: confira o access da rota.');

    const result = await systemUsers.get(principal.user.id);
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json(result.value);
  };

  return { login, requestPasswordReset, resetPassword, changeFarmerPassword, changeWorkerPassword, systemLogin, getSystemSession };
}

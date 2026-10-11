import { accountToken } from '#modules/accounts';
import type { SessionTokens } from '#shared/domain/tokens';
import { toBody } from '#shared/infra/http/body';
import { sendFailure, toId } from '#shared/infra/http/respond';
import type { Handler, IdParams, Principal } from '#shared/infra/http/types';
import type {
  LoginResponse,
  MessageResponse,
  PasswordResetRequestResponse,
  SystemLoginResponse,
  SystemUser,
  SystemUserResponse,
  UserRole
} from '../contracts';
import { parseLoginInput, parsePasswordChange, parsePasswordReset, parsePasswordResetRequest, parseSystemUserUpdate } from '../http/parsers';
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
  updateSystemProfile: Handler<SystemUserResponse>;
}

// Id do usuário de sistema que fez a requisição. Só nas rotas com acesso de sistema: sem ele, é bug na rota.
export function systemUserId(principal: Principal | undefined): number {
  if (principal?.kind !== 'system') throw new Error('Rota de usuário de sistema sem usuário de sistema: confira o access da rota.');
  return principal.user.id;
}

// Token da conta aberta (vale para os dois perfis dela).
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
    const result = await systemUsers.get(systemUserId(res.locals.principal));
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json(result.value);
  };

  // PATCH /api/auth/system/me - O usuário de sistema edita o próprio perfil (nome e e-mail)
  const updateSystemProfile: Handler<SystemUserResponse> = async (req, res) => {
    const changes = parseSystemUserUpdate(toBody(req.body));
    if (!changes.ok) { sendFailure(res, changes); return; }

    const result = await systemUsers.updateOwn(systemUserId(res.locals.principal), changes.value);
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Profile updated successfully!', system_user: result.value });
  };

  return {
    login,
    requestPasswordReset,
    resetPassword,
    changeFarmerPassword,
    changeWorkerPassword,
    systemLogin,
    getSystemSession,
    updateSystemProfile
  };
}

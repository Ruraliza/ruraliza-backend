import type { UserRole } from '#modules/accounts';
import { accountToken } from '#modules/accounts';
import type { MessageResponse } from '#shared/contracts/api';
import type { SessionTokens } from '#shared/domain/tokens';
import { toBody } from '#shared/infra/http/body';
import { sendFailure, toId } from '#shared/infra/http/respond';
import type { Handler, IdParams } from '#shared/infra/http/types';
import type { LoginResponse, PasswordResetRequestResponse } from '../auth.contract';

import { parseLoginInput, parsePasswordChange, parsePasswordReset, parsePasswordResetRequest } from './auth.parsers';
import type { AuthUseCases } from '../auth.module';

// HTTP do acesso: login do app, "esqueci a senha" e troca de senha. O login da equipe fica em src/modules/system-users.
export interface AuthController {
  login: Handler<LoginResponse>;
  requestPasswordReset: Handler<PasswordResetRequestResponse>;
  resetPassword: Handler<LoginResponse>;
  changeFarmerPassword: Handler<MessageResponse, IdParams>;
  changeWorkerPassword: Handler<MessageResponse, IdParams>;
}

// A mesma resposta com e sem conta para o e-mail.
const PASSWORD_RESET_REQUESTED = 'If this e-mail has an account, a reset code will be sent to it.';

// Token da conta aberta (vale para os dois perfis dela).
export function createAuthController(auth: AuthUseCases, tokens: SessionTokens): AuthController {
  // POST /api/auth/login - Confere e-mail e senha do perfil
  const login: Handler<LoginResponse> = async (req, res) => {
    const input = parseLoginInput(toBody(req.body));
    if (!input.ok) { sendFailure(res, input); return; }

    const result = await auth.login.execute(input.value);
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Logged in successfully!', user: result.value, token: accountToken(tokens, result.value) });
  };

  // POST /api/auth/password-reset - Pede a redefinição (o código vai só para o dono do e-mail)
  const requestPasswordReset: Handler<PasswordResetRequestResponse> = async (req, res) => {
    const input = parsePasswordResetRequest(toBody(req.body));
    if (!input.ok) { sendFailure(res, input); return; }

    await auth.requestPasswordReset.execute(input.value);
    res.status(200).json({ message: PASSWORD_RESET_REQUESTED });
  };

  // POST /api/auth/password-reset/confirm - Cria a nova senha com o token
  const resetPassword: Handler<LoginResponse> = async (req, res) => {
    const input = parsePasswordReset(toBody(req.body));
    if (!input.ok) { sendFailure(res, input); return; }

    const result = await auth.resetPassword.execute(input.value);
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Password reset successfully!', user: result.value, token: accountToken(tokens, result.value) });
  };

  // PATCH /api/{farmers|workers}/:id/password - Troca a senha confirmando a atual
  type ChangePassword = Handler<MessageResponse, IdParams>;
  const changePassword = async (role: UserRole, req: Parameters<ChangePassword>[0], res: Parameters<ChangePassword>[1]): Promise<void> => {
    const input = parsePasswordChange(toBody(req.body));
    if (!input.ok) { sendFailure(res, input); return; }

    const result = await auth.changePassword.execute({ role, profileId: toId(req.params.id), input: input.value });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Password changed successfully!' });
  };
  // Uma const nomeada por rota: o nome vira o operationId da documentação.
  const changeFarmerPassword: ChangePassword = (req, res) => changePassword('farmer', req, res);
  const changeWorkerPassword: ChangePassword = (req, res) => changePassword('worker', req, res);

  return {
    login,
    requestPasswordReset,
    resetPassword,
    changeFarmerPassword,
    changeWorkerPassword
  };
}

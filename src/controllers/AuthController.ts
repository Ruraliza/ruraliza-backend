import type { LoginResponse, MessageResponse, PasswordResetRequestResponse, UserRole } from '../contracts';
import { toBody } from '../http/body';
import { parseLoginInput, parsePasswordChange, parsePasswordReset, parsePasswordResetRequest } from '../http/parsers';
import { sendFailure, toId } from '../http/respond';
import type { Handler, IdParams } from '../http/types';
import type { AuthUseCases } from '../usecases/AuthUseCases';

// HTTP do acesso: login, "esqueci a senha" e troca de senha.
export interface AuthController {
  login: Handler<LoginResponse>;
  requestPasswordReset: Handler<PasswordResetRequestResponse>;
  resetPassword: Handler<LoginResponse>;
  changeFarmerPassword: Handler<MessageResponse, IdParams>;
  changeWorkerPassword: Handler<MessageResponse, IdParams>;
}

export function createAuthController(auth: AuthUseCases): AuthController {
  // POST /api/auth/login - Confere e-mail e senha do perfil
  const login: Handler<LoginResponse> = async (req, res) => {
    const input = parseLoginInput(toBody(req.body));
    if (!input.ok) { sendFailure(res, input); return; }

    const result = await auth.login(input.value);
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Logged in successfully!', user: result.value });
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
    res.status(200).json({ message: 'Password reset successfully!', user: result.value });
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

  return { login, requestPasswordReset, resetPassword, changeFarmerPassword, changeWorkerPassword };
}

import { parseLoginInput } from '#modules/auth';
import type { SessionTokens } from '#shared/domain/tokens';
import { toBody } from '#shared/infra/http/body';
import { sendFailure, toId } from '#shared/infra/http/respond';
import type { Handler, IdParams } from '#shared/infra/http/types';
import type { SystemLoginResponse, SystemUser, SystemUserResponse } from '../system-user.contract';
import type { SystemUserUseCases } from '../system-users.module';
import { systemUserId } from './system-principal';
import { parseAdminSystemUserUpdate, parseSystemUserInput, parseSystemUserUpdate } from './system-user.parsers';

// HTTP da equipe: login e perfil próprio (em /api/auth/system) e o cadastro feito pelo
// administrador (em /api/admin/system-users).
export interface SystemUserController {
  systemLogin: Handler<SystemLoginResponse>;
  getSystemSession: Handler<SystemUser>;
  updateSystemProfile: Handler<SystemUserResponse>;
  listSystemUsers: Handler<SystemUser[]>;
  createSystemUser: Handler<SystemUserResponse>;
  getSystemUser: Handler<SystemUser, IdParams>;
  updateSystemUser: Handler<SystemUserResponse, IdParams>;
}

export function createSystemUserController(systemUsers: SystemUserUseCases, tokens: SessionTokens): SystemUserController {
  // POST /api/auth/system/login - Login da equipe (administradores e tutores)
  const systemLogin: Handler<SystemLoginResponse> = async (req, res) => {
    const input = parseLoginInput(toBody(req.body));
    if (!input.ok) { sendFailure(res, input); return; }

    const result = await systemUsers.systemLogin.execute(input.value);
    if (!result.ok) { sendFailure(res, result); return; }
    const token = tokens.issue({ kind: 'system', id: result.value.id });
    res.status(200).json({ message: 'Logged in successfully!', user: result.value, token });
  };

  // GET /api/auth/system/me - Quem é o usuário de sistema do token (cargo atualizado)
  const getSystemSession: Handler<SystemUser> = async (_req, res) => {
    const result = await systemUsers.getSystemUser.execute({ systemUserId: systemUserId(res.locals.principal) });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json(result.value);
  };

  // PATCH /api/auth/system/me - O usuário de sistema edita o próprio perfil (nome e e-mail)
  const updateSystemProfile: Handler<SystemUserResponse> = async (req, res) => {
    const changes = parseSystemUserUpdate(toBody(req.body));
    if (!changes.ok) { sendFailure(res, changes); return; }

    const result = await systemUsers.updateOwnSystemUser.execute({ systemUserId: systemUserId(res.locals.principal), changes: changes.value });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Profile updated successfully!', system_user: result.value });
  };

  // GET /api/admin/system-users - A equipe (administradores e tutores)
  const listSystemUsers: Handler<SystemUser[]> = async (_req, res) => {
    res.status(200).json(await systemUsers.listSystemUsers.execute());
  };

  // POST /api/admin/system-users - Cadastra um usuário de sistema
  const createSystemUser: Handler<SystemUserResponse> = async (req, res) => {
    const input = parseSystemUserInput(toBody(req.body));
    if (!input.ok) { sendFailure(res, input); return; }

    const result = await systemUsers.createSystemUser.execute(input.value);
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(201).json({ message: 'System user created successfully!', system_user: result.value });
  };

  // GET /api/admin/system-users/:id - Um usuário de sistema
  const getSystemUser: Handler<SystemUser, IdParams> = async (req, res) => {
    const result = await systemUsers.getSystemUser.execute({ systemUserId: toId(req.params.id) });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json(result.value);
  };

  // PATCH /api/admin/system-users/:id - Edita nome, e-mail e cargo (o próprio cargo não)
  const updateSystemUser: Handler<SystemUserResponse, IdParams> = async (req, res) => {
    const changes = parseAdminSystemUserUpdate(toBody(req.body));
    if (!changes.ok) { sendFailure(res, changes); return; }

    const result = await systemUsers.updateSystemUserByAdmin.execute({
      actorId: systemUserId(res.locals.principal), systemUserId: toId(req.params.id), changes: changes.value
    });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'System user updated successfully!', system_user: result.value });
  };

  return { systemLogin, getSystemSession, updateSystemProfile, listSystemUsers, createSystemUser, getSystemUser, updateSystemUser };
}

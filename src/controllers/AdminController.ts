import { parseProfileUpdate } from '#modules/accounts';
import type { FarmerUseCases } from '#modules/farmers';
import type { PhotoUseCases } from '#modules/media';
import { toBody } from '#shared/infra/http/body';
import { sendFailure, toId } from '#shared/infra/http/respond';
import type { Handler, IdParams } from '#shared/infra/http/types';
import type { AdminUser, FarmerResponse, MessageResponse, SystemUser, SystemUserResponse, WorkerResponse } from '../contracts';
import { parseAdminSystemUserUpdate, parseSystemUserInput, parseWorkerUpdate } from '../http/parsers';
import type { AdminUseCases } from '../usecases/AdminUseCases';
import type { SystemUserUseCases } from '../usecases/SystemUserUseCases';
import type { WorkerUseCases } from '../usecases/WorkerUseCases';
import { systemUserId } from './AuthController';

// HTTP da administração: contas do app (lista, edição, remoção) e equipe (usuários de sistema).
export interface AdminController {
  listUsers: Handler<AdminUser[]>;
  getUser: Handler<AdminUser, IdParams>;
  deleteUser: Handler<MessageResponse, IdParams>;
  adminUpdateFarmer: Handler<FarmerResponse, IdParams>;
  adminDeleteFarmer: Handler<MessageResponse, IdParams>;
  adminDeleteFarmerPhoto: Handler<FarmerResponse, IdParams>;
  adminUpdateWorker: Handler<WorkerResponse, IdParams>;
  adminDeleteWorker: Handler<MessageResponse, IdParams>;
  adminDeleteWorkerPhoto: Handler<WorkerResponse, IdParams>;
  listSystemUsers: Handler<SystemUser[]>;
  createSystemUser: Handler<SystemUserResponse>;
  getSystemUser: Handler<SystemUser, IdParams>;
  updateSystemUser: Handler<SystemUserResponse, IdParams>;
}

export interface AdminControllerUseCases {
  admin: AdminUseCases;
  farmers: FarmerUseCases;
  workers: WorkerUseCases;
  photos: PhotoUseCases;
  systemUsers: SystemUserUseCases;
}

export function createAdminController({ admin, farmers, workers, photos, systemUsers }: AdminControllerUseCases): AdminController {
  // GET /api/admin/users - Todas as contas com os perfis (CPF mascarado)
  const listUsers: Handler<AdminUser[]> = async (_req, res) => {
    res.status(200).json(await admin.listUsers());
  };

  // GET /api/admin/users/:id - Uma conta com os perfis completos
  const getUser: Handler<AdminUser, IdParams> = async (req, res) => {
    const result = await admin.getUser(toId(req.params.id));
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json(result.value);
  };

  // DELETE /api/admin/users/:id - Remove a conta e os dois perfis
  const deleteUser: Handler<MessageResponse, IdParams> = async (req, res) => {
    const result = await admin.deleteUser(toId(req.params.id));
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Account deleted successfully!' });
  };

  // PATCH /api/admin/farmers/:id - Edita o perfil de produtor
  const adminUpdateFarmer: Handler<FarmerResponse, IdParams> = async (req, res) => {
    const changes = parseProfileUpdate(toBody(req.body));
    if (!changes.ok) { sendFailure(res, changes); return; }

    const result = await farmers.updateFarmer.execute({ farmerId: toId(req.params.id), changes: changes.value });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Farmer updated successfully!', farmer: result.value });
  };

  // DELETE /api/admin/farmers/:id - Remove o perfil de produtor (a conta fica se tiver o outro perfil)
  const adminDeleteFarmer: Handler<MessageResponse, IdParams> = async (req, res) => {
    const result = await farmers.deleteFarmer.execute({ farmerId: toId(req.params.id) });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Farmer deleted successfully!' });
  };

  // DELETE /api/admin/farmers/:id/photo - Remove a foto de perfil do produtor (ex.: imagem imprópria)
  const adminDeleteFarmerPhoto: Handler<FarmerResponse, IdParams> = async (req, res) => {
    const result = await photos.removeFarmerPhoto.execute({ farmerId: toId(req.params.id) });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Farmer photo removed successfully!', farmer: result.value });
  };

  // PATCH /api/admin/workers/:id - Edita o perfil de trabalhador
  const adminUpdateWorker: Handler<WorkerResponse, IdParams> = async (req, res) => {
    const changes = parseWorkerUpdate(toBody(req.body));
    if (!changes.ok) { sendFailure(res, changes); return; }

    const result = await workers.update(toId(req.params.id), changes.value);
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Worker updated successfully!', worker: result.value });
  };

  // DELETE /api/admin/workers/:id - Remove o perfil de trabalhador (a conta fica se tiver o outro perfil)
  const adminDeleteWorker: Handler<MessageResponse, IdParams> = async (req, res) => {
    const result = await workers.delete(toId(req.params.id));
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Worker deleted successfully!' });
  };

  // DELETE /api/admin/workers/:id/photo - Remove a foto de perfil do trabalhador (ex.: imagem imprópria)
  const adminDeleteWorkerPhoto: Handler<WorkerResponse, IdParams> = async (req, res) => {
    const result = await photos.removeWorkerPhoto.execute({ workerId: toId(req.params.id) });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Worker photo removed successfully!', worker: result.value });
  };

  // GET /api/admin/system-users - A equipe (administradores e tutores)
  const listSystemUsers: Handler<SystemUser[]> = async (_req, res) => {
    res.status(200).json(await systemUsers.list());
  };

  // POST /api/admin/system-users - Cadastra um usuário de sistema
  const createSystemUser: Handler<SystemUserResponse> = async (req, res) => {
    const input = parseSystemUserInput(toBody(req.body));
    if (!input.ok) { sendFailure(res, input); return; }

    const result = await systemUsers.create(input.value);
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(201).json({ message: 'System user created successfully!', system_user: result.value });
  };

  // GET /api/admin/system-users/:id - Um usuário de sistema
  const getSystemUser: Handler<SystemUser, IdParams> = async (req, res) => {
    const result = await systemUsers.get(toId(req.params.id));
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json(result.value);
  };

  // PATCH /api/admin/system-users/:id - Edita nome, e-mail e cargo (o próprio cargo não)
  const updateSystemUser: Handler<SystemUserResponse, IdParams> = async (req, res) => {
    const changes = parseAdminSystemUserUpdate(toBody(req.body));
    if (!changes.ok) { sendFailure(res, changes); return; }

    const result = await systemUsers.updateByAdmin(systemUserId(res.locals.principal), toId(req.params.id), changes.value);
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'System user updated successfully!', system_user: result.value });
  };

  return {
    listUsers,
    getUser,
    deleteUser,
    adminUpdateFarmer,
    adminDeleteFarmer,
    adminDeleteFarmerPhoto,
    adminUpdateWorker,
    adminDeleteWorker,
    adminDeleteWorkerPhoto,
    listSystemUsers,
    createSystemUser,
    getSystemUser,
    updateSystemUser
  };
}

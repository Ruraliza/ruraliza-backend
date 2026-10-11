import { parseProfileUpdate } from '#modules/accounts';
import type { FarmerResponse } from '#modules/farmers';
import { parseWorkerUpdate } from '#modules/workers';
import type { WorkerResponse } from '#modules/workers';
import type { MessageResponse } from '#shared/contracts/api';
import { toBody } from '#shared/infra/http/body';
import { sendFailure, toId } from '#shared/infra/http/respond';
import type { Handler, IdParams } from '#shared/infra/http/types';
import type { AdminUser } from '../admin.contract';
import type { AdminRouteUseCases } from '../admin.module';

// HTTP da administração das contas do app (lista, edição, remoção). A equipe fica em src/modules/system-users.
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
}

export function createAdminController({ admin, farmers, workers, photos }: AdminRouteUseCases): AdminController {
  // GET /api/admin/users - Todas as contas com os perfis (CPF mascarado)
  const listUsers: Handler<AdminUser[]> = async (_req, res) => {
    res.status(200).json(await admin.listAccounts.execute());
  };

  // GET /api/admin/users/:id - Uma conta com os perfis completos
  const getUser: Handler<AdminUser, IdParams> = async (req, res) => {
    const result = await admin.getAccountDetail.execute({ accountId: toId(req.params.id) });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json(result.value);
  };

  // DELETE /api/admin/users/:id - Remove a conta e os dois perfis
  const deleteUser: Handler<MessageResponse, IdParams> = async (req, res) => {
    const result = await admin.deleteAccount.execute({ accountId: toId(req.params.id) });
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

    const result = await workers.updateWorker.execute({ workerId: toId(req.params.id), changes: changes.value });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Worker updated successfully!', worker: result.value });
  };

  // DELETE /api/admin/workers/:id - Remove o perfil de trabalhador (a conta fica se tiver o outro perfil)
  const adminDeleteWorker: Handler<MessageResponse, IdParams> = async (req, res) => {
    const result = await workers.deleteWorker.execute({ workerId: toId(req.params.id) });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Worker deleted successfully!' });
  };

  // DELETE /api/admin/workers/:id/photo - Remove a foto de perfil do trabalhador (ex.: imagem imprópria)
  const adminDeleteWorkerPhoto: Handler<WorkerResponse, IdParams> = async (req, res) => {
    const result = await photos.removeWorkerPhoto.execute({ workerId: toId(req.params.id) });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Worker photo removed successfully!', worker: result.value });
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
    adminDeleteWorkerPhoto
  };
}

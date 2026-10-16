import type { UserRole } from '#modules/accounts';
import { toBody } from '#shared/infra/http/body';
import { sendFailure, toId } from '#shared/infra/http/respond';
import type { Handler, IdParams } from '#shared/infra/http/types';
import type { AdminVerification, AdminVerificationResponse, Verification, VerificationResponse } from '../verification.contract';
import type { VerificationUseCases } from '../verification.module';
import { parseDocumentType, parseVerificationReview, parseVerificationStatusQuery, readDocumentUpload } from './verification.parsers';

// HTTP da verificação de identidade: o próprio perfil envia e acompanha; a equipe confere e decide.
// O upload chega como o próprio arquivo no corpo (Content-Type image/*), lido pelo express.raw em app.ts.
export interface VerificationController {
  farmerVerification: Handler<Verification, IdParams>;
  workerVerification: Handler<Verification, IdParams>;
  submitFarmerVerification: Handler<VerificationResponse, IdParams>;
  submitWorkerVerification: Handler<VerificationResponse, IdParams>;
  listVerifications: Handler<AdminVerification[]>;
  getVerificationDocument: Handler<Buffer, IdParams>;
  reviewVerification: Handler<AdminVerificationResponse, IdParams>;
}

type Req = Parameters<Handler<never, IdParams>>[0];
type Res<T> = Parameters<Handler<T, IdParams>>[1];

export function createVerificationController(useCases: VerificationUseCases): VerificationController {
  async function show(role: UserRole, req: Req, res: Res<Verification>): Promise<void> {
    const result = await useCases.get.execute({ role, profileId: toId(req.params.id) });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json(result.value);
  }

  async function submit(role: UserRole, req: Req, res: Res<VerificationResponse>): Promise<void> {
    const documentType = parseDocumentType(req.query['document_type']);
    if (!documentType.ok) { sendFailure(res, documentType); return; }
    const upload = readDocumentUpload(req.body);
    if (!upload.ok) { sendFailure(res, upload); return; }
    const result = await useCases.submit.execute({ role, profileId: toId(req.params.id), documentType: documentType.value, upload: upload.value });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(201).json({ message: 'Verification requested.', verification: result.value });
  }

  // GET /api/farmers/:id/verification - Situação da verificação do produtor
  const farmerVerification: Handler<Verification, IdParams> = (req, res) => show('farmer', req, res);

  // GET /api/workers/:id/verification - Situação da verificação do trabalhador
  const workerVerification: Handler<Verification, IdParams> = (req, res) => show('worker', req, res);

  // POST /api/farmers/:id/verification?document_type= - O produtor envia o documento
  const submitFarmerVerification: Handler<VerificationResponse, IdParams> = (req, res) => submit('farmer', req, res);

  // POST /api/workers/:id/verification?document_type= - O trabalhador envia o documento
  const submitWorkerVerification: Handler<VerificationResponse, IdParams> = (req, res) => submit('worker', req, res);

  // GET /api/admin/verifications?status= - Fila da equipe
  const listVerifications: Handler<AdminVerification[]> = async (req, res) => {
    const status = parseVerificationStatusQuery(req.query['status']);
    if (!status.ok) { sendFailure(res, status); return; }
    res.status(200).json(await useCases.list.execute({ status: status.value }));
  };

  // GET /api/admin/verifications/:id/document - A foto do documento (só enquanto está em análise)
  const getVerificationDocument: Handler<Buffer, IdParams> = async (req, res) => {
    const result = await useCases.document.execute({ id: toId(req.params.id) });
    if (!result.ok) { sendFailure(res, result); return; }
    res.setHeader('Content-Type', result.value.contentType);
    res.setHeader('Cache-Control', 'private, no-store');
    res.status(200).send(Buffer.from(result.value.bytes));
  };

  // PATCH /api/admin/verifications/:id - Aprova ou recusa
  const reviewVerification: Handler<AdminVerificationResponse, IdParams> = async (req, res) => {
    const input = parseVerificationReview(toBody(req.body));
    if (!input.ok) { sendFailure(res, input); return; }
    const result = await useCases.review.execute({ id: toId(req.params.id), input: input.value });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Verification reviewed.', verification: result.value });
  };

  return { farmerVerification, workerVerification, submitFarmerVerification, submitWorkerVerification, listVerifications, getVerificationDocument, reviewVerification };
}

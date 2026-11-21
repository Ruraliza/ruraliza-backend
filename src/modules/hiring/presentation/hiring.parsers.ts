import { blockedTermProblem } from '#shared/domain/moderation';
import { type Result, invalid, ok } from '#shared/domain/result';
import { PRICE_UNITS, isPriceUnit } from '#modules/services';
import type { Body } from '#shared/infra/http/body';
import type { Principal } from '#shared/infra/http/types';
import { MAX_HIRING_NOTE } from '../domain/hiring.rules';
import type { NegotiationViewer } from '../application/negotiation';
import type { AnalyzeAction, AnalyzeInput, ApplyInput, PaymentInput, ProposalAnswerInput, ProposalInput, WorkerActionInput } from '../hiring.contract';

// Formato dos corpos das rotas de contratação (400). Regras que dependem dos dados ficam nos casos de uso.

const ANALYZE_ACTIONS: readonly AnalyzeAction[] = ['Accept', 'Reject'];

function isAnalyzeAction(value: unknown): value is AnalyzeAction {
  return ANALYZE_ACTIONS.some((action) => action === value);
}

export function parseAnalyzeInput(body: Body): Result<AnalyzeInput> {
  const { application_id, action } = body;
  if (!isAnalyzeAction(action)) return invalid("A ação deve ser 'Accept' ou 'Reject'.");
  if (!application_id) return invalid('Informe o application_id.');
  return ok({ application_id: Number(application_id), action });
}

export function parseWorkerAction(body: Body): Result<WorkerActionInput> {
  const workerId = body['worker_id'];
  if (!workerId) return invalid('Informe o worker_id.');
  return ok({ worker_id: Number(workerId) });
}

// Texto curto opcional (mensagem da candidatura, observações da proposta): vazio vira ausente.
export function parseNote(value: unknown, label: string, where: string): Result<string | undefined> {
  if (value === undefined || value === null) return ok(undefined);
  if (typeof value !== 'string') return invalid(`${label} deve ser um texto.`);
  const note = value.trim();
  if (!note) return ok(undefined);
  if (note.length > MAX_HIRING_NOTE) return invalid(`${label} pode ter no máximo ${MAX_HIRING_NOTE} caracteres.`);
  const offensive = blockedTermProblem(where, note);
  return offensive ? invalid(offensive) : ok(note);
}

export function parseApplyInput(body: Body): Result<ApplyInput> {
  const worker = parseWorkerAction(body);
  if (!worker.ok) return worker;
  const message = parseNote(body['message'], 'A mensagem', 'na mensagem');
  if (!message.ok) return message;
  return ok(message.value === undefined ? worker.value : { ...worker.value, message: message.value });
}

// Proposta: valor maior que zero (até R$ 1.000.000 por unidade), unidade da lista e observações opcionais
// (até 300 caracteres, sem palavrões). Forma e momento do pagamento não existem mais: se vierem, são ignorados.
export function parseProposalInput(body: Body): Result<ProposalInput> {
  const amount = body['amount'];
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
    return invalid('O valor deve ser um número maior que zero (até R$ 1.000.000).');
  }
  const unit = body['unit'];
  if (!isPriceUnit(unit)) return invalid(`unit inválida. Use uma destas: ${PRICE_UNITS.join(', ')}.`);
  const notes = parseNote(body['notes'], 'As observações', 'nas observações');
  if (!notes.ok) return notes;
  return ok({ amount: Math.round(amount * 100) / 100, unit, notes: notes.value ?? null });
}

// Pagamento: o total em R$ que o produtor libera (maior que zero, até R$ 10.000.000).
export function parsePaymentInput(body: Body): Result<PaymentInput> {
  const value = body['value'];
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 10_000_000) {
    return invalid('Informe o valor total do pagamento: um número maior que zero.');
  }
  return ok({ value: Math.round(value * 100) / 100 });
}

export function parseProposalAnswer(body: Body): Result<ProposalAnswerInput> {
  const action = body['action'];
  if (action !== 'Accept' && action !== 'Decline') return invalid("A ação deve ser 'Accept' ou 'Decline'.");
  return ok({ action });
}

// Os perfis da conta que fez a requisição (a rota exige uma conta do app).
export function viewerOf(principal: Principal | undefined): NegotiationViewer {
  if (principal?.kind !== 'account') return { farmerId: null, workerId: null };
  return { farmerId: principal.account.farmer_id, workerId: principal.account.worker_id };
}

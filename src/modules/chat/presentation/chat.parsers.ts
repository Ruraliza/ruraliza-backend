import { type Result, invalid, ok } from '#shared/domain/result';
import type { Body } from '#shared/infra/http/body';
import type { Principal } from '#shared/infra/http/types';
import { tooLong } from '#shared/utils/validation';
import type { ChatMessageInput, ChatPhoneInput } from '../chat.contract';
import { type ChatViewer, MAX_CHAT_MESSAGE } from '../domain/chat.rules';

// Formato dos corpos das rotas de conversa (400).

export function parseChatMessage(body: Body): Result<ChatMessageInput> {
  const raw = body['body'];
  if (typeof raw !== 'string' || raw.trim() === '') return invalid('Escreva a mensagem.');
  const text = raw.trim();
  const problem = tooLong('A mensagem', text, MAX_CHAT_MESSAGE);
  return problem ? invalid(problem) : ok({ body: text });
}

export function parseChatPhone(body: Body): Result<ChatPhoneInput> {
  const share = body['share'];
  if (typeof share !== 'boolean') return invalid('Informe share: true (liberar) ou false (deixar de compartilhar).');
  return ok({ share });
}

// Os perfis da conta que fez a requisição (a rota exige uma conta do app).
export function viewerOf(principal: Principal | undefined): ChatViewer {
  if (principal?.kind !== 'account') return { farmerId: null, workerId: null };
  return { farmerId: principal.account.farmer_id, workerId: principal.account.worker_id };
}

import type { ServerResponse } from 'node:http';

// Server-Sent Events: a resposta fica aberta e o servidor escreve um evento a cada mudança.
// O navegador escuta com EventSource, que reconecta sozinho se a conexão cair.

// Nome do evento enviado quando as candidaturas mudam (o frontend busca a lista de novo).
export const APPLICATIONS_CHANGED_EVENT = 'applications';
// Chegou mensagem (ou mudou o WhatsApp liberado) numa conversa aberta na tela.
export const CHAT_CHANGED_EVENT = 'chat';
// Alguma conversa do perfil mudou (mensagem nova, lida, aberta ou encerrada): lista e contador do menu.
export const CHATS_CHANGED_EVENT = 'chats';

// Comentário periódico: mantém a conexão viva atrás de proxies que cortam conexões ociosas.
const HEARTBEAT_MS = 25_000;
// Espera sugerida ao EventSource antes de reconectar.
const RETRY_MS = 3_000;

// Abre o stream e chama `onClose` quando o cliente desconecta (fechou a aba, saiu da tela).
export function openEventStream(res: ServerResponse, onClose: () => void): void {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no' // nginx: não segurar os eventos em buffer
  });
  res.write(`retry: ${RETRY_MS}\n\n`);

  const heartbeat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS);
  res.on('close', () => {
    clearInterval(heartbeat);
    onClose();
  });
}

// O EventSource só entrega eventos com `data`, por isso vai um objeto vazio.
export function sendEvent(res: ServerResponse, event: string): void {
  res.write(`event: ${event}\ndata: {}\n\n`);
}

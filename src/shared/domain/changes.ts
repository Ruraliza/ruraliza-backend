// Avisos de mudança para quem acompanha uma tela aberta (enviados por SSE, ver src/shared/infra/http/sse.ts).
// O aviso não carrega dados: quem escuta busca a lista de novo pela rota de sempre.
//
// Canais:
// - candidaturas de um serviço (tela do produtor): `serviceApplications(serviceId)`;
// - candidaturas de um trabalhador (tela "Candidaturas"): `workerApplications(workerId)`;
// - mensagens de uma conversa (tela da conversa): `chatMessages(chatId)`;
// - lista de conversas de um perfil (tela "Conversas" e o contador do menu): `profileChats(role, id)`;
// - avisos de um perfil (central de notificações e o sino da barra de cima): `profileNotifications(role, id)`.
export type ChangeTopic =
  | `service:${number}:applications`
  | `worker:${number}:applications`
  | `chat:${number}`
  | `farmer:${number}:chats`
  | `worker:${number}:chats`
  | `farmer:${number}:notifications`
  | `worker:${number}:notifications`;

export const serviceApplications = (serviceId: number): ChangeTopic => `service:${serviceId}:applications`;
export const workerApplications = (workerId: number): ChangeTopic => `worker:${workerId}:applications`;
export const chatMessages = (chatId: number): ChangeTopic => `chat:${chatId}`;
export const profileChats = (role: 'farmer' | 'worker', profileId: number): ChangeTopic => `${role}:${profileId}:chats`;
export const profileNotifications = (role: 'farmer' | 'worker', profileId: number): ChangeTopic => `${role}:${profileId}:notifications`;

export type ChangeListener = () => void;

// TODO(db): em memória só vale para um processo. Com mais de uma instância da API,
// troque por algo compartilhado (ex.: LISTEN/NOTIFY do PostgreSQL ou Redis pub/sub).
export interface ChangeFeed {
  publish(topics: Iterable<ChangeTopic>): void;
  // Devolve a função que cancela a inscrição.
  subscribe(topic: ChangeTopic, listener: ChangeListener): () => void;
}

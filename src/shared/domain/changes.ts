// Avisos de mudança para quem acompanha uma tela aberta (enviados por SSE, ver src/http/sse.ts).
// O aviso não carrega dados: quem escuta busca a lista de novo pela rota de sempre.
//
// Canais:
// - candidaturas de um serviço (tela do produtor): `serviceApplications(serviceId)`;
// - candidaturas de um trabalhador (tela "Candidaturas"): `workerApplications(workerId)`.
export type ChangeTopic = `service:${number}:applications` | `worker:${number}:applications`;

export const serviceApplications = (serviceId: number): ChangeTopic => `service:${serviceId}:applications`;
export const workerApplications = (workerId: number): ChangeTopic => `worker:${workerId}:applications`;

export type ChangeListener = () => void;

// TODO(db): em memória só vale para um processo. Com mais de uma instância da API,
// troque por algo compartilhado (ex.: LISTEN/NOTIFY do PostgreSQL ou Redis pub/sub).
export interface ChangeFeed {
  publish(topics: Iterable<ChangeTopic>): void;
  // Devolve a função que cancela a inscrição.
  subscribe(topic: ChangeTopic, listener: ChangeListener): () => void;
}

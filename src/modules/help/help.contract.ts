// Central de ajuda: perguntas frequentes que a equipe do Ruraliza edita sem mexer no código (issue #34).

// Tema de cada pergunta, na ordem em que aparecem na tela.
export type HelpTopic = 'comecar' | 'produtores' | 'trabalhadores' | 'pagamentos' | 'seguranca' | 'trilhas' | 'conta';

export interface HelpArticle {
  id: number;
  question: string;
  answer: string; // texto simples; quebras de linha viram parágrafos
  topic: HelpTopic;
  position: number; // ordem dentro do tema (menor primeiro)
  published: boolean; // rascunho não aparece na central pública
  updated_at: string; // ISO 8601
}

// POST /admin/help
export interface HelpArticleInput {
  question: string;
  answer: string;
  topic: HelpTopic;
  published?: boolean; // padrão: true
}

// PATCH /admin/help/:id (só o que mudou)
export type HelpArticleUpdate = Partial<HelpArticleInput>;

// PATCH /admin/help/:id/move
export interface HelpArticleMoveInput {
  direction: 'up' | 'down';
}

export interface HelpArticleResponse {
  message: string;
  article: HelpArticle;
}

import type { Repository } from '#shared/domain/repository';
import type { AccountPreferences, UserRole } from '../accounts.contract';

// Conta de acesso: um e-mail e uma senha, ligados a até dois perfis (produtor e trabalhador).
// Fica fora das entidades de perfil (Farmer/Worker) para a senha nunca sair numa resposta.
// TODO(db): tabela `accounts` com UNIQUE (email), UNIQUE (farmer_id), UNIQUE (worker_id),
// FKs para os perfis com ON DELETE SET NULL e CHECK de pelo menos um perfil.
export interface Account {
  id: number;
  email: string; // o mesmo dos perfis ligados
  password_hash: string;
  // Redefinição pendente ("esqueci a senha"): só o resumo do token é guardado, nunca o token.
  reset_token_digest: string | null;
  reset_expires_at: string | null; // ISO 8601
  farmer_id: number | null;
  worker_id: number | null;
  last_role: UserRole; // painel aberto por último: é o que abre no próximo login
  // Aceite dos Termos de Uso e da Política de Privacidade no cadastro (LGPD: quem aceitou o quê e quando).
  // Ausente só nas contas de antes do aceite existir.
  terms_version?: string;
  terms_accepted_at?: string; // ISO 8601
  // Tema, tamanho do texto e contraste. Ausente: os padrões (ver domain/preferences.ts).
  // TODO(db): coluna `preferences jsonb` (ou três colunas) com os padrões no DEFAULT.
  preferences?: AccountPreferences;
}

// TODO(db): restrições UNIQUE (email), (farmer_id) e (worker_id).
export type AccountRepository = Repository<Account, 'email' | 'farmer_id' | 'worker_id' | 'reset_token_digest'>;

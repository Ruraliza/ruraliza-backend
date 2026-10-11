import type { Result } from '#shared/domain/result';
import type { UserRole } from '../accounts.contract';

// Dados do perfil novo numa conta que já existe (o e-mail é o da conta; não há senha).
export interface NewProfileData {
  email: string;
  name: string;
  phone: string;
  cpf: string;
  // Só para o perfil de trabalhador.
  bio: string | null;
  certificates: string | null;
  courses: string | null;
  experience: string | null;
}

// Quem cria o perfil de produtor ou de trabalhador. A conta não conhece os módulos de perfis:
// o container liga esta porta aos casos de uso deles (os perfis, por sua vez, criam a conta no cadastro).
export interface ProfileFactory {
  create(role: UserRole, data: NewProfileData): Promise<Result<{ id: number }>>;
}

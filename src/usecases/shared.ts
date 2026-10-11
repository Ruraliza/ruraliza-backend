import { type Result, conflict, ok } from '#shared/domain/result';

// --- Perfis (produtor e trabalhador) ---

// Só o que a checagem de unicidade precisa (FarmerRepository e WorkerRepository cumprem).
interface ProfileLookup {
  find(criteria: { email?: string; cpf?: string }): Promise<{ id: number }[]>;
}

// Unicidade de e-mail/CPF entre perfis do MESMO tipo. Sem `currentId`: cadastro (confere e-mail e CPF).
// Com `currentId`: edição (só o e-mail muda, e o próprio perfil não conta).
export async function checkProfileUnique(
  profiles: ProfileLookup,
  email: string | undefined,
  cpf: string | undefined,
  currentId?: number
): Promise<Result<null>> {
  if (email !== undefined) {
    const sameEmail = await profiles.find({ email });
    if (sameEmail.some((p) => p.id !== currentId)) {
      return conflict('Já existe um cadastro com este e-mail.');
    }
  }
  if (cpf !== undefined) {
    const sameCpf = await profiles.find({ cpf });
    if (sameCpf.length > 0) {
      return conflict('Já existe um cadastro com este CPF.');
    }
  }
  return ok(null);
}

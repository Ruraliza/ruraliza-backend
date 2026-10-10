import type { LoginInput, PasswordChangeInput, PasswordResetInput, PasswordResetRequestInput, SessionUser, UserRole } from '../contracts';
import type { Clock } from '../domain/clock';
import { type Credential, type PasswordHasher, RESET_TOKEN_TTL_MS, type ResetTokens } from '../domain/passwords';
import type { CredentialRepository, FarmerRepository, WorkerRepository } from '../domain/repositories';
import { type Result, invalid, notFound, ok, requireFound, unauthorized } from '../domain/result';

// Mesma mensagem para e-mail desconhecido e senha errada: não revela quem tem cadastro.
const WRONG_CREDENTIALS = 'E-mail ou senha incorretos.';
const INVALID_RESET = 'Este pedido de redefinição é inválido ou expirou. Peça uma nova redefinição de senha.';

const ROLE_LABEL: Record<UserRole, string> = { farmer: 'produtor', worker: 'trabalhador' };

export interface PasswordTools {
  hasher: PasswordHasher;
  resetTokens: ResetTokens;
}

// Login, "esqueci a senha" e troca de senha com a conta aberta.
// A senha fica no repositório de credenciais, separada do perfil (ver src/domain/passwords.ts).
export class AuthUseCases {
  constructor(
    private readonly repos: { farmers: FarmerRepository; workers: WorkerRepository; credentials: CredentialRepository },
    private readonly clock: Clock,
    private readonly tools: PasswordTools
  ) {}

  async login(input: LoginInput): Promise<Result<SessionUser>> {
    const profile = await this.findProfile(input.role, input.email);
    const credential = profile && (await findCredential(this.repos.credentials, input.role, profile.id));
    if (!credential || !(await this.tools.hasher.verify(input.password, credential.password_hash))) {
      return unauthorized(WRONG_CREDENTIALS);
    }
    return ok({ role: input.role, id: credential.user_id });
  }

  // Passo 1 do "esqueci a senha": gera o token que iria por e-mail (um pedido novo invalida o anterior).
  // TODO(email): enviar o código por e-mail, parar de devolvê-lo e responder 200 também para
  // e-mail desconhecido (hoje o 404 revela quem tem cadastro).
  async requestReset(input: PasswordResetRequestInput): Promise<Result<{ reset_token: string }>> {
    const profile = await this.findProfile(input.role, input.email);
    if (!profile) return notFound(`Não há cadastro de ${ROLE_LABEL[input.role]} com este e-mail.`);

    const credential = requireFound(await findCredential(this.repos.credentials, input.role, profile.id), `senha do ${ROLE_LABEL[input.role]} ${profile.id}`);
    const { token, digest } = this.tools.resetTokens.create();
    credential.reset_token_digest = digest;
    credential.reset_expires_at = new Date(Date.parse(this.clock.now()) + RESET_TOKEN_TTL_MS).toISOString();
    await this.repos.credentials.update(credential);
    return ok({ reset_token: token });
  }

  // Passo 2: cria a nova senha. O token vale uma vez só.
  async resetPassword(input: PasswordResetInput): Promise<Result<SessionUser>> {
    const [credential] = await this.repos.credentials.find({ reset_token_digest: this.tools.resetTokens.digest(input.token) });
    const expired = credential?.reset_expires_at == null || Date.parse(credential.reset_expires_at) <= Date.parse(this.clock.now());
    if (!credential || expired) return invalid(INVALID_RESET);

    await this.savePassword(credential, input.password);
    return ok({ role: credential.role, id: credential.user_id });
  }

  // Com a conta aberta: confirma a senha atual em vez de mandar código por e-mail.
  async changePassword(role: UserRole, userId: number, input: PasswordChangeInput): Promise<Result<null>> {
    const profiles = role === 'farmer' ? this.repos.farmers : this.repos.workers;
    if (!(await profiles.findById(userId))) return notFound(role === 'farmer' ? 'Produtor não encontrado.' : 'Trabalhador não encontrado.');

    const credential = requireFound(await findCredential(this.repos.credentials, role, userId), `senha do ${ROLE_LABEL[role]} ${userId}`);
    if (!(await this.tools.hasher.verify(input.current_password, credential.password_hash))) {
      return unauthorized('A senha atual está incorreta.');
    }
    if (input.current_password === input.new_password) return invalid('A nova senha precisa ser diferente da atual.');

    await this.savePassword(credential, input.new_password);
    return ok(null);
  }

  // Trocar a senha também cancela uma redefinição pendente.
  private async savePassword(credential: Credential, password: string): Promise<void> {
    credential.password_hash = await this.tools.hasher.hash(password);
    credential.reset_token_digest = null;
    credential.reset_expires_at = null;
    await this.repos.credentials.update(credential);
  }

  private async findProfile(role: UserRole, email: string): Promise<{ id: number } | undefined> {
    const profiles = role === 'farmer' ? this.repos.farmers : this.repos.workers;
    const [profile] = await profiles.find({ email });
    return profile;
  }
}

async function findCredential(credentials: CredentialRepository, role: UserRole, userId: number): Promise<Credential | undefined> {
  const [credential] = await credentials.find({ role, user_id: userId });
  return credential;
}

// Senha inicial, criada junto com o perfil no cadastro.
// TODO(db): na mesma transação que cria o perfil.
export async function registerPassword(
  credentials: CredentialRepository,
  hasher: PasswordHasher,
  role: UserRole,
  userId: number,
  password: string
): Promise<void> {
  await credentials.create({ role, user_id: userId, password_hash: await hasher.hash(password), reset_token_digest: null, reset_expires_at: null });
}

// Remove a senha junto com o perfil.
export async function removePassword(credentials: CredentialRepository, role: UserRole, userId: number): Promise<void> {
  const credential = await findCredential(credentials, role, userId);
  if (credential) await credentials.delete(credential.id);
}

import type { AdminSystemUserUpdate, LoginInput, SystemUser, SystemUserInput, SystemUserUpdate } from '../contracts';
import type { Clock } from '../domain/clock';
import type { PasswordHasher } from '../domain/passwords';
import type { SystemUserRepository } from '../domain/repositories';
import { type Result, conflict, notFound, ok, unauthorized } from '../domain/result';
import { type SystemUserRecord, toSystemUser } from '../domain/system-users';

const NOT_FOUND = 'Usuário de sistema não encontrado.';

// Mesma mensagem para e-mail desconhecido e senha errada (como no login do app).
const WRONG_CREDENTIALS = 'E-mail ou senha incorretos.';

// Equipe do Ruraliza (administradores e tutores): login próprio e cadastro feito por um administrador.
// Independente das contas do app: o mesmo e-mail pode ter conta no app e usuário de sistema.
export class SystemUserUseCases {
  constructor(
    private readonly repos: { systemUsers: SystemUserRepository },
    private readonly clock: Clock,
    private readonly hasher: PasswordHasher
  ) {}

  async login(input: LoginInput): Promise<Result<SystemUser>> {
    const user = await this.findByEmail(input.email);
    if (!user || !(await this.hasher.verify(input.password, user.password_hash))) {
      return unauthorized(WRONG_CREDENTIALS);
    }
    return ok(toSystemUser(user));
  }

  async get(id: number): Promise<Result<SystemUser>> {
    const user = await this.repos.systemUsers.findById(id);
    return user ? ok(toSystemUser(user)) : notFound(NOT_FOUND);
  }

  async list(): Promise<SystemUser[]> {
    return (await this.repos.systemUsers.find()).map(toSystemUser);
  }

  async create(input: SystemUserInput): Promise<Result<SystemUser>> {
    if (await this.findByEmail(input.email)) return conflict('Já existe um usuário de sistema com este e-mail.');

    const user = await this.repos.systemUsers.create({
      email: input.email,
      name: input.name,
      role: input.role,
      password_hash: await this.hasher.hash(input.password),
      insertion_date: this.clock.now()
    });
    return ok(toSystemUser(user));
  }

  // O próprio perfil: nome e e-mail.
  async updateOwn(id: number, changes: SystemUserUpdate): Promise<Result<SystemUser>> {
    return this.update(id, changes);
  }

  // Edição pelo administrador (`actorId`): nome, e-mail e cargo. O próprio cargo não muda,
  // para a equipe nunca ficar sem administrador.
  async updateByAdmin(actorId: number, id: number, changes: AdminSystemUserUpdate): Promise<Result<SystemUser>> {
    if (id === actorId && changes.role !== undefined && changes.role !== 'admin') {
      return conflict('Você não pode alterar o próprio cargo. Peça a outro administrador.');
    }
    return this.update(id, changes);
  }

  // Primeiro administrador (variáveis ADMIN_* do servidor). Não mexe num usuário que já existe.
  async ensureInitialAdmin(input: Omit<SystemUserInput, 'role'>): Promise<'created' | 'exists'> {
    const created = await this.create({ ...input, role: 'admin' });
    return created.ok ? 'created' : 'exists';
  }

  private async update(id: number, changes: AdminSystemUserUpdate): Promise<Result<SystemUser>> {
    const user = await this.repos.systemUsers.findById(id);
    if (!user) return notFound(NOT_FOUND);

    if (changes.email !== undefined && changes.email !== user.email && (await this.findByEmail(changes.email))) {
      return conflict('Já existe um usuário de sistema com este e-mail.');
    }
    if (changes.email !== undefined) user.email = changes.email;
    if (changes.name !== undefined) user.name = changes.name;
    if (changes.role !== undefined) user.role = changes.role;
    await this.repos.systemUsers.update(user);
    return ok(toSystemUser(user));
  }

  private async findByEmail(email: string): Promise<SystemUserRecord | undefined> {
    const [user] = await this.repos.systemUsers.find({ email });
    return user;
  }
}

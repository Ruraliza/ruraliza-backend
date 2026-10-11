// Regras de senha comuns às contas do app e aos usuários de sistema.
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

// Hash lento e com sal (ex.: scrypt). `verify` compara em tempo constante.
export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, hash: string): Promise<boolean>;
}

// API pública do módulo de contas: o único arquivo que outros módulos enxergam (#modules/accounts).
export type * from './accounts.contract';
export { accountToken } from './application/account-token';
export {
  type AccountRepos,
  changeAccountEmail,
  checkCpfForAccount,
  checkNewAccount,
  checkProfileUnique,
  createAccount,
  unlinkProfile
} from './application/account-profiles';
export type { Account, AccountRepository } from './domain/account';
export { DEFAULT_PREFERENCES, preferencesOf } from './domain/preferences';
export {
  CPF_TAKEN,
  EMAIL_TAKEN,
  ROLE_LABEL,
  findAccountByEmail,
  findAccountOf,
  hasProfile,
  otherRole,
  profileKey,
  toSession
} from './domain/account.rules';
export type { NewProfileData, ProfileFactory } from './domain/profile-factory';
export { createInMemoryAccountRepository } from './infra/in-memory-account.repository';
export { type AccountSchemaName, accountSchemas } from './presentation/account.schemas';
export {
  type ProfileChanges,
  type ProfileFields,
  WORKER_TEXTS,
  nullableText,
  optionalText,
  parseProfileInput,
  parseProfileUpdate,
  workerTextProblem
} from './presentation/profile.parsers';
export { cpf, optionalTextSchema, photoUrl, profileEditableProps, profileInputProps, workerTextProps } from './presentation/profile.schema-parts';
export { type AccountUseCases, type AccountsModuleDeps, createAccountRoutes, createAccountUseCases } from './accounts.module';

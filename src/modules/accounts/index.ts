// API pública do módulo de contas: o único arquivo que outros módulos enxergam (#modules/accounts).
export type * from './accounts.contract';
export {
  type AccountRepos,
  changeAccountEmail,
  checkCpfForAccount,
  checkNewAccount,
  createAccount,
  unlinkProfile
} from './application/account-profiles';
export type { Account, AccountRepository } from './domain/account';
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
export { type AccountUseCases, type AccountsModuleDeps, createAccountRoutes, createAccountUseCases } from './accounts.module';

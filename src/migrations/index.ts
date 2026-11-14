import type { Migration } from '#shared/infra/postgres/migrate';
import { initialSchema } from './001-initial';

// Passos do esquema, na ordem em que rodam. Um passo novo entra sempre no fim.
export const MIGRATIONS: readonly Migration[] = [initialSchema];

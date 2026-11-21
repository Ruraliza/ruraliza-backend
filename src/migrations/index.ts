import type { Migration } from '#shared/infra/postgres/migrate';
import { initialSchema } from './001-initial';
import { negotiatedHiring } from './002-negotiated-hiring';
import { estimatedPriceAndPayment } from './003-estimated-price-and-payment';
import { catalogAndInvites } from './004-catalog-and-invites';

// Passos do esquema, na ordem em que rodam. Um passo novo entra sempre no fim.
export const MIGRATIONS: readonly Migration[] = [initialSchema, negotiatedHiring, estimatedPriceAndPayment, catalogAndInvites];

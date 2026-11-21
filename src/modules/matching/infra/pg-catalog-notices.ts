import type { Database } from '#shared/infra/postgres/database';
import type { CatalogNoticeStore } from '../domain/catalog-notice';

// No PostgreSQL, a reserva é um UPDATE ... RETURNING: atômico, então cada aviso sai uma vez só.
export function createPgCatalogNoticeStore(db: Database): CatalogNoticeStore {
  return {
    async claimPending(now) {
      const { rows } = await db.query('UPDATE catalog_notices SET sent_at = $1 WHERE sent_at IS NULL RETURNING worker_id', [now]);
      return rows.map((row) => Number(row['worker_id'])).sort((a, b) => a - b);
    }
  };
}

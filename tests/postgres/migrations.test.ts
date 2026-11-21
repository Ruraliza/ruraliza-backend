// Migrações sobre dados antigos (npm run test:postgres): cada passo novo preserva o que já estava gravado.
import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { initialSchema } from '../../src/migrations/001-initial';
import { negotiatedHiring } from '../../src/migrations/002-negotiated-hiring';
import { estimatedPriceAndPayment } from '../../src/migrations/003-estimated-price-and-payment';
import { type TestDatabase, TEST_DATABASE_URL, createTestDatabase, dropTestDatabases } from '../support/postgres';
import { NOW } from './hiring-helpers';

function database(): Promise<TestDatabase> {
  if (TEST_DATABASE_URL === null) assert.fail('Defina TEST_DATABASE_URL (um banco só de testes) para rodar os testes do PostgreSQL.');
  return createTestDatabase(TEST_DATABASE_URL);
}

after(dropTestDatabases);

describe('PostgreSQL: migrações sobre dados antigos', () => {
  it('as migrações 002 e 003 mantêm os dados antigos: o valor fica (como empreitada), e a conclusão vem do pagamento', async () => {
    const { pool } = await database();
    const client = await pool.connect();
    const schema = `mig_${String(Date.now())}`;
    try {
      await client.query(`CREATE SCHEMA ${schema}`);
      await client.query(`SET search_path TO ${schema}`);
      await client.query(initialSchema.sql);
      await client.query(`INSERT INTO services (farmer_id, farm_id, payment_id, worker_id, name, description, category, duration, price, expires_at, status, insertion_date)
        VALUES (1, 1, 1, 2, 'Capina', null, 'Capina', 4, 200, null, 'Completed', $1), (1, 1, null, null, 'Roçada', null, 'Outros', 2, 90, null, 'Pending', $1)`, [NOW]);
      await client.query(`INSERT INTO payments (service_id, farmer_id, worker_id, value, status, insertion_date) VALUES (1, 1, 2, 200, 'Completed', '2026-03-10T12:00:00Z')`);
      await client.query(negotiatedHiring.sql);
      // Vaga publicada enquanto a 002 valia: sem valor ("a combinar").
      await client.query(`INSERT INTO services (farmer_id, farm_id, name, category, duration, status, insertion_date) VALUES (1, 1, 'Cerca', 'Outros', 8, 'Pending', $1)`, [NOW]);
      await client.query(estimatedPriceAndPayment.sql);
      const { rows } = await client.query<{ price: number | null; price_unit: string | null; completed_at: Date | null }>('SELECT price, price_unit, completed_at FROM services ORDER BY id');
      assert.deepEqual(rows.map((r) => [r.price, r.price_unit, r.completed_at?.toISOString() ?? null]), [
        [200, 'fixed', '2026-03-10T12:00:00.000Z'], [90, 'fixed', null], [null, null, null]
      ]);
      // Proposta sem forma e momento do pagamento.
      await client.query(`INSERT INTO proposals (application_id, service_id, farmer_id, worker_id, amount, unit, proposed_by, status, insertion_date)
        VALUES (1, 1, 1, 2, 150, 'day', 'worker', 'Pending', $1)`, [NOW]);
      await assert.rejects(client.query(`UPDATE services SET price_unit = 'semana' WHERE id = 1`), /check/);
    } finally {
      await client.query('RESET search_path');
      await client.query(`DROP SCHEMA ${schema} CASCADE`);
      client.release();
    }
  });
});

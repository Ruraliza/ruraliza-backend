import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { type Account, createInMemoryAccountRepository } from '#modules/accounts';
import { createInMemoryFarmerRepository } from '#modules/farmers';
import { createInMemoryApplicationRepository } from '#modules/hiring';
import { createInMemoryServiceRepository } from '#modules/services';
import { createInMemoryWorkerRepository } from '#modules/workers';
import { type SentPush, adjustableClock, recordingPush } from '#shared/testing/recorders';
import { unwrap } from '#shared/testing/unwrap';
import { createInMemoryReportRepository } from '../infra/in-memory-report.repository';
import type { ReportInput } from '../report.contract';
import { CreateReportUseCase } from './create-report.usecase';
import { ListReportsUseCase } from './list-reports.usecase';
import type { ReportDeps } from './report-deps';
import { ReviewReportUseCase } from './review-report.usecase';

const NOW = '2026-10-16T12:00:00.000Z';

function account(id: Partial<Pick<Account, 'farmer_id' | 'worker_id'>>, email: string): Omit<Account, 'id'> {
  return {
    email, password_hash: 'x', reset_token_digest: null, reset_expires_at: null,
    farmer_id: id.farmer_id ?? null, worker_id: id.worker_id ?? null, last_role: id.farmer_id ? 'farmer' : 'worker'
  };
}

describe('Denúncias', () => {
  let deps: ReportDeps & { clock: ReturnType<typeof adjustableClock> };
  let pushes: SentPush[];
  let create: CreateReportUseCase;
  let list: ListReportsUseCase;
  let review: ReviewReportUseCase;
  // Ana (produtora 1) publicou Capina; Maria (trabalhadora 1) se candidatou; João (trabalhador 2), não.
  let serviceId: number;

  beforeEach(async () => {
    const push = recordingPush();
    pushes = push.sent;
    deps = {
      reports: createInMemoryReportRepository(),
      farmers: createInMemoryFarmerRepository(),
      workers: createInMemoryWorkerRepository(),
      services: createInMemoryServiceRepository(),
      applications: createInMemoryApplicationRepository(),
      accounts: createInMemoryAccountRepository(),
      clock: adjustableClock(NOW),
      push
    };
    const worker = { phone: '1', cpf: '11144477735', bio: null, certificates: null, courses: null, experience: null, photo_url: null, resume_url: null, insertion_date: NOW };
    const ana = await deps.farmers.create({ email: 'ana@exemplo.com', name: 'Ana', phone: '1', cpf: '52998224725', farms: [], photo_url: null, insertion_date: NOW });
    const maria = await deps.workers.create({ ...worker, email: 'maria@exemplo.com', name: 'Maria' });
    await deps.workers.create({ ...worker, email: 'joao@exemplo.com', name: 'João' });
    await deps.accounts.create(account({ farmer_id: ana.id }, 'ana@exemplo.com'));
    await deps.accounts.create(account({ worker_id: maria.id }, 'maria@exemplo.com'));
    await deps.accounts.create(account({ worker_id: 2 }, 'joao@exemplo.com'));
    const service = await deps.services.create({
      farmer_id: ana.id, farm_id: 1, payment_id: null, worker_id: null, name: 'Capina', description: null,
      category: 'Manutenção', duration: 4, price: 200, expires_at: null, status: 'Pending', insertion_date: NOW
    });
    serviceId = service.id;
    await deps.applications.create({ service_id: service.id, worker_id: maria.id, status: 'Pending', insertion_date: NOW });
    create = new CreateReportUseCase(deps);
    list = new ListReportsUseCase(deps);
    review = new ReviewReportUseCase(deps);
  });

  const fraud = (target: Pick<ReportInput, 'target_type' | 'target_id'>): ReportInput => ({ ...target, reason: 'fraude', details: null });

  it('o trabalhador denuncia qualquer vaga, mesmo sem ter se candidatado', async () => {
    const report = unwrap(await create.execute({ role: 'worker', profileId: 2, input: fraud({ target_type: 'service', target_id: serviceId }) }));

    assert.deepEqual(
      [report.status, report.target_type, report.reason, report.insertion_date],
      ['open', 'service', 'fraude', NOW]
    );
  });

  it('uma pessoa só é denunciada por quem teve contato com ela (candidatura)', async () => {
    unwrap(await create.execute({ role: 'worker', profileId: 1, input: fraud({ target_type: 'farmer', target_id: 1 }) }));
    unwrap(await create.execute({ role: 'farmer', profileId: 1, input: { target_type: 'worker', target_id: 1, reason: 'comportamento' } }));

    const stranger = await create.execute({ role: 'worker', profileId: 2, input: fraud({ target_type: 'farmer', target_id: 1 }) });
    const notApplicant = await create.execute({ role: 'farmer', profileId: 1, input: fraud({ target_type: 'worker', target_id: 2 }) });

    assert.deepEqual([stranger.ok ? '' : stranger.kind, notApplicant.ok ? '' : notApplicant.kind], ['forbidden', 'forbidden']);
  });

  it('cada perfil denuncia só o que pode, e ninguém denuncia o que é seu', async () => {
    // Maria passa a ter também um perfil de produtora, com uma vaga.
    const mariaFarmer = await deps.farmers.create({ email: 'maria@exemplo.com', name: 'Maria', phone: '1', cpf: '11144477735', farms: [], photo_url: null, insertion_date: NOW });
    const mariaAccount = (await deps.accounts.find({ worker_id: 1 }))[0];
    assert.ok(mariaAccount);
    await deps.accounts.update({ ...mariaAccount, farmer_id: mariaFarmer.id });
    const own = await deps.services.create({
      farmer_id: mariaFarmer.id, farm_id: 2, payment_id: null, worker_id: null, name: 'Ordenha', description: null,
      category: 'Pecuária', duration: 2, price: 100, expires_at: null, status: 'Pending', insertion_date: NOW
    });

    const results = await Promise.all([
      create.execute({ role: 'farmer', profileId: 1, input: fraud({ target_type: 'service', target_id: serviceId }) }),
      create.execute({ role: 'worker', profileId: 1, input: fraud({ target_type: 'worker', target_id: 2 }) }),
      create.execute({ role: 'worker', profileId: 1, input: fraud({ target_type: 'service', target_id: own.id }) }),
      create.execute({ role: 'worker', profileId: 1, input: fraud({ target_type: 'service', target_id: 99 }) })
    ]);

    assert.deepEqual(results.map((r) => (r.ok ? 'ok' : r.kind)), ['invalid', 'invalid', 'invalid', 'not_found']);
  });

  it('não abre a mesma denúncia duas vezes enquanto a equipe analisa; depois da decisão, pode de novo', async () => {
    const input = fraud({ target_type: 'service', target_id: serviceId });
    const first = unwrap(await create.execute({ role: 'worker', profileId: 1, input }));

    const again = await create.execute({ role: 'worker', profileId: 1, input });
    assert.equal(again.ok ? '' : again.kind, 'conflict');

    unwrap(await review.execute({ id: first.id, input: { status: 'dismissed' } }));
    assert.equal((await create.execute({ role: 'worker', profileId: 1, input })).ok, true);
  });

  it('a equipe vê a fila com os nomes e as contas, a mais recente primeiro, e filtra pela situação', async () => {
    unwrap(await create.execute({ role: 'worker', profileId: 1, input: fraud({ target_type: 'service', target_id: serviceId }) }));
    deps.clock.set('2026-10-16T13:00:00.000Z');
    const second = unwrap(await create.execute({ role: 'farmer', profileId: 1, input: { target_type: 'worker', target_id: 1, reason: 'outro', details: 'Sumiu no meio do serviço.' } }));
    unwrap(await review.execute({ id: second.id, input: { status: 'resolved', note: 'Conversei com ela.' } }));

    const all = await list.execute();
    const open = await list.execute({ status: 'open' });

    assert.deepEqual(all.map((r) => [r.reporter.name, r.target_name, r.target_account_id, r.status]), [
      ['Ana', 'Maria', 2, 'resolved'],
      ['Maria', 'Capina', 1, 'open']
    ]);
    assert.deepEqual([all[0]?.reporter.account_id, all[0]?.resolution_note, all[0]?.details], [1, 'Conversei com ela.', 'Sumiu no meio do serviço.']);
    assert.deepEqual(open.map((r) => r.target_name), ['Capina']);
  });

  it('a decisão avisa quem denunciou (sem a anotação interna) e não pode ser refeita', async () => {
    const report = unwrap(await create.execute({ role: 'worker', profileId: 1, input: fraud({ target_type: 'service', target_id: serviceId }) }));
    deps.clock.set('2026-10-17T09:00:00.000Z');

    const decided = unwrap(await review.execute({ id: report.id, input: { status: 'resolved', note: 'Vaga removida.' } }));
    const twice = await review.execute({ id: report.id, input: { status: 'dismissed' } });

    assert.deepEqual([decided.status, decided.reviewed_at], ['resolved', '2026-10-17T09:00:00.000Z']);
    assert.equal(twice.ok ? '' : twice.kind, 'conflict');
    assert.deepEqual(pushes, [{
      role: 'worker',
      profileId: 1,
      message: {
        title: 'Sua denúncia foi analisada',
        body: 'A equipe confirmou o problema sobre a vaga Capina e tomou providências. Obrigado por avisar.',
        url: 'trabalhador/ajuda'
      }
    }]);
  });

  it('perfil removido continua na fila, com o nome no lugar', async () => {
    unwrap(await create.execute({ role: 'farmer', profileId: 1, input: { target_type: 'worker', target_id: 1, reason: 'ofensivo' } }));
    await deps.workers.delete(1);
    await deps.farmers.delete(1);

    const [item] = await list.execute();

    assert.deepEqual([item?.reporter.name, item?.reporter.account_id, item?.target_name, item?.target_account_id], ['(perfil removido)', null, '(removido)', null]);
  });
});

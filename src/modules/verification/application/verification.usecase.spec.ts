import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { type Account, createInMemoryAccountRepository } from '#modules/accounts';
import { createInMemoryFarmerRepository } from '#modules/farmers';
import { createInMemoryWorkerRepository } from '#modules/workers';
import type { NormalizeOptions } from '#shared/domain/images';
import { type Result, invalid, ok } from '#shared/domain/result';
import { InMemoryImageStore } from '#shared/infra/images/in-memory-image-store';
import { type SentPush, adjustableClock, recordingPush } from '#shared/testing/recorders';
import { unwrap } from '#shared/testing/unwrap';
import { createInMemoryVerificationRepository } from '../infra/in-memory-verification.repository';
import type { Verification } from '../verification.contract';
import { GetVerificationDocumentUseCase } from './get-verification-document.usecase';
import { GetVerificationUseCase } from './get-verification.usecase';
import { ListVerificationsUseCase } from './list-verifications.usecase';
import { ReviewVerificationUseCase } from './review-verification.usecase';
import { SubmitVerificationUseCase } from './submit-verification.usecase';
import type { VerificationDeps } from './verification-deps';
import { createVerificationReader, removeVerificationOf } from './verification-reader';

const NOW = '2026-10-16T12:00:00.000Z';
const PHOTO = new Uint8Array([1, 2, 3]);
const UNREADABLE = new Uint8Array([0]);

describe('Verificação de identidade', () => {
  let deps: VerificationDeps & { clock: ReturnType<typeof adjustableClock> };
  let store: InMemoryImageStore;
  let pushes: SentPush[];
  let normalized: NormalizeOptions[];
  let get: GetVerificationUseCase;
  let submit: SubmitVerificationUseCase;
  let list: ListVerificationsUseCase;
  let review: ReviewVerificationUseCase;
  let documentOf: GetVerificationDocumentUseCase;

  beforeEach(async () => {
    const push = recordingPush();
    pushes = push.sent;
    normalized = [];
    store = new InMemoryImageStore();
    deps = {
      verifications: createInMemoryVerificationRepository(),
      farmers: createInMemoryFarmerRepository(),
      workers: createInMemoryWorkerRepository(),
      accounts: createInMemoryAccountRepository(),
      idDocuments: {
        processor: {
          normalize: (input, options = {}) => {
            normalized.push(options);
            return Promise.resolve(input === UNREADABLE ? invalid('Não foi possível ler a imagem.') : ok({ bytes: input, contentType: 'image/webp', width: 1600, height: 1000 }));
          }
        },
        store
      },
      clock: adjustableClock(NOW),
      push
    };
    // Carlos tem os dois perfis (mesmo CPF); Maria só o de trabalhadora.
    const profile = { phone: '1', photo_url: null, insertion_date: NOW };
    const worker = { ...profile, bio: null, certificates: null, courses: null, experience: null, resume_url: null };
    const carlosFarmer = await deps.farmers.create({ ...profile, email: 'carlos@exemplo.com', name: 'Carlos Souza', cpf: '52998224725', farms: [] });
    const carlosWorker = await deps.workers.create({ ...worker, email: 'carlos@exemplo.com', name: 'Carlos Souza', cpf: '52998224725' });
    await deps.workers.create({ ...worker, email: 'maria@exemplo.com', name: 'Maria Lima', cpf: '11144477735' });
    const account: Omit<Account, 'id'> = {
      email: 'carlos@exemplo.com', password_hash: 'x', reset_token_digest: null, reset_expires_at: null,
      farmer_id: carlosFarmer.id, worker_id: carlosWorker.id, last_role: 'farmer'
    };
    await deps.accounts.create(account);
    get = new GetVerificationUseCase(deps);
    submit = new SubmitVerificationUseCase(deps);
    list = new ListVerificationsUseCase(deps);
    review = new ReviewVerificationUseCase(deps);
    documentOf = new GetVerificationDocumentUseCase(deps);
  });

  const send = (role: 'farmer' | 'worker', profileId: number, upload = PHOTO): Promise<Result<Verification>> =>
    submit.execute({ role, profileId, documentType: 'cnh', upload });

  it('sem pedido, a situação é "none"; o envio entra na fila com a foto legível (até 1600px)', async () => {
    assert.equal(unwrap(await get.execute({ role: 'worker', profileId: 2 })).status, 'none');

    const pending = unwrap(await send('worker', 2));

    assert.deepEqual([pending.status, pending.document_type, pending.submitted_at, pending.verified], ['pending', 'cnh', NOW, false]);
    assert.deepEqual(normalized, [{ maxSide: 1600 }]);
    const [request] = await list.execute({ status: 'pending' });
    assert.deepEqual([request?.name, request?.cpf, request?.has_document], ['Maria Lima', '11144477735', true]);
  });

  it('reenviar troca a foto e apaga a anterior; foto ilegível não entra', async () => {
    unwrap(await send('worker', 2));
    const [first] = await deps.verifications.find({ role: 'worker', profile_id: 2 });
    unwrap(await send('worker', 2));
    const [second] = await deps.verifications.find({ role: 'worker', profile_id: 2 });

    assert.equal(second?.id, first?.id);
    assert.equal(await store.get(first?.document_id ?? ''), undefined);
    assert.ok(await store.get(second?.document_id ?? ''));
    const unreadable = await send('worker', 2, UNREADABLE);
    assert.equal(unreadable.ok ? '' : unreadable.kind, 'invalid');
  });

  it('aprovar apaga a foto, avisa a pessoa e dá o selo também ao outro perfil da conta (mesmo CPF)', async () => {
    unwrap(await send('farmer', 1));
    const [request] = await list.execute();
    deps.clock.set('2026-10-17T09:00:00.000Z');

    const decided = unwrap(await review.execute({ id: request?.id ?? 0, input: { status: 'approved' } }));

    assert.deepEqual([decided.status, decided.has_document, decided.reviewed_at], ['approved', false, '2026-10-17T09:00:00.000Z']);
    assert.equal((await documentOf.execute({ id: decided.id })).ok, false);
    assert.equal(unwrap(await get.execute({ role: 'worker', profileId: 1 })).verified, true);
    const reader = createVerificationReader(deps);
    assert.deepEqual([...await reader.verifiedFarmers([1, 9])], [1]);
    assert.deepEqual([...await reader.verifiedWorkers([1, 2])], [1]);
    assert.deepEqual(pushes.map((p) => [p.role, p.profileId, p.message.title, p.message.url]), [['farmer', 1, 'Seu perfil foi verificado', 'produtor/perfil']]);
  });

  it('recusar manda o motivo para a pessoa, que pode enviar de novo', async () => {
    unwrap(await send('worker', 2));
    const [request] = await list.execute();

    unwrap(await review.execute({ id: request?.id ?? 0, input: { status: 'rejected', reason: 'A foto ficou tremida' } }));
    const again = await review.execute({ id: request?.id ?? 0, input: { status: 'approved' } });

    const status = unwrap(await get.execute({ role: 'worker', profileId: 2 }));
    assert.deepEqual([status.status, status.rejection_reason, status.verified], ['rejected', 'A foto ficou tremida', false]);
    assert.equal(again.ok ? '' : again.kind, 'conflict');
    assert.equal(pushes[0]?.message.body, 'A foto ficou tremida. Você pode enviar o documento de novo pelo seu perfil.');
    assert.equal(unwrap(await send('worker', 2)).status, 'pending');
  });

  it('o selo vale para o nome conferido: mudou o nome, some o selo e dá para verificar de novo', async () => {
    unwrap(await send('worker', 2));
    const [request] = await list.execute();
    unwrap(await review.execute({ id: request?.id ?? 0, input: { status: 'approved' } }));

    const alreadyVerified = await send('worker', 2);
    const maria = await deps.workers.findById(2);
    assert.ok(maria);
    await deps.workers.update({ ...maria, name: 'MARIA  lima' }); // só maiúsculas e espaços: continua valendo
    const stillVerified = unwrap(await get.execute({ role: 'worker', profileId: 2 })).verified;
    await deps.workers.update({ ...maria, name: 'Maria Oliveira' });

    assert.equal(alreadyVerified.ok ? '' : alreadyVerified.kind, 'conflict');
    assert.equal(stillVerified, true);
    assert.deepEqual([...await createVerificationReader(deps).verifiedWorkers([2])], []);
    assert.equal(unwrap(await send('worker', 2)).status, 'pending');
  });

  it('perfil removido leva o pedido e a foto junto', async () => {
    unwrap(await send('worker', 2));
    const [record] = await deps.verifications.find({ role: 'worker', profile_id: 2 });

    await removeVerificationOf(deps, 'worker', 2);

    assert.deepEqual(await deps.verifications.find({}), []);
    assert.equal(await store.get(record?.document_id ?? ''), undefined);
  });
});

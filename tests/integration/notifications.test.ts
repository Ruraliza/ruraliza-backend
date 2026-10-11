// Avisos em tempo real (SSE) e notificações push disparados pelos fluxos.
// Testes de integração: os módulos juntos pelo container, sem HTTP (as regras de cada caso de uso
// estão nos specs ao lado do código, em src/modules/*/application).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { type Container, createContainer } from '../../src/container';
import { NOW, farmerWithFarm, openService, setup, unwrap, worker } from './support';

describe('Avisos em tempo real (SSE)', () => {
  // Conta quantas vezes cada tela aberta seria avisada.
  async function watch(c: Container, kind: 'service' | 'worker', id: number): Promise<{ count: () => number; stop: () => void }> {
    let calls = 0;
    const listener = (): void => { calls++; };
    const stop = unwrap(kind === 'service'
      ? await c.useCases.hiring.watchServiceApplications.execute({ serviceId: id, listener: listener })
      : await c.useCases.workers.watchWorkerApplications.execute({ workerId: id, listener: listener }));
    return { count: () => calls, stop };
  }

  it('o produtor é avisado quando alguém se candidata ou desiste', async () => {
    const c = setup();
    const { farmerId, farmId } = await farmerWithFarm(c);
    const serviceId = await openService(c, farmerId, farmId);
    const w = await worker(c, 'w@exemplo.com', '11144477735');
    const farmerScreen = await watch(c, 'service', serviceId);

    unwrap(await c.useCases.hiring.applyForService.execute({ serviceId: serviceId, workerId: w }));
    assert.equal(farmerScreen.count(), 1);
    unwrap(await c.useCases.hiring.withdrawFromService.execute({ serviceId: serviceId, workerId: w }));
    assert.equal(farmerScreen.count(), 2);

    farmerScreen.stop();
    unwrap(await c.useCases.hiring.applyForService.execute({ serviceId: serviceId, workerId: w }));
    assert.equal(farmerScreen.count(), 2); // parou de acompanhar
  });

  it('o trabalhador é avisado quando o status das candidaturas dele muda', async () => {
    const c = setup();
    const { farmerId, farmId } = await farmerWithFarm(c);
    const serviceId = await openService(c, farmerId, farmId);
    const [w1, w2] = [await worker(c, 'w1@exemplo.com', '11144477735'), await worker(c, 'w2@exemplo.com', '39053344705')];
    const a1 = unwrap(await c.useCases.hiring.applyForService.execute({ serviceId: serviceId, workerId: w1 }));
    unwrap(await c.useCases.hiring.applyForService.execute({ serviceId: serviceId, workerId: w2 }));
    const [screen1, screen2] = [await watch(c, 'worker', w1), await watch(c, 'worker', w2)];

    unwrap(await c.useCases.hiring.analyzeApplication.execute({ serviceId: serviceId, application_id: a1.id, action: 'Accept' }));
    assert.deepEqual([screen1.count(), screen2.count()], [1, 1]); // aceito e recusado pelo aceite

    unwrap(await c.useCases.hiring.withdrawFromService.execute({ serviceId: serviceId, workerId: w1 }));
    assert.deepEqual([screen1.count(), screen2.count()], [2, 2]); // a do 2º volta a Pending

    unwrap(await c.useCases.services.cancelService.execute({ serviceId: serviceId }));
    assert.deepEqual([screen1.count(), screen2.count()], [2, 3]); // só quem ainda tinha candidatura
  });

  it('acompanhar serviço ou trabalhador inexistente dá not_found', async () => {
    const c = setup();
    const noop = (): void => undefined;
    const service = await c.useCases.hiring.watchServiceApplications.execute({ serviceId: 999, listener: noop });
    const w = await c.useCases.workers.watchWorkerApplications.execute({ workerId: 999, listener: noop });
    assert.deepEqual([service.ok ? '' : service.kind, w.ok ? '' : w.kind], ['not_found', 'not_found']);
  });
});
describe('Notificações push', () => {
  const ENDPOINT = 'https://push.exemplo.com/abc';
  const KEYS = { p256dh: 'chave', auth: 'segredo' };

  // Grava o que seria enviado; `gone` simula inscrições revogadas no navegador.
  function pushSetup(gone: readonly string[] = []): { c: Container; sent: { endpoint: string; title: string; url: string }[] } {
    const sent: { endpoint: string; title: string; url: string }[] = [];
    const c = createContainer({
      clock: { now: () => NOW },
      push: {
        send: (sub, message) => {
          sent.push({ endpoint: sub.endpoint, title: message.title, url: message.url });
          return Promise.resolve(gone.includes(sub.endpoint) ? 'gone' : 'sent');
        }
      }
    });
    return { c, sent };
  }

  async function accountOf(c: Container, filter: { farmer_id: number } | { worker_id: number }): Promise<number> {
    const [account] = await c.repos.accounts.find(filter);
    assert.ok(account);
    return account.id;
  }

  it('candidatura avisa o produtor; aceite avisa o aceito e os recusados pelo aceite', async () => {
    const { c, sent } = pushSetup();
    const { farmerId, farmId } = await farmerWithFarm(c);
    const serviceId = await openService(c, farmerId, farmId);
    const [w1, w2] = [await worker(c, 'w1@exemplo.com', '11144477735'), await worker(c, 'w2@exemplo.com', '39053344705')];
    unwrap(await c.useCases.push.subscribe.execute({ accountId: await accountOf(c, { farmer_id: farmerId }), input: { endpoint: 'https://push.exemplo.com/produtor', keys: KEYS } }));
    unwrap(await c.useCases.push.subscribe.execute({ accountId: await accountOf(c, { worker_id: w1 }), input: { endpoint: 'https://push.exemplo.com/w1', keys: KEYS } }));
    unwrap(await c.useCases.push.subscribe.execute({ accountId: await accountOf(c, { worker_id: w2 }), input: { endpoint: 'https://push.exemplo.com/w2', keys: KEYS } }));

    const a1 = unwrap(await c.useCases.hiring.applyForService.execute({ serviceId: serviceId, workerId: w1 }));
    unwrap(await c.useCases.hiring.applyForService.execute({ serviceId: serviceId, workerId: w2 }));
    await c.notifier.idle();
    assert.deepEqual(sent.map((s) => [s.endpoint, s.url]), [
      ['https://push.exemplo.com/produtor', `produtor/servicos/${serviceId}`],
      ['https://push.exemplo.com/produtor', `produtor/servicos/${serviceId}`]
    ]);

    sent.length = 0;
    unwrap(await c.useCases.hiring.analyzeApplication.execute({ serviceId: serviceId, application_id: a1.id, action: 'Accept' }));
    await c.notifier.idle();
    assert.deepEqual(sent.map((s) => [s.endpoint, s.title]), [
      ['https://push.exemplo.com/w1', 'Você foi aceito!'],
      ['https://push.exemplo.com/w2', 'Candidatura recusada']
    ]);
  });

  it('a mesma inscrição reenviada não duplica e passa para a conta que entrou por último', async () => {
    const { c, sent } = pushSetup();
    const { farmerId, farmId } = await farmerWithFarm(c);
    const serviceId = await openService(c, farmerId, farmId);
    const w = await worker(c, 'w@exemplo.com', '11144477735');
    const farmerAccount = await accountOf(c, { farmer_id: farmerId });

    unwrap(await c.useCases.push.subscribe.execute({ accountId: farmerAccount, input: { endpoint: ENDPOINT, keys: KEYS } }));
    unwrap(await c.useCases.push.subscribe.execute({ accountId: farmerAccount, input: { endpoint: ENDPOINT, keys: KEYS } }));
    assert.equal((await c.repos.pushSubscriptions.find()).length, 1);

    unwrap(await c.useCases.push.subscribe.execute({ accountId: await accountOf(c, { worker_id: w }), input: { endpoint: ENDPOINT, keys: KEYS } }));
    unwrap(await c.useCases.hiring.applyForService.execute({ serviceId: serviceId, workerId: w }));
    await c.notifier.idle();
    assert.equal(sent.length, 0); // o aparelho agora é do trabalhador, não do produtor
  });

  it('inscrição revogada no navegador é apagada no primeiro envio', async () => {
    const { c } = pushSetup([ENDPOINT]);
    const { farmerId, farmId } = await farmerWithFarm(c);
    const serviceId = await openService(c, farmerId, farmId);
    const w = await worker(c, 'w@exemplo.com', '11144477735');
    unwrap(await c.useCases.push.subscribe.execute({ accountId: await accountOf(c, { farmer_id: farmerId }), input: { endpoint: ENDPOINT, keys: KEYS } }));

    unwrap(await c.useCases.hiring.applyForService.execute({ serviceId: serviceId, workerId: w }));
    await c.notifier.idle();
    assert.equal((await c.repos.pushSubscriptions.find()).length, 0);
  });

  it('cancelar inscrição para os envios; conta inexistente dá not_found', async () => {
    const { c, sent } = pushSetup();
    const { farmerId, farmId } = await farmerWithFarm(c);
    const serviceId = await openService(c, farmerId, farmId);
    const w = await worker(c, 'w@exemplo.com', '11144477735');
    const farmerAccount = await accountOf(c, { farmer_id: farmerId });
    unwrap(await c.useCases.push.subscribe.execute({ accountId: farmerAccount, input: { endpoint: ENDPOINT, keys: KEYS } }));
    unwrap(await c.useCases.push.unsubscribe.execute({ accountId: farmerAccount, endpoint: ENDPOINT }));

    unwrap(await c.useCases.hiring.applyForService.execute({ serviceId: serviceId, workerId: w }));
    await c.notifier.idle();
    assert.equal(sent.length, 0);

    const missing = await c.useCases.push.subscribe.execute({ accountId: 999, input: { endpoint: ENDPOINT, keys: KEYS } });
    assert.equal(missing.ok ? '' : missing.kind, 'not_found');
  });

  it('falha no serviço de push não afeta a operação', async () => {
    const c = createContainer({ clock: { now: () => NOW }, push: { send: () => Promise.reject(new Error('fora do ar')) } });
    const { farmerId, farmId } = await farmerWithFarm(c);
    const serviceId = await openService(c, farmerId, farmId);
    const w = await worker(c, 'w@exemplo.com', '11144477735');
    unwrap(await c.useCases.push.subscribe.execute({ accountId: await accountOf(c, { farmer_id: farmerId }), input: { endpoint: ENDPOINT, keys: KEYS } }));

    const original = console.error;
    console.error = () => {};
    try {
      unwrap(await c.useCases.hiring.applyForService.execute({ serviceId: serviceId, workerId: w }));
      await c.notifier.idle();
    } finally {
      console.error = original;
    }
  });
});

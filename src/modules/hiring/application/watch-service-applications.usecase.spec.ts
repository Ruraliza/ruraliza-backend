import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { InMemoryChangeFeed } from '#shared/infra/memory/in-memory-change-feed';
import { unwrap } from '#shared/testing/unwrap';
import { givenService, hiringTestbed } from '../testing/hiring-fixtures';
import { WatchServiceApplicationsUseCase } from './watch-service-applications.usecase';

describe('WatchServiceApplicationsUseCase', () => {
  it('avisa a cada mudança nas candidaturas do serviço até parar de acompanhar', async () => {
    const changes = new InMemoryChangeFeed();
    const t = { ...hiringTestbed(), changes };
    const watch = new WatchServiceApplicationsUseCase(t);
    const service = await givenService(t);
    let calls = 0;

    const stop = unwrap(await watch.execute({ serviceId: service.id, listener: () => { calls++; } }));
    changes.publish([`service:${service.id}:applications`, 'service:99:applications']);
    stop();
    changes.publish([`service:${service.id}:applications`]);

    assert.equal(calls, 1);
  });

  it('serviço inexistente dá not_found', async () => {
    const watch = new WatchServiceApplicationsUseCase(hiringTestbed());

    const result = await watch.execute({ serviceId: 99, listener: () => undefined });

    assert.equal(result.ok ? 'ok' : result.kind, 'not_found');
  });
});

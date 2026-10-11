import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Lesson } from '../track.contract';
import { canTransition, publishProblem, workloadMinutes } from './track';

describe('regras da trilha', () => {
  it('só anda para frente, sem remoção nem volta para rascunho; descontinuada pode ser reativada', () => {
    assert.equal(canTransition('draft', 'published'), true);
    assert.equal(canTransition('published', 'discontinued'), true);
    assert.equal(canTransition('discontinued', 'published'), true);
    assert.equal(canTransition('draft', 'discontinued'), false);
    assert.equal(canTransition('published', 'draft'), false);
    assert.equal(canTransition('discontinued', 'draft'), false);
    assert.equal(canTransition('published', 'published'), false);
  });

  it('publicar exige ao menos um módulo e nenhum módulo vazio', () => {
    const lesson = { id: 2, title: 'A', video_url: null, content: 'x', duration_minutes: 5 };
    assert.match(publishProblem([]) ?? '', /pelo menos um módulo/);
    assert.match(publishProblem([{ id: 1, title: 'Vazio', lessons: [] }]) ?? '', /"Vazio" não tem aulas/);
    assert.equal(publishProblem([{ id: 1, title: 'M', lessons: [lesson] }]), null);
  });

  it('a carga horária é a soma das aulas', () => {
    const l = (id: number, duration_minutes: number): Lesson => ({ id, title: 'A', video_url: null, content: 'x', duration_minutes });
    assert.equal(workloadMinutes({ modules: [{ id: 1, title: 'M', lessons: [l(2, 15), l(3, 45)] }, { id: 4, title: 'N', lessons: [l(5, 30)] }] }), 90);
  });
});

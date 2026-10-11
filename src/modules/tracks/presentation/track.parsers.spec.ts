import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { unwrap } from '#shared/testing/unwrap';
import { parseTrackContent, parseTrackInput, parseTrackStatus, parseTrackUpdate } from './track.parsers';

const kind = (r: { ok: boolean; kind?: string }): string => (r.ok ? 'ok' : (r.kind ?? ''));

describe('parsers das trilhas', () => {
  it('entrada: apara textos e ordena as categorias pela lista oficial, sem repetir', () => {
    assert.deepEqual(unwrap(parseTrackInput({ title: '  Café ', description: ' Curso ', categories: ['Plantio', 'Colheita', 'Plantio'] })), {
      title: 'Café', description: 'Curso', categories: ['Colheita', 'Plantio']
    });
    assert.equal(kind(parseTrackInput({ title: 'A', description: 'B', categories: [] })), 'invalid');
    assert.equal(kind(parseTrackInput({ title: 'A', description: 'B', categories: ['Pescaria'] })), 'invalid');
    assert.equal(kind(parseTrackInput({ title: 'x'.repeat(121), description: 'B', categories: ['Colheita'] })), 'invalid');
  });

  it('edição: recusa campos que não se editam por aqui', () => {
    assert.equal(kind(parseTrackUpdate({ status: 'published' })), 'invalid');
    assert.equal(kind(parseTrackUpdate({ modules: [] })), 'invalid');
    assert.equal(kind(parseTrackUpdate({ tutor_ids: [1, 'dois'] })), 'invalid');
    assert.deepEqual(unwrap(parseTrackUpdate({ tutor_ids: [1, 2] })), { tutor_ids: [1, 2] });
  });

  it('conteúdo: normaliza o vídeo e exige vídeo ou texto e duração inteira', () => {
    const content = unwrap(parseTrackContent({
      modules: [{ title: ' Módulo ', lessons: [{ id: 3, title: 'Aula', video_url: 'https://youtu.be/dQw4w9WgXcQ', duration_minutes: 12 }] }]
    }));
    assert.deepEqual(content, {
      modules: [{ title: 'Módulo', lessons: [{ id: 3, title: 'Aula', video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', content: '', duration_minutes: 12 }] }]
    });

    const bad = (lesson: Record<string, unknown>): string => kind(parseTrackContent({ modules: [{ title: 'M', lessons: [{ title: 'A', duration_minutes: 10, content: 'x', ...lesson }] }] }));
    assert.equal(bad({ content: '', video_url: null }), 'invalid');
    assert.equal(bad({ video_url: 'https://exemplo.com/v.mp4' }), 'invalid');
    assert.equal(bad({ duration_minutes: 0 }), 'invalid');
    assert.equal(bad({ duration_minutes: 7.5 }), 'invalid');
    assert.equal(bad({ duration_minutes: 601 }), 'invalid');
    assert.equal(bad({ id: 'x' }), 'invalid');
    assert.equal(kind(parseTrackContent({})), 'invalid');
    assert.equal(kind(parseTrackContent({ modules: Array.from({ length: 31 }, () => ({ title: 'M', lessons: [] })) })), 'invalid');
  });

  it('status: só published e discontinued', () => {
    assert.equal(unwrap(parseTrackStatus({ status: 'discontinued' })), 'discontinued');
    assert.equal(kind(parseTrackStatus({ status: 'draft' })), 'invalid');
    assert.equal(kind(parseTrackStatus({ status: 'deleted' })), 'invalid');
  });
});

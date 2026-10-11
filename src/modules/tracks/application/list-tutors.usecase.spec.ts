import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { givenTutor, tracksTestbed } from '../testing/track-fixtures';
import { ListTutorsUseCase } from './list-tutors.usecase';

describe('ListTutorsUseCase', () => {
  it('só cargo tutor, em ordem alfabética', async () => {
    const t = tracksTestbed();
    await givenTutor(t, 'Tiago Tutor');
    await givenTutor(t, 'Ana Admin', 'admin');
    await givenTutor(t, 'Bia Tutora');

    assert.deepEqual((await new ListTutorsUseCase(t).execute()).map((x) => x.name), ['Bia Tutora', 'Tiago Tutor']);
  });
});

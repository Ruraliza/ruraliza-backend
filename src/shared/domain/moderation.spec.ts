import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { blockedTermProblem, findBlockedTerm } from './moderation';

describe('filtro de palavrões', () => {
  it('acha palavrão com acento, maiúscula, letra repetida ou número no lugar da letra', () => {
    assert.equal(findBlockedTerm('Que PORRA é essa'), 'porra');
    assert.equal(findBlockedTerm('serviço de merdaaaa'), 'merdaaaa');
    assert.equal(findBlockedTerm('p0rr4 nenhuma'), 'porra');
    assert.equal(findBlockedTerm('Vai tomar no cu'), 'vai tomar no cu');
    assert.equal(findBlockedTerm('filho-da-puta'), 'filho-da-puta');
  });

  it('deixa passar as palavras do campo que contêm ou lembram um termo', () => {
    for (const ok of [
      'Limpeza do curral e da cultura de milho',
      'Disputa de terras? Não. Deputado? Também não.',
      'Adubação com bosta de vaca curtida',
      'Micronutrientes: B, Cu e Zn',
      'Ninho de pica-pau no mourão',
      'Troca de pneu com macaco hidráulico',
      'Plantio de milho crioulo e sementes crioulas',
      'Porteira arrombada, precisa de conserto',
      'Crescimento retardado por falta de chuva',
      'Pagamento de R$ 500 por 40 horas'
    ]) {
      assert.equal(findBlockedTerm(ok), null, ok);
    }
  });

  it('a mensagem diz qual campo revisar', () => {
    assert.equal(blockedTermProblem('no nome do serviço', 'Colheita de café'), null);
    assert.equal(blockedTermProblem('no nome do serviço', 'colheita da porra'), 'Há palavras não permitidas no nome do serviço. Reescreva sem palavrões nem ofensas.');
    assert.equal(blockedTermProblem('na descrição', null), null);
  });
});

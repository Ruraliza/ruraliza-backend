import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HIDDEN_EMAIL, HIDDEN_PHONE, maskContacts } from './chat.rules';

describe('maskContacts', () => {
  for (const phone of ['(24) 98888-7766', '24988887766', '+55 24 98888-7766', '9 8888 7766', '24.98888.7766', '3333-4444']) {
    it(`oculta o telefone "${phone}"`, () => {
      assert.deepEqual(maskContacts(`me chama no ${phone} amanhã`), { text: `me chama no ${HIDDEN_PHONE} amanhã`, masked: true });
    });
  }

  it('oculta e-mail', () => {
    assert.deepEqual(maskContacts('manda para maria@exemplo.com'), { text: `manda para ${HIDDEN_EMAIL}`, masked: true });
  });

  for (const text of ['Pago R$ 1.500,00 no fim', 'Começa dia 12/10 às 7h', 'São 40 sacos de 60 kg', 'Fica no km 15 da BR-040']) {
    it(`não mexe em "${text}"`, () => {
      assert.deepEqual(maskContacts(text), { text, masked: false });
    });
  }
});

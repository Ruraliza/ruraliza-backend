// Contrato da API: formato de entidades, entradas e respostas.
// Espelha ruraliza-frontend/src/models; `npm run check:contracts` garante que os dois batem.
// Os módulos já migrados guardam o seu contrato em src/modules/<módulo>/<nome>.contract.ts;
// este arquivo continua sendo o ponto único que o check e o código legado importam.
export type * from './api';
export type * from './auth';
export type * from './config';
export type * from './farmer';
export type * from './push';
export type * from './system';
export type * from './worker';

export type * from '../modules/farms/farm.contract';
export type * from '../modules/services/service.contract';
export type * from '../modules/hiring/hiring.contract';

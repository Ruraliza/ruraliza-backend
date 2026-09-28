import type { Farm } from '../contracts';

// Array que serve como base de dados em memória para as fazendas.
// deleted_at: preenchido quando o produtor remove a fazenda (fica guardada para o histórico dos serviços).
export const farms: Farm[] = [];

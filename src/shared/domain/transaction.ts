// Gravar várias entidades juntas: o que `work` fizer pelos repositórios que recebe vale inteiro ou,
// se ele lançar um erro, não vale nada. No PostgreSQL é uma transação (src/postgres.ts).
// Dentro de `work` use só os repositórios recebidos; avisos, pushes e outros efeitos ficam para depois dele.
export type Transaction<R> = <T>(work: (repos: R) => Promise<T>) => Promise<T>;

// Sem banco não há o que desfazer: `work` roda direto sobre os repositórios (memória e testes unitários).
export function directTransaction<R>(repos: R): Transaction<R> {
  return (work) => work(repos);
}

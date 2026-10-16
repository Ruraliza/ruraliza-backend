// Filtro de palavrões e ofensas (issue #27): títulos e descrições de vagas e os textos do perfil do
// trabalhador são recusados (400) quando têm um destes termos. A lista é a mesma do frontend
// (core/models/moderation.model.ts), que avisa antes de enviar; o `npm run check:contracts` confere que batem.
//
// Ficaram de fora, de propósito, palavras com sentido comum no campo: "bosta" (esterco), "cu" (cobre, Cu),
// "pica" (pica-pau), "rola", "pau", "saco", "vaca", "piranha", "macaco" (bicho e ferramenta), "arrombada"
// (porteira arrombada), "retardado" (crescimento retardado) e "crioulo" (milho e semente crioula).
// Escreva sem acento e em minúsculas; espaço vale para frases.
export const BLOCKED_TERMS = [
  'caralho', 'caraio', 'caralha', 'porra', 'puta', 'puto', 'putaria', 'putinha', 'merda', 'merdinha',
  'foda', 'foder', 'fuder', 'fodase', 'fodasse', 'fodido', 'fodida', 'fudido', 'fudida',
  'buceta', 'boceta', 'piroca', 'cuzao', 'cuzona',
  'viado', 'boiola', 'baitola', 'bichona', 'sapatona', 'traveco', 'vadia', 'vagabunda',
  'fdp', 'vsf', 'vtnc', 'tnc', 'pqp', 'krl',
  'filho da puta', 'filha da puta', 'vai tomar no cu', 'tomar no cu', 'toma no cu', 'no seu cu', 'pau no cu',
  'vai se foder', 'vai se fuder', 'puta que pariu', 'preto sujo', 'negro imundo'
] as const;

// Troca de letra por número ou símbolo ("p0rr4", "put@").
const LOOKALIKES: Readonly<Record<string, string>> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's' };

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[013457@$]/g, (char) => LOOKALIKES[char] ?? char);
}

// Cada letra pode se repetir ("porraaa", "caralhooo"); o espaço das frases aceita ponto, hífen e sublinhado.
function termPattern(term: string): string {
  return term.replace(/[a-z]/g, '$&+').replace(/ /g, '[\\s._-]+');
}

// Só a palavra inteira: "curral", "disputa" e "deputado" passam.
const BLOCKED = new RegExp(`(?<![a-z])(?:${BLOCKED_TERMS.map(termPattern).join('|')})(?![a-z])`);

// O termo encontrado (já normalizado) ou null.
export function findBlockedTerm(text: string): string | null {
  return BLOCKED.exec(normalize(text))?.[0] ?? null;
}

// Mensagem de erro para um campo, ou null se o texto está limpo. `where`: onde está o problema
// ("no nome do serviço", "na descrição"), para a pessoa saber o que revisar.
export function blockedTermProblem(where: string, text: string | null | undefined): string | null {
  return text && findBlockedTerm(text) !== null
    ? `Há palavras não permitidas ${where}. Reescreva sem palavrões nem ofensas.`
    : null;
}

import type { HelpArticleRepository } from '../domain/help-article';
import type { HelpTopic } from '../help.contract';

// Perguntas que a central de ajuda já traz (a equipe edita, reordena e apaga em /sistema/ajuda).
// Os textos descrevem o app como ele é hoje. TODO(db): virar migração com esses dados.
const DEFAULT_ARTICLES: readonly [HelpTopic, string, string][] = [
  ['comecar', 'O que é o Ruraliza?',
    'Um app que conecta produtores rurais a trabalhadores, prestadores de serviço e estudantes. O produtor publica o serviço, quem sabe fazer se candidata, o produtor escolhe e os dois combinam os detalhes pela conversa do app.'],
  ['comecar', 'Quanto custa?', 'Nesta fase de testes, nada. Não há cobrança para produtores nem para trabalhadores.'],
  ['comecar', 'Posso ser produtor e trabalhador na mesma conta?',
    'Sim. Você cria a conta com um perfil e depois ativa o outro em Perfil, em "Quero ser produtor" ou "Quero ser trabalhador". O e-mail e a senha são os mesmos, e você troca de painel quando quiser.'],

  ['produtores', 'Como publico um serviço?',
    'Toque em Novo, o botão do meio do menu. Escolha a fazenda, diga o que precisa ser feito, a categoria, quantas horas e quanto paga. Se quiser, coloque um prazo para as candidaturas.\nAntes, cadastre pelo menos uma fazenda em Fazendas, marcando o ponto no mapa.'],
  ['produtores', 'Como escolho quem vai fazer o serviço?',
    'Abra o serviço em Serviços. Cada candidato aparece com experiência, certificados e a nota das avaliações. Toque em "Aceitar trabalhador": os outros candidatos são avisados e a conversa com o escolhido abre na hora.'],
  ['produtores', 'Posso editar ou cancelar um serviço?',
    'Sim, enquanto ninguém foi aceito: abra o serviço e use Editar ou Cancelar. Depois do aceite, combine as mudanças pela conversa.'],
  ['produtores', 'Preciso repetir um serviço que já publiquei. Tem atalho?',
    'Tem. Abra o serviço antigo em Serviços e toque em "Publicar de novo": o formulário abre preenchido com os mesmos dados. É só ajustar o que mudou e escolher o prazo.'],

  ['trabalhadores', 'Como encontro vagas?',
    'Toque em Buscar. Dá para filtrar por categoria, carga horária, data de publicação e nota da fazenda. Cada vaga mostra a cidade, as horas e o valor antes de você se candidatar.'],
  ['trabalhadores', 'Como sei se fui aceito?',
    'Em Candidaturas você acompanha cada uma: aguardando, aceita ou recusada. Quando o produtor aceita, chega um aviso no sino e, se você ativou, nas notificações do celular e no WhatsApp.'],
  ['trabalhadores', 'Posso desistir de um serviço?',
    'Sim. Abra a vaga e toque em Desistir. Se você já tinha sido aceito, o serviço volta a receber candidaturas e o produtor é avisado. Desista o quanto antes, para não atrapalhar quem conta com você.'],

  ['pagamentos', 'Como funciona o pagamento?',
    'Nesta fase o pagamento é simulado: quando o serviço termina, o produtor toca em "Liberar pagamento" e o pagamento fica registrado no serviço. Nenhum dinheiro passa pelo app.\nCombine a forma de pagamento de verdade diretamente com a outra pessoa.'],
  ['pagamentos', 'Como funcionam as avaliações?',
    'Depois do pagamento, o produtor avalia o trabalhador (pontualidade, empenho e qualidade) e o trabalhador avalia a fazenda (infraestrutura, condições e se o serviço foi como o anúncio dizia).\nA nota só aparece quando os dois avaliam, ou 14 dias depois, para ninguém avaliar de troco.'],

  ['seguranca', 'Meu telefone fica visível?',
    'Não. Nas listas, CPF, telefone e e-mail aparecem mascarados. O WhatsApp só é liberado na conversa quando os dois tocam para liberar. Antes disso, números e e-mails escritos nas mensagens ficam ocultos.'],
  ['seguranca', 'O Ruraliza é responsável pelo trabalho combinado?',
    'Não. O Ruraliza aproxima quem precisa de quem sabe fazer: não é empregador nem agência de emprego. As condições de trabalho, a segurança (como os EPIs e a NR-31) e o pagamento são combinados e garantidos entre o produtor e o trabalhador. Os detalhes estão nos Termos de Uso.'],
  ['seguranca', 'Como denuncio uma vaga ou uma pessoa?',
    'Na vaga, toque em "Denunciar vaga", no fim da tela. Na conversa, toque em Denunciar, no alto. O produtor também denuncia um candidato pelo cartão dele no serviço.\nEscolha o motivo e, se quiser, conte o que aconteceu: só a equipe do Ruraliza lê, e a pessoa não fica sabendo quem denunciou. Quando a equipe decidir, chega um aviso para você.'],
  ['seguranca', 'Por que meu texto foi recusado?',
    'O Ruraliza não aceita palavrões nem ofensas em vagas e perfis, para o ambiente continuar profissional. Reescreva o trecho sem essas palavras; o resto do que você escreveu continua no formulário.'],
  ['seguranca', 'Meus dados estão seguros?',
    'Esta é uma versão de testes: os dados ficam na memória do servidor e são apagados quando ele reinicia. As senhas são guardadas só como código (hash) e as fotos perdem os dados de localização. Evite usar dados reais por enquanto. Os detalhes estão na Política de Privacidade.'],

  ['trilhas', 'O que são as trilhas de estudo?',
    'Cursos práticos para trabalhadores, divididos em módulos e aulas em vídeo e texto. Abra Trilhas, escolha pela categoria e comece quando quiser: o progresso fica salvo.'],
  ['trilhas', 'Como consigo o certificado?',
    'Ao concluir a última aula, o certificado sai em nome da Ruraliza, com seu nome, a carga horária e a data. Você baixa em PDF, e qualquer pessoa confere a autenticidade pelo código, em Validar certificado.'],

  ['conta', 'Esqueci minha senha. E agora?',
    'Na tela de entrada, toque em "Esqueci minha senha" e informe seu e-mail. Nesta versão de testes o código não vai por e-mail: o app leva você direto para criar a senha nova.'],
  ['conta', 'Como deixo as letras maiores?',
    'Toque no Aa no alto da tela: as letras ficam 25% maiores e as cores mais fortes, bom para ler sob o sol. Em Perfil, no cartão Aparência e leitura, você também escolhe o tema escuro.'],
  ['conta', 'Como excluo minha conta?',
    'Em Perfil, toque em "Excluir conta". Seu perfil, suas fotos e seus dados saem do Ruraliza. Se houver serviço em andamento, conclua ou combine a desistência antes.']
];

export async function createDefaultHelpArticles(helpArticles: HelpArticleRepository, now: string): Promise<void> {
  const positions = new Map<HelpTopic, number>();
  for (const [topic, question, answer] of DEFAULT_ARTICLES) {
    const position = (positions.get(topic) ?? 0) + 1;
    positions.set(topic, position);
    await helpArticles.create({ question, answer, topic, position, published: true, updated_at: now });
  }
}

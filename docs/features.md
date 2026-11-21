# Funcionalidades

O que a API do Ruraliza faz, uma funcionalidade por seção: para que serve, as regras principais, o módulo responsável e as rotas de entrada. O detalhe de cada rota (campos, status de erro) está no [README](../README.md#️-rotas) e no Swagger (`/api/docs`); o escopo e os limites do produto, em [PRODUCT.md](../PRODUCT.md); a estrutura do código, em [architecture.md](architecture.md).

Os módulos citados ficam em `src/modules/<módulo>/`.

## Visão geral

O Ruraliza conecta produtores rurais a trabalhadores, prestadores e estudantes. A API cobre o caminho completo de uma contratação:

1. O produtor cadastra a fazenda e publica uma vaga (serviço).
2. O trabalhador encontra a vaga pela busca ou pelas recomendações e se candidata.
3. O produtor aceita um candidato; o serviço entra em andamento e a conversa dos dois abre.
4. O produtor libera o pagamento (simulado) e o serviço fica concluído.
5. Os dois se avaliam, e as notas formam a reputação de cada um.

Em volta desse caminho ficam a formação (trilhas e certificados), os avisos (central, push e tempo real), a segurança da plataforma (verificação de identidade, denúncias, filtro de palavrões) e as ferramentas da equipe (administração, central de ajuda, patrocínios).

| Quem usa | O que faz |
|---|---|
| Produtor | Cadastra fazendas, publica vagas, analisa candidaturas, libera o pagamento, avalia o trabalhador e vê o painel da fazenda |
| Trabalhador | Busca vagas, se candidata, conversa com o produtor, estuda trilhas, recebe certificados e avalia a fazenda |
| Equipe (`admin` e `tutor`) | Gerencia contas, equipe, trilhas, ajuda, patrocínios, denúncias e verificações |

## Contas e acesso

### Cadastro e conta (`accounts`, `farmers`, `workers`)

- Uma conta por pessoa, com e-mail e CPF únicos. O cadastro escolhe o primeiro perfil (`POST /api/farmers` ou `POST /api/workers`) e já devolve a sessão.
- O cadastro exige o aceite dos termos (`accept_terms: true`). A conta guarda a versão aceita e a data, para provar o consentimento (LGPD).
- A mesma conta pode ter os dois perfis, com o mesmo e-mail e a mesma senha (`POST /api/accounts/:id/profiles`), e alterna o painel aberto (`PATCH /api/accounts/:id/active-role`).
- Quem tem os dois perfis não se candidata a uma vaga que publicou como produtor.
- Cada pessoa edita o próprio perfil (nome, e-mail, telefone; o trabalhador também apresentação, experiência, certificados e cursos). CPF não muda.
- Remover um perfil apaga o que depende dele (fazendas, serviços, candidaturas, fotos, currículo, avaliações, avisos). Com serviço em andamento, a remoção é recusada (409).

### Login e senha (`auth`)

- `POST /api/auth/login` confere e-mail e senha e devolve um token Bearer válido por 12 horas. E-mail ou senha errados dão a mesma mensagem.
- Toda rota não pública exige o token e confere o dono: uma conta só mexe nos próprios perfis, fazendas, serviços e candidaturas. Sem token, 401; token de outra pessoa, 403.
- Conta e perfis são relidos a cada requisição, então uma conta removida perde o acesso na hora.
- Troca de senha com a conta aberta: `PATCH /api/{farmers|workers}/:id/password`, confirmando a senha atual.
- "Esqueci a senha" (`POST /api/auth/password-reset` e `/confirm`): a resposta é sempre a mesma, com ou sem conta para o e-mail, e nunca devolve o código. O código vale 30 minutos e uma vez só. Como o envio por e-mail ainda não existe, a redefinição só funciona no `npm run dev`, com o código no terminal.
- As senhas ficam guardadas com hash scrypt, fora do perfil, e nunca saem numa resposta.

### Preferências da conta (`accounts`)

`GET` e `PATCH /api/accounts/:id/preferences` guardam o tema (claro, escuro ou do sistema), o tamanho do texto e o alto contraste. Valem nos dois painéis e em qualquer aparelho.

## Fazendas e vagas

### Fazendas (`farms`)

- O produtor cadastra fazendas com endereço, cidade, UF e o ponto marcado no mapa (`/api/farmers/:id/farms`).
- Cada fazenda aceita até 6 fotos; a primeira é a capa.
- Remover uma fazenda a arquiva: ela some das listas, mas os serviços encerrados continuam com ela. Com serviço aberto ou em andamento, a remoção é recusada.
- As coordenadas só chegam ao trabalhador aceito no serviço. Nas vagas abertas ele vê apenas cidade e UF.

### Vagas (`services`)

- O produtor publica um serviço numa fazenda com nome, categoria, duração em horas, preço e, se quiser, descrição e prazo (`POST /api/farmers/services`).
- Os tipos de serviço (categorias) são uma lista fixa em dois níveis, grupo > serviço: Lavoura e horta, Cercas e construções, Água, Pasto e terreno, Animais, Máquinas e Outros, cada um com os seus serviços (a lista completa está no [PRODUCT.md](../PRODUCT.md)). `GET /api/categories` devolve a lista plana dos serviços e `GET /api/categories/groups`, os grupos. A vaga guarda o serviço; publicar ou editar com um valor fora da lista dá 400.
- Um serviço passa por `Pending` (aberto), `In Progress` (com trabalhador aceito), `Completed` (pago) ou `Cancelled`. Só dá para editar ou cancelar enquanto está `Pending`; cancelar recusa as candidaturas pendentes.
- Prazo (`expires_at`): a vaga aceita candidaturas até o fim desse dia no horário de Brasília. Vencida, some da busca e recusa candidaturas até o produtor renovar a data.

### Busca de vagas (`services`)

`GET /api/workers/services` lista as vagas abertas e dentro do prazo, com cidade, UF, fotos e reputação da fazenda. Os filtros se combinam: texto livre (sem diferenciar acentos), serviço, grupo de serviços, duração, dia de publicação e nota mínima da fazenda. A ordenação pode ser por mais recente, preço, duração ou nota.

### Vagas para você: recomendações e avisos (`matching`)

- O trabalhador informa as categorias que quer, a região ("perto de mim", guardada com cerca de 1 km de precisão, e um raio de 5 a 300 km) e se quer avisos (`/api/workers/:id/job-preferences`).
- `GET /api/workers/:id/recommended-jobs` sugere as vagas que combinam: pela categoria escolhida, pelas trilhas que ele faz e, sem nada disso, pelas categorias em que já se candidatou. Fazenda bem avaliada e produtor verificado ajudam no desempate. Cada vaga vem com os motivos e a distância aproximada.
- A distância é calculada na API; o ponto da fazenda nunca sai na resposta.
- Com os avisos ligados, quem combina com uma vaga nova recebe "Vaga nova perto de você" na hora (no máximo 3 por dia) e, uma vez por semana, um resumo das vagas encontradas.

## Contratação

### Candidatura e aceite (`hiring`)

- O trabalhador se candidata (`POST /api/workers/services/:id/apply`): uma candidatura por vaga, só em vaga aberta e dentro do prazo.
- O produtor vê os candidatos com a reputação e o selo de verificado de cada um (`GET /api/farmers/services/:id/applications`). CPF, telefone e e-mail vêm mascarados.
- O produtor aceita ou recusa (`PATCH /api/farmers/services/:id/analyze`). O aceite coloca o serviço em andamento e recusa as outras candidaturas.
- O trabalhador pode desistir (`PATCH /api/workers/services/:id/withdraw`) e volta uma etapa: a candidatura pendente é removida; se já tinha sido aceito, o serviço volta a `Pending` e as candidaturas recusadas pelo aceite voltam à fila.
- Aceite, desistência e pagamento gravam tudo numa transação: ou tudo fica gravado, ou nada.

### Pagamento simulado (`hiring`)

`POST /api/farmers/services/:id/payment` "libera" o pagamento de um serviço em andamento: cria o registro do pagamento e conclui o serviço. Não há dinheiro real. É esse momento que valida o trabalho no app e abre o prazo das avaliações.

### Conversa (`chat`)

Conversa interna de cada contratação, para os dois combinarem o serviço sem expor o contato antes da hora.

- Abre no aceite, fecha se o trabalhador desistir e fica aberta por 7 dias depois do pagamento. Fechada, continua legível.
- Só o produtor e o trabalhador daquela contratação leem e escrevem (`/api/chats/:id`, mensagens de até 1000 caracteres).
- Consentimento duplo para o WhatsApp: cada lado libera o próprio número (`PATCH /api/chats/:id/phone`) e os números só aparecem quando os dois liberaram. Antes disso, telefones e e-mails escritos nas mensagens saem ocultos.
- Cada pessoa tem o seu contador de não lidas, e cada mensagem gera um aviso para a outra parte.

### Avaliações e reputação (`reviews`)

- Depois do pagamento, o produtor avalia o trabalhador (pontualidade, empenho e qualidade) e o trabalhador avalia a fazenda (infraestrutura, condições de trabalho e se o serviço foi como o anúncio). Notas de 1 a 5 e comentário opcional.
- A avaliação é cega: a nota de um lado só aparece para o outro, e só entra na reputação, quando os dois avaliaram ou quando o prazo de 14 dias acaba.
- Cada lado avalia uma vez, sem edição.
- A reputação traz a média geral, a média por critério e a quantidade. Para ordenar, usa uma média ponderada, para que uma única nota 5 não passe na frente de muitas notas 4,8.
- Quem avaliou não é identificado nas listas públicas (`GET /api/reviews/workers/:id` e `/api/reviews/farms/:id`).
- A reputação aparece onde se escolhe: na lista de candidatos e nas vagas.

### Painel da fazenda (`farm-stats`)

`GET /api/farmers/:id/stats` reúne os números do produtor em todas as fazendas: horas e serviços concluídos, valor pago, quantas pessoas trabalharam com ele e quantas voltaram, nota média, vagas abertas, candidaturas esperando resposta, os últimos 6 meses, as categorias e quem já passou por lá.

## Formação

### Trilhas de estudo (`tracks`)

- Cursos para os trabalhadores, divididos em módulos e aulas. Cada aula tem vídeo (YouTube ou Vimeo), texto ou os dois, e uma duração; a carga horária da trilha é a soma.
- Os tutores montam as trilhas em `/api/admin/tracks`. A trilha nasce em rascunho, é publicada e pode ser descontinuada ou reativada; não há remoção.
- Trilha descontinuada some da lista e não aceita alunos novos, mas quem já começou termina.
- O trabalhador vê as trilhas disponíveis, se matricula e marca as aulas concluídas (`/api/workers/tracks` e `/api/workers/:id/tracks/:trackId`).

### Certificados (`tracks`)

- Concluir a última aula emite o certificado, com o nome, a trilha, a carga horária e a data guardados como estavam na emissão.
- Cada certificado tem um código e um resumo SHA-256 dos seus dados. Qualquer pessoa confere os dois em `GET /api/certificates/:code`, sem login.
- O resumo detecta alteração dos dados, mas não é assinatura digital: quem garante o certificado é a validação pelo código.

## Avisos e tempo real

Tudo o que a plataforma precisa avisar sai por até quatro caminhos. O envio roda em segundo plano: uma falha em qualquer um vai só para o log e não afeta a operação que gerou o aviso.

### Central de notificações (`notifications`)

O histórico do sino do app (`/api/farmers/:id/notifications` e `/api/workers/:id/notifications`). Guarda até 100 avisos por perfil, mesmo para quem não ativou o push, com o total de não lidos. Avisos iguais ainda não lidos, como várias mensagens na mesma conversa, viram um só com contagem.

### Notificações push (`notifications`)

Web Push para quem precisa agir com o app fechado. A conta inscreve cada navegador (`/api/accounts/:id/push-subscriptions`). O produtor é avisado de candidatura e desistência; o trabalhador, de aceite, recusa, cancelamento e pagamento; os dois, de mensagem nova, pedido de WhatsApp e avaliação recebida. O clique abre o app na tela certa. Depende das chaves VAPID no `.env`.

### Atualização em tempo real (`live` e streams dos módulos)

As telas se atualizam sozinhas por Server-Sent Events. O aviso não traz dados: a tela busca a lista de novo. Há streams por assunto (candidaturas, conversa, lista de conversas, notificações) e um stream único por perfil (`GET /api/farmers/:id/live` e `/api/workers/:id/live`), que evita esgotar o limite de conexões do navegador. Vale para uma instância da API só.

## Segurança da plataforma

### Verificação de identidade (`verification`)

- A pessoa envia a foto da frente do RG ou da CNH (`POST /api/{farmers|workers}/:id/verification`). A equipe confere nome e CPF com os do perfil e aprova ou recusa, com o motivo.
- Aprovado, o perfil ganha o selo de verificado, que aparece para o produtor nos candidatos e para o trabalhador nas vagas. Se a pessoa muda o nome, o selo some até verificar de novo.
- A foto do documento fica num armazenamento privado, só a equipe a vê, e ela é apagada logo depois da decisão.

### Denúncias (`reports`)

- O trabalhador denuncia uma vaga ou um produtor a cuja vaga se candidatou; o produtor denuncia um trabalhador que se candidatou a um serviço dele.
- Motivos: fraude, condições de trabalho, comportamento, conteúdo ofensivo ou outro, com um relato de até 500 caracteres.
- A equipe decide se a denúncia é procedente ou descartada (`/api/admin/reports`). Quem denunciou recebe o resultado; quem foi denunciado não fica sabendo quem denunciou.
- A decisão só registra o resultado. Remover a conta ou editar o perfil é feito na administração.

### Filtro de palavrões (`src/shared/domain/moderation.ts`)

Títulos e descrições de vagas e os textos do perfil do trabalhador são recusados quando têm palavrão ou ofensa. O filtro reconhece variações (acento, maiúscula, letra repetida, número no lugar da letra) e deixa passar palavras com sentido comum no campo. O frontend usa a mesma lista. O relato das denúncias não passa pelo filtro, para quem denuncia uma ofensa poder contar o que ouviu.

### Proteção de dados pessoais

- CPF sai mascarado em listas e respostas embutidas.
- Telefone e e-mail do trabalhador ficam ocultos para o produtor até os dois liberarem o WhatsApp na conversa.
- As fotos enviadas perdem os metadados (EXIF e GPS).
- Nenhum dado de quem usa o app vai para os anunciantes.

## Arquivos

### Fotos e currículo (`media`)

- Foto de perfil de produtor e de trabalhador, fotos da fazenda e logo de patrocínio. Toda foto é corrigida, reduzida para no máximo 1000 px e convertida para WebP; a de perfil sai sempre quadrada. Arquivo que não é imagem é recusado; o limite é 10 MB.
- O trabalhador pode enviar um currículo em PDF de até 5 MB (`POST /api/workers/:id/resume`).
- As entidades guardam só a URL. Os arquivos saem por `GET /api/images/:id` e `GET /api/documents/:id`.
- Os bytes ficam em memória, no PostgreSQL ou num bucket privado do Supabase Storage, conforme a configuração (ver [Armazenamento](../README.md#-armazenamento)).

## Ferramentas da equipe

### Usuários de sistema e permissões (`system-users`, `auth`)

A equipe tem login próprio (`POST /api/auth/system/login`), separado das contas do app e sem cadastro público. Cada rota pede uma permissão, não um cargo:

| Cargo | Permissões |
|---|---|
| `admin` | Contas do app, equipe, supervisão de todas as trilhas, conteúdo (ajuda e patrocínios) e moderação (denúncias e verificações) |
| `tutor` | Criar trilhas e editar as de que é tutor |

O administrador cadastra e edita a equipe em `/api/admin/system-users`. Ele não muda o próprio cargo, para a equipe nunca ficar sem administrador.

### Administração de contas (`admin`)

Em `/api/admin/users` a equipe lista as contas do app, abre uma conta com os perfis completos, edita ou remove um perfil, remove a conta inteira e tira uma foto de perfil imprópria.

### Central de ajuda (`help`)

Perguntas frequentes que a equipe edita sem mexer no código: cria, edita, reordena, publica ou deixa em rascunho (`/api/admin/help`). A lista pública (`GET /api/help`) vem agrupada por tema e não exige login. O servidor já sobe com um conjunto padrão de perguntas.

### Patrocínios (`sponsors`)

- Um cartão marcado como "Patrocinado" no Início de produtores e trabalhadores, para lojas agropecuárias, revendas e marcas.
- A equipe cadastra o anunciante, a chamada, o link, a logo, o público, as UFs, as categorias e o período, e acompanha aparições e cliques (`/api/admin/sponsors`).
- A rotação mostra, entre os que servem para quem pediu, o que menos apareceu (`GET /api/sponsors/slot`).
- O cartão é pedido sem login e o link abre direto a página do anunciante.

## Apoio ao app

### Configuração e saúde (`platform`, `notifications`)

- `GET /api/health`: verificação de que a API está no ar.
- `GET /api/config/maps`: chave e Map ID do Google Maps, só para as origens do frontend.
- `GET /api/config/push`: chave pública das notificações push.

### Documentação da API

O Swagger (`/api/docs`) e o OpenAPI (`/api/docs/openapi.json`) são gerados das mesmas declarações das rotas, então não existe rota sem documentação. O teste e2e confere toda resposta contra esse documento.

### Dados de demonstração

Ao subir, o servidor cria contas, fazendas, vagas, histórico de serviços, conversas, avaliações e trilhas de teste (`SEED_DEMO=false` desliga). As contas estão em [Usuários de teste](../README.md#usuários-de-teste).

## O que ainda não existe

Envio de e-mail, pagamento real, assinatura digital dos certificados, registro de horas, relatórios em PDF e várias instâncias da API. A lista completa está em [Próximos passos](../README.md#️-próximos-passos).

## Manutenção

Atualize este documento quando uma funcionalidade entrar, sair ou mudar de regra. O detalhe das rotas continua no README.

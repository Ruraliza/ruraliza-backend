# Estudo: assinatura gov.br nos certificados (issue #33)

**Pergunta do card:** dar validade legal aos certificados das trilhas e evitar falsificação integrando a assinatura do
Gov.br, com metadados no PDF e um selo "Documento autenticado pelo Gov.br" na tela de download.

**Resposta curta:** a integração direta com a assinatura gov.br não está disponível para o Ruraliza hoje, e o selo não
deve ser colocado sem a assinatura de verdade. Há dois caminhos possíveis, descritos abaixo.

## O que a plataforma gov.br oferece

- A Plataforma de Assinatura GOV.BR tem o portal de assinaturas (a pessoa assina um PDF com a própria conta gov.br), a
  API de assinatura para sistemas e o validador público em [validar.iti.gov.br](https://validar.iti.gov.br). A
  assinatura gov.br é **avançada** pela Lei 14.063/2020 (a ICP-Brasil é a **qualificada**).
- **Quem pode integrar a API:** órgãos públicos federais, estaduais e municipais, com regulamento próprio. As credenciais
  são pedidas por um gestor público, e as de produção exigem que o sistema já use o Login Único gov.br e esteja num
  domínio oficial de governo (gov.br, edu.br, jus.br...), conforme a Portaria SGD/MGI nº 7.076/2024. Empresas privadas
  não têm acesso hoje (há também a Portaria SGD/MGI nº 11.230/2025, que vale conferir quando for decidir).
- Fontes: [Assinatura eletrônica para órgãos](https://www.gov.br/governodigital/pt-br/identidade/assinatura-eletronica/assinatura-eletronica-para-orgaos),
  [manual de integração](https://manual-integracao-assinatura-eletronica.servicos.gov.br/pt-br/4.0/introducao.html) e
  [repositório do manual](https://github.com/servicosgovbr/manual-integracao-assinatura-eletronica).

## Por que não colocar o selo agora

Um selo "autenticado pelo Gov.br" num documento que não foi assinado pelo gov.br engana quem confere o certificado
(e usa a marca do governo sem autorização). O que o Ruraliza já tem é honesto e funciona: cada certificado tem um
**código**, e qualquer pessoa confere a autenticidade em "Validar certificado" (`GET /api/certificates/:code`), com os
dados guardados no momento da emissão.

## Caminhos possíveis

1. **Assinatura digital ICP-Brasil da própria Ruraliza (recomendado quando houver CNPJ).** Um certificado digital
   e-CNPJ A1 (arquivo .pfx) assina cada PDF no servidor (padrão PAdES), o que dá assinatura **qualificada**, que qualquer
   pessoa confere no validador do ITI. Custo: o certificado A1 (renovação anual) e guardar a chave com segurança (cofre
   de segredos, nunca no repositório). No código, a emissão do PDF ganharia um passo de assinatura; o selo passaria a
   ser "Assinado digitalmente (ICP-Brasil)", com o link para o validador.
2. **Parceria com uma instituição pública.** Se o certificado for usado como horas complementares de um curso
   (instituto federal, universidade pública), a própria instituição, que pode integrar a API gov.br, assinaria os
   certificados emitidos em parceria. Exige convênio e integração do lado da instituição.

## Melhorias que já cabem agora, sem custo

- QR code no PDF apontando para a página de validação do código.
- Mostrar na validação um resumo (hash SHA-256) dos dados do certificado, para provar que nada foi alterado.

As duas já estão no app: o certificado guarda o resumo (`data_hash`) desde a emissão, o PDF traz o resumo e o QR code,
e a página de validação mostra o resumo e confere se ele bate com os dados.

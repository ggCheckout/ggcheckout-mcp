import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export const BUYER_MESSAGING_URI = 'ggcheckout://docs/buyer-messaging';
const MARKDOWN = 'text/markdown';

/**
 * How the store talks to a buyer, for the seller's own Claude: the three bands, the owner of each
 * moment and the daily limit per person. Written in pt-BR, the seller's language, so Claude can quote
 * it when the seller asks "who messages my buyer, and when".
 */
export const BUYER_MESSAGING_DOC = `# Como a sua loja fala com o comprador

Cada momento da compra tem um dono só, para o comprador nunca receber duas mensagens sobre a mesma coisa. Os momentos ficam em três faixas, e a tela Recuperar vendas > Visão geral mostra quem é o dono de cada um.

## 1. Avisos

As mensagens automáticas da compra:

- **Pix ou boleto gerado:** o aviso "Pendente" manda o código.
- **Compra aprovada:** o aviso "Aprovado" e a entrega mandam a confirmação e o acesso.

Os avisos sempre saem e não contam no limite por pessoa. Dá para editar o texto e desligar cada um, mas desligar deixa o comprador sem o código do Pix ou sem o acesso. Por isso a tela pede confirmação, e a linha aparece como "Desligado" na Visão geral.

## 2. Recuperação e venda

Um funil por momento:

- Pix não pago;
- Pix expirado;
- cartão recusado ou cancelado;
- carrinho abandonado;
- depois da compra (funil "Pós-compra", com boas-vindas e oferta).

Momento sem funil não manda nada. Ligar um segundo funil para o mesmo momento troca o dono: o anterior é desligado.

Um passo do funil pode ser **"Assistente escreve"**, com um objetivo (lembrete de Pix, boas-vindas, oferta ou livre) e um prazo. Se o assistente não mandar até o prazo, o funil segue para o próximo passo. Com o assistente desligado, o passo é pulado na hora, e a Visão geral avisa.

**Limite por pessoa:** cada comprador recebe 1 mensagem de recuperação ou venda por dia, somando todos os funis. Você pode subir para até 3. Avisos e respostas na conversa não contam. Uma mensagem barrada pelo limite espera a vaga dentro do prazo do próprio passo. Se o prazo vencer, ela é pulada, e o motivo aparece na linha do tempo do comprador. Quando duas esperam, sai primeiro o Pix não pago, depois o cartão, o carrinho e por último o pós-compra.

A compra encerra todos os funis de recuperação do comprador.

A recuperação antiga (a escada de mensagens de Pix e cartão) virou um funil com os mesmos textos e tempos.

## 3. Conversa

Quando o comprador responde, os funis de recuperação dele param, e a conversa fica com o assistente (se estiver ligado) ou com a sua equipe na Caixa de entrada.

O assistente lê a linha do tempo do comprador (o que os avisos e os funis já mandaram e o que vem a seguir) e não repete o que já saiu. Ele nunca manda o código do Pix ou o acesso por conta própria, só quando o comprador pede.

## Linha do tempo do comprador

Tudo que foi enviado a um contato (aviso, funil, passo do assistente, resposta), com a hora e o resultado, mais o próximo envio previsto. É a mesma linha do tempo que você vê nas jornadas, e é o que o assistente lê antes de escrever.
`;

/** Registered for a seller key only: an assistant run (`ggck_agent_`) reads its rules from its prompt. */
export function registerBuyerMessagingDoc(server: McpServer): void {
  server.registerResource('buyer_messaging', BUYER_MESSAGING_URI, {
    mimeType: MARKDOWN,
    description: 'How the store talks to its buyers (in pt-BR, for the seller): the three bands (notices, recovery and sales, conversation), the owner of each moment, the "assistant writes" funnel step and the daily limit per person.',
  }, async () => ({
    contents: [{ uri: BUYER_MESSAGING_URI, mimeType: MARKDOWN, text: BUYER_MESSAGING_DOC }],
  }));
}

import type { GuideProblem, GuideSection, GuideTopic, TrackingGuide } from '../types/tracking.js';

/**
 * How a sale's metrics travel from the checkout to Meta, TikTok, Google Ads and UTMify, and why they
 * go missing. One source: `explain_tracking` answers from it, and the tracking view draws it.
 * Written from how the checkout, funnel and store behave today, in pt-BR for the seller.
 */
export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: 'paths',
    title: 'Caminhos dos eventos',
    summary: 'Cada evento pode chegar às plataformas por dois caminhos: o navegador do comprador e o servidor do GGCheckout.',
    items: [
      {
        title: 'Credenciais',
        body: 'Ficam em tokens do cofre, um por integração (Meta, TikTok, Google Ads e UTMify). O checkout e o funil apontam para o token, e o valor do token nunca aparece para você nem para o assistente.',
      },
      {
        title: 'Modo de rastreio',
        body: 'Cada token tem um modo. "pixel" dispara só no navegador. "events_api" dispara só pelo servidor. "both" dispara nos dois e depende da deduplicação. No painel, em Configurações > Métricas, o campo "Modo de Rastreamento" mostra "Ambos (Recomendado)" para "both". Meta e TikTok começam em "both"; Google Ads começa em "events_api".',
      },
      {
        title: 'Kwai',
        body: 'Não há integração com o Kwai.',
      },
    ],
  },
  {
    id: 'initiate_checkout',
    title: 'Início de compra (InitiateCheckout)',
    summary: 'Dispara quando o comprador abre o checkout e de novo, pelo servidor, quando o pedido é criado.',
    items: [
      {
        title: 'No navegador',
        body: 'Ao carregar o checkout saem PageView, ViewContent e InitiateCheckout (Meta e TikTok). AddToCart sai quando o comprador marca um order bump.',
      },
      {
        title: 'No servidor',
        body: 'Ao criar o pedido, a fila de métricas envia InitiateCheckout para a API de Conversões da Meta e para o TikTok, e initiate_checkout para a UTMify.',
      },
      {
        title: 'Só servidor não tem evento de navegador',
        body: 'Com o modo "events_api" o navegador não dispara InitiateCheckout. Isso é esperado e não é erro, mas a Meta e o TikTok ficam sem o sinal do navegador.',
      },
    ],
  },
  {
    id: 'purchase',
    title: 'Compra (Purchase)',
    summary: 'A compra é confirmada pelo servidor quando o pagamento é aprovado. O navegador só ajuda se a aba ainda estiver aberta.',
    items: [
      {
        title: 'No navegador',
        body: 'O Purchase do navegador só sai enquanto a aba do checkout estiver aberta no momento da aprovação.',
      },
      {
        title: 'No servidor',
        body: 'Quando o pagamento é aprovado, o servidor envia Purchase para a Meta e para o TikTok, purchase para a UTMify e a conversão do Google Ads. Depois, a UTMify recebe refunded e chargedback se ocorrerem.',
      },
      {
        title: 'Modo "pixel" perde compras',
        body: 'Quem paga o PIX depois de fechar a aba não gera Purchase no navegador, e o modo "pixel" não tem o envio do servidor para cobrir. Use "both" (no painel, "Ambos (Recomendado)").',
      },
    ],
  },
  {
    id: 'utms',
    title: 'UTMs e identificadores de clique',
    summary: 'A atribuição só existe se os parâmetros chegarem ao checkout na URL, porque ele não guarda nada entre visitas.',
    items: [
      {
        title: 'Checkout',
        body: 'Lê somente a query string da URL em que foi aberto. Não persiste UTMs: sem parâmetros na URL, a venda sai sem UTMs.',
      },
      {
        title: 'Funil, loja, upsell e downsell',
        body: 'O funil repassa os parâmetros ao checkout. A loja guarda os parâmetros por 7 dias no navegador. Upsell e downsell herdam os da compra principal.',
      },
      {
        title: 'Onde ficam na venda',
        body: 'As UTMs ficam guardadas na venda, junto dos identificadores de clique da Meta (fbc e fbp) e do TikTok (ttclid e ttp).',
      },
      {
        title: 'utm_source=organic',
        body: 'O script da UTMify grava utm_source=organic quando não encontra nenhum parâmetro, e guarda as UTMs por 7 dias no navegador. Por isso vendas do funil podem aparecer como orgânicas.',
      },
    ],
  },
  {
    id: 'dedup',
    title: 'Deduplicação',
    summary: 'Com o modo "both", navegador e servidor mandam o mesmo evento, e a plataforma junta os dois pelo identificador do evento.',
    items: [
      {
        title: 'Identificador do evento',
        body: 'É formado por uma base mais o nome do evento. Na compra, a base é o código da venda nos dois lados, então a junção é confiável.',
      },
      {
        title: 'InitiateCheckout é mais frágil',
        body: 'No navegador a base é um código calculado a partir do e-mail (ou da visita anônima) e da hora, guardado só naquela aba. No servidor é o identificador que o navegador mandou, ou um código calculado a partir de e-mail, produto e hora.',
      },
      {
        title: 'Quando a junção falha',
        body: 'Em outra aba, com o armazenamento do navegador bloqueado ou quando a hora vira entre o navegador e o servidor. O evento conta duas vezes.',
      },
      {
        title: 'UTMify',
        body: 'Nunca deduplica: se ela recebe o mesmo evento por dois caminhos, conta os dois.',
      },
    ],
  },
  {
    id: 'funnel',
    title: 'Funil e quiz',
    summary: 'O funil mede a visita e deixa a compra para o checkout aberto a partir dele.',
    items: [
      {
        title: 'O que dispara no funil',
        body: 'Só PageView no navegador (Meta e TikTok) e a configuração do Google. Não há Lead nem InitiateCheckout no funil, por desenho.',
      },
      {
        title: 'UTMify no funil',
        body: 'Carrega os scripts da UTMify quando o pixel dela está configurado no funil. Sem o pixel da UTMify configurado, a atribuição depende dos parâmetros do link.',
      },
      {
        title: 'Checkout aberto do funil',
        body: 'Dispara os próprios eventos, com os tokens do checkout. Os parâmetros da URL do funil são repassados a ele.',
      },
    ],
  },
  {
    id: 'store',
    title: 'Loja',
    summary: 'A loja guarda a origem do visitante por um tempo e a entrega ao checkout.',
    items: [
      {
        title: 'Origem guardada por 7 dias',
        body: 'A loja mantém as UTMs no navegador por 7 dias. Quem volta depois disso, ou de outro aparelho, chega sem origem.',
      },
      {
        title: 'Upsell e downsell',
        body: 'Herdam as UTMs e os identificadores da compra principal, sem depender de novos parâmetros na URL.',
      },
    ],
  },
  {
    id: 'errors',
    title: 'Erros e saúde dos tokens',
    summary: 'Cada envio do servidor deixa um resultado no pagamento, e o token guarda o histórico de falhas.',
    items: [
      {
        title: 'No pagamento',
        body: 'O resultado de cada canal (Meta, TikTok, Google Ads e UTMify) fica no registro de envio da venda, com o que foi enviado, o que falhou e o erro do provedor.',
      },
      {
        title: 'No token',
        body: 'O token guarda quantas falhas seguidas houve, o último erro e o motivo da desativação. Depois de 3 falhas seguidas, ou de um erro permanente, ele é desativado e para de enviar.',
      },
      {
        title: 'Erros recentes',
        body: 'Há um registro de erros por canal, mantido por 24 horas por padrão. O diagnóstico de rastreamento lê esse registro junto com os tokens.',
      },
    ],
  },
];

export const GUIDE_PROBLEMS: Array<GuideProblem & { topics: GuideTopic[] }> = [
  {
    topics: ['utms', 'funnel', 'store'],
    symptom: 'A venda chegou sem UTMs',
    causes: [
      'O link do anúncio ou da divulgação não tem parâmetros.',
      'Os parâmetros do anúncio não estão configurados na plataforma de anúncios.',
      'Um redirecionamento no caminho descarta a query string.',
      'O comprador reabriu o checkout sem a query string, e o checkout não guarda UTMs.',
    ],
    fixes: [
      'Confira se o link final tem utm_source, utm_medium e utm_campaign.',
      'Ative os parâmetros de URL nos anúncios.',
      'Teste o link com um clique real e veja se a query chega ao checkout.',
    ],
  },
  {
    topics: ['utms', 'funnel'],
    symptom: 'Vendas do funil aparecem como utm_source=organic',
    causes: [
      'O script da UTMify grava "organic" quando não encontra parâmetros.',
      'O link do anúncio para o funil estava sem UTMs.',
    ],
    fixes: [
      'Coloque as UTMs no link que leva ao funil.',
      'Confirme se o funil repassa os parâmetros ao checkout.',
    ],
  },
  {
    topics: ['purchase', 'paths'],
    symptom: 'A compra de PIX não aparece na Meta ou no TikTok',
    causes: [
      'O token está no modo "pixel" e o comprador pagou depois de fechar a aba.',
      'O token do checkout foi desativado depois de falhas seguidas.',
    ],
    fixes: [
      'Em Configurações > Métricas, troque o "Modo de Rastreamento" para "Ambos (Recomendado)".',
      'Peça um diagnóstico de rastreamento aqui no chat e veja se o token está desativado ou com falhas.',
    ],
  },
  {
    topics: ['dedup', 'paths'],
    symptom: 'Eventos duplicados na Meta ou no TikTok',
    causes: [
      'A deduplicação do InitiateCheckout falhou: outra aba, armazenamento bloqueado ou virada de hora.',
      'O mesmo pixel está cadastrado em dois tokens, e o servidor envia o evento duas vezes.',
    ],
    fixes: [
      'Em Configurações > Métricas, mantenha uma integração por pixel e escolha só ela em "Pixels & Rastreio" no checkout.',
      'Para a Purchase não há o que ajustar: ela usa o id do pagamento nos dois lados.',
    ],
  },
  {
    topics: ['dedup'],
    symptom: 'A UTMify mostra eventos em dobro',
    causes: ['A UTMify nunca deduplica e recebeu o mesmo evento por dois caminhos.'],
    fixes: ['Confira se há dois tokens utmify no mesmo checkout ou funil e deixe só um.'],
  },
  {
    topics: ['errors', 'paths'],
    symptom: 'Nada chega a uma plataforma de repente',
    causes: [
      'O token foi desativado depois de 3 falhas ou de um erro permanente (credencial vencida ou sem permissão).',
      'O checkout aponta para um token que foi removido.',
    ],
    fixes: [
      'Em Configurações > Métricas, corrija a credencial da integração e salve: salvar reativa o token.',
      'Escolha o pixel novo na seção "Pixels & Rastreio" do editor do checkout e peça um novo diagnóstico aqui no chat para confirmar.',
    ],
  },
  {
    topics: ['funnel', 'initiate_checkout'],
    symptom: 'O funil não mostra Lead nem InitiateCheckout',
    causes: ['O funil só dispara PageView por desenho; o resto sai no checkout aberto a partir dele.'],
    fixes: ['Analise as conversões no checkout, não no funil.'],
  },
];

/** The guide for a topic, or all of it. A topic keeps its own section and the problems that touch it. */
export function explainTracking(topic?: GuideTopic): TrackingGuide {
  const sections = topic ? GUIDE_SECTIONS.filter((s) => s.id === topic) : GUIDE_SECTIONS;
  const problems = (topic ? GUIDE_PROBLEMS.filter((p) => p.topics.includes(topic)) : GUIDE_PROBLEMS)
    .map(({ symptom, causes, fixes }) => ({ symptom, causes, fixes }));
  return { topic: topic ?? null, sections, problems };
}

/**
 * The UTM templates of each ad platform, as UTMify's help center publishes them (generic variant,
 * verified 2026-11-11). The query strings are verbatim: the macros are filled by the ad platform when
 * the ad is shown, so they stay unencoded.
 */
export type Platform = 'meta' | 'tiktok' | 'google' | 'kwai' | 'manual';

export const PLATFORMS: readonly Platform[] = ['meta', 'tiktok', 'google', 'kwai', 'manual'];

export type TemplatePlatform = Exclude<Platform, 'manual'>;

export const TEMPLATE_QUERY: Record<TemplatePlatform, string> = {
  meta: 'utm_source=FB&utm_campaign={{campaign.name}}|{{campaign.id}}&utm_medium={{adset.name}}|{{adset.id}}'
    + '&utm_content={{ad.name}}|{{ad.id}}&utm_term={{placement}}',
  tiktok: 'utm_source=tiktok&utm_campaign=__CAMPAIGN_NAME__|__CAMPAIGN_ID__&utm_medium=__AID_NAME__|__AID__'
    + '&utm_content=__CID_NAME__|__CID__&utm_term=__PLACEMENT__',
  google: 'utm_source=google&utm_campaign={campaignid}&utm_medium={adgroupid}&utm_content={creative}'
    + '&utm_term={placement}::{keyword}&keyword={keyword}&device={device}&network={network}',
  kwai: 'utm_source=kwai&utm_campaign=__CMPNID__&utm_medium=__ADSETID__&utm_content=__ADID__::__CALLBACK__::__KS_PIXELID__',
};

/** Google appends the template to the landing page the ad serves, through this macro. */
export const GOOGLE_LANDING_MACRO = '{lpurl}';

/** The manual fields, in the order they are written to the link. */
export const MANUAL_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'src', 'sck'] as const;
export type ManualKey = (typeof MANUAL_KEYS)[number];
export type ManualParams = Partial<Record<ManualKey, string>>;

/** Where to paste the result, one step per entry; `{destination}` is replaced by the clean URL. */
export const WHERE_TO_PASTE: Record<Platform, string[]> = {
  meta: [
    'No Gerenciador de Anúncios, abra o anúncio e vá até a etapa de destino.',
    'No campo "Destino", cole apenas a URL limpa: {destination}',
    'Logo abaixo, no campo "Parâmetros de URL", cole o texto de cima, sem o "?" na frente.',
    'Publique o anúncio e confira o link no relatório de UTMs.',
  ],
  tiktok: [
    'No TikTok Ads Manager, abra o anúncio e vá até a etapa de criativo.',
    'No campo "URL de destino", cole a URL: {destination}',
    'Logo depois dela, escreva "?" e cole o texto de cima (o link completo já traz tudo junto).',
  ],
  google: [
    'No Google Ads, abra Administrador, Configurações da conta e depois Acompanhamento.',
    'No campo "Modelo de acompanhamento", cole o texto de cima e deixe a marcação automática ligada.',
    'No anúncio, o URL final é só o link limpo: {destination}',
  ],
  kwai: [
    'No Kwai for Business, abra o conjunto de anúncios.',
    'No campo da URL, cole a URL: {destination}',
    'Logo depois dela, escreva "?" e cole o texto de cima.',
  ],
  manual: [
    'Use o link completo onde o cliente vai clicar: bio, e-mail, WhatsApp, página ou anúncio.',
    'Cada campo já está codificado para URL, não precisa mexer em nada.',
  ],
};

export const TEMPLATE_NOTES: Record<Platform, string[]> = {
  meta: [
    'Não use "|", "#", "&" nem "?" nos nomes de campanha, conjunto e anúncio.',
    'Campanhas que já foram publicadas mantêm os nomes antigos.',
  ],
  tiktok: [
    'Não use "|", "#", "&" nem "?" nos nomes de campanha, grupo e anúncio.',
    'Campanhas que já foram publicadas mantêm os nomes antigos.',
  ],
  google: [
    'Não use "|", "#", "&" nem "?" nos nomes de campanha e de grupo de anúncios.',
    'Campanhas que já foram publicadas mantêm os nomes antigos.',
    'O modelo vale para a conta inteira, então vale para todas as campanhas dela.',
  ],
  kwai: [
    'Não use "|", "#", "&" nem "?" nos nomes de campanha e de conjunto.',
    'Campanhas que já foram publicadas mantêm os nomes antigos.',
    'Vale só para conjuntos de anúncios novos.',
  ],
  manual: [
    'Os valores são codificados para URL (espaços e acentos viram %xx).',
  ],
};

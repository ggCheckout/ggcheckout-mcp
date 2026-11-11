import {
  TRACKING_CHANNELS,
  type ChannelErrors,
  type DiagnosisContext,
  type FindingSeverity,
  type TrackingChannel,
  type TrackingCheckout,
  type TrackingFinding,
  type TrackingFunnel,
  type TrackingPayment,
  type TrackingToken,
} from '../types/tracking.js';
import { clip, disabledReasonText, listNames } from './text.js';

export const CHANNEL_LABEL: Record<TrackingChannel, string> = {
  facebook: 'Meta',
  tiktok: 'TikTok',
  google: 'Google Ads',
  utmify: 'UTMify',
};

const SEVERITY_ORDER: Record<FindingSeverity, number> = { critical: 0, warning: 1, info: 2, ok: 3 };

/** Critical first, then warning, info and ok; the order of the rules holds inside a severity. */
export function sortFindings(findings: TrackingFinding[]): TrackingFinding[] {
  return findings
    .map((finding, index) => ({ finding, index }))
    .sort((a, b) => SEVERITY_ORDER[a.finding.severity] - SEVERITY_ORDER[b.finding.severity] || a.index - b.index)
    .map(({ finding }) => finding);
}

const NOT_YET = 'não disponível ainda';

// Where the seller acts, with the dashboard's own labels: no MCP tool can create or edit these tokens.
const METRICS_SCREEN = 'Configurações > Métricas';
const PIXELS_SECTION = '"Pixels & Rastreio" do editor do checkout';
const MODE_BOTH = '"Modo de Rastreamento" para "Ambos (Recomendado)"';

function isDisabled(token: TrackingToken): boolean {
  return token.status === 'disabled' || Boolean(token.health?.disabledReason);
}

/** Ids of the tokens the checkouts and the funnel in scope point to. */
export function referencedTokenIds(checkouts: TrackingCheckout[], funnel: TrackingFunnel | null): Set<string> {
  const ids = new Set<string>();
  for (const checkout of checkouts) checkout.metricTokenIds.forEach((id) => ids.add(id));
  for (const id of Object.values(funnel?.tokenIds ?? {})) if (id) ids.add(id);
  return ids;
}

/** Checkouts without a token, and checkouts or funnels that point to a token that is not in the vault. */
export function referenceRules(
  checkouts: TrackingCheckout[],
  funnel: TrackingFunnel | null,
  tokens: TrackingToken[] | null,
): TrackingFinding[] {
  const findings: TrackingFinding[] = [];

  const bare = checkouts.filter((c) => c.metricTokenIds.length === 0);
  if (bare.length) {
    findings.push({
      severity: 'warning',
      code: 'checkout_no_metric_token',
      title: bare.length === 1 ? 'Checkout sem token de métricas' : `${bare.length} checkouts sem token de métricas`,
      detail: `Nenhuma venda de ${listNames(bare.map((c) => c.title))} é enviada à Meta, ao TikTok, ao Google Ads ou à UTMify.`,
      fix: `Conecte o pixel em ${METRICS_SCREEN} e escolha-o na seção ${PIXELS_SECTION}.`,
    });
  }

  if (tokens) {
    const known = new Set(tokens.map((t) => t.id));
    const missing = new Map<string, string[]>();
    for (const checkout of checkouts) {
      for (const id of checkout.metricTokenIds) {
        if (!known.has(id)) missing.set(id, [...(missing.get(id) ?? []), checkout.title]);
      }
    }
    for (const id of Object.values(funnel?.tokenIds ?? {})) {
      if (id && !known.has(id)) missing.set(id, [...(missing.get(id) ?? []), funnel?.title ?? 'funil']);
    }
    for (const [id, owners] of missing) {
      findings.push({
        severity: 'critical',
        code: 'token_missing',
        title: 'Aponta para um token que não existe',
        detail: `${listNames(owners)} usa o token ${id}, que não está no cofre. Nada é enviado por ele.`,
        fix: `Conecte o pixel de novo em ${METRICS_SCREEN} e escolha o novo pixel na seção ${PIXELS_SECTION} (ou nas configurações do funil).`,
      });
    }
  }
  return findings;
}

/** Health, mode and duplicates of the tokens in scope. `referenced` says which ones a checkout or funnel uses. */
export function tokenRules(tokens: TrackingToken[], referenced: Set<string>): TrackingFinding[] {
  const findings: TrackingFinding[] = [];
  if (tokens.length === 0) return findings;

  if (tokens.every((t) => t.health === null)) {
    findings.push({
      severity: 'info',
      code: 'token_health_unavailable',
      title: `Saúde dos tokens ${NOT_YET}`,
      detail: 'A API ainda não informa falhas e desativação dos tokens, então esses itens não foram verificados.',
      fix: 'Tente de novo depois que a API for atualizada.',
    });
  } else {
    let unhealthy = false;
    for (const token of tokens) {
      const label = `${token.title} (${CHANNEL_LABEL[token.channel]})`;
      const health = token.health;
      if (isDisabled(token)) {
        unhealthy = true;
        const reason = disabledReasonText(health?.disabledReason) ?? 'motivo não informado';
        findings.push({
          severity: referenced.has(token.id) ? 'critical' : 'warning',
          code: 'token_disabled',
          title: `Token desativado: ${token.title}`,
          detail: `${label} está desativado (${reason}) e não envia eventos${referenced.has(token.id) ? ', mas ainda é usado por um checkout ou funil' : ''}.${health?.lastError ? ` Último erro: ${clip(health.lastError)}` : ''}`,
          fix: `Em ${METRICS_SCREEN}, abra a integração, corrija a credencial (vencida ou sem permissão) e salve: salvar reativa o token. Depois peça um novo diagnóstico aqui no chat.`,
        });
      } else if (health && health.consecutiveFailures > 0) {
        unhealthy = true;
        findings.push({
          severity: 'warning',
          code: 'token_failures',
          title: `Token com falhas: ${token.title}`,
          detail: `${label} falhou ${health.consecutiveFailures} ${health.consecutiveFailures === 1 ? 'vez seguida' : 'vezes seguidas'}${health.lastError ? `. Último erro: ${clip(health.lastError)}` : ''}. Com 3 falhas seguidas ele é desativado.`,
          fix: `Em ${METRICS_SCREEN}, confira a credencial e as permissões da integração e salve de novo.`,
        });
      }
    }
    if (!unhealthy) {
      findings.push({
        severity: 'ok',
        code: 'tokens_healthy',
        title: 'Tokens sem falhas',
        detail: `${tokens.length === 1 ? '1 token verificado' : `${tokens.length} tokens verificados`}, nenhum com falha ou desativado.`,
        fix: '',
      });
    }
  }

  for (const token of tokens) {
    if (!referenced.has(token.id)) continue;
    if (token.channel !== 'facebook' && token.channel !== 'tiktok') continue;
    if (token.trackingMode === 'pixel') {
      findings.push({
        severity: 'warning',
        code: 'token_mode_pixel',
        title: `Modo "pixel": ${token.title}`,
        detail: `${CHANNEL_LABEL[token.channel]} recebe a compra só pelo navegador. Se o comprador fechar a aba antes do PIX ser pago, a Purchase se perde.`,
        fix: `Em ${METRICS_SCREEN}, abra a integração e troque o ${MODE_BOTH}.`,
      });
    } else if (token.trackingMode === 'events_api') {
      findings.push({
        severity: 'info',
        code: 'token_mode_events_api',
        title: `Só servidor: ${token.title}`,
        detail: `${CHANNEL_LABEL[token.channel]} recebe os eventos só pelo servidor, sem InitiateCheckout do navegador. É válido, mas perde o sinal do navegador.`,
        fix: `Se quiser os dois caminhos, em ${METRICS_SCREEN} troque o ${MODE_BOTH}.`,
      });
    }
  }

  return [...findings, ...duplicatePixelRules(tokens)];
}

/** Two tokens of a channel on the same pixel make the server send each event twice. */
export function duplicatePixelRules(tokens: TrackingToken[]): TrackingFinding[] {
  const groups = new Map<string, TrackingToken[]>();
  for (const token of tokens) {
    if (!token.pixelId) continue;
    const key = `${token.channel}:${token.pixelId}`;
    groups.set(key, [...(groups.get(key) ?? []), token]);
  }
  return [...groups.values()]
    .filter((group) => group.length > 1)
    .map((group) => ({
      severity: 'warning' as const,
      code: 'pixel_duplicate',
      title: `O mesmo pixel em ${group.length} tokens`,
      detail: `${listNames(group.map((t) => t.title))} apontam para o mesmo pixel de ${CHANNEL_LABEL[group[0].channel]}. Se os dois forem usados, o servidor envia cada evento em dobro.`,
      fix: `Em ${METRICS_SCREEN}, mantenha uma integração por pixel e escolha só ela na seção ${PIXELS_SECTION}.`,
    }));
}

const UTM_CHECKLIST = [
  '- O link do anúncio ou da divulgação tem parâmetros (utm_source, utm_medium, utm_campaign).',
  '- Os parâmetros de URL estão ativados nos anúncios.',
  '- Nenhum redirecionamento no caminho descarta a query string.',
  '- O comprador não reabriu o checkout sem a query string (o checkout não guarda UTMs).',
].join('\n');

export function paymentRules(payment: TrackingPayment, viaFunnel: boolean): TrackingFinding[] {
  const findings: TrackingFinding[] = [];
  const paid = payment.status === 'paid';

  if (Object.keys(payment.utms).length === 0) {
    findings.push({
      severity: 'warning',
      code: 'payment_no_utms',
      title: 'Venda sem UTMs',
      detail: 'O pagamento não guardou nenhum parâmetro de origem, então a venda não é atribuída a uma campanha.',
      fix: `Confira, nesta ordem:\n${UTM_CHECKLIST}`,
    });
  } else if (payment.utms.utm_source?.toLowerCase() === 'organic') {
    findings.push({
      severity: 'warning',
      code: 'payment_utm_organic',
      title: 'utm_source=organic',
      detail: viaFunnel
        ? 'A venda veio de um funil e saiu como orgânica. O script da UTMify grava "organic" quando não encontra parâmetros.'
        : 'A venda saiu como orgânica. O script da UTMify grava "organic" quando não encontra parâmetros.',
      fix: 'Coloque as UTMs no link que leva ao funil ou ao checkout e confirme que os parâmetros são repassados.',
    });
  }

  const dispatch = payment.dispatch;
  if (dispatch === null) {
    findings.push({
      severity: 'info',
      code: 'dispatch_unavailable',
      title: `Registro de envios ${NOT_YET}`,
      detail: 'Este pagamento não trouxe o resultado dos envios aos canais, então não dá para dizer se os eventos saíram.',
      fix: 'Tente de novo depois que a API for atualizada.',
    });
  } else {
    let failed = false;
    for (const channel of TRACKING_CHANNELS) {
      const entry = dispatch[channel];
      if (!entry || entry.ok !== false) continue;
      failed = true;
      const errors = entry.details
        .filter((d) => d.ok === false && d.error)
        .slice(0, 3)
        .map((d) => `${d.title ?? 'envio'}${d.code ? ` (${d.code})` : ''}: ${clip(d.error)}`);
      findings.push({
        severity: 'critical',
        code: `dispatch_failed_${channel}`,
        title: `Envio falhou: ${CHANNEL_LABEL[channel]}`,
        detail: `${entry.event ? `Evento ${entry.event}. ` : ''}${entry.failed ?? '?'} de ${entry.total ?? '?'} envios falharam.${errors.length ? ` ${errors.join(' | ')}` : ''}`,
        fix: `Confira a credencial da integração em ${METRICS_SCREEN}; depois peça um novo diagnóstico aqui no chat para ver a saúde do token.`,
      });
    }
    const delivered = TRACKING_CHANNELS.filter((c) => dispatch[c]);
    const paidNotSent = paid && (payment.flags.paid === false || (payment.flags.paid === null && delivered.length === 0));
    if (paidNotSent) {
      failed = true;
      findings.push({
        severity: 'warning',
        code: 'paid_not_dispatched',
        title: 'Venda paga sem envio de compra',
        detail: 'O pagamento está pago, mas o envio da compra às plataformas não foi registrado.',
        fix: `Confira se o checkout tem um pixel escolhido na seção ${PIXELS_SECTION} e se a integração em ${METRICS_SCREEN} está ativa.`,
      });
    }
    if (!failed && delivered.length > 0) {
      findings.push({
        severity: 'ok',
        code: 'dispatch_ok',
        title: 'Envios registrados sem erro',
        detail: `Canais com envio: ${listNames(delivered.map((c) => CHANNEL_LABEL[c]))}.`,
        fix: '',
      });
    }
  }
  return findings;
}

export function funnelRules(funnel: TrackingFunnel): TrackingFinding[] {
  const findings: TrackingFinding[] = [
    {
      severity: 'info',
      code: 'funnel_events_by_design',
      title: 'O funil não dispara Lead nem InitiateCheckout',
      detail: 'O funil envia só PageView (Meta e TikTok). A compra e o início de compra saem no checkout aberto a partir dele.',
      fix: '',
    },
  ];
  findings.push(funnel.utmifyPixelId
    ? {
      severity: 'ok',
      code: 'funnel_utmify_set',
      title: 'Pixel da UTMify configurado no funil',
      detail: 'O funil carrega os scripts da UTMify.',
      fix: '',
    }
    : {
      severity: 'info',
      code: 'funnel_utmify_missing',
      title: 'Funil sem pixel da UTMify',
      detail: 'Sem o pixel, a atribuição do funil depende dos parâmetros do link.',
      fix: 'Se você usa a UTMify, configure o pixel dela nas configurações do funil.',
    });
  return findings;
}

/** Subjects with the most errors first, for the findings and for the summary in the answer. */
export function topSubjects(rows: ChannelErrors['rows'], max = 3) {
  const bySubject = new Map<string, { title: string | null; code: string | null; count: number; lastError: string | null; lastAt: string | null }>();
  for (const row of rows) {
    const key = `${row.subjectCode ?? ''}|${row.subjectTitle ?? ''}`;
    const entry = bySubject.get(key) ?? { title: row.subjectTitle, code: row.subjectCode, count: 0, lastError: null, lastAt: null };
    entry.count += 1;
    if (!entry.lastAt || (row.createdAt ?? '') > entry.lastAt) {
      entry.lastAt = row.createdAt;
      entry.lastError = row.errorMessage ?? row.errorCode;
    }
    bySubject.set(key, entry);
  }
  return [...bySubject.values()].sort((a, b) => b.count - a.count).slice(0, max);
}

export function errorRules(errors: Record<TrackingChannel, ChannelErrors | null>): TrackingFinding[] {
  const findings: TrackingFinding[] = [];
  const unavailable = TRACKING_CHANNELS.filter((c) => errors[c] === null);
  const hours = TRACKING_CHANNELS.map((c) => errors[c]?.hours).find((h) => h) ?? 24;

  for (const channel of TRACKING_CHANNELS) {
    const entry = errors[channel];
    if (!entry || entry.rows.length === 0) continue;
    const subjects = topSubjects(entry.rows).map((s) => {
      const name = s.title ?? s.code ?? 'sem nome';
      return `${name} (${s.count})${s.lastError ? `: ${clip(s.lastError)}` : ''}`;
    });
    findings.push({
      severity: 'warning',
      code: `channel_errors_${channel}`,
      title: `Erros recentes: ${CHANNEL_LABEL[channel]}`,
      detail: `${entry.rows.length} ${entry.rows.length === 1 ? 'erro' : 'erros'} nas últimas ${entry.hours} horas. Principais: ${subjects.join(' | ')}`,
      fix: `Veja o erro do provedor, corrija a credencial ou a permissão em ${METRICS_SCREEN} e peça um novo diagnóstico aqui no chat.`,
    });
  }

  if (unavailable.length === TRACKING_CHANNELS.length) {
    findings.push({
      severity: 'info',
      code: 'errors_unavailable',
      title: `Registro de erros ${NOT_YET}`,
      detail: 'A API ainda não tem a rota de erros de integração, então os erros recentes não foram verificados.',
      fix: 'Tente de novo depois que a API for atualizada.',
    });
  } else if (unavailable.length === 0 && !findings.length) {
    findings.push({
      severity: 'ok',
      code: 'no_recent_errors',
      title: `Sem erros nas últimas ${hours} horas`,
      detail: 'Nenhum canal registrou erro de envio no período.',
      fix: '',
    });
  }
  return findings;
}

/** Every rule over what was read, critical first. Pure: the context holds all the data. */
export function diagnoseTracking(ctx: DiagnosisContext): TrackingFinding[] {
  const findings: TrackingFinding[] = [];

  if (ctx.missingCheckoutId) {
    findings.push({
      severity: 'critical',
      code: 'checkout_not_found',
      title: 'Checkout não encontrado',
      detail: `O checkout ${ctx.missingCheckoutId} não está na lista deste vendedor.`,
      fix: 'Confira o id na lista de checkouts do painel ou peça ao assistente para listar seus checkouts.',
    });
  }

  const referenced = referencedTokenIds(ctx.checkouts, ctx.funnel);
  findings.push(...referenceRules(ctx.checkouts, ctx.funnel, ctx.tokens));

  if (ctx.tokens === null) {
    findings.push({
      severity: 'info',
      code: 'tokens_unavailable',
      title: `Tokens e saúde ${NOT_YET}`,
      detail: 'A API ainda não tem a rota de tokens do negócio, então tokens, modos e falhas não foram verificados.',
      fix: 'Tente de novo depois que a API for atualizada.',
    });
  } else {
    const scoped = ctx.scope.kind === 'checkout' || ctx.scope.kind === 'funnel'
      ? ctx.tokens.filter((t) => referenced.has(t.id))
      : ctx.tokens;
    findings.push(...tokenRules(scoped, referenced));
  }

  if (ctx.funnel) findings.push(...funnelRules(ctx.funnel));
  if (ctx.payment) {
    findings.push(...paymentRules(ctx.payment, Boolean(ctx.scope.funnelId || ctx.payment.funnelId)));
  }
  findings.push(...errorRules(ctx.errors));

  const worst = findings.some((f) => f.severity === 'critical' || f.severity === 'warning');
  if (!worst) {
    findings.push({
      severity: 'ok',
      code: 'all_clear',
      title: 'Nada de errado no que foi verificado',
      detail: 'Nenhuma regra encontrou problema nos dados lidos.',
      fix: '',
    });
  }
  return sortFindings(findings);
}

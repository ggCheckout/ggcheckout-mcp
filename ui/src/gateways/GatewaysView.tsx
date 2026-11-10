import { Lock } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import '../styles/dashboard.css';
import './gateways.css';
import type { Host, HostSnapshot } from '../host';
import { Segmented } from '../dashboard/parts';
import { formatInt } from '../lib/format';
import { gatewayLogo, gatewayName } from '../lib/gateways';
import {
  LOW_SAMPLE, coverLine, formatRate, isUnstable, rankingFor, rateColor, summarizeStats, summarizeWallets, unitLabel, usageLine,
  type GatewayStats, type Metric, type RankRow, type Wallet, type WalletEntry,
} from './model';

function Logo({ gateway, size = 32 }: { gateway: string; size?: number }) {
  const logo = gatewayLogo(gateway);
  return logo
    ? <img className="gw-logo" src={logo} width={size} height={size} alt="" />
    : <span className="gw-logo gw-logo-fallback" style={{ width: size, height: size }} aria-hidden>{gatewayName(gateway).charAt(0).toUpperCase()}</span>;
}

function Rate({ rate, metric }: { rate: number; metric: Metric }) {
  return <span className="gw-rate num" style={{ ['--rate' as string]: rateColor(rate, metric) }}>{`${formatRate(rate)}%`}</span>;
}

/** The score column of PanelOrderedRow. */
function Score({ row, unit, metric, hours, loaded }: { row: RankRow | undefined; unit: string; metric: Metric; hours: number; loaded: boolean }) {
  if (!loaded) return null;
  if (!row) return <span className="gw-score muted">Sem dados ainda</span>;
  return (
    <span className="gw-score">
      <Rate rate={row.rate} metric={metric} />
      <span className="gw-unit">{row.sample < LOW_SAMPLE ? 'poucos dados ainda' : `${unit} · ${hours}h`}</span>
    </span>
  );
}

function OrderedList({ entries, method, metric, stats }: { entries: WalletEntry[]; method: 'pix' | 'card'; metric: Metric; stats: GatewayStats | null }) {
  const ranking = stats ? rankingFor(stats, method, metric) : [];
  const byGateway = new Map(ranking.map((r) => [r.gateway, r]));
  const scored = entries.map((e) => byGateway.get(e.gateway)).filter((r): r is RankRow => Boolean(r));
  const best = scored.length > 1 ? scored.reduce((a, b) => (b.rate > a.rate ? b : a)).gateway : null;
  if (!entries.length) {
    return <p className="empty">{method === 'pix' ? 'Sem PIX nesta ordem de cobrança.' : 'Sem cartão nesta ordem de cobrança.'}</p>;
  }
  return (
    <>
      <ol className="gw-order">
        {entries.map((e, i) => (
          <li key={`${e.credentialId}-${i}`} className="gw-order-row" data-first={i === 0 || undefined}>
            <span className="gw-pos num" aria-hidden>{i + 1}</span>
            <Logo gateway={e.gateway} />
            <span className="gw-who">
              <span className="gw-name-line">
                <span className="gw-name">{gatewayName(e.gateway)}</span>
                {e.label && <span className="muted">{` · ${e.label}`}</span>}
                {!e.active && <span className="gw-off">{' · desconectada'}</span>}
              </span>
              <span className="gw-tags">
                <span className="gw-role" data-role={i === 0 ? 'primary' : 'reserve'}>{i === 0 ? 'Principal' : 'Reserva'}</span>
                {best === e.gateway && <span className="gw-best">Melhor</span>}
                {e.locked && <Lock size={13} className="muted" aria-label="Travada nesta posição" />}
              </span>
            </span>
            <Score row={byGateway.get(e.gateway)} unit={unitLabel(method, metric)} metric={method === 'card' ? 'reliability' : metric} hours={stats?.hours ?? 24} loaded={Boolean(stats?.ranking)} />
          </li>
        ))}
      </ol>
      {method === 'card' && <p className="gw-note">Só a principal cobra: se recusar, não há nova tentativa.</p>}
    </>
  );
}

function WalletCard({ wallet, stats }: { wallet: Wallet; stats: GatewayStats | null }) {
  const [tab, setTab] = useState<'pix' | 'card'>(wallet.pix.length || !wallet.card.length ? 'pix' : 'card');
  return (
    <section className="surface gw-wallet">
      <header className="gw-wallet-head">
        <div className="gw-wallet-title">
          <h2 className="card-title small">{wallet.name}</h2>
          {wallet.auto && <span className="gw-auto">{wallet.metric === 'conversion' ? 'Automático por PIX pagos' : 'Automático por estabilidade'}</span>}
        </div>
        <p className="card-sub">{`${coverLine(wallet)} · ${usageLine(wallet)}`}</p>
      </header>
      <Segmented options={[['pix', 'PIX'], ['card', 'Cartão']]} active={tab} onPick={setTab} className="gw-tabs" />
      <OrderedList entries={tab === 'pix' ? wallet.pix : wallet.card} method={tab} metric={wallet.metric} stats={stats} />
    </section>
  );
}

/** "Ordem de cobrança": each wallet, with the last day's rates read once through the host. */
function Wallets({ host, wallets, canCallTools }: { host: Host; wallets: Wallet[]; canCallTools: boolean }) {
  const [stats, setStats] = useState<GatewayStats | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!canCallTools || !wallets.length) return;
    host.callTool('get_gateway_fallback_stats', {}).then((d) => setStats(summarizeStats(d))).catch(() => setFailed(true));
  }, [host, canCallTools, wallets.length]);

  return (
    <>
      <header className="gw-page-head">
        <h1 className="card-title">Ordem de cobrança</h1>
        <p className="card-sub">Defina quem cobra seus clientes: no PIX, a principal cobra primeiro e, se falhar, a reserva entra; no cartão, cobra a primeira ativa.</p>
        {failed && <p className="card-sub">Métricas indisponíveis</p>}
      </header>
      {wallets.length
        ? wallets.map((w) => <WalletCard key={w.id} wallet={w} stats={stats} />)
        : <section className="surface gw-wallet"><p className="empty">Crie sua primeira ordem de cobrança no painel: escolha a principal, adicione reservas e use nos checkouts e lojas.</p></section>}
    </>
  );
}

/** "Ranking de estabilidade", by stability or by paid PIX. */
function Ranking({ stats }: { stats: GatewayStats }) {
  const hasConversion = Boolean(stats.ranking?.conversion.length);
  const [metric, setMetric] = useState<Metric>(stats.ranking && !rankingFor(stats, 'pix', 'reliability').length && hasConversion ? 'conversion' : 'reliability');
  const rows = rankingFor(stats, 'pix', metric);
  const unstable = rows.filter((r) => isUnstable(r.gateway, r.rate, stats)).length;
  return (
    <section className="surface gw-wallet">
      <header className="gw-wallet-head">
        <h2 className="card-title">Ranking de estabilidade</h2>
        <p className="card-sub">{`Taxa de sucesso PIX por gateway (últimas ${stats.hours ?? 24}h)`}</p>
      </header>
      <Segmented options={[['reliability', 'Estabilidade'], ['conversion', 'PIX pagos']]} active={metric} onPick={setMetric} className="gw-tabs" />
      {unstable > 0 && <p className="gw-warn">{`${unstable} ${unstable === 1 ? 'gateway com taxa' : 'gateways com taxa'} de erro acima do normal`}</p>}
      {rows.length ? (
        <ol className="gw-order">
          {rows.map((r, i) => (
            <li key={r.gateway} className="gw-order-row" data-first={i === 0 || undefined}>
              <span className="gw-pos num" aria-hidden>{i + 1}</span>
              <Logo gateway={r.gateway} />
              <span className="gw-who">
                <span className="gw-name">{gatewayName(r.gateway)}</span>
                <span className="gw-unit">
                  {`${formatInt(r.sample)} ${metric === 'conversion' ? 'PIX gerados' : 'tentativas'}`}
                  {isUnstable(r.gateway, r.rate, stats) && metric === 'reliability' && <span className="gw-unstable"> · Instável</span>}
                </span>
              </span>
              <span className="gw-score"><Rate rate={r.rate} metric={metric} />{r.sample < LOW_SAMPLE && <span className="gw-unit">poucos dados ainda</span>}</span>
            </li>
          ))}
        </ol>
      ) : <p className="empty">Sem dados de gateway nesta janela.</p>}
    </section>
  );
}

/** Gateways view: list_checkout_wallets (the charge order) and get_gateway_fallback_stats (the ranking). */
export function GatewaysView({ host, state }: { host: Host; state: HostSnapshot }) {
  const wallets = useMemo(() => summarizeWallets(state.payload), [state.payload]);
  const stats = useMemo(() => (wallets ? null : summarizeStats(state.payload)), [wallets, state.payload]);

  useEffect(() => {
    if (wallets) host.tellModel('Ordens de cobrança (carteiras) abertas na tela do chat.');
    else if (stats) host.tellModel('Ranking de estabilidade dos gateways aberto na tela do chat.');
  }, [host, wallets, stats]);

  if (!wallets && !stats) return <p className="state" data-tone="error">A resposta não trouxe gateways.</p>;
  return (
    <div className="dashboard gateways">
      {wallets ? <Wallets host={host} wallets={wallets} canCallTools={state.canCallTools} /> : <Ranking stats={stats!} />}
    </div>
  );
}

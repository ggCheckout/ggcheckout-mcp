import { useEffect, useState } from 'react';
import '../styles/dashboard.css';
import type { Host, HostSnapshot } from '../host';
import { formatCents, formatInt, formatPercent } from '../lib/format';
import { ApprovalRate } from './ApprovalRate';
import { DASHBOARD_RANGES, summarizeCharts, summarizeStats, type ChartsSummary, type DashboardRange } from './model';
import { Kpi, ViewHeader } from './parts';
import { SalesByProduct } from './SalesByProduct';
import { SalesByState } from './SalesByState';
import { SalesChart } from './SalesChart';
import { StatsCards } from './StatsCards';

const FOCUS_TITLE: Record<string, string> = {
  revenue: 'Faturamento',
  approval: 'Aprovação por método',
  products: 'Mais vendidos',
  states: 'Vendas por estado',
  refunds: 'Reembolsos',
};

const rangeLabel = (value: string) => DASHBOARD_RANGES.find((r) => r.value === value)?.label ?? value;
const isRange = (value: unknown): value is DashboardRange => DASHBOARD_RANGES.some((r) => r.value === value);

function Focus({ s }: { s: ChartsSummary }) {
  switch (s.focus) {
    case 'revenue': return <SalesChart series={s.series} revenue={s.revenue} />;
    case 'approval': return <ApprovalRate approval={s.approval} open />;
    case 'products': return <SalesByProduct products={s.products} orderBumps={s.orderBumps} />;
    case 'states': return <SalesByState states={s.states} />;
    case 'refunds':
      return (
        <div className="kpis">
          <Kpi label="Reembolsos" value={formatInt(s.refunds.refund)} />
          <Kpi label="Chargebacks" value={formatInt(s.refunds.chargeback)} />
          <Kpi label="MED" value={formatInt(s.refunds.med)} />
        </div>
      );
    default: return null;
  }
}

function FullPanel({ s, timezone }: { s: ChartsSummary; timezone?: string }) {
  return (
    <>
      <div className="kpis">
        <Kpi label="Ticket médio" value={formatCents(s.averageTicket)} />
        <Kpi label="Conversão" value={formatPercent(s.conversion)} />
        <Kpi label="Reembolsos" value={formatInt(s.refundsTotal)} />
      </div>
      <SalesChart series={s.series} revenue={s.revenue} />
      <div className="panels">
        <ApprovalRate approval={s.approval} open={false} />
        <SalesByProduct products={s.products} orderBumps={s.orderBumps} />
        <SalesByState states={s.states} />
      </div>
      {timezone && <p className="foot">{`Fuso ${timezone}`}</p>}
    </>
  );
}

/**
 * Sales view for get_dashboard_stats and get_dashboard_charts: the stats as StatsCards, one `focus`
 * of the charts (the card the user asked about), or the whole panel. The period buttons re-run the
 * same tool, with the same focus, through the host.
 */
export function SalesView({ host, state }: { host: Host; state: HostSnapshot }) {
  const [payload, setPayload] = useState<unknown>(state.payload);
  const [range, setRange] = useState<string>(isRange(state.args.range) ? state.args.range : 'week');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const stats = summarizeStats(payload);
  const charts = stats ? null : summarizeCharts(payload);
  const period = (stats?.period ?? charts?.period ?? range) as string;
  const timezone = (payload as { timezone?: string } | null)?.timezone ?? (state.args.tz as string | undefined);
  const heading = stats ? 'Vendas' : charts?.focus ? FOCUS_TITLE[charts.focus] : 'Painel de vendas';

  useEffect(() => {
    if (stats || charts) host.tellModel(`${heading} aberto em "${rangeLabel(period)}" na tela do chat.`);
  }, [payload]);

  if (!stats && !charts) return <p className="state" data-tone="error">A resposta não trouxe dados do painel.</p>;

  const switchRange = async (next: DashboardRange) => {
    const previous = range;
    setRange(next);
    setBusy(true);
    setFailure(null);
    try {
      setPayload(stats
        ? await host.callTool('get_dashboard_stats', { range: next })
        : await host.callTool('get_dashboard_charts', {
          range: next,
          ...(timezone ? { tz: timezone } : {}),
          ...(charts?.focus ? { focus: charts.focus } : {}),
        }));
    } catch (error) {
      setRange(previous);
      setFailure(`Não deu para trocar o período: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dashboard">
      {/* A focused answer is one dashboard card, which carries its own title. */}
      <ViewHeader title={charts?.focus ? undefined : `Vendas · ${rangeLabel(period)}`}>
        {state.canCallTools && (
          <div className="ranges" role="group" aria-label="Período">
            {DASHBOARD_RANGES.map((r) => (
              <button key={r.value} type="button" aria-pressed={r.value === (busy ? range : period)} onClick={() => r.value !== period && switchRange(r.value)}>
                {r.label}
              </button>
            ))}
          </div>
        )}
      </ViewHeader>
      {failure && <p className="state" data-tone="error" role="alert">{failure}</p>}
      <div id="content" aria-busy={busy || undefined}>
        {stats ? <StatsCards stats={stats} period={period} /> : charts?.focus ? <Focus s={charts} /> : <FullPanel s={charts!} timezone={timezone} />}
      </div>
    </div>
  );
}

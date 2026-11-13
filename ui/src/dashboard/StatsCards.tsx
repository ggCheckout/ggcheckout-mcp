import { AlertCircle, Clock, DollarSign, ShoppingCart, TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react';
import { formatCents, formatInt } from '../lib/format';
import { COMPARISON_LABELS, PERIOD_LABELS, type StatsSummary } from './model';

interface Card {
  id: string;
  title: string;
  icon: LucideIcon;
  tone: 'success' | 'warning' | 'danger';
  value: string;
  change?: number;
  description: string;
  invert?: boolean;
  hideChange?: boolean;
}

const changeNumber = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const formatChange = (value?: number) => (value == null || Number.isNaN(value) ? '--' : `${value >= 0 ? '+' : ''}${changeNumber.format(value)}%`);

/** One-line value that shrinks with the card, as `fitOneLineFontSize` does on the dashboard. */
const fitOneLine = (text: string, maxRem: number) => `max(1rem, min(${maxRem}rem, ${(100 / (text.length * 0.62)).toFixed(2)}cqi))`;

function StatCard({ card }: { card: Card }) {
  const good = card.invert ? (card.change ?? 0) <= 0 : (card.change ?? 0) >= 0;
  const Trend = good ? TrendingUp : TrendingDown;
  const Icon = card.icon;
  return (
    <div className={`metric ${card.tone}`} data-metric={card.id}>
      <div className="stat-top">
        <p className="stat-title">{card.title}</p>
        <span className="stat-icon"><Icon size={24} aria-hidden /></span>
      </div>
      <div className="stat-value-row">
        <p className="stat-value" style={{ fontSize: fitOneLine(card.value, 1.875) }}>{card.value}</p>
      </div>
      <div className="stat-foot">
        {card.hideChange ? null : <Trend size={16} aria-hidden />}
        {card.hideChange ? null : <span className="stat-change">{formatChange(card.change)}</span>}
        <span className="stat-desc">{card.description}</span>
      </div>
    </div>
  );
}

/** StatsCards of the seller dashboard: sales, revenue, pending and expired. */
export function StatsCards({ stats, period }: { stats: StatsSummary; period: string }) {
  const comparison = COMPARISON_LABELS[period] ?? COMPARISON_LABELS.custom;
  const cards: Card[] = [
    { id: 'sales', title: 'Total de Vendas', icon: ShoppingCart, tone: 'success', value: formatInt(stats.sales), change: stats.salesChange, description: comparison },
    { id: 'revenue', title: 'Receita Total', icon: DollarSign, tone: 'success', value: formatCents(stats.revenue), change: stats.revenueChange, description: comparison },
    { id: 'pending', title: 'Vendas Pendentes', icon: Clock, tone: 'warning', value: formatInt(stats.pending), change: stats.pendingChange, description: 'aguardando pagamento', invert: true },
    { id: 'expired', title: 'Vendas Expiradas', icon: AlertCircle, tone: 'danger', value: formatInt(stats.expired), description: PERIOD_LABELS[period] ?? PERIOD_LABELS.custom, hideChange: true },
  ];
  return <div className="stats">{cards.map((card) => <StatCard key={card.id} card={card} />)}</div>;
}

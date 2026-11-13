import { Award, Flag, MousePointerClick, UserCheck, Users, type LucideIcon } from 'lucide-react';
import { useEffect } from 'react';
import '../styles/dashboard.css';
import './funnel.css';
import type { Host, HostSnapshot } from '../host';
import { formatInt } from '../lib/format';
import { ViewHeader } from '../dashboard/parts';
import { summarizeFunnelConversion, summarizeFunnelStats, type FunnelConversion, type FunnelStats } from './model';

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
  return (
    <div className="metric neutral funnel-stat">
      <div className="funnel-stat-label"><Icon size={16} aria-hidden /><span>{label}</span></div>
      <p className="funnel-stat-value num">{value}</p>
    </div>
  );
}

/** The stats cards of the funnel editor's Leads tab. */
function LeadStats({ stats }: { stats: FunnelStats }) {
  return (
    <div className="funnel-stats">
      <StatCard label="Visitantes" value={formatInt(stats.visitors)} icon={Users} />
      <StatCard label="Leads Adquiridos" value={formatInt(stats.leads)} icon={UserCheck} />
      <StatCard label="Taxa de Interação" value={`${stats.interactionRate}%`} icon={MousePointerClick} />
      <StatCard label="Leads Qualificados" value={formatInt(stats.qualified)} icon={Award} />
      <StatCard label="Fluxos Finalizados" value={formatInt(stats.completed)} icon={Flag} />
    </div>
  );
}

/** FunnelConversionViz: one bar per step, sized by its visitors, colored by its drop-off. */
function Conversion({ conversion }: { conversion: FunnelConversion }) {
  return (
    <section className="surface funnel-conversion">
      <h3 className="funnel-title">Conversão</h3>
      {conversion.steps.length ? (
        <div className="funnel-steps">
          {conversion.steps.map((step) => (
            <div key={step.id} className="funnel-step">
              <span className="funnel-step-name" title={step.title}>{step.title}</span>
              <div className="funnel-step-track">
                <div className="funnel-step-bar" style={{ width: `${step.width}%`, backgroundColor: step.color }} />
              </div>
              <div className="funnel-step-nums">
                <span className="funnel-step-visitors num">{formatInt(step.visitors)}</span>
                {step.dropOffRate > 0 && <span className="funnel-step-drop num">{`-${step.dropOffRate}%`}</span>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="empty">Nenhum visitante ainda. Publique o funil para começar a medir.</p>
      )}
      <div className="funnel-foot">
        <span>{`${formatInt(conversion.totalVisitors)} ${conversion.totalVisitors === 1 ? 'visitante' : 'visitantes'}`}</span>
        <span>{`Conversão: ${conversion.conversionRate}%`}</span>
      </div>
    </section>
  );
}

/** Funnel view for get_funnel_lead_stats (the Leads tab cards) and get_funnel_lead_analytics (the conversion chart). */
export function FunnelView({ host, state }: { host: Host; state: HostSnapshot }) {
  const stats = summarizeFunnelStats(state.payload);
  const conversion = stats ? null : summarizeFunnelConversion(state.payload);

  useEffect(() => {
    if (stats) host.tellModel('Leads do funil abertos na tela do chat.');
    else if (conversion) host.tellModel(`Conversão por etapa${conversion.funnelTitle ? ` de "${conversion.funnelTitle}"` : ''} aberta na tela do chat.`);
  }, [host, state.payload]);

  if (!stats && !conversion) return <p className="state" data-tone="error">A resposta não trouxe dados do funil.</p>;
  return (
    <div className="dashboard">
      <ViewHeader title={stats ? 'Leads do funil' : conversion?.funnelTitle ?? 'Funil'} />
      {stats ? <LeadStats stats={stats} /> : <Conversion conversion={conversion!} />}
    </div>
  );
}

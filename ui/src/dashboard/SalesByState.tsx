import { useState } from 'react';
import locationIcon from '../art/icon-location.avif';
import { formatCents, formatInt } from '../lib/format';
import { BRAZIL_STATES } from './brazilStates';
import { InfoTip, Segmented, Surface } from './parts';
import type { StateSales } from './model';

const RANK_BADGES = ['#f59e0b', '#9ca3af', '#b45309'];

function tone(count: number | undefined, max: number) {
  if (!count) return 'none';
  const intensity = count / max;
  return intensity > 0.8 ? '5' : intensity > 0.6 ? '4' : intensity > 0.4 ? '3' : intensity > 0.2 ? '2' : '1';
}

function NoLocation({ withIcon, hint }: { withIcon: boolean; hint: string }) {
  return (
    <div className="no-location">
      {withIcon && <img src={locationIcon} alt="" width={32} height={32} />}
      <p className="no-location-title">Sem dados de localização</p>
      <p className="no-location-hint">{hint}</p>
    </div>
  );
}

function StatesMap({ states }: { states: StateSales[] }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const byCode = Object.fromEntries(states.map((s) => [s.state, s]));
  const max = Math.max(1, ...states.map((s) => s.count));
  const total = states.reduce((sum, s) => sum + s.count, 0);
  const hover = hovered ? byCode[hovered] : undefined;
  return (
    <div className="map-view">
      <div className="map-box">
        <svg viewBox="50 20 400 440" className="brazil" role="img" aria-label="Mapa de vendas por estado">
          {Object.entries(BRAZIL_STATES).map(([code, st]) => (
            <g key={code}>
              <path d={st.path} className="uf" data-tone={tone(byCode[code]?.count, max)} onPointerEnter={() => setHovered(code)} onPointerLeave={() => setHovered(null)} />
              <text x={st.labelX} y={st.labelY} className="uf-label" textAnchor="middle" dominantBaseline="middle">{code}</text>
            </g>
          ))}
        </svg>
        {hovered && hover && (
          <div className="state-pop">
            <p className="pop-name">{BRAZIL_STATES[hovered].name}</p>
            <p className="pop-line">{`${hover.count} vendas • ${formatCents(hover.revenue)}`}</p>
          </div>
        )}
      </div>
      <div className="top-states">
        {states.length ? (
          <>
            <p className="top-title">Top Estados</p>
            {states.slice(0, 3).map((s, i) => (
              <div key={s.state} className="top-row">
                <span className="top-left">
                  <span className="badge" style={{ background: RANK_BADGES[i] }}>{i + 1}</span>
                  <span className="top-name">{BRAZIL_STATES[s.state]?.name ?? s.state}</span>
                </span>
                <span className="top-count">{total > 0 ? `${formatInt(s.count)} (${((s.count / total) * 100).toFixed(0)}%)` : formatInt(s.count)}</span>
              </div>
            ))}
          </>
        ) : (
          <NoLocation withIcon={false} hint="Habilite frete nos checkouts para coletar endereços" />
        )}
      </div>
    </div>
  );
}

function StatesList({ states }: { states: StateSales[] }) {
  if (!states.length) return <NoLocation withIcon hint="Dados disponíveis apenas para vendas com endereço (checkout com frete habilitado)" />;
  const total = states.reduce((sum, s) => sum + s.count, 0);
  return (
    <div className="state-list">
      {states.map((s) => (
        <div key={s.state} className="state-row">
          <span className="state-left">
            <img src={locationIcon} alt="" width={20} height={20} />
            <span>{BRAZIL_STATES[s.state]?.name ?? s.state}</span>
          </span>
          <span className="state-right">
            <span className="state-track"><span style={{ width: `${total > 0 ? (s.count / total) * 100 : 0}%` }} /></span>
            <span className="state-nums">
              <span className="state-count">{formatInt(s.count)}</span>
              <span className="state-rev">{formatCents(s.revenue)}</span>
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

/** SalesByState of the seller dashboard: schematic map with the top 3, or the full list. */
export function SalesByState({ states }: { states: StateSales[] }) {
  const [view, setView] = useState<'map' | 'list'>('map');
  return (
    <Surface className="analytics states-card">
      <header className="states-head">
        <div className="states-title">
          <h3 className="card-title small">Vendas por Estado</h3>
          <Segmented tight options={[['map', 'Mapa'], ['list', 'Lista']]} active={view} onPick={setView} />
        </div>
        <InfoTip text="Vendas aprovadas com endereço de entrega, por estado." />
      </header>
      <div className="states-body">{view === 'map' ? <StatesMap states={states} /> : <StatesList states={states} />}</div>
    </Surface>
  );
}

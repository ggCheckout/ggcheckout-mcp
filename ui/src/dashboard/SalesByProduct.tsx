import { ArrowDown, ArrowUp, Search } from 'lucide-react';
import { useState } from 'react';
import { InfoTip, Segmented, Surface } from './parts';
import type { ProductShare } from './model';

const BAR_COLORS = ['#3b82f6', '#22d3ee', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#f97316', '#14b8a6', '#6366f1', '#84cc16'];
const VISIBLE_LIMIT = 5;
type Tab = 'products' | 'bumps';

/** SalesByProduct of the seller dashboard: products and order bumps, ranked, searchable. */
export function SalesByProduct({ products, orderBumps }: { products: ProductShare[]; orderBumps: ProductShare[] }) {
  const [tab, setTab] = useState<Tab>('products');
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [order, setOrder] = useState<'desc' | 'asc'>('desc');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const items = tab === 'bumps' && orderBumps.length ? orderBumps : products;
  const ranked = [...items]
    .sort((a, b) => (order === 'desc' ? b.count - a.count : a.count - b.count))
    .map((item, i) => ({ ...item, rank: i + 1, color: BAR_COLORS[i % BAR_COLORS.length] }));
  const q = query.trim().toLowerCase();
  const rows = q ? ranked.filter((item) => item.name.toLowerCase().includes(q)) : ranked;
  const visible = expanded ? rows : rows.slice(0, VISIBLE_LIMIT);
  const max = Math.max(1, ...items.map((p) => p.count));
  const picked = items.filter((p) => selected.has(p.name));
  const total = (picked.length ? picked : items).reduce((sum, p) => sum + p.count, 0);
  const sortLabel = order === 'desc' ? 'Maior para menor' : 'Menor para maior';

  const pickTab = (next: Tab) => {
    setTab(next);
    setExpanded(false);
    setQuery('');
    setSelected(new Set());
  };
  const toggle = (name: string) => setSelected((current) => {
    const next = new Set(current);
    if (!next.delete(name)) next.add(name);
    return next;
  });

  return (
    <Surface className="insight list-card art-sales-by-product">
      <header className="list-head">
        <div className="list-title">
          <h3 className="card-title">Vendas por Produto</h3>
          <InfoTip text="Distribuição de vendas aprovadas por produto no período selecionado." />
        </div>
        <Segmented
          className="tabs"
          options={[['products', 'Produtos'], ...(orderBumps.length ? [['bumps', 'Order Bumps'] as [Tab, string]] : [])]}
          active={tab}
          onPick={pickTab}
        />
        {items.length > 0 && (
          <div className="tools">
            <label className="search-box">
              <Search size={14} aria-hidden />
              <input className="search" type="search" placeholder="Buscar produto..." aria-label="Buscar produto" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <button type="button" className="icon-btn" title={sortLabel} aria-label={sortLabel} onClick={() => setOrder(order === 'desc' ? 'asc' : 'desc')}>
              {order === 'desc' ? <ArrowDown size={14} aria-hidden /> : <ArrowUp size={14} aria-hidden />}
            </button>
            {selected.size > 0 && (
              <button type="button" className="chip" onClick={() => setSelected(new Set())}>{`${selected.size} selecionados ×`}</button>
            )}
          </div>
        )}
      </header>
      <div className="list-body">
        {items.length ? (
          <div className={expanded ? 'ranked expanded' : 'ranked'}>
            {visible.map((p) => (
              <button key={p.name} type="button" className={selected.has(p.name) ? 'rank-row selected' : 'rank-row'} aria-pressed={selected.has(p.name)} onClick={() => toggle(p.name)}>
                <span className="rank-line">
                  <span className="rank-dot" style={{ background: p.color }} />
                  <span className="rank-n">{`${p.rank}.`}</span>
                  <span className="rank-name" title={p.name}>{p.name}</span>
                  <span className="rank-count num">{p.count.toLocaleString('pt-BR')}</span>
                  <span className="rank-pct">{`${p.percentage.toFixed(0)}%`}</span>
                </span>
                <span className="rank-track"><span style={{ width: `${(p.count / max) * 100}%`, background: p.color }} /></span>
              </button>
            ))}
          </div>
        ) : (
          <p className="empty">Nenhuma venda no período</p>
        )}
        {items.length > 0 && (
          <div className="list-foot">
            <span>{picked.length ? `Selecionados: ${picked.length} (${total} vendas)` : `Total: ${total} vendas`}</span>
            {rows.length > VISIBLE_LIMIT && (
              <button type="button" className="more" onClick={() => setExpanded(!expanded)}>{expanded ? 'Ver menos' : 'Ver mais'}</button>
            )}
          </div>
        )}
      </div>
    </Surface>
  );
}

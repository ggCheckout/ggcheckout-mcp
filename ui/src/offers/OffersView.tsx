import { ArrowDown, Flag, ShoppingCart, Timer } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import '../styles/dashboard.css';
import './offers.css';
import type { Host, HostSnapshot } from '../host';
import { formatCents } from '../lib/format';
import { declineLine, summarizeDownsells, summarizeUpsells, type Offer } from './model';

const ORDINALS = ['Primeiro', 'Segundo', 'Terceiro', 'Quarto', 'Quinto'];
const ordinal = (i: number) => ORDINALS[i] ?? `${i + 1}º`;

function Step({ icon, title, sub }: { icon: ReactNode; title: string; sub?: string }) {
  return (
    <li className="of-step">
      <span className="of-step-icon" aria-hidden>{icon}</span>
      <span><span className="of-step-title">{title}</span>{sub && <span className="of-step-sub">{sub}</span>}</span>
    </li>
  );
}

function Arrow({ label }: { label?: string }) {
  return (
    <li className="of-arrow" aria-hidden={!label}>
      <ArrowDown size={14} />
      {label && <span>{label}</span>}
    </li>
  );
}

/** An offer card, as FunnelSequenceStrip draws a product: ordinal, title, price (struck original), status. */
function OfferCard({ offer, i }: { offer: Offer; i: number }) {
  const struck = offer.originalPriceCents != null && offer.priceCents != null && offer.originalPriceCents > offer.priceCents;
  return (
    <li className="of-card" data-kind={offer.kind} data-active={offer.active || undefined}>
      <span className="of-card-top">
        <span className="of-ordinal">{`${ordinal(i)} ${offer.kind === 'upsell' ? 'upsell' : 'downsell'}`}</span>
        <span className="of-status" data-on={offer.active || undefined}>{offer.active ? 'ativo' : 'inativo'}</span>
      </span>
      <span className="of-title">{offer.title}</span>
      {offer.headline && <span className="of-headline">{offer.headline}</span>}
      <span className="of-meta">
        {offer.priceCents != null && (
          <span className="of-price num">
            {struck && <s>{formatCents(offer.originalPriceCents)}</s>}
            {formatCents(offer.priceCents)}
          </span>
        )}
        {offer.productCount > 1 && <span className="of-chip">{`${offer.productCount} produtos`}</span>}
        {offer.timerMinutes != null && <span className="of-chip"><Timer size={12} aria-hidden />{`${offer.timerMinutes} min`}</span>}
      </span>
    </li>
  );
}

/** The post-purchase map: checkout, the upsells, the downsells a declined "stop" upsell opens, success. */
function OfferMap({ upsells, downsells }: { upsells: Offer[]; downsells: Offer[] | null }) {
  const live = upsells.filter((u) => u.active);
  const liveDown = (downsells ?? []).filter((d) => d.active);
  return (
    <section className="surface of-map">
      <h2 className="card-title">Funil pós-compra</h2>
      <p className="card-sub">Recusar um upsell configurado como "parar na recusa" inicia a sequência de downsell deste produto.</p>
      <ol className="of-flow">
        <Step icon={<ShoppingCart size={16} />} title="Checkout" sub="O comprador paga o produto principal" />
        {upsells.length ? upsells.map((u, i) => (
          <li key={u.id} className="of-group">
            <ol className="of-flow">
              {i === 0 && <Arrow label="Depois da compra" />}
              <OfferCard offer={u} i={i} />
              <Arrow label={u.active ? declineLine(u, i === upsells.length - 1 || !upsells.slice(i + 1).some((x) => x.active), liveDown.length > 0) : 'Inativo: o funil pula esta oferta'} />
            </ol>
          </li>
        )) : <li className="of-empty">Nenhum upsell ainda.</li>}
        {downsells && downsells.length > 0 && (
          <>
            {!live.length && (
              <li className="of-warn">Este produto não tem upsell. Sem um upsell para recusar, estes downsells não vão aparecer no checkout.</li>
            )}
            {downsells.map((d, i) => (
              <li key={d.id} className="of-group">
                <ol className="of-flow">
                  <OfferCard offer={d} i={i} />
                  <Arrow label={d.active ? declineLine(d, i === downsells.length - 1 || !downsells.slice(i + 1).some((x) => x.active), false) : 'Inativo: o funil pula esta oferta'} />
                </ol>
              </li>
            ))}
          </>
        )}
        <Step icon={<Flag size={16} />} title="Sucesso" sub="A página de obrigado do produto" />
      </ol>
      {downsells === null && <p className="of-note">Os downsells deste produto não puderam ser lidos.</p>}
    </section>
  );
}

/** Offers view: list_upsells or list_downsells, completed with the other list of the same product. */
export function OffersView({ host, state }: { host: Host; state: HostSnapshot }) {
  const upsells = useMemo(() => summarizeUpsells(state.payload), [state.payload]);
  const downsells = useMemo(() => (upsells ? null : summarizeDownsells(state.payload)), [upsells, state.payload]);
  const productId = typeof state.args.productId === 'string' ? state.args.productId : null;
  const [other, setOther] = useState<Offer[] | null | undefined>(undefined);

  useEffect(() => {
    if ((!upsells && !downsells) || !productId || !state.canCallTools) return;
    const tool = upsells ? 'list_downsells' : 'list_upsells';
    host.callTool(tool, { productId })
      .then((data) => setOther(upsells ? summarizeDownsells(data) : summarizeUpsells(data)))
      .catch(() => setOther(null));
  }, [host, upsells, downsells, productId, state.canCallTools]);

  useEffect(() => {
    if (upsells || downsells) host.tellModel('Funil pós-compra (upsells e downsells) do produto aberto na tela do chat.');
  }, [host, upsells, downsells]);

  if (!upsells && !downsells) return <p className="state" data-tone="error">A resposta não trouxe ofertas.</p>;
  const ups = upsells ?? (other === undefined ? [] : other ?? []);
  const downs = downsells ?? (other === undefined ? [] : other);
  return <div className="dashboard offers"><OfferMap upsells={ups} downsells={downs} /></div>;
}

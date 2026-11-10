import { Check, Lock } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import '../styles/dashboard.css';
import './rewards.css';
import community from '../art/reward-community.avif';
import networkGroup from '../art/reward-network-group.avif';
import bracelet from '../art/reward-bracelet.avif';
import plaque50k from '../art/reward-plaque-50k.avif';
import plaque100k from '../art/reward-plaque-100k.avif';
import plaque500k from '../art/reward-plaque-500k.avif';
import plaque1m from '../art/reward-plaque-1m.avif';
import type { Host, HostSnapshot } from '../host';
import { formatAmount, formatReais, summarizeRedeem, summarizeRewards, type Rewards, type Stop } from './model';

const ART: Record<Stop['art'], string> = {
  community, 'network-group': networkGroup, bracelet,
  'plaque-50k': plaque50k, 'plaque-100k': plaque100k, 'plaque-500k': plaque500k, 'plaque-1m': plaque1m,
};

/** ProgressHeader: total revenue and the way to the next stop. */
function Header({ rewards }: { rewards: Rewards }) {
  const { next } = rewards;
  return (
    <section className="surface rw-head">
      <div className="rw-head-top">
        <div>
          <p className="eyebrow">Faturamento total</p>
          <p className="rw-total num"><span className="rw-currency">R$</span>{formatAmount(rewards.revenueReais)}</p>
        </div>
        <div className="rw-head-side">
          <p className="num">{`${rewards.completed} de ${rewards.total} conquistadas`}</p>
          {next && <p className="muted">{`próxima parada: ${next.title}`}</p>}
        </div>
      </div>
      {next && (
        <>
          <div className="rw-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={next.percent} aria-label={`Caminho até ${next.title}`}>
            <span style={{ width: `${next.percent}%` }} />
          </div>
          <p className="rw-way num"><strong>{formatAmount(next.missingReais)}</strong>{` para ${next.title} · ${next.percent}% do caminho`}</p>
        </>
      )}
    </section>
  );
}

/** The redeem of the WhatsApp group: the only reward redeem_reward takes; it hands back the invite link. */
function GroupRedeem({ host, stop }: { host: Host; stop: Stop }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);

  async function redeem() {
    if (busy || !stop.rewardId) return;
    setBusy(true);
    setError(null);
    try {
      const result = summarizeRedeem(await host.callTool('redeem_reward', { rewardId: stop.rewardId }));
      if (!result?.redirectUrl) throw new Error('Ocorreu um erro ao tentar resgatar a recompensa');
      setLink(result.redirectUrl);
      host.tellModel(`O vendedor resgatou pelo chat: ${stop.title}.`);
      await host.openLink(result.redirectUrl);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Ocorreu um erro ao tentar resgatar a recompensa');
    } finally {
      setBusy(false);
    }
  }

  if (link) return <a className="rw-link" href={link} target="_blank" rel="noreferrer" onClick={(e) => { e.preventDefault(); void host.openLink(link); }}>Abrir o grupo</a>;
  return (
    <>
      <button type="button" className="cta rw-redeem" onClick={redeem} disabled={busy}>{busy ? 'Carregando...' : 'Entrar no grupo'}</button>
      {error && <p className="rw-error" role="alert">{error}</p>}
    </>
  );
}

function StopRow({ host, stop, n, total, canCallTools }: { host: Host; stop: Stop; n: number; total: number; canCallTools: boolean }) {
  return (
    <li className="rw-stop" data-state={stop.state}>
      <span className="rw-node" aria-hidden>{stop.state === 'unlocked' ? <Check size={14} /> : stop.state === 'locked' ? <Lock size={12} /> : null}</span>
      <span className="rw-art" title={`Parada ${n} de ${total}`}>
        <img src={ART[stop.art]} width={64} height={64} alt="" />
        {stop.state === 'locked' && <Lock size={16} className="rw-art-lock" aria-hidden />}
      </span>
      <span className="rw-body">
        <span className="rw-title-line">
          <span className="rw-title">{stop.title}</span>
          {stop.state === 'current' && <span className="rw-here">Você está aqui</span>}
        </span>
        {stop.targetReais > 0 && <span className="rw-target num">{`${formatReais(stop.targetReais)} faturados`}</span>}
        <span className="rw-desc">{stop.description}</span>
        {stop.state === 'unlocked' && stop.kind === 'whatsapp_group' && canCallTools && <GroupRedeem host={host} stop={stop} />}
        {stop.state === 'unlocked' && stop.kind === 'physical' && <span className="rw-hint">Resgate no painel: o envio pede seu endereço.</span>}
      </span>
      <span className="rw-side">
        {stop.state === 'unlocked' ? <span className="rw-done">Conquistado</span> : (
          <>
            <span className="rw-missing-label">Faltam</span>
            <span className="rw-missing num">{formatReais(stop.missingReais)}</span>
            {stop.state === 'current' && (
              <>
                <span className="rw-mini" aria-hidden><span style={{ width: `${stop.percent}%` }} /></span>
                <span className="rw-missing-label num">{`${stop.percent}% do caminho`}</span>
              </>
            )}
          </>
        )}
      </span>
    </li>
  );
}

/** Rewards view: calculate_rewards (the trail) and redeem_reward (the group link). */
export function RewardsView({ host, state }: { host: Host; state: HostSnapshot }) {
  const rewards = useMemo(() => summarizeRewards(state.payload), [state.payload]);
  const redeemed = useMemo(() => (rewards ? null : summarizeRedeem(state.payload)), [rewards, state.payload]);

  useEffect(() => {
    if (rewards) host.tellModel('Trilha de recompensas aberta na tela do chat.');
  }, [host, rewards]);

  if (redeemed) {
    return (
      <div className="dashboard rewards">
        <section className="surface rw-head">
          <p className="eyebrow brand">Recompensa resgatada</p>
          <p className="rw-desc">{redeemed.redirectUrl ? 'Seu acesso ao grupo está pronto.' : 'Resgate registrado.'}</p>
          {redeemed.redirectUrl && <button type="button" className="cta rw-redeem" onClick={() => void host.openLink(redeemed.redirectUrl!)}>Entrar no grupo</button>}
        </section>
      </div>
    );
  }
  if (!rewards) return <p className="state" data-tone="error">A resposta não trouxe recompensas.</p>;
  return (
    <div className="dashboard rewards">
      <Header rewards={rewards} />
      <section className="surface rw-trail">
        <h2 className="card-title">Sua Jornada de Conquistas</h2>
        <p className="card-sub">Cada meta alcançada traz recompensas exclusivas para você</p>
        <ol className="rw-stops">
          {rewards.stops.map((s, i) => <StopRow key={s.title} host={host} stop={s} n={i + 1} total={rewards.stops.length} canCallTools={state.canCallTools} />)}
        </ol>
        <p className="rw-foot">O faturamento é calculado com base em todos os pedidos pagos desde o início.</p>
      </section>
    </div>
  );
}

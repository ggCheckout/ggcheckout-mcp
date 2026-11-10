import { useSyncExternalStore } from 'react';
import type { Host } from './host';
import { pickView } from './views';
import { SalesView } from './dashboard/SalesView';
import { FunnelView } from './funnel/FunnelView';
import { PaymentsView } from './payments/PaymentsView';
import { BillingView } from './billing/BillingView';
import { PixView } from './pix/PixView';

export function GgApp({ host }: { host: Host }) {
  const state = useSyncExternalStore(host.subscribe, host.getSnapshot, host.getSnapshot);

  if (state.error) return <p className="state" data-tone="error" role="alert">{state.error}</p>;
  if (state.payload === undefined) return <div className="skeleton" style={{ height: 220 }} aria-busy="true" />;

  switch (pickView(state.toolName, state.payload)) {
    case 'sales':
      return <SalesView key={state.generation} host={host} state={state} />;
    case 'funnel':
      return <FunnelView key={state.generation} host={host} state={state} />;
    case 'payments':
      return <PaymentsView key={state.generation} host={host} state={state} />;
    case 'billing':
      return <BillingView key={state.generation} host={host} state={state} />;
    case 'pix':
      return <PixView key={state.generation} host={host} state={state} />;
    default:
      return <p className="state" data-tone="error">A resposta não trouxe nada que esta tela desenhe.</p>;
  }
}

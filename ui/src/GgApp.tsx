import { useSyncExternalStore } from 'react';
import type { Host } from './host';
import { pickView } from './views';
import { SalesView } from './dashboard/SalesView';
import { FunnelView } from './funnel/FunnelView';
import { PaymentsView } from './payments/PaymentsView';
import { BillingView } from './billing/BillingView';
import { DomainsView } from './domains/DomainsView';
import { DeliveriesView } from './deliveries/DeliveriesView';
import { GatewaysView } from './gateways/GatewaysView';
import { RewardsView } from './rewards/RewardsView';
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
    case 'domains':
      return <DomainsView key={state.generation} host={host} state={state} />;
    case 'deliveries':
      return <DeliveriesView key={state.generation} host={host} state={state} />;
    case 'gateways':
      return <GatewaysView key={state.generation} host={host} state={state} />;
    case 'rewards':
      return <RewardsView key={state.generation} host={host} state={state} />;
    case 'pix':
      return <PixView key={state.generation} host={host} state={state} />;
    default:
      return <p className="state" data-tone="error">A resposta não trouxe nada que esta tela desenhe.</p>;
  }
}

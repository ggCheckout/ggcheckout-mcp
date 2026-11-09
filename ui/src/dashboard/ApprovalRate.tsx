import { formatInt, formatPercent } from '../lib/format';
import { gatewayLogo, gatewayName, METHOD_ICONS } from '../lib/gateways';
import { Surface } from './parts';
import type { MethodApproval } from './model';

function GatewayMark({ gateway }: { gateway: string }) {
  const logo = gatewayLogo(gateway);
  return (
    <span className="gw-mark">
      {logo ? <img src={logo} alt="" /> : <span className="gw-initial">{gatewayName(gateway).charAt(0).toUpperCase()}</span>}
    </span>
  );
}

function MethodRow({ method, open }: { method: MethodApproval; open: boolean }) {
  const hasGateways = method.byGateway.length > 0;
  return (
    <details className="method" data-method={method.key} open={open && hasGateways}>
      <summary className="method-row">
        <span className="method-icon"><img src={METHOD_ICONS[method.key] ?? METHOD_ICONS.gateway} alt="" /></span>
        <span className="method-text">
          <strong>{method.label}</strong>
          <span className="muted num">{`${formatInt(method.approved)}/${formatInt(method.total)}`}</span>
        </span>
        <span className="method-bar"><span style={{ width: `${(method.rate ?? 0) * 100}%` }} /></span>
        <span className="method-rate num">{method.rate == null ? 'N/A' : formatPercent(method.rate)}</span>
        {hasGateways && <span className="chevron" aria-hidden />}
      </summary>
      {hasGateways && (
        <div className="gw-list">
          {method.byGateway.map((g) => (
            <div key={g.gateway} className="gw-row">
              <GatewayMark gateway={g.gateway} />
              <span className="gw-name">{gatewayName(g.gateway)}</span>
              <span className="muted num">{`${formatInt(g.approved)}/${formatInt(g.total)}`}</span>
              <span className="gw-rate num">{g.rate == null ? 'N/A' : formatPercent(g.rate)}</span>
            </div>
          ))}
        </div>
      )}
    </details>
  );
}

/**
 * ApprovalRate of the seller dashboard: one row per method that opens into its gateways. Inside the
 * approval focus the rows start open, since the gateways are the answer.
 */
export function ApprovalRate({ approval, open }: { approval: MethodApproval[]; open: boolean }) {
  return (
    <Surface className="insight list-card art-approval-rate">
      <header className="list-head"><h3 className="card-title">Taxa de Aprovação</h3></header>
      <div className="list-body">
        {approval.length
          ? approval.map((method) => <MethodRow key={method.key} method={method} open={open} />)
          : <p className="empty">Nenhuma tentativa no período</p>}
      </div>
    </Surface>
  );
}

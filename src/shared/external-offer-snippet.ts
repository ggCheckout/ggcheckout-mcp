import type { ExternalFlow, OfferKind } from '../core/types/product.js';

/**
 * The HTML the seller pastes on their own page for an external upsell — the same markup the
 * dashboard's "Copiar HTML" produces (`lib/upsell/externalOfferSnippet.ts` in the saas). The API has
 * no route that renders it, so it is built here; keep the two in step.
 *
 * Only `data-gg-offer`, `data-gg-accept`, `data-gg-decline` and the script are the contract: the
 * script reads those, opens the GG iframe and charges from inside it. The inline styles only make
 * the button look like the one in the editor's preview.
 */

const SNIPPET_PATH = '/embed/upsell.js';
const SNIPPET_VERSION = 1;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Black or white text over `#RRGGBB`, by relative luminance — the editor's `getContrastText`. */
function contrastText(hex: string): string {
  const int = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(int >> 16) & 255, (int >> 8) & 255, int & 255].map((channel) => {
    const v = channel / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.5 ? '#000000' : '#ffffff';
}

function cssText(style: Record<string, string>): string {
  return Object.entries(style)
    .map(([property, value]) => `${property.replace(/[A-Z]/g, (l) => `-${l.toLowerCase()}`)}:${value}`)
    .join(';');
}

const COLOR = /^#[0-9a-fA-F]{6}$/;

function isStep(value: unknown): boolean {
  const step = value as { kind?: unknown; url?: unknown } | null;
  return step?.kind === 'thank_you' || (step?.kind === 'url' && typeof step.url === 'string');
}

/**
 * Whether a stored value is a routing the API would apply — the shape of its `externalFlowSchema`.
 * The API reads an invalid one as absent, so the snippet must too.
 */
export function isExternalFlow(value: unknown): value is ExternalFlow {
  const flow = value as Partial<ExternalFlow> | null;
  return typeof flow?.acceptLabel === 'string' && flow.acceptLabel.trim() !== ''
    && typeof flow.declineLabel === 'string' && flow.declineLabel.trim() !== ''
    && typeof flow.buttonColor === 'string' && COLOR.test(flow.buttonColor)
    && isStep(flow.onAccept) && isStep(flow.onDecline);
}

export function externalOfferRef(kind: OfferKind, parentProductId: string, offerUid: string, productId: string) {
  return `${kind}:${parentProductId}:${offerUid}:${productId}`;
}

export function buildExternalOfferSnippet(input: {
  offerRef: string;
  flow: Pick<ExternalFlow, 'acceptLabel' | 'declineLabel' | 'buttonColor'>;
  appUrl: string;
}): string {
  const acceptStyle = cssText({
    display: 'block',
    width: '100%',
    maxWidth: '480px',
    margin: '0 auto',
    padding: '16px 32px',
    border: 'none',
    borderRadius: '8px',
    backgroundColor: input.flow.buttonColor,
    color: contrastText(input.flow.buttonColor),
    fontFamily: 'inherit',
    fontSize: '18px',
    fontWeight: '700',
    lineHeight: '1.3',
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.15)',
  });
  const declineStyle = cssText({
    display: 'inline-block',
    marginTop: '16px',
    color: '#6b7280',
    fontSize: '14px',
    fontFamily: 'inherit',
    textDecoration: 'underline',
  });
  const src = `${input.appUrl.replace(/\/+$/, '')}${SNIPPET_PATH}?v=${SNIPPET_VERSION}`;

  return [
    `<div data-gg-offer="${escapeHtml(input.offerRef)}" style="text-align:center">`,
    `  <button type="button" data-gg-accept style="${escapeHtml(acceptStyle)}">${escapeHtml(input.flow.acceptLabel)}</button>`,
    `  <a href="#" data-gg-decline style="${escapeHtml(declineStyle)}">${escapeHtml(input.flow.declineLabel)}</a>`,
    `</div>`,
    `<script src="${escapeHtml(src)}" async></script>`,
  ].join('\n');
}

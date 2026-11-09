import { mkdirSync, writeFileSync } from 'node:fs';
import { APP_VIEWS, buildView } from './apps.js';

/**
 * Writes each view as the client receives it to `dist/views/<page>`, published as
 * `ggcheckout-mcp/views/<page>`: saas-checkout's Storybook loads them next to the dashboard
 * components they mirror, so a drift between the two shows in review. Run by `npm run build`.
 */
const out = new URL('../../../views/', import.meta.url);
mkdirSync(out, { recursive: true });
for (const view of APP_VIEWS) writeFileSync(new URL(view.page, out), buildView(view.page));

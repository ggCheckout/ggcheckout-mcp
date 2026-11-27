# Contracts published by other repos

Copies of the contract packages that this repo reads in tests. They are a mirror, never a source:
the producer owns them and tests its real responses against them.

| Package | Producer | Read by |
|---|---|---|
| `ggcheckout-core/whatsapp-agent/v2` | `ggCheckout/ggcheckout-core` → `contracts/whatsapp/agent/v2` | the WhatsApp assistant tools and the recipe (`examples/whatsapp-agent`) |
| `saas-checkout/buyer-messaging/overview/v1` | `ggCheckout/saas-checkout` → `contracts/buyer-messaging/overview/v1` | `get_buyer_messaging_overview` |

The WhatsApp agent tools call the saas, which passes the core bodies on unchanged where the core
package notes it (the pending page, the conversation page, the reply, the escalation). The tool
limits, the recipe and the overview parser are tested against these fixtures, never against shapes
written by hand in a test.

## Updating a package

1. Copy the producer's directory byte by byte, its `manifest.json` included:
   `git -C <producer> archive <commit> <dir> | tar -x -C <tmp>`, then copy `<tmp>/<dir>/` over the
   package here.
2. Update `UPSTREAM_PINS` in `src/contracts/upstream-mirror.test.ts`: the producer commit the copy
   came from and the sha-256 of its `manifest.json`.
3. Run `npx vitest run src/contracts examples/whatsapp-agent src/adapters/outbound/buyer-messaging.api.test.ts`.

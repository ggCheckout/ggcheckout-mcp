# Contracts published by ggcheckout-core

Copies of the core's contract packages that this repo reads in tests. They are a mirror, never a
source: the core owns them and tests its real responses against them.

| Package | Producer |
|---|---|
| `whatsapp-agent/v2` | `ggCheckout/ggcheckout-core` → `contracts/whatsapp/agent/v2` |

The WhatsApp agent tools call the saas, which passes these core bodies on unchanged where noted in
the package (the pending page, the conversation page, the reply, the escalation). The recipe
(`examples/whatsapp-agent`) and the tool limits are tested against these fixtures, never against
shapes written by hand in a test.

## Updating a package

1. Copy the producer's directory byte by byte, its `manifest.json` included:
   `git -C <core> archive <commit> contracts/whatsapp/agent/v2 | tar -x -C <tmp>`, then copy
   `<tmp>/contracts/whatsapp/agent/v2/` over `whatsapp-agent/v2/`.
2. Update `CORE_MANIFEST_PINS` in `src/contracts/core-mirror.test.ts`: the core commit the copy
   came from and the sha-256 of its `manifest.json`.
3. Run `npx vitest run src/contracts examples/whatsapp-agent`.

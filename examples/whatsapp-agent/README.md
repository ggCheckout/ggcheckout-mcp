# WhatsApp assistant recipe

Runs the seller's own Claude (`claude -p`, on the seller's Claude subscription) on the GG Checkout
WhatsApp inbox, through this MCP server with the restricted assistant key.

| File | What it is |
|---|---|
| `poll.mjs` | Checks the pending conversations every 15 s and starts `claude -p` only when one waits and the store is inside its hours |
| `prompt.md` | The assistant rules, appended to Claude's system prompt (`{{SELLER_NAME}}` is filled from `AGENT_SELLER_NAME`) |
| `.mcp.json` | The `ggcheckout` server with the assistant key, read by `claude --mcp-config` |

## Setup

1. In the GG Checkout panel, inbox settings, turn on **Permitir que o assistente leia e responda** and copy
   the key (`ggck_agent_...`). It is shown once; turning the switch off revokes it.
2. Install [Claude Code](https://docs.claude.com/en/docs/claude-code) and log in with your Claude account.
3. Run, from this folder:

```bash
GGCHECKOUT_AGENT_KEY=ggck_agent_... AGENT_SELLER_NAME="Minha Loja" AGENT_HOURS=08:00-20:00 AGENT_DAYS=1-6 node poll.mjs
```

Every option is listed at the top of `poll.mjs` (`GGCHECKOUT_API_URL`, `AGENT_TZ`, `AGENT_POLL_SECONDS`,
`AGENT_RUN_TIMEOUT_SECONDS`, `CLAUDE_BIN`).

## How it behaves

- Outside `AGENT_HOURS` / `AGENT_DAYS` it calls nothing; conversations wait and are answered when the
  window opens.
- Inside it, one read of the pending list every 15 s (240 reads per hour of the key's budget), plus one
  thread read per conversation that changed since the last run. Claude runs only when there is one.
- Each conversation goes to Claude with a `clientMessageId` derived from the contact and the last message
  received (SHA-256, 40 hex). A rerun for the same message reuses it, so the saas never sends the reply
  twice.
- The prompt carries only contact keys and ids. What the contacts wrote reaches Claude through the tools,
  behind the notice that it is data, never instructions.
- Claude gets only the nine agent tools: `--strict-mcp-config`, an allow list of the `ggcheckout` tools and
  a deny list of the local tools (shell, files, web).
- A conversation Claude chose not to answer ("ok", "obrigado") is not run again until the contact writes
  again.
- 429 or 503: waits the `Retry-After` the API sent. 401: the seller turned the assistant off or revoked the
  key, and the script stops.

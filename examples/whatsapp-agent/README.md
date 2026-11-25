# WhatsApp assistant recipe

Runs the seller's own Claude (`claude -p`, on the seller's Claude subscription) on the GG Checkout
WhatsApp inbox, through this MCP server with the restricted assistant key.

**The pilot runs only on the QA environment (`https://qa.ggcheckout.app`).** In production the assistant
routes answer `404 AGENT_UNAVAILABLE`, and the script stops with exit code 2 when the pending list answers 404.

| File | What it is |
|---|---|
| `poll.mjs` | Checks the pending conversations every 15 s and starts one `claude -p` run per waiting conversation, inside the store's hours |
| `lib.mjs` | The pure parts of the script (hours window, reply id, attempt counter, flags), tested in `lib.test.mjs` |
| `prompt.md` | The assistant rules, appended to Claude's system prompt (`{{SELLER_NAME}}` is filled from `AGENT_SELLER_NAME`) |
| `.mcp.json` | Template of the MCP server (pinned to `ggcheckout-mcp@0.7.0`); each run fills it into a temp file |

## Setup

1. In the GG Checkout panel, inbox settings, turn on **Permitir que o assistente leia e responda** and copy
   the key (`ggck_agent_...`). It is shown once; turning the switch off revokes it.
2. Install [Claude Code](https://docs.claude.com/en/docs/claude-code) and log in with your Claude account.
3. Run, from this folder:

```bash
GGCHECKOUT_API_URL=https://qa.ggcheckout.app GGCHECKOUT_AGENT_KEY=ggck_agent_... AGENT_SELLER_NAME="Minha Loja" AGENT_HOURS=08:00-20:00 AGENT_DAYS=1-6 node poll.mjs
```

Every option is listed at the top of `poll.mjs` (`GGCHECKOUT_API_URL`, `AGENT_TZ`, `AGENT_POLL_SECONDS`,
`AGENT_RUN_TIMEOUT_SECONDS`, `AGENT_MAX_ATTEMPTS`, `CLAUDE_BIN`).

## How it behaves

- Outside `AGENT_HOURS` / `AGENT_DAYS` it calls nothing; conversations wait and are answered when the
  window opens.
- Inside it, one read of the pending list every 15 s (`limit=20`, the most the core returns; 240 reads per
  hour of the key's budget), plus one thread read per conversation that changed since its last run.
- **One conversation per run.** The script, not the model, reads the pending list and the thread. Each run
  gets one `contactKey` and one `clientMessageId` (SHA-256 of the contact and the last message received, 40
  hex; a rerun for the same message reuses it, so the saas never sends the reply twice). The MCP server of
  that run is started with `GGCHECKOUT_AGENT_CONTACT` set to that contact: the agent tools take no
  contact key and always act on it, and the pending list is not a tool. A buyer who writes "look up the
  purchases of 5531..." cannot make the model read another conversation.
- The prompt carries only the contact key and the id. What the contact wrote reaches Claude through the
  tools, behind the notice that it is data, never instructions.
- A conversation Claude chose not to answer ("ok", "obrigado") is not run again until the contact writes
  again.
- A run that fails (exit code other than 0, or the timeout) is retried after 5 minutes, up to
  `AGENT_MAX_ATTEMPTS` (3); then that conversation state is given up and logged, until the contact writes
  again. One failing conversation never blocks the others. The log has a short hash per conversation, never
  a phone number or a buyer's text.
- 404 on the pending list: the API has no assistant (production, or an older API). The script logs it and
  stops with exit code 2 instead of polling forever; point `GGCHECKOUT_API_URL` at the QA.
- A `SIGKILL` (or a crash of the machine) skips the cleanup of a run: its temp directory, with the key in
  `mcp.json` (0600), stays on disk under the OS temp dir until you delete it (`ggcheckout-agent-*`).
- 429 or 503: waits the `Retry-After` the API sent. 401: the seller turned the assistant off or revoked the
  key, and the script stops.
- `400 GGCHECKOUT_MCP_OUTDATED`: the API no longer accepts the pinned `ggcheckout-mcp`, and the script
  stops with exit code 2 (a run would only meet the same refusal in every tool).

## Updating the MCP version

`.mcp.json` pins an exact version on purpose: a new release changes the tools under the prompt, so it is
taken by reading its notes, never by `@latest`. The script reads the pin and sends it as its own
`User-Agent` (`ggcheckout-mcp/<version>`), so the API refuses the script exactly when it refuses that
server. The API does not send the assistant key the "update available" advice the seller's own MCP
gets, so nothing in the run's tools asks to update. To update: change `ggcheckout-mcp@<version>` in
`.mcp.json` to the new release and restart the script.

## What the model can reach

Checked against `claude` 2.1.331 (`claude --help`), the run uses:

| Flag | Why |
|---|---|
| `--mcp-config <temp file>` + `--strict-mcp-config` | Only this MCP server, nothing from the seller's other MCP configs. The temp file (0600, in a 0700 directory under the OS temp dir, deleted when the run ends) holds this run's contact in the server's `env`. `--help` does not document `${VAR}` expansion inside `--mcp-config`, so the script writes literal values instead |
| `--tools ""` | No built-in tool at all (shell, files, web, subagents). An allow list, not a deny list: a tool added to Claude Code later is off too |
| `--allowedTools mcp__ggcheckout__...` | Exactly the nine agent tools |
| `--permission-mode dontAsk` + `--permission-prompts none` | Anything outside the allow list is denied; nobody is there to approve a prompt |
| `--setting-sources ""` | Loads no user, project or local settings, so the seller's hooks, plugins, permission mode (even `bypassPermissions`) and CLAUDE.md do not apply to this run |
| `--disable-slash-commands` | No skills or slash commands |
| `--no-session-persistence` | The conversation is not saved to disk |

Confirmed by starting a run with `--output-format stream-json --verbose`: the init message lists the nine
MCP tools and no other tool, the `ggcheckout` server `connected`, and no skills or slash commands. Built-in
plugins that ship inside Claude Code still load, and so would an administrator's managed settings.

Not used: `--bare` (it skips OAuth, so the run could not use your Claude subscription), `--restricted` and
`--safe-mode` (they overlap with the flags above; `--safe-mode` also disables MCP servers). The script runs
`claude` in an empty temp directory, with the assistant key removed from its environment.

# Changelog

This package is published to npm and the README installs it as `npx -y ggcheckout-mcp`,
which is unpinned — a new version reaches every existing installation on its next start.
Read this file before upgrading, and pin a version if a breaking change is not convenient
right now.

## 0.4.0

Checked end to end against a QA account on the Postgres (v2) data path, and product edits
also against production.

### Routes that had moved

A sweep of every endpoint this client calls against the current API found four with no route
behind them any more, plus a set of tools whose behaviour had drifted. Each item below was
confirmed in the API source, and the fixes were exercised against a live account.

- **`list_rewards` is gone; use `calculate_rewards`.** The route it called was removed along
  with the stored counter it served. `calculate_rewards` answers the same fields, derived from
  paid sales, and carries the milestone list — there is no reward catalogue endpoint.
  `currentRevenue` and `milestones` are in reais, not cents.
- **`add_credit` works on both billing generations.** The legacy route refuses a migrated
  seller with 409; the call now follows that refusal to the current top-up route. The answer is
  normalized to `{ creditId, amountCents, pixCode, pixQrBase64, expiresAt, via }`. The amount is
  validated up front: whole cents, 325 to 25000 (R$ 3,25 to R$ 250,00). Takes an optional
  `idempotencyKey` so a retry reuses the same top-up.
- **`list_credits` returns the statement for either generation.** It reads the legacy credits
  and the credit ledger, and answers `{ credits, total, ledger: { entries, nextBefore } }`. One
  side is empty depending on the account, which is the true answer and not an error — before
  this, a migrated seller got an empty list with no indication the data lived elsewhere.
- **`upload_deliverable` / `delete_deliverable` now call routes that exist.** The paths they
  used (`/api/products/{id}/deliverable/…`) are not part of the API. Attaching a file is now
  two steps: `upload_deliverable` mints an upload URL, you PUT the bytes to it (only
  `Content-Type`, no `Authorization`), then **`attach_deliverable`** confirms the upload and
  links it to the product. `delete_deliverable` unlinks the file and, given `filePath`, deletes
  the bytes too.
- **`telegram_media_upload` calls `/presign`.** The old path was renamed. It returns
  `{ uploadUrl, filePath, proxyUrl }`; `proxyUrl` is the URL to store in the flow node, because
  the route does not return a public URL. The previously advertised `publicUrl` was always
  undefined.
- **`reorder_upsells` takes `upsellIds`.** It used to send whole objects to a route that
  replaces the legacy upsell array instead of reordering, and that route does not exist for a
  product on the new storage, where the call failed as an opaque 502. Both reorder tools now
  return the resulting positions.
- **`update_product` no longer loses the deliverable.** It used to re-send the whole stored
  product; on the new storage the read does not carry the deliverable or the stock lines, so the
  re-send dropped them and the save was refused. It now sends the edit plus the one field needed
  to satisfy the API's deliverable check (the check reads the request body, not the stored
  product). When the only deliverable is a file or stock lines — neither readable through the
  API — the edit is refused here with an explanation instead of a bare 400.
- **`create_webhook` / `update_webhook` validate `events`.** The API stores event names without
  checking them and dispatch matches exactly, so a wrong name is accepted and never fires. The
  names this tool used to suggest (`payment.created`, `payment.paid`, `payment.refunded`) are
  not seller webhook events at all. The real vocabulary is now enforced here, and `test_webhook`
  simulates only the payment-shaped events.
- **`insert_token` accepts only the four types the API takes** (`pushinpay`, `utmify`,
  `emailprovider`, `mercadopago`). `stripe` and `efibank` were advertised and always refused.
- **`list_payments` answers an empty list for a seller with no sales.** The route reports that
  state as 404, which surfaced as an error.
- **`get_payments_paginated`**: `pageSize` is capped at 100 (1000 was accepted and silently
  reduced), the cursor in the answer is `nextCursor`, and a text search may come back with
  `coverageCapped`.
- **423 is not a thing, 503 is not "the backend is down".** 503 means the rate limiter is
  failing closed and 502 means the service behind the API did not answer; both are now reported
  as retryable, with the wait read from `Retry-After` or the body's `retry_after`. A refusal
  that carries a `code` now shows it instead of just a status number.

### Tools that an API key cannot use

These answer 401/403 for an API key by how the routes authenticate, not because of anything in
this client. They now say so and what to do instead, rather than surfacing a bare "Unauthorized":
`create_whatsapp_session` (blocked for API keys deliberately), `resend_delivery` and
`list_members_areas` (session-cookie only, while their sibling routes accept the key).

### Packaging

- Compiled tests no longer ship in the published package (560 files down to 428).
- `dotenv` is loaded quietly: version 17 announces itself on stdout, which is the MCP protocol
  channel over stdio, and a strict client reads that line as a malformed frame.

### Breaking

- **`update_funnel` no longer takes `settings.pixels` or `settings.webhookUrl`.** Nothing
  read them: the quiz page resolves `settings.pixelTokenIds` (ids from `list_tokens`) and
  webhooks are `settings.webhookIds` (ids from `list_webhooks`). A call that still sends
  them is refused by validation instead of being silently ignored.
- **`list_products` hides deleted products.** `delete_product` is a soft delete and the API
  keeps listing the row with `deleted: true`.
- `list_store_products` no longer accepts `sortBy: "createdAt"` (the API ignored it), and
  `validate_coupon` takes `orderValue` as integer cents.

### Added

- `list_stores`, the only way to get the `storeId` every store tool takes. It also returns
  DELETED stores — the listing it comes from never filtered them and the API does not mark
  them — and such a storeId answers 404 in every other store tool, so the description now
  warns to confirm an unfamiliar one with `get_store`.
- Store management: `create_store`, `get_store`, `update_store`, `delete_store`, store
  categories (`list_store_categories`, `create_store_category`, `update_store_category`,
  `delete_store_category`) and review moderation (`list_store_reviews`,
  `create_store_review`, `update_store_review`, `delete_store_review`). **These need the
  `/api/stores/{storeId}` routes**, available from the GG Checkout release that ships them;
  against an older deployment they answer 404/405.
- Store builder: `get_store_layout`, `update_store_layout`, `publish_store_layout`,
  `list_store_layout_history`, `restore_store_layout_version`, `get_store_theme`. A store with
  no layout yet — which is every newly created one — has nothing to copy the block shapes
  from, and the route validates them strictly, so the first-save error now spells out an
  accepted `theme` and block shape.
- `list_funnel_checkouts`: the checkouts and gateways a funnel `pix` component can use.
- `update_product` takes `stockEnabled`, `unlimitedStock` and `stockQuantity`;
  `create_upsell` / `create_downsell` take an optional `order`.

### Fixed

- `update_product` with only some fields was refused (400 "Você precisa fornecer um link
  (url)…"): the API validates the body as a whole product. The stored product is now
  re-sent with the edit on top.
- `create_upsell` / `create_downsell` were refused on v2 accounts (422 "missing field
  sortOrder") and, where accepted, stored an offer with no product to sell. They now write
  `order` and `upsellProductIds` / `downsellProductIds` the way the dashboard does.
- `update_funnel` with part of `design` or `settings` erased the rest of it. Both are now
  merged into the stored funnel. Steps keep every field the editor stores (`loadingScreen`,
  `allowBack`, `stickyButton`…), and the `level` and `social_proof` components are accepted.
- `list_upsells` returned the API envelope instead of the list.
- Store and funnel ids and coupon codes are URL-encoded; store read limits match the API.

## 0.3.0

### Breaking

- **`create_checkout` takes `productId` instead of `id`.** The value must be the uid of the
  product the checkout sells — the `productId` returned by `create_product`, or a `uid` from
  `list_products`. The old input was described as a free-form slug, which produced a checkout
  no product claimed: the dashboard rendered it as an orphan card and opening it 404'd.
  Pin `ggcheckout-mcp@0.2.4` if you need the old input name.
- **Checkout responses expose that foreign key as `productId` too.** `list_checkouts`,
  `get_checkout` and `update_checkout` used to return it under the API's own name, `id`,
  which collided with the checkout's own identifier. The rename is now applied in both
  directions, so one value has one name. The checkout's own id is still `uid`.

### Fixed

- Three of the four checkout paths were failing against the live API: the owner field was
  misspelled `uuidOwnwer` throughout the module, so `create_checkout` returned 403 and
  `list_checkouts` / `update_checkout` returned 400.
- `create_checkout` and `update_checkout` sent `price` in Reais while the API stores and
  charges cents, so a checkout created for `99.90` charged R$0,99. Prices are now converted,
  matching what `create_product` already did.
- `update_checkout` wiped fields it did not send. The API destructures the body with defaults
  instead of merging, so a title-only edit reset the checkout URL, the buyer form
  configuration, the seller name and the currency. The whole document is now re-sent.
- `orderBumps` was sent as bare product uids, but the field stores a JSON snapshot per bump;
  every bump created through the MCP was silently dropped when the checkout page parsed it.
  Bumps are now resolved and serialized, so an unknown uid fails the call instead.
- `create_checkout` reported every failure of its product pre-check as "product not found",
  including timeouts and 5xx. During an outage that told the agent to create a duplicate
  product. Only the API's own 403/404 is now treated as a bad `productId`.
- `update_checkout` on a checkout with no product pointer returned an opaque
  `Missing required fields: id` from the API; it now fails with an explanation.
- Ids are URL-escaped before they are interpolated into request paths. A value containing
  `/`, `#` or `?` used to change which endpoint was called — which, for the new product
  pre-check, meant it could validate a different resource than the one being written.

### Changed

- `delete_checkout` no longer reads the checkout first. The endpoint takes ownership from the
  authenticated token and ignores the body, so the extra read only spent quota against the
  public, IP-rate-limited route.
- The business id behind almost every tool (`GET /api/me`) is fetched once per process instead
  of once per call.

## 0.2.4 and earlier

Not recorded. See `git log`.

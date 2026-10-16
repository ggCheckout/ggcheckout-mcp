# Changelog

This package is published to npm and the README installs it as `npx -y ggcheckout-mcp@latest`,
which is unpinned — a new version reaches every existing installation on its next start.
Read this file before upgrading, and pin a version if a breaking change is not convenient
right now.

## 0.4.0

Checked end to end against a QA account on the Postgres (v2) data path, and product edits
also against production.

### Release requirement — do not publish before the API has these changes

Two tools depend on an open pull request of the API. Published before it, the install (unpinned)
reaches everyone, and they write a model the API does not read yet:

- `set_offer_product_page` and `get_offer_snippets` need the per-product seller page model of
  ggCheckout/saas-checkout#1681 (`productOverrides[product].displayMode` + `externalFlow.pageUrl`).
  Against an API without it, the write is saved but the buyer never reaches the seller's page.

`update_module`, `update_section`, `update_lesson`, `delete_module`, `delete_section` and
`delete_lesson` need the `PATCH`/`DELETE` routes under `/api/members-area/{areaId}/modules/…` of
ggCheckout/saas-checkout#1685, merged on 2026-10-13. Against an API without them they answer
"this API has no such route yet", not as a missing item.

### Breaking

Every item here changes what an existing call sends or gets back. A 0.x minor bump is a
breaking release, and with the unpinned install it reaches everyone on the next start.

- **`list_rewards` is gone; use `calculate_rewards`.** The route it called was removed along
  with the stored counter it served. `calculate_rewards` answers the same fields, derived from
  paid sales, and carries the milestone list — there is no reward catalogue endpoint.
  `currentRevenue` and `milestones` are in reais, not cents.
- **`upload_deliverable` takes `fileSize` and no longer takes `fileUrl`**, and attaching is now
  two calls: `upload_deliverable` mints an upload URL, you PUT the bytes to it, and
  **`attach_deliverable`** confirms the upload and links it. See "Routes that had moved".
- **`reorder_upsells` takes `upsellIds`** (all the ids, in order) instead of `upsells` (whole
  objects). Both reorder tools now return the resulting positions.
- **`add_credit` answers a new shape** — `{ creditId, amountCents, pixCode, pixQrBase64,
  expiresAt, via }` — and **`amountCents` must be whole cents from 325 to 25000** (R$ 3,25 to
  R$ 250,00). Anything else used to reach the API; it is now refused before the call.
- **`create_webhook` / `update_webhook` accept only the 15 real event names**, and
  **`test_webhook` simulates only `pix.paid`, `card.paid`, `pix.expired`, `card.expired`**. The
  old suggestions (`payment.created`, `payment.paid`, `payment.refunded`…) are refused.
- **`insert_token` takes `type` and `target` from `pushinpay`, `utmify`, `emailprovider`,
  `mercadopago`.** Any other value was always refused by the API.
- **Lower caps:** `get_payments_paginated` `pageSize` 1000 → 100 (the API already reduced it
  silently); `list_credits` `limit` 1000 → 200, the lowest cap of the two statements it reads.
- **`update_funnel` no longer takes `settings.pixels` or `settings.webhookUrl`.** Nothing
  read them: the quiz page resolves `settings.pixelTokenIds` (ids from `list_tokens`) and
  webhooks are `settings.webhookIds` (ids from `list_webhooks`). A call that still sends
  them is refused by validation instead of being silently ignored.
- **`list_products` hides deleted products.** `delete_product` is a soft delete and the API
  keeps listing the row with `deleted: true`.
- `list_store_products` no longer accepts `sortBy: "createdAt"` (the API ignored it), and
  `validate_coupon` takes `orderValue` as integer cents.
- **`update_checkout` merges the `checkout` object instead of replacing it.** Send only the keys
  to change. An array still replaces the stored one, and a key can no longer be removed by leaving
  it out; set it to `null` instead. The stored `checkout.paymentMethods` is not part of the merge:
  the read does not return every stored value of the methods, so re-sending it could rewrite them
  with less than what is stored. Payment methods change only when the call sends them.
- **`upload_deliverable` requires `fileType`.**
- **Empty lists are refused** where the API would do nothing with them: `events` in
  `create_webhook` / `update_webhook` and `order` in `reorder_downsells` need at least one item.
- **Lesson `content` follows the API's shape** (`create_lesson`, `update_lesson`). Quiz questions
  are `{ id, question, type, options: string[], correctAnswer, explanation, points }`; the old
  `{ text, options: [{ id, text, isCorrect }] }` was stored as sent and no student could be graded
  on it. `textMarkdown`, `videoId`, `videoDuration`, `videoThumbnail`, `videoQualities`,
  `estimatedReadTime`, `fileSize` and `fileType` are gone: the API dropped them with a 200. URLs
  must be absolute, at most 50 questions, `minScore` a whole number from 0 to 100.
- **Cascading deletes need `confirm: true`** (`delete_module`, `delete_section`, `delete_lesson`).

### Routes that had moved

A sweep of every endpoint this client calls against the current API found four with no route
behind them any more, plus a set of tools whose behaviour had drifted. Each item below was
confirmed in the API source, and the fixes were exercised against a live account.

- **`list_rewards` → `calculate_rewards`** (see Breaking).
- **`add_credit` works on both billing generations.** The legacy route refuses a migrated
  seller with 409 pointing at the top-up route; the call now follows that refusal, and only
  that one. Takes an optional `idempotencyKey`, which only the new billing reads. A timeout or
  a 502 may still have opened the PIX, so that error now says to look in `list_credits` before
  retrying instead of inviting a second charge.
- **`list_credits` returns the statement for either generation.** It reads the legacy credits
  and the credit ledger, and answers `{ credits, total, ledger: { entries, nextBefore } }`. One
  side is empty depending on the account, which is the true answer and not an error — before
  this, a migrated seller got an empty list with no indication the data lived elsewhere. If one
  side fails, the other still answers and `creditsError` / `ledgerError` says what failed.
- **`upload_deliverable` / `delete_deliverable` now call routes that exist.** The paths they
  used (`/api/products/{id}/deliverable/…`) are not part of the API. Attaching a file is now
  two steps: `upload_deliverable` mints an upload URL, you PUT the bytes to it (only
  `Content-Type`, no `Authorization`), then **`attach_deliverable`** confirms the upload and
  links it to the product, keeping any link the product already has. `delete_deliverable`
  unlinks the file and, given `filePath`, deletes the bytes too; it refuses when the file is
  the only deliverable, and a failed byte deletion comes back as `fileDeleteError` beside the
  completed unlink.
- **`telegram_media_upload` calls `/presign`.** The old path was renamed. It returns
  `{ uploadUrl, filePath, proxyUrl }`; `proxyUrl` is the URL to store in the flow node, because
  the route does not return a public URL. The previously advertised `publicUrl` was always
  undefined.
- **`reorder_upsells` calls `.../upsells/reorder`.** It used to send whole objects to a route
  that replaces the legacy upsell array instead of reordering, and that route does not exist
  for a product on the new storage, where the call failed as an opaque 502.
- **`update_product` writes the way each storage expects.** It used to re-send the whole
  stored product. That is still what the old storage needs — its write puts a default into
  every key the body omits (`url: ''`, `deliverableFile: null`, `membersAreaEnabled: false`…),
  so a partial body would wipe the product with a 200 — and its read carries the file and the
  stock lines, so it still goes back whole (minus the live `stockQuantity`). On the new storage
  the read carries neither, so the re-send dropped them and the save was refused; there the
  call now sends the edit plus the one field that satisfies the API's deliverable check (the
  check reads the request body, not the stored product). When the only deliverable is a file or
  stock lines — neither readable there — the edit is refused here with an explanation instead
  of a bare 400. `attach_deliverable` and `delete_deliverable` go through the same write.
- **`create_webhook` / `update_webhook` validate `events`.** The API stores event names without
  checking them and dispatch matches exactly, so a wrong name is accepted and never fires. The
  names this tool used to suggest (`payment.created`, `payment.paid`, `payment.refunded`) are
  not seller webhook events at all. The real vocabulary is now enforced here, and `test_webhook`
  simulates only the payment-shaped events.
- **`insert_token` accepts only the four types the API takes**, in `type` and in `target`,
  which the route checks against the same list. `stripe` and `efibank` were advertised and
  always refused.
- **`list_payments` answers an empty list for a seller with no sales.** The route reports that
  state as 404, which surfaced as an error.
- **`get_payments_paginated`**: the cursor in the answer is `nextCursor`; `totalCapped: true`
  means the count stopped at its cap and `total` is a floor; a text search may come back with
  `coverageCapped`.
- **423 is not a thing, 503 is not "the backend is down".** 503 means the rate limiter is
  failing closed and nothing was changed, so it is reported as retryable. 502 means the service
  behind the API did not answer, and a write may or may not have landed, so it says to check
  before repeating one. The wait is read from `Retry-After` or the body's `retry_after`. A
  refusal that carries a `code` now shows it instead of just a status number.

### Tools that an API key cannot use

`create_whatsapp_session` answers 403 for an API key by design: the route classes it as
sensitive. It now says so and what to do instead, rather than surfacing a bare "Forbidden".

### Packaging

- Compiled tests and source maps no longer ship, and the build clears `dist/` first so no
  leftover output from an older build is packed (560 files and 1.0 MB unpacked down to 222
  files and 512 kB).
- `dotenv` is loaded quietly: version 17 announces itself on stdout, which is the MCP protocol
  channel over stdio, and a strict client reads that line as a malformed frame.

### Added

- **Installs stay on the latest version.** The README configuration now uses
  `npx -y ggcheckout-mcp@latest`; plain `npx -y ggcheckout-mcp` reuses the cached copy and can
  leave an installation on an old version. To stay on a version, pin it (`ggcheckout-mcp@0.4.0`)
  and update it by hand.
- **Update notice.** On startup the server checks the npm registry once, in the background (2 s
  limit, any failure is silent). While a newer version is published, tool responses (successes
  and errors) carry a short `update:` line so the assistant can tell the user to restart their
  client.
- **`User-Agent: ggcheckout-mcp/<version>`** on every request, so the API can tell which release
  is calling and refuse writes from versions it no longer supports, with a message asking to
  update. The header's format must not change; see "Versioning and the API" in the README.
  Minimum-version decision for this release: **0.4.0**. `update_checkout` in 0.3.x resent the
  whole document it read, and the API now refuses that write from versions below 0.4.0 with a
  message asking to update; writes that send only what changed are not affected.
- **Offers on the seller's page:** `set_offer_product_page` puts one product of an upsell or
  downsell on the seller's own page (or back on the GG page), mixed with GG pages in the same
  funnel; `get_offer_snippets` returns, read only, the HTML to paste for each product on the
  seller's page. `update_checkout` now merges the `checkout` object, so setting one key keeps the
  rest of the page setup.
- **Members-area files:** `upload_members_area_file` uploads an image, a lesson video or a file
  (PDF, document, audio) from the machine running the server and returns the URL to use. It reads
  only from the folder set in `GGCHECKOUT_UPLOAD_ROOT` and refuses every upload while that is unset.
  `create_pdf_lessons` creates a batch of PDF lessons; `list_lesson_attachments`,
  `add_lesson_attachment` and `delete_lesson_attachment` manage a lesson's complementary files.
- **Editing and deleting the course structure:** `update_module`, `update_section`, `update_lesson`,
  `delete_module`, `delete_section`, `delete_lesson` — until now only the dashboard could, through
  server actions an API key cannot call. **They need the API release with the `PATCH`/`DELETE`
  routes under `/api/members-area/{areaId}/modules/…`**; an older deployment answers 404/405.
- `create_module` and `create_section` take `dripSettings`; `create_section` and `create_lesson`
  take `showTitleOverlay`, `showImageOnly` and `order`, and `create_lesson` a `thumbnailUrl`.
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

- **`update_checkout` sends only the checkout's identity and what changed.** The checkout API
  keeps every key absent from the body as stored, so the tool no longer echoes the whole
  document it read back (`paymentMethods`, the `checkout` object, `orderBumps`, `url`,
  `fields`, `sellerName`, `currency`, `published`, `createBy`). Echoing it could overwrite
  stored values the read does not carry (re-sent order bumps lost their per-bump original
  price and button text); `paymentMethods`, `checkout` and `orderBumps` only travel when the
  caller changes them.
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

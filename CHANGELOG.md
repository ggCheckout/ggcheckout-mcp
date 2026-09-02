# Changelog

This package is published to npm and the README installs it as `npx -y ggcheckout-mcp`,
which is unpinned — a new version reaches every existing installation on its next start.
Read this file before upgrading, and pin a version if a breaking change is not convenient
right now.

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

# Token Payments → Credits

This repository now uses a purchase-intent based flow to credit user balances after verified SPL token payment.

## Flow

1. **Create purchase intent**
   - `POST /api/purchase-intents` with `{ "packageCode": "small|medium|large" }`.
   - Server stores immutable expectation fields: `expectedAmount`, `mint`, `treasury`, `expiresAt`.
2. **User sends SPL transfer**
   - Client sends exact `expectedAmount` of `mint` to treasury associated token account.
   - Client includes `intentId` in memo/reference.
3. **Verify and credit**
   - `POST /api/purchase-intents/:id/verify` with `{ "txSig": "..." }`.
   - Server verifies transaction on-chain and then confirms in one DB transaction.

## Invariants (enforced)

- Credits are issued only if on-chain transfer matches:
  - mint equals intent mint
  - destination equals treasury ATA
  - amount exactly equals expected amount
  - memo/reference includes intent id
- Replay prevention:
  - each `PurchaseIntent` can be confirmed once
  - each `txSig` can be attached once (`UNIQUE` on `PurchaseIntent.txSig`)
  - each intent can issue one ledger entry (`UNIQUE` on `CreditLedger.intentId`)
- Confirmation writes are atomic:
  - row lock `SELECT ... FOR UPDATE` on the intent
  - intent update + ledger append + balance increment in one DB transaction

## Operational notes

- Configure these env vars:
  - `SOLANA_RPC_URL`
  - `SOLANA_CLUSTER` (optional metadata)
  - `CONFIRMATION_LEVEL` (`confirmed` default)
  - `TREASURY_WALLET`
  - `TOKEN_MINT`
- Seed default packages with:
  - `npm run db:seed`
- Expired intents are marked `EXPIRED` when verify is attempted after expiration.


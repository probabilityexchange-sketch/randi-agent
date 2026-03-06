# Crypto Wallet Guidance

This repo contains wallet-auth and Solana payment-related code paths. Capability may vary by deployment config.

## Default wallet rules

- never assume the correct wallet or account without checking
- do not sign or submit transactions without explicit approval
- explain what a transaction will do before requesting approval
- distinguish viewing balances from moving funds

## Safe default pattern

1. inspect relevant wallet state
2. summarize intended action
3. request approval for signing or sending
4. record outcome and identifiers

## Scope boundary

- spend-related rules: [../policies/spending-limits.md](../policies/spending-limits.md)
- trade-related rules: [../policies/trading-guardrails.md](../policies/trading-guardrails.md)

This is policy guidance, not a complete enforcement layer.

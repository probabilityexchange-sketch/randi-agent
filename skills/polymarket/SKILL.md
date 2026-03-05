# Polymarket CLI Skill

Expertise in interacting with **Polymarket**, the world's largest prediction market, using the `polymarket-cli`. This skill allows the agent to research markets, monitor prices, and execute trades on the Polygon network.

## Core Capabilities

- **Market Research**: Search for specific markets, list active events, and retrieve detailed market metadata (outcomes, end dates, volume).
- **Price Analysis**: Access the Order Book (CLOB) for any market. Get real-time buy/sell prices, midpoints, spreads, and price history.
- **Trading Operations**: Place limit orders, execute market orders, and manage active positions.
- **Portfolio Tracking**: Monitor collateral balances (USDC), conditional token balances, and historical trade data.
- **On-Chain Interaction**: Manage wallet configuration, handle contract approvals, and bridge assets.

---

## 🛠 Usage Guide

### 1. Market Discovery

Use these commands to find what to bet on.

```bash
# Search for markets related to a topic
polymarket markets search "bitcoin" --limit 5

# List top 10 high-volume active markets
polymarket markets list --active true --order volume_num --limit 10

# Get details for a specific market by slug
polymarket markets get "will-trump-win-the-2024-presidential-election"
```

### 2. Price & Order Book (CLOB)

Non-authenticated commands for real-time data.

```bash
# Get the current midpoint price for a token
polymarket clob midpoint <TOKEN_ID>

# View the full order book (top bids/asks)
polymarket clob book <TOKEN_ID>

# Get price history (1 day interval)
polymarket clob price-history <TOKEN_ID> --interval 1d
```

### 3. Executing Trades

Requires a configured wallet and USDC balance.

```bash
# Place a Market Buy order ($10 USDC)
polymarket clob market-order --token <TOKEN_ID> --side buy --amount 10

# Place a Limit Buy order (20 shares at $0.45)
polymarket clob create-order --token <TOKEN_ID> --side buy --price 0.45 --size 20

# Cancel all open orders
polymarket clob cancel-all

# Check USDC collateral balance
polymarket clob balance --asset-type collateral
```

### 4. Portfolio & On-Chain

```bash
# List all active positions for a wallet
polymarket data positions <WALLET_ADDRESS>

# Check total portfolio value
polymarket data value <WALLET_ADDRESS>

# View trade history
polymarket clob trades
```

---

## 💡 Expert Tips

1.  **JSON Output**: Always use the `-o json` flag when scripting or processing data for precise extraction.
    *   Example: `polymarket -o json clob midpoint <TOKEN_ID> | jq '.mid'`
2.  **Market Identifiers**: Markets can be identified by **Slug**, **Condition ID**, or **Token ID**. Use `polymarket markets get <SLUG>` to find the specific Token IDs for "Yes" and "No" outcomes.
3.  **Order Types**: The default is `GTC` (Good 'Til Cancelled). You can also use `FOK` (Fill or Kill) or `GTD` (Good 'Til Date).
4.  **Batch Actions**: You can query multiple tokens at once by comma-separating IDs: `polymarket clob batch-prices "TOKEN1,TOKEN2"`.

---

## Related Skills

- **hummingbot** — Use for advanced market making strategies on Polymarket.
- **clawnch** — For cross-chain token launches and discovery.
- **find-arbitrage-opps** — Search for price discrepancies between Polymarket and other platforms.

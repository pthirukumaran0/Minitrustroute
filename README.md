# 🛡️ TrustRoute: AI-Powered Secure Cross-Border Payment Router

TrustRoute is an intelligent payment routing and risk mitigation engine designed for secure cross-border financial transactions. It evaluates transactional and telecom risk signals (such as 24-hour SIM swap detection, phone number validation, and device fingerprinting) and dynamically discovers optimal payment routes through a multi-provider clearing network.

---

## 🏗️ Architecture Overview

TrustRoute utilizes a dual-database architecture:
1. **MongoDB (Document Ledger)**: Acts as the primary immutable ledger storing individual transaction lifecycle records, risk evaluations, telecom signals, contributing risk factors, recommended actions, timestamps, and chosen route details.
2. **Neo4j (Property Graph Engine)**: Models the global cross-border interbank payment network, containing payment gateways, correspondent settlement banks, and regional clearing houses connected by directed `CONNECTS_TO` relationships.

```
                           +----------------------------+
                           |  Next.js 16 App Router API |
                           +--------------+-------------+
                                          |
                +-------------------------+-------------------------+
                |                                                   |
                v                                                   v
      +-------------------+                               +--------------------+
      |  MongoDB Ledger   |                               |  Neo4j Graph DBMS  |
      | (Transactions,    |                               | (PaymentProviders  |
      |  Risk Audit Logs, |                               |  & CONNECTS_TO     |
      |  Selected Routes) |                               |  Topology)         |
      +-------------------+                               +--------------------+
```

---

## 📋 Environment Configuration

Copy `.env.example` to `.env.local` and customize credentials for your local environment:

```bash
cp .env.example .env.local
```

### Environment Variables

| Variable | Description | Default Example |
| :--- | :--- | :--- |
| `MONGODB_URI` | Connection URI for the MongoDB server | `mongodb://127.0.0.1:27017/trustroute` |
| `NEO4J_URI` | Bolt connection protocol and host for Neo4j | `bolt://127.0.0.1:7687` |
| `NEO4J_USERNAME` | Username for Neo4j authentication | `neo4j` |
| `NEO4J_PASSWORD` | Password configured in Neo4j Desktop / Server | *(Keep secret in `.env.local`)* |
| `NEO4J_DATABASE` | Target database name in Neo4j DBMS | `neo4j` |

> 🔒 **Security Notice**: `.env.local` is excluded by `.gitignore` and is never committed to Git. Only `.env.example` with harmless placeholder values is tracked in version control.

---

## 📊 Database Schemas

### 1. MongoDB Transaction Model (`src/models/Transaction.ts`)

Each cross-border payment attempt is recorded with the following schema:

| Field | Type | Validation / Constraints | Description |
| :--- | :--- | :--- | :--- |
| `transactionId` | `String` | Required, unique, trimmed, indexed | Unique identifier for payment (e.g., `TXN-173000...` or `DEMO-TXN-SAFE-001`) |
| `amount` | `Number` | Required, strictly positive (`> 0.01`) | Transfer amount in specified currency |
| `currency` | `String` | Required, 3 uppercase characters | Currency code (e.g., `USD`, `EUR`, `INR`) |
| `sourceCountry` | `String` | Required, trimmed | ISO code or name of origin country |
| `destinationCountry` | `String` | Required, trimmed | ISO code or name of recipient country |
| `riskScore` | `Number` | Required, bounded between `0` and `100` | Calculated fraud risk metric |
| `riskDecision` | `String` | Enum: `['APPROVED', 'STEP_UP', 'BLOCKED']` | Final automated verdict determined by the server |
| `signals.simSwap24h` | `Boolean` | Required | `true` if mobile number had a SIM swap within 24h |
| `signals.numberVerified` | `Boolean` | Required | `true` if mobile identity is verified with carrier |
| `signals.deviceStatus` | `String` | Required | Device fingerprint integrity (`TRUSTED`, `SUSPICIOUS`, `UNKNOWN`) |
| `contributingFactors` | `Array<String>` | Default `[]` | List of transparent rule explanations detailing score components |
| `recommendedAction` | `String` | Default `''` | Prescriptive action (`PROCEED_WITH_INTELLIGENT_ROUTING`, `REQUIRE_OUT_OF_BAND_MFA_AUTHENTICATION`, `BLOCK_IMMEDIATE_AND_ALERT_FRAUD_OPS`) |
| `selectedRoute` | `Object \| null` | Nullable | Selected routing path details (`routeId`, `routeName`, `hops`, `estimatedCost`, `estimatedLatencyMs`, `explanation`), or `null` if blocked/pending |
| `status` | `String` | Required, indexed | Status lifecycle (`APPROVED`, `STEP_UP_REQUIRED`, `BLOCKED`, `PENDING`, `ROUTING_FAILED`) |
| `createdAt` / `updatedAt` | `Date` | Automated timestamps | Indexed with `{ createdAt: -1 }` for high-performance reverse-chronological queries |

---

### 2. Neo4j Payment Network Graph Structure (`src/lib/routingEngine.ts`)

The payment network is modeled as a directed property graph:

- **Node Label**: `(:PaymentProvider)`
  - Properties: `id` (Unique ID), `name`, `type` (`GATEWAY`, `BANK`, `CLEARING`, `CORRIDOR`, `DESTINATION_BANK`), `country`, `currency`, `status` (`ACTIVE`/`INACTIVE`), `isAvailable` (`true`/`false`)
- **Relationship**: `[:CONNECTS_TO]`
  - Properties:
    - `baseCost`: Transaction processing fee in USD
    - `latencyMs`: Expected hop propagation latency in milliseconds
    - `reliability`: Historical uptime/success probability ratio (e.g. `0.999`)
    - `status`: Edge operational status (`ACTIVE`/`INACTIVE`)
    - `isAvailable`: Availability flag (`true`/`false`)
    - `prohibited`: Regulatory or security embargo flag (`true`/`false`)

---

## ⚡ Deterministic Rule-Based Risk Engine (`src/lib/riskEngine.ts`)

To prevent client-side tampering, any client-supplied `riskScore`, `riskDecision`, or `status` is intentionally ignored by the backend. Risk is calculated deterministically on the server:

1. **Baseline Score**: Starts at `+10`
2. **SIM Swap Flag (MANDATORY RULE)**:
   - A SIM swap detected within the previous 24h ALWAYS results in **`BLOCKED`**, regardless of amount or client input (+70 points).
3. **Carrier Number Verification**: Unverified phone number adds `+25` points.
4. **Device Integrity**: `SUSPICIOUS` (emulator/rooted) adds `+30` points; `UNKNOWN` adds `+15` points; `TRUSTED` adds `+0` points.
5. **Amount Thresholds**:
   - `> $50,000`: `+30` points
   - `> $10,000`: `+15` points
   - `> $5,000`: `+5` points
6. **Cross-Border Corridor**: `+5` points if `sourceCountry != destinationCountry`.

### Decision Thresholds:
- **`BLOCKED`**: `simSwap24h == true` OR `riskScore >= 70`. Payment route is strictly `null` (`BLOCK_IMMEDIATE_AND_ALERT_FRAUD_OPS`).
- **`STEP_UP`**: `35 <= riskScore < 70`. Transaction is placed in `STEP_UP_REQUIRED` state and held for out-of-band verification. No route is executed.
- **`APPROVED`**: `riskScore < 35`. Transaction is cleared to proceed with intelligent routing.

---

## 🧭 Intelligent Routing Engine (`src/lib/routingEngine.ts`)

TrustRoute uses **Multi-Objective Dijkstra's Shortest Path Algorithm** and **Yen's K-Shortest Loopless Paths Algorithm (1971)** to discover optimal routes across active payment providers in Neo4j.

### Edge Cost Function
For every directed edge $e = (u, v)$:
$$W(e) = (w_{\text{cost}} \cdot \text{baseCost}) + \left(w_{\text{latency}} \cdot \frac{\text{latencyMs}}{100}\right) + \left(w_{\text{reliability}} \cdot (1 - \text{reliability}) \cdot 100\right)$$
- Default weights: $w_{\text{cost}} = 1.0$, $w_{\text{latency}} = 0.5$, $w_{\text{reliability}} = 5.0$.
- Because all weights are strictly positive, the graph is free of negative cycles.

### Key Capabilities:
- **Exclusion of Unavailable & Prohibited Edges**: Automatically filters out any edge or node where `isAvailable = false`, `status != 'ACTIVE'`, or `prohibited = true`.
- **Missing Provider Handling**: Returns an explicit `MISSING_PROVIDER` error if an origin or destination country lacks an active provider node.
- **Unreachable Destination Handling**: Returns `UNREACHABLE_DESTINATION` if destination cannot be reached over active edges without inventing a nonexistent route.
- **Yen's K-Shortest Paths**: Computes top $K$ alternative corridors for fallback liquidity routing.

---

## 🚀 Running the Project

### 1. Seed Sample Network & Demo Transactions
The demo seeder is **non-destructive** and **repeatable** (idempotent upserts via `findOneAndUpdate` in MongoDB and `MERGE` in Neo4j):
```bash
npm run seed:demo
```

### 2. Start Next.js Development Server
```bash
npm run dev
```

---

## 🧪 Automated Test Suites

### Run Phase 1 Tests (8 tests)
```bash
npm run test:phase1
```

### Run Phase 2 Tests (15 tests)
```bash
npm run test:phase2
```

The test runner categorizes tests into:
1. **Unit Tests**: Pure deterministic risk rules and algorithm mathematics.
2. **Neo4j Live Tests**: Real connectivity to local Neo4j graph checking multi-hop routing, edge exclusion, missing providers, and unreachable destinations.
3. **API & MongoDB Persistence Tests**: Real HTTP calls to Next.js API verifying Zod validation, duplicate prevention, and database disk persistence.

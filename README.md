# TrustRoute: AI-Powered Secure Cross-Border Payment Router

**Final-Year Mini-Project (Engineering)**  
TrustRoute is a decoupled full-stack fintech platform designed to solve cross-border remittance challenges: multi-day settlement latency, high intermediary correspondent banking fees, and account takeover (ATO) fraud driven by unauthorized SIM swaps.

---

## 🏗️ Architecture Overview

The project is architecturally and physically separated into two independent applications:

```
TrustRoute/
├── backend/                   # Standalone Node.js + Express + TypeScript REST API (Port 5000)
│   ├── src/
│   │   ├── controllers/       # Health, Transactions, Network, Analytics
│   │   ├── routes/            # Express route handlers
│   │   ├── middleware/        # Centralized error handler, auth guards
│   │   ├── lib/               # Risk engine, routing engine (Dijkstra + Yen K-SP), DB clients
│   │   ├── models/            # Mongoose Transaction model and indexes
│   │   ├── app.ts             # Express app setup with CORS & JSON parser
│   │   └── server.ts          # Server entry point with DB connect & graceful shutdown
│   ├── scripts/               # Seed demo and Phase 1 / Phase 2 automated test suites
│   ├── package.json           # Backend dependencies and scripts
│   ├── tsconfig.json          # TypeScript build configuration
│   ├── .env                   # Server credentials (git-ignored)
│   └── .env.example           # Environment template
│
├── frontend/                  # Next.js 16 App Router + Tailwind CSS (Port 3000)
│   ├── app/                   # All 15 decoupled UI modules
│   │   ├── page.tsx           # Module 1: Overview Dashboard
│   │   ├── payment/           # Module 2: Payment Initiation Simulator
│   │   ├── transactions/      # Module 3: Transaction Monitor & Module 4: Details
│   │   ├── risk/              # Module 5: Fraud Analysis & Risk Monitoring
│   │   ├── step-up/           # Module 6: Step-Up Verification Queue
│   │   ├── routing/           # Module 7: Payment Routing Explorer
│   │   ├── route-comparison/  # Module 8: Route Comparison (Yen's KSP)
│   │   ├── network/           # Module 9: Provider Network Directory
│   │   ├── admin/             # Module 10: Provider & Rail Administration
│   │   ├── audit/             # Module 11: Audit Trail & Decision Ledger
│   │   ├── reports/           # Module 12: Reports & Performance Analytics
│   │   ├── health/            # Module 13: System Health & Infrastructure Diagnostics
│   │   ├── settings/          # Module 14: System Settings & Engine Parameters
│   │   └── help/              # Module 15: Help & Architecture Handbook
│   ├── src/
│   │   ├── components/        # Layout (Sidebar, Header, AppShell), UI, Routing Graph Visualizer
│   │   ├── types/             # Client-safe TypeScript models & API types
│   │   └── lib/               # Centralized API client (NEXT_PUBLIC_API_BASE_URL)
│   ├── package.json           # Frontend dependencies (Zero database drivers)
│   ├── next.config.ts         # Next.js configuration with Turbopack & proxy rewrites
│   ├── .env.local             # Frontend environment (git-ignored)
│   └── .env.example           # Frontend environment template
│
├── README.md                  # Project documentation and review handbook
├── package.json               # Root workspace script coordinator
└── .gitignore                 # Root and subproject exclusion rules
```

---

## ⚡ Quick Start: Running Independently

TrustRoute requires **MongoDB** (port 27017) and **Neo4j** (port 7687) running locally.

### Terminal 1 — Backend REST API (Port 5000)

```powershell
cd D:\Miniproject\backend
npm install
npm run build
npm run seed:demo    # Idempotent demo database seeder
npm run dev          # Or 'npm start' to run compiled server
```

The backend server listens on `http://localhost:5000` with CORS configured for `http://localhost:3000`.

### Terminal 2 — Frontend Application (Port 3000)

```powershell
cd D:\Miniproject\frontend
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## 🧪 Automated Test Suites

Both test suites run directly against the standalone backend API and database engines:

```powershell
cd D:\Miniproject\backend

# Phase 1 Test Suite (8/8 Tests: DB connectivity, health, schema validation, idempotency)
npm run test:phase1

# Phase 2 Test Suite (15/15 Tests: Risk rules, SIM swap blocking, Dijkstra & Yen's routing)
npm run test:phase2
```

---

## 🌐 Backend REST API Endpoints

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/health` | `GET` | Real-time ping probes for MongoDB & Neo4j connectivity and latency. |
| `/api/transactions` | `GET` | Fetches transactions with pagination, filtering, search, and sorting. |
| `/api/transactions` | `POST` | Validates input with Zod, runs deterministic risk engine, routes via Neo4j, persists to MongoDB. |
| `/api/transactions/:id` | `GET` | Fetches a single transaction record by `transactionId` or MongoDB ObjectId. |
| `/api/network` | `GET` | Retrieves all 9 provider nodes and directed interbank rails from Neo4j. |
| `/api/network/route-preview` | `POST` | Simulates Multi-Objective Dijkstra and Yen's K alternatives without database writes. |
| `/api/network/connections` | `PATCH` | Admin endpoint to toggle edge availability or set prohibitions (`x-admin-key: TRUSTROUTE-ADMIN-2026`). |
| `/api/analytics` | `GET` | Aggregates volume by currency, risk distributions, and corridor conversion metrics. |

---

## 🛡️ Core Algorithmic Guarantees

1. **Deterministic Risk Scoring:**
   $$\text{RiskScore} = \text{SIMSwap24h}(+100) + \text{UnverifiedPhone}(+25) + \text{SuspiciousDevice}(+35) + \text{HighValue}(+15)$$
   - $\le 30$: `APPROVED` (Dispatches interbank route)
   - $31 - 70$: `STEP_UP` (Quarantined in escrow; zero routes assigned)
   - $\ge 71$: `BLOCKED` (Immediately rejected; zero routes assigned)
   - **Hard Circuit Breaker:** Any SIM swap detected within 24 hours unconditionally results in `BLOCKED` with no payment route.

2. **Multi-Objective Dijkstra Routing:**
   $$W(e) = \alpha \cdot \frac{\text{BaseCost}(e)}{\text{MaxCost}} + \beta \cdot \frac{\text{LatencyMs}(e)}{\text{MaxLatency}}$$
   Subject to: $\text{Reliability}(e) \ge 0.95$, $\text{isAvailable} = \text{true}$, and $\text{prohibited} = \text{false}$.

3. **Yen's K-Shortest Loopless Paths Algorithm:**
   Computes optimal route $A[0]$ and alternative fallback paths $A[1], A[2]$ by iteratively searching spur deviations while masking previous prefix edges to guarantee cycle-free routes.

# Buzz — Complete System Analysis

> **Generated:** 2026-07-30  
> **Project:** Block, Inc. — Open Source  
> **Repository:** https://github.com/block/buzz  
> **License:** Apache-2.0

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Tech Stack](#2-tech-stack)
3. [Architecture Overview](#3-architecture-overview)
4. [Infrastructure & Docker Services](#4-infrastructure--docker-services)
5. [Database Schema](#5-database-schema)
6. [API & Protocol](#6-api--protocol)
7. [Event Kind Registry](#7-event-kind-registry)
8. [Feature Deep-Dive](#8-feature-deep-dive)
9. [AI Agent Ecosystem](#9-ai-agent-ecosystem)
10. [Configuration Guide](#10-configuration-guide)
11. [Runbook](#11-runbook)
12. [Known Limitations & Risks](#12-known-limitations--risks)
13. [Security Model](#13-security-model)
14. [Codebase Structure](#14-codebase-structure)

---

## 1. Executive Summary

Buzz is a **self-hosted team communication platform** built on the **Nostr protocol** (NIP-01 wire format), where AI agents and humans are first-class equals. Every action — a chat message, reaction, workflow step, canvas update, or huddle event — is a cryptographically signed Nostr event identified by a `kind` integer.

The **relay** is the single source of truth. All reads and writes flow through a central Rust (Axum) WebSocket server. There is no peer-to-peer event exchange, no gossip, no replication — clients connect to one relay over WebSocket, and the relay enforces auth, verifies Schnorr signatures, persists events to Postgres, fans out to subscribers, indexes for search, and triggers automation.

**Key facts:**
- 26 Rust crates in workspace
- Desktop app: Tauri 2 + React 19 + TypeScript + Tailwind CSS
- Mobile app: Flutter 3.x + Dart + Riverpod + Hooks
- Web UI: Vite + React 19 (TypeScript)
- ~81 registered Nostr event kinds
- Multi-tenant (community-scoped) Postgres schema
- AI agent harness via ACP (Agent Communication Protocol)
- YAML-as-code workflow engine with cron scheduling
- Git smart HTTP hosting (NIP-34)
- Real-time huddle audio (WebSocket Opus relay)
- iOS/Android push notifications via NIP-PL gateway
- Hash-chain audit log
- Blossom-compatible S3 media storage

---

## 2. Tech Stack

### Core Backend

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| Runtime | Rust (Tokio) | 1.95.0 (toolchain), edition 2021 | Async runtime for all backend services |
| Web Framework | Axum | 0.8 | HTTP + WebSocket server |
| Database ORM | SQLx | 0.9 | Async Postgres access (runtime queries, no compile-time macros) |
| Database | PostgreSQL | 17 (Alpine) | Primary event store, FTS, workflow state |
| Cache/PubSub | Redis | 7 (Alpine) | Pub/sub fan-out, presence, typing indicators |
| Search | Postgres FTS (GIN) | N/A | Full-text search via `tsvector` generated column |
| Message Protocol | Nostr NIP-01 | NIP-44, NIP-98 | Cryptographically signed event wire format |
| Serialization | Serde | 1 | JSON, YAML, Postcard (for mesh transport) |
| Observability | Tracing + OpenTelemetry | 0.1 / 0.32 | Structured logging, OTLP export |
| Metrics | Metrics + Prometheus | 0.24 / 0.18 | Prometheus metrics export |

### Key Rust Dependencies (Workspace)

| Crate | Version | Purpose |
|-------|---------|---------|
| tokio | 1 (multi-thread) | Async runtime |
| axum | 0.8 | HTTP + WebSocket server framework |
| tower/tower-http | 0.5/0.6 | Middleware stack (timeout, CORS, compression, rate limiting) |
| sqlx | 0.9 | Postgres async driver |
| redis | 1.0 | Redis async client |
| nostr | 0.44 | Nostr protocol types + crypto (NIP-44, NIP-98) |
| iroh | 1.0.0-rc.0 | Inter-relay mesh transport (TLS + QUIC) |
| reqwest | 0.13 | HTTP client (webhook delivery, SSRF-protected) |
| dashmap | 6 | Concurrent subscription index |
| moka | 0.12 | In-memory cache (local-echo dedup) |
| rmcp | 1.1.0 | MCP (Model Context Protocol) SDK |
| evalexpr | 11 | Workflow condition evaluation |
| iroh | 1.0.0-rc.0 | Mesh transport |

### Desktop App (Tauri 2 + React 19)

| Component | Technology | Version |
|-----------|-----------|---------|
| Framework | Tauri | ~2.11 |
| UI Library | React | 19.1.0 |
| Language | TypeScript | ~6.0.0 |
| Bundler | Vite | ~8.0.0 |
| Styling | Tailwind CSS | 4.3.0 |
| Routing | TanStack Router | 1.168.10 |
| State/Data | TanStack React Query | 5.90.21 |
| UI Components | Radix UI | Various (1.x) |
| Rich Text | TipTap | 3.22.3 |
| Markdown | react-markdown + rehype/remark | 10.1.0 |
| Emoji | Emoji Mart | 5.6.0 |
| Icons | Lucide React | 1.0.0 |
| Carousel | Embla Carousel | 8.6.0 |
| QR Code | react-qr | 4.2.0 |
| Virtual List | Virtua | 0.49.3 |
| Animations | Motion | 12.38.0 |
| Syntax Highlight | Shiki | 4.0.2 |
| Validation | Zod | 4.4.3 |

### Web UI (Browser)

| Component | Technology | Version |
|-----------|-----------|---------|
| UI Library | React | 19.1.0 |
| Bundler | Vite | ~8.0.0 |
| Styling | Tailwind CSS | 4.3.0 |
| Routing | TanStack Router | 1.168.10 |
| Git in Browser | isomorphic-git | 1.38.3 |
| Nostr | nostr-tools | 2.23.3 |

### Mobile App (Flutter)

| Component | Technology | Version |
|-----------|-----------|---------|
| Framework | Flutter | ^3.11.4 (Dart SDK) |
| State Management | Riverpod (hooks_riverpod) | ^3.0.3 |
| Hooks | flutter_hooks | ^0.21.3 |
| WebSocket | web_socket_channel | ^3.0.1 |
| Nostr | nostr (Dart) | ^2.0.0 |
| Secure Storage | flutter_secure_storage | ^10.0.0 |
| Camera/Scanner | mobile_scanner | ^7.0.0 |
| HTTP | http | ^1.4.0 |
| Icons | lucide_icons_flutter | ^3.1.0 |

### CI/CD & Tooling

| Tool | Version | Purpose |
|------|---------|---------|
| Rust toolchain | 1.95.0 | Rust compiler |
| Node.js | 24 (Docker) | JS runtime for builds |
| pnpm | Latest (corepack) | Package manager |
| Just | From cargo-binstall | Task runner |
| Biome | Config in biome.json | Linting + formatting |
| Docker Compose | V2 | Local dev infrastructure |
| Hermit | Self-downloading | Toolchain version manager |
| Lefthook | From bin/ | Git hooks (pre-commit, pre-push) |
| Playwright | ^1.58.2 | E2E testing (desktop + web) |
| cargo-chef | 0.1.71 | Docker layer caching for Rust builds |

---

## 3. Architecture Overview

### System Architecture

```
                               CLIENTS
                                 |
             ┌───────────────────┼───────────────────┐
             ▼                   ▼                   ▼
      Desktop (Tauri)      Web (React)        Mobile (Flutter)
             |                   |                   |
             └───────────────────┼───────────────────┘
                                 |
                     WebSocket (NIP-01)
                                 |
                                 ▼
                    ┌─────────────────────────┐
                    │     buzz-relay (Axum)     │
                    │                          │
                    │  ┌──────┐ ┌──────┐      │
                    │  │ AUTH │ │EVENT │      │
                    │  │NIP-42│ │ PIPELINE     │
                    │  │NIP-98│ │      │      │
                    │  └──────┘ └──────┘      │
                    │  ┌────────────────────┐ │
                    │  │SubscriptionRegistry│ │
                    │  │ DashMap fan-out    │ │
                    │  └────────────────────┘ │
                    │                          │
                    │  HTTP Bridge:            │
                    │  /events /query /count   │
                    │  /media/* /git/*         │
                    │  /hooks/{id} /info       │
                    └─────────┬─────────┬──────┘
                              │         │
                    ┌─────────▼──┐ ┌────▼──────────┐
                    │  Postgres  │ │    Redis      │
                    │  (events,  │ │ (presence,    │
                    │  channels, │ │  typing,      │
                    │  users,    │ │  pub/sub)     │
                    │  workflows,│ └───────────────┘
                    │  search,   │
                    │  audit)    │
                    └────────────┘
                              │
                    ┌─────────▼───────────────┐
                    │   S3 (MinIO) Media       │
                    │   + Git/CAS Storage      │
                    └─────────────────────────┘

                    ┌─────────────────────────┐
                    │   AI Agent Subsystem     │
                    │                          │
                    │  buzz-acp (Agent Harness)│
                    │      │                   │
                    │  ACP/JSON-RPC over stdio │
                    │      │                   │
                    │  Agent Subprocesses      │
                    │  (goose/codex/claude)    │
                    └─────────────────────────┘
```

### Crate Dependency Hierarchy

```
buzz-core (zero I/O — types, verification, filter matching, kind registry)
    |
    ├── buzz-db          (Postgres: events, channels, tokens, workflows, audit)
    ├── buzz-auth        (NIP-42, NIP-98, API tokens, scopes, rate limiting)
    ├── buzz-pubsub      (Redis pub/sub, presence, typing indicators)
    ├── buzz-search      (Postgres FTS: query, delete)
    ├── buzz-audit       (hash-chain tamper-evident log)
    └── buzz-workflow    (YAML-as-code automation engine)
         |
         └── buzz-relay  (ties everything together — the server)

buzz-acp            (agent harness — bridges relay @mentions to AI agents)
buzz-sdk            (typed Nostr event builders)
buzz-media          (Blossom/S3 media storage)
buzz-cli            (agent-first CLI)
buzz-admin          (operator CLI: relay membership + key generation)
buzz-conformance    (multi-tenant conformance checker + property tests)
buzz-relay-mesh     (iroh-based inter-relay mesh transport)
buzz-pair-relay     (ephemeral sidecar for NIP-AB device pairing)
sprig               (all-in-one harness: ACP + agent + dev MCP)
buzz-dev-mcp        (developer MCP server — shell + file-edit tools)
buzz-persona        (agent persona packs)
buzz-push-gateway   (iOS/Android push notification gateway)
buzz-ws-client      (shared NIP-42 WebSocket client)
buzz-test-client    (integration test client)
git-sign-nostr      (sign git objects with Nostr key)
git-credential-nostr (git credential helper for Nostr-authed push/fetch)
```

### Connection Lifecycle

Every WebSocket connection follows this exact sequence:

1. **Community Binding** — `TenantContext` resolved from the request host before any handler can observe tenant data
2. **Semaphore Acquire** — `conn_semaphore.try_acquire_owned()` — connection capacity checked
3. **NIP-42 Challenge** — Relay sends `["AUTH", "<challenge>"]`
4. **Authentication** — Client responds with `["AUTH", <signed-event>]` or falls back to NIP-98 for HTTP
5. **Active Loops** — Three concurrent tasks: recv_loop, send_loop (mpsc channel), heartbeat_loop (30s ping)
6. **Cleanup** — CancellationToken signals all loops, subscriptions removed, semaphore released

### Event Pipeline

When the relay receives `["EVENT", <event>]`:

```
1. AUTH CHECK        — AuthState.Authenticated? MessagesWrite scope?
2. PUBKEY MATCH      — event.pubkey == auth_context.pubkey?
3. KIND_AUTH REJECT   — kind == 22242 (AUTH events never stored)
4. EPHEMERAL ROUTE   — kind 20000-29999 -> ephemeral sub-pipeline
5. VERIFY            — spawn_blocking(verify_event) — Schnorr sig + ID hash
6. MEMBERSHIP        — channel_id in tags? -> check_channel_membership
7. DB INSERT         — db.insert_event (ON CONFLICT DO NOTHING)
8. REDIS PUBLISH     — pubsub.publish_event (if channel-scoped)
9. FAN-OUT           — sub_registry.fan_out -> conn_manager.send_to
10. SEARCH INDEX     — search_index_tx.send (bounded worker queue)
11. AUDIT LOG        — audit.log (spawned async, non-blocking)
12. WORKFLOW TRIGGER  — wf.on_event (spawned async)
```

### Subscription System (Three-Tier Fan-Out)

| Tier | Index | Key | Use Case |
|------|-------|-----|---------|
| 1 | `channel_kind_index` | `(channel_id, kind)` | Subs with explicit channel + kind filter — O(1) |
| 2 | `channel_wildcard_index` | `channel_id` | Subs with channel but no `kinds` constraint |
| 3 | `subs` (linear scan) | — | Global subs (no channel_id) |

Global subs are **excluded** from channel-scoped events (security boundary for private channels).

---

## 4. Infrastructure & Docker Services

### Local Development Stack (`docker-compose.yml`)

| Service | Image | Port(s) | Memory | Health Check | Purpose |
|---------|-------|---------|--------|-------------|---------|
| Postgres | postgres:17-alpine | 5432 | 512m | pg_isready | Primary event store |
| Redis | redis:7-alpine | 6379 | 128m | redis-cli ping | Pub/sub, presence, typing |
| Adminer | adminer:latest | 8082 | 64m | Depends on Postgres | DB web UI (dev only) |
| Keycloak | keycloak:26.0 | 8180 | 512m | HTTP health | OIDC identity (dev only) |
| MinIO | minio/minio:latest | 9000/9001 | 256m | HTTP health | S3-compatible storage (media) |
| MinIO Init | minio/mc:latest | — | — | Depends on MinIO | Create bucket, set policies |
| Prometheus | prom/prometheus:latest | 9090 | 128m | — | Metrics collection |

### Isolated Test Stack (`docker-compose.harness.yml`)

Separate Compose project (`buzz-harness`) for GUI read-model tests — never touches the default `buzz-*` dev stack:

| Service | Host Port | Internal Port |
|---------|-----------|---------------|
| Postgres | 5471 | 5432 |
| Redis | 6471 | 6379 |
| MinIO | 9471/9472 | 9000/9001 |

### Relay Container Image (`Dockerfile`)

Multi-stage Docker build with:

- **Stage 1:** cargo-chef base (Rust toolchain + optional proxy CA)
- **Stage 2:** Dependency graph planner
- **Stage 3:** Build dependencies then binary (buzz-relay, buzz-admin, buzz-pair-relay)
- **Stage 4:** Web bundle (pnpm + Vite for buzz-web + buzz-admin-web)
- **Stage 5:** Runtime (debian:bookworm-slim) — git, ca-certificates, curl, openssl

OCI annotations: `org.opencontainers.image.source` for GHCR link.

Built binaries:
- `/usr/local/bin/buzz-relay` — main relay server
- `/usr/local/bin/buzz-admin` — operator CLI
- `/usr/local/bin/buzz-pair-relay` — device pairing sidecar

Published as `ghcr.io/block/buzz:<tag>`.

### Redis Key Patterns

| Pattern | Type | TTL | Purpose |
|---------|------|-----|---------|
| `buzz:channel:{uuid}` | Pub/Sub | — | Event fan-out |
| `buzz:presence:{pubkey_hex}` | String | 90s | Online/away status (3x heartbeat interval) |
| `buzz:typing:{channel_uuid}` | Sorted Set | 60s | Active typers (5s activity window) |

### Multi-Community Mode

- Community resolved from request host before any handler runs
- `community_id` is NOT NULL on every tenant-scoped table
- PKs lead with `community_id` to prevent cross-community data leaks
- Redis keys prefixed `buzz:{community}:...` in shared Redis deployments

---

## 5. Database Schema

The schema lives in `schema/schema.sql` and is the authoritative multi-tenant source. It replaces the single-community schema; existing deployments migrate via the backfill migration (0002). Every tenant-scoped table carries `community_id NOT NULL` as its first PK column.

### Custom PostgreSQL Types

| Type | Values |
|------|--------|
| `channel_type` | `stream`, `forum`, `dm`, `workflow` |
| `channel_visibility` | `open`, `private` |
| `member_role` | `owner`, `admin`, `member`, `guest`, `bot` |
| `workflow_status` | `active`, `disabled`, `archived` |
| `run_status` | `pending`, `running`, `waiting_approval`, `completed`, `failed`, `cancelled` |
| `approval_status` | `pending`, `granted`, `denied`, `expired` |
| `delivery_method` | `webhook`, `websocket` |
| `subscription_status` | `active`, `paused`, `deleted` |
| `pause_reason` | `user`, `system`, `rate_limit` |
| `channel_add_policy` | `anyone`, `owner_only`, `nobody` |

### Table Reference

| # | Table | Purpose | PK | Partitioning |
|---|-------|---------|----|-------------|
| 1 | `communities` | Tenant registry (OPERATOR-GLOBAL) | `(id)` | — |
| 2 | `channels` | Channel records | `(community_id, id)` | — |
| 3 | `channel_members` | Membership with roles (soft-delete) | `(community_id, channel_id, pubkey)` | — |
| 4 | `users` | User profiles per community | `(community_id, pubkey)` | — |
| 5 | `events` | All stored Nostr events | `(community_id, created_at, id)` | Monthly RANGE on `created_at` |
| 6 | `event_mentions` | Pubkey mention fan-out | `(community_id, pubkey_hex, event_id)` | — |
| 7 | `thread_metadata` | Thread parent/child/reply tracking | `(community_id, event_created_at, event_id)` | — |
| 8 | `reactions` | Emoji reactions | `(community_id, event_created_at, event_id, pubkey, emoji)` | — |
| 9 | `subscriptions` | Webhook/WebSocket subscriptions | `(community_id, id)` | — |
| 10 | `delivery_log` | Subscription delivery audit | `(delivered_at, id)` | Monthly RANGE on `delivered_at` |
| 11 | `workflows` | Workflow definitions | `(community_id, id)` | — |
| 12 | `workflow_runs` | Execution records | `(community_id, id)` | — |
| 13 | `workflow_approvals` | Approval gates (SHA-256 hashed tokens) | `(community_id, token)` | — |
| 14 | `scheduled_workflow_fires` | Cron claim (at-most-once) | `(community_id, workflow_id, scheduled_for)` | — |
| 15 | `api_tokens` | API tokens (SHA-256 hashed) | `(community_id, id)` | — |
| 16 | `rate_limit_violations` | Abuse/health (OPERATOR-GLOBAL) | `(id)` | — |
| 17 | `pubkey_allowlist` | Relay membership allowlist | `(community_id, pubkey)` | — |
| 18 | `relay_members` | NIP-43 relay members | `(community_id, pubkey)` | — |
| 19 | `join_policy_acceptances` | Policy version acceptance records | `(community_id, pubkey, policy_version)` | — |
| 20 | `relay_invites` | Use-limited invite links | `(community_id, id)` | — |
| 21 | `archived_identities` | NIP-IA archived identities | `(community_id, pubkey)` | — |
| 22 | `audit_log` | Hash-chain audit log | `(community_id, seq)` | — |
| 23 | `moderation_reports` | NIP-56 reports queue | `(community_id, id)` | — |
| 24 | `community_bans` | Ban + timeout state | `(community_id, pubkey)` | — |
| 25 | `moderation_actions` | Moderation audit trail | `(community_id, id)` | — |
| 26 | `_operator_global_tables` | Lint allowlist registry | `(table_name)` | — |
| 27 | `push_leases` | NIP-PL push lease state | `(community_id, author, installation_id)` | — |
| 28 | `push_wake_outbox` | Durable push delivery queue | `(community_id, id)` | — |
| 29 | `push_match_queue` | Event-to-push matching | `(community_id, event_id)` | — |
| 30 | `push_gateway_challenges` | Public gateway one-time challenges | `(id)` | — |
| 31 | `push_gateway_installations` | Push gateway device registrations | `(id)` | — |
| 32 | `push_gateway_delegations` | Relay push delegations | `(id)` | — |
| 33 | `push_gateway_endpoint_quotas` | Endpoint rate limiting | `(token_fingerprint)` | — |
| 34 | `push_gateway_delivery_auth_replays` | Replay prevention for auth events | `(relay_pubkey, auth_event_id)` | — |
| 35 | `push_gateway_delivery_request_replays` | Replay prevention for requests | `(relay_pubkey, request_id)` | — |
| 36 | `replica_heartbeat` | Replication freshness token | `(id)` | — |

### Events Table Partitioning

Monthly range partitions on `events.created_at`:

```sql
CREATE TABLE events_p_past       FOR VALUES FROM (MINVALUE) TO ('2026-01-01');
CREATE TABLE events_p2026_01     FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE events_p2026_02     FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE events_p2026_03     FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE events_p2026_04     FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE events_p2026_05     FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE events_p2026_06     FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE events_p_future     FOR VALUES FROM ('2026-07-01') TO (MAXVALUE);
```

### Key Indexes

- GIN index on `events.search_tsv` for full-text search (`@@` operator)
- Events hot-path: `(community_id, channel_id, created_at DESC, id)`
- Events addressable: `(community_id, kind, pubkey, channel_id, deleted_at)`
- Events parameterized: `(community_id, kind, pubkey, d_tag, created_at DESC, id)` WHERE `d_tag` IS NOT NULL
- Thread parent lookup: `(community_id, parent_event_id)`
- Delivery log: `(community_id, subscription_id)`

### Database Triggers

1. **channels_community_id_immutable** — prevents re-tenanting channels
2. **events_enqueue_push_match** — AFTER INSERT on events, enqueues matching push jobs
3. **events_refresh_channel_ttl** — DEFERRED constraint trigger for TTL refresh on channel events
4. **events_created_at_floor** — Replica-fence floor guard (defers to commit time)

---

## 6. API & Protocol

### WebSocket Protocol (NIP-01)

Max frame size: 65,536 bytes. Max subscriptions per connection: 1024. Max historical results per filter: 500.

| Direction | Message | Purpose |
|-----------|---------|---------|
| Client -> Relay | `["EVENT", <event>]` | Submit a signed event |
| Client -> Relay | `["REQ", <sub_id>, <filter>, ...]` | Subscribe to events |
| Client -> Relay | `["CLOSE", <sub_id>]` | Cancel a subscription |
| Client -> Relay | `["AUTH", <event>]` | Authenticate (NIP-42) |
| Relay -> Client | `["EVENT", <sub_id>, <event>]` | Deliver a matching event |
| Relay -> Client | `["EOSE", <sub_id>]` | End of stored events |
| Relay -> Client | `["OK", <id>, true/false, "msg"]` | Event acceptance result |
| Relay -> Client | `["CLOSED", <sub_id>, "reason"]` | Subscription closed |
| Relay -> Client | `["NOTICE", "message"]` | Informational message |
| Relay -> Client | `["AUTH", <challenge>]` | Authentication challenge |

### HTTP Endpoints

| Method | Path | Handler | Auth |
|--------|------|---------|------|
| GET | `/` | WebSocket upgrade or NIP-11 relay info | — |
| GET | `/info` | NIP-11 relay info | — |
| GET | `/.well-known/nostr.json` | NIP-05 identity | — |
| GET | `/health` | Health check | — |
| GET | `/_liveness` | Liveness probe (8080) | — |
| GET | `/_readiness` | Readiness probe (8080) | — |
| POST | `/events` | Submit signed Nostr event | NIP-42 or NIP-98 |
| POST | `/query` | Query Nostr events (NIP-01 filters) | NIP-42 or NIP-98 |
| POST | `/count` | Count Nostr events (NIP-45 filters) | NIP-42 or NIP-98 |
| POST | `/hooks/{id}` | Workflow webhook trigger | Secret-authenticated |
| PUT | `/media/upload` | Upload media blob (Blossom, 50 MB) | NIP-42 or NIP-98 |
| GET/HEAD | `/media/{sha256_ext}` | Retrieve/probe media blob | Optional auth |
| GET | `/git/{owner}/{repo}/info/refs` | Git smart HTTP advertisement | NIP-42 |
| POST | `/git/{owner}/{repo}/git-upload-pack` | Git smart HTTP fetch | NIP-42 |
| POST | `/git/{owner}/{repo}/git-receive-pack` | Git smart HTTP push | NIP-42 |
| POST | `/internal/git/policy` | Internal git hook policy check | Internal |
| GET | `/metrics` | Prometheus metrics (9102) | — |

### Relay Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| MAX_FRAME_BYTES | 65,536 | Max WebSocket frame |
| MAX_SUBSCRIPTIONS | 1024 | Per-connection sub limit |
| MAX_HISTORICAL_LIMIT | 500 | Per-filter query cap |
| handler_semaphore | 1024 | Concurrent EVENT/REQ handlers |
| Slow client grace | 3 | Consecutive full-buffer disconnects |
| Heartbeat interval | 30s | WebSocket ping interval |
| Missed pong limit | 3 | Disconnect after 3 missed pongs |

### Authentication Paths

| Path | Mechanism | Use Case |
|------|-----------|---------|
| NIP-42 | Schnorr-signed challenge/response (kind:22242) | WebSocket connections |
| NIP-98 HTTP Auth | Schnorr-signed kind:27235 event | HTTP bridge endpoints |
| API Tokens | SHA-256 hashed bearer tokens | Programmatic access |
| Dev-only key derivation | SHA-256("buzz-test-key:{username}") | Development/test (gated behind `dev` feature) |

NIP-42 timestamp tolerance: +-60 seconds.

### ACP (Agent Communication Protocol) CLI

The `buzz` CLI uses agent-facing subcommands:

```
buzz messages thread --channel <uuid> --event <hex> --format compact
buzz channels list
buzz agents list
```

All reads return sig-stripped JSON arrays; writes return `{event_id, accepted, message}`.

---

## 7. Event Kind Registry

All kinds defined in `buzz-core/src/kind.rs` as `pub const KIND_*: u32`.

### Kind Ranges

| Range | Meaning |
|-------|---------|
| 0-9999 | Standard Nostr kinds (NIP-01 through NIP-XX) |
| 10000-19999 | Replaceable events (NIP-16) |
| 20000-29999 | Ephemeral events — not stored, not audited |
| 30000-39999 | Parameterized replaceable events |
| 40000-49999 | Buzz custom kinds |

### Selected Buzz Custom Kinds

| Kind | Constant | Description |
|------|----------|-------------|
| 7 | KIND_REACTION | Emoji reaction (NIP-25) |
| 9 | KIND_STREAM_MESSAGE | Chat message in Stream channel (NIP-29) |
| 1059 | KIND_GIFT_WRAP | NIP-17 encrypted DM envelope |
| 1984 | KIND_REPORT | NIP-56 moderation report |
| 40002 | KIND_STREAM_MESSAGE_V2 | Stream message v2 format |
| 40003 | KIND_STREAM_MESSAGE_EDIT | Edit of a stream message |
| 40007 | KIND_STREAM_REMINDER | Reminder on a message |
| 40099 | KIND_SYSTEM_MESSAGE | Channel state change system message |
| 40100 | KIND_CANVAS | Shared document for a channel |
| 41010 | KIND_DM_OPEN | Open/create DM channel |
| 43001-43006 | KIND_JOB_* | Agent job protocol |
| 44100 | KIND_MEMBER_ADDED_NOTIFICATION | Relay-signed member add notice |
| 44101 | KIND_MEMBER_REMOVED_NOTIFICATION | Relay-signed member remove notice |
| 45001 | KIND_FORUM_POST | Forum thread root |
| 45003 | KIND_FORUM_COMMENT | Forum thread reply |
| 46001-46012 | KIND_WORKFLOW_* | Workflow execution events |
| 46020 | KIND_WORKFLOW_TRIGGER | Trigger workflow execution |
| 46030-46031 | KIND_APPROVAL_* | Approval grant/deny |
| 48100-48106 | KIND_HUDDLE_* | Huddle lifecycle events |
| 49001 | KIND_MEDIA_UPLOAD | Media upload audit |
| 20001 | KIND_PRESENCE_UPDATE | Ephemeral presence heartbeat |
| 20002 | KIND_TYPING_INDICATOR | Ephemeral typing indicator |
| 22242 | KIND_AUTH | NIP-42 auth (never stored) |
| 27235 | KIND_HTTP_AUTH | NIP-98 HTTP auth (never stored) |
| 30175 | KIND_PERSONA | Agent persona definition |
| 30176 | KIND_TEAM | Agent team definition |
| 30177 | KIND_MANAGED_AGENT | Managed agent record |
| 30300 | KIND_EVENT_REMINDER | Encrypted event reminder |
| 30617-30618 | KIND_GIT_REPO_* | NIP-34 git repository |
| 30620 | KIND_WORKFLOW_DEF | Workflow definition |
| 39000-39003 | KIND_NIP29_GROUP_* | NIP-29 group state (addressable) |
| 39005-39006 | KIND_THREAD_SUMMARY / WINDOW_BOUNDS | Channel window overlays |

### Special Kind Categories

| Category | Function | Kinds |
|----------|----------|-------|
| Ephemeral | `is_ephemeral()` | 20000-29999 |
| Replaceable | `is_replaceable()` | 0, 3, 41, 10000-19999 |
| Param Replaceable | `is_parameterized_replaceable()` | 30000-39999 |
| Author-only | `AUTHOR_ONLY_KINDS` | 30300, 30350 |
| P-gated | `P_GATED_KINDS` | 24200, 44100, 44101, 1059, 30622, 44200 |
| Result-gated | `RESULT_GATED_KINDS` | 30622, 44200 |
| Relay-only | `is_relay_only_kind()` | 13534, 40901, 40902, 30622, 39005, 39006 |
| Workflow execution | `is_workflow_execution_kind()` | 46001-46012 |
| Command | `is_command_kind()` | 30620, 41010-41012, 46020, 46030-46031 |
| Moderation | `is_moderation_command_kind()` | 9040-9044 |
| Relay admin | `is_relay_admin_kind()` | 9030-9033 |

---

## 8. Feature Deep-Dive

### 8.1 Real-Time Chat (Stream + Forum Channels)

**Stream channels** (kind:9/40002) — ordered chat with real-time fan-out. Messages are Nostr events with content, tags, and cryptographic signatures.

**Forum channels** (kind:45001/45003) — threaded discussions with forum post roots and comments. Support upvoting (kind:45002).

**Features:**
- Message history (Postgres queries, up to 500 per filter)
- Real-time delivery via WebSocket fan-out
- Channel membership gating
- Soft-delete (removed_at) for members
- Typing indicators (ephemeral kind:20002 via Redis ZADD)
- Thread replies with `reply_count` and `descendant_count` tracking
- Message editing (kind:40003)
- Message pinning (kind:40004)
- Message bookmarking (kind:40005)
- Scheduled messages (kind:40006)
- Reminders (kind:40007)

### 8.2 Direct Messages (DMs)

**Wire protocol:** NIP-17 gift-wrapped events (kind:1059) — outer NIP-44 encrypted envelope hiding sender, content, and timestamp from non-participants.

**Channel management:** `KIND_DM_OPEN` (41010) creates DM channels; `KIND_DM_ADD_MEMBER` (41011) for group DMs; `KIND_DM_HIDE` (41012) to remove from sidebar.

**Relay-side:**
- Hidden DM state via `hidden_at` in `channel_members` table
- `KIND_DM_VISIBILITY` (30622) snapshots per-viewer hidden state

### 8.3 Authentication & Authorization

| Mechanism | Detail |
|-----------|---------|
| NIP-42 WS Auth | Schnorr-signed challenge/response; grants all known scopes |
| NIP-98 HTTP Auth | kind:27235 with URL + method tags; HTTP bridge endpoints |
| API Tokens | SHA-256 hashed bearer tokens with scopes + channel allowlists |
| Scopes | 14 scopes (Messages, Channels, Users, Jobs, Subscriptions, Files x R/W + AdminChannels, AdminUsers) |
| Rate Limiting | Trait exists, 4 tiers defined, NO production implementation yet |
| Membership | NIP-43 relay-level membership + channel-level membership |

### 8.4 Workflow Engine

YAML-as-code automation engine in `buzz-workflow`. Definitions stored as kind:30620 (parameterized replaceable, `d=workflow_uuid`).

**Trigger types:**
- `message_posted` — fires when a message matches filter conditions
- `reaction_added` — fires on matching reactions
- `schedule` — cron-expression-based scheduling
- `webhook` — HTTP POST to `/hooks/{id}` with secret auth

**7 action types:**
| Action | Description |
|--------|-------------|
| `send_message` | Post to the workflow's channel |
| `send_dm` | DM to a user (NOT IMPLEMENTED — returns NotImplError) |
| `set_channel_topic` | Update channel topic (NOT IMPLEMENTED) |
| `add_reaction` | React to trigger message |
| `call_webhook` | HTTP POST (SSRF-protected, max 1 MiB response) |
| `request_approval` | Suspend for human approval |
| `delay` | Pause execution (max 300 seconds) |

**Condition evaluation:** evalexpr with `HashMapContext`. Custom functions: `str_contains`, `str_starts_with`, `str_ends_with`, `str_len`. 100ms timeout. Dot notation (`trigger.text` -> `trigger_text`).

**Template variables:** `{{trigger.text}}`, `{{trigger.author}}`, `{{steps.ID.output.FIELD}}`. Single-pass (not recursive). Unknown = literal.

**Concurrency control:** `Arc<Semaphore>` with 100 permits. `try_acquire()` — returns `CapacityExceeded` immediately rather than queuing.

**Cron scheduler:** Loop every 60 seconds. Window-based matching. DB-durable at-most-once fire claims.

### 8.5 Push Notifications (NIP-PL)

Multi-component system:
- **Push gateway** (`buzz-push-gateway`) — standalone binary for iOS/Android push delivery
- **Durable queues** — `push_match_queue` (event-to-lease matching) + `push_wake_outbox` (delivery)
- **Lease state** — `push_leases` table tracks per-device push capability
- **Delegations** — relay-to-gateway delegation authorizations
- **Replay protection** — event and request idempotency tables

Trigger: AFTER INSERT trigger on `events` table enqueues matching jobs for push-capable installations.

### 8.6 Media Storage (Blossom/S3)

**Protocol:** Blossom NIP-compatible media upload/download via `buzz-media` crate.

**Storage:** S3-compatible (MinIO locally, any S3 provider in production). Bucket: `buzz-media`.

**Endpoints:**
- `PUT /media/upload` — 50 MB max, concurrent upload limits per pubkey
- `GET/HEAD /media/{sha256_ext}` — optional auth-gated reads

**Concurrency controls:**
- `BUZZ_MEDIA_MAX_CONCURRENT_UPLOADS=8`
- `BUZZ_MEDIA_MAX_CONCURRENT_UPLOADS_PER_PUBKEY=2`
- `BUZZ_MEDIA_UPLOADS_PER_MINUTE=30`

### 8.7 Git Smart HTTP (NIP-34)

The relay hosts bare git repos with smart HTTP protocol support. Kind:30617 = repo announcement, kind:30618 = repo state (branch/tag refs).

**Endpoints:**
- `GET /git/{owner}/{repo}/info/refs` — advertisement
- `POST /git/{owner}/{repo}/git-upload-pack` — fetch/pull
- `POST /git/{owner}/{repo}/git-receive-pack` — push
- `POST /internal/git/policy` — internal hook policy checks

**Architecture:** Shells out to `git` subprocesses (receive-pack / upload-pack / repo hydrate). Pack cache with bounded concurrent population. SSRF protection via `is_private_ip()`.

### 8.8 Huddle Audio

Real-time voice via WebSocket at `/huddle/{channel_id}/audio`. In-process relay, no external SFU.

**Frame protocol (v2):** 8-byte header (sequence u16, timestamp u32, dBov i8, flags u8) + opaque Opus payload.

**Room state:** Soft cap 25 peers (hard cap 255 via u8 peer index). Per-peer bounded audio channel (drop-on-full). Lifecycle Nostr events: huddle started (48100), participant joined (48101), left (48102), ended (48103).

**Not yet built:** recording, per-track publishing.

### 8.9 Moderation

| Feature | Kinds | Tables | Detail |
|---------|-------|--------|--------|
| Reports | 1984 | `moderation_reports` | NIP-56 reports; signals never auto-actions |
| Bans | 9040-9041 | `community_bans` | Connection block + write-block |
| Timeouts | 9042-9043 | `community_bans.muted_until` | Write-only restriction |
| Resolve | 9044 | `moderation_actions` | Resolution audit trail |
| Commands | 9040-9044 | — | Mod-signed commands, never stored as events |

Actions: `delete_message`, `kick`, `ban`, `unban`, `timeout`, `untimeout`, `dismiss_report`, `escalate`, `resolve:*`.

### 8.10 Event Reminders (NIP-ER)

Kind:30300 parameterized replaceable events. Encrypted to author, with `not_before` timestamp tag. Relays hold and deliver at scheduled time. Author-only reads. See `docs/nips/NIP-ER.md`.

### 8.11 Agent Personas (NIP-AP)

Kind:30175 (persona definition), 30176 (team definition), 30177 (managed agent record).

Persona system prompt, display name, avatar, model, provider, runtime fields. Author-only-unless-shared read model: events without `["shared","true"]` tag are readable only by the publishing user; with the tag, readable community-wide.

### 8.12 Agent Engrams (NIP-AE)

Kind:30174 parameterized replaceable events. Encrypted memory records for AI agents. Addressed by `(pubkey_a, kind, d_tag)` where `d_tag` is an HMAC of the agent-owner conversation key. See `docs/nips/NIP-AE.md`.

### 8.13 Admin Dashboard

Private read-only admin dashboard at `BUZZ_ADMIN_HOST` (default `admin.localhost:3000`). Built with Vite + React (separate `admin-web/` project). Served by the relay alongside the main web UI. Report generation and product feedback visualization.

`buzz-admin` CLI: `add-member`, `remove-member`, `list-members`, `generate-key`, `reconcile-channels`. Shipped in the Docker image at `/usr/local/bin/buzz-admin`.

### 8.14 Device Pairing (NIP-AB)

Ephemeral sidecar relay (`buzz-pair-relay`) for device pairing protocol. CLI interop testing via `buzz-pairing-cli`. Uses kind:24134 (ephemeral pairing events).

---

## 9. AI Agent Ecosystem

### 9.1 ACP Harness (`buzz-acp`)

Standalone binary bridging Buzz relay events to AI agents via the Agent Communication Protocol (ACP/JSON-RPC over stdio).

```
Buzz Relay --WS--> buzz-acp --stdio (ACP)--> Agent (goose/codex/claude)
```

**Key features:**
- 1-32 parallel agent subprocesses with claim/return lifecycle
- Per-channel event queuing (at most one prompt in-flight per channel)
- @mention detection and subscription filtering
- Heartbeat prompts for long-running sessions
- Crash recovery: auto-respawn on subprocess failure
- Configurable via env vars, CLI flags, or TOML config file

### 9.2 Minimal Agent (`buzz-agent`)

Non-streaming ACP-compliant agent with tool-calls-as-output. Includes:
- Multi-provider LLM support (OpenAI, Anthropic, Google, Databricks, OpenRouter)
- MCP tool server integration
- Agent handoff protocol
- Persona catalog integration
- Built-in tools: shell commands, file I/O, search, web fetch
- Hints system for persona-specific behavior

### 9.3 Developer MCP Server (`buzz-dev-mcp`)

Standalone MCP server offering shell execution and file editing tools. Used as a sidecar by `buzz-agent`.

### 9.4 CLI (`buzz-cli`)

Agent-first CLI with commands for:
- Channel operations (list, read, create)
- Message operations (send, thread, search)
- Agent interactions (list, mention)
- Feed operations (mentions, activity, needs-action)
- Reaction management
- Emoji operations
- Notes

### 9.5 Sprig Harness (`sprig`)

All-in-one binary bundling ACP harness, agent, and dev MCP for deploy-anywhere deployment. Optimized with `opt-level = "z"`, LTO = fat, panic = abort, stripped.

### 9.6 Agent Observer

Ephemeral kind:24200 encrypted agent observer telemetry and control frames. Owner-scoped, sent over encrypted channels.

---

## 10. Configuration Guide

### Environment Variables

#### Database (Postgres)

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | postgres://buzz:buzz_dev@localhost:5432/buzz | Primary connection string |
| `READ_DATABASE_URL` | (unset) | Optional read-replica URL |
| `BUZZ_DB_POOL_SIZE` | 50 | Max pool connections per writer/reader |

#### Redis

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_URL` | redis://localhost:6379 | Redis connection string |
| `BUZZ_REDIS_POOL_SIZE` | 16 | Max connections in shared pool |

#### Relay Server

| Variable | Default | Description |
|----------|---------|-------------|
| `BUZZ_BIND_ADDR` | 0.0.0.0:3000 | Relay bind address |
| `RELAY_URL` | ws://localhost:3000 | Public WebSocket URL |
| `BUZZ_RELAY_PRIVATE_KEY` | (auto) | Relay signing key |
| `BUZZ_WEB_DIR` | (unset) | Path to web UI dist |
| `BUZZ_ADMIN_HOST` | (unset) | Admin dashboard host |

#### S3-Compatible Object Storage

| Variable | Default | Description |
|----------|---------|-------------|
| `BUZZ_S3_ENDPOINT` | http://localhost:9000 | S3 endpoint URL |
| `BUZZ_S3_ACCESS_KEY` | buzz_dev | Access key |
| `BUZZ_S3_SECRET_KEY` | buzz_dev_secret | Secret key |
| `BUZZ_S3_BUCKET` | buzz-media | Bucket name |
| `BUZZ_S3_REGION` | us-east-1 | AWS region |
| `BUZZ_S3_ADDRESSING_STYLE` | path | path or virtual |

#### Logging / Tracing

| Variable | Default | Description |
|----------|---------|-------------|
| `RUST_LOG` | buzz_relay=debug,... | Log level filter |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | (unset) | OTLP gRPC endpoint |

#### ACP Agent Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `BUZZ_PRIVATE_KEY` | (required) | Agent Nostr private key |
| `BUZZ_RELAY_URL` | (required) | Relay WSS URL |
| `BUZZ_ACP_AGENT_COMMAND` | goose | Agent binary |
| `BUZZ_ACP_AGENTS` | 1 | Parallel agents (1-32) |
| `BUZZ_ACP_MODEL` | (unset) | LLM model override |
| `BUZZ_ACP_TURN_TIMEOUT` | 320 | Max seconds per turn |
| `BUZZ_ACP_MAX_TURNS_PER_SESSION` | 0 | Turns before rotation |
| `BUZZ_ACP_SUBSCRIBE` | mentions | Sub mode (mentions/all/config) |
| `BUZZ_ACP_CONTEXT_MESSAGE_LIMIT` | 12 | Context messages fetched |
| `BUZZ_ACP_HEARTBEAT_INTERVAL` | 0 | Heartbeat interval (0=disabled) |

---

## 11. Runbook

### First-Time Setup

```bash
# Copy environment config
cp .env.example .env

# Activate Hermit toolchain
. ./bin/activate-hermit

# Run full setup (Docker services, migrations, dependencies)
just setup

# Install git hooks
just hooks
```

### Daily Development

```bash
# Start everything (Docker + relay + desktop)
just dev

# Start relay only (API + WebSocket server)
just relay

# Start relay with web UI
just relay-web

# Start desktop standalone (no relay needed)
just desktop-standalone
```

### Building & Checking

```bash
# Full CI pipeline (fmt + clippy + tests + builds)
just ci

# Rust workspace build
just build

# Format all code
just fmt-all

# Rust clippy
just clippy

# Desktop checks
just desktop-check
just desktop-ci

# Web checks
just web-check

# Mobile checks
just mobile-check
```

### Testing

```bash
# Unit tests only (no infra needed)
just test-unit

# Integration tests (requires Postgres + Redis)
just test-integration

# Full test suite
just test

# Desktop E2E tests
just desktop-e2e-smoke
just desktop-e2e-integration

# Web E2E tests
just web-e2e-smoke

# Mobile tests
just mobile-test
```

### Database

```bash
# Apply migrations
just migrate

# Seed test data
just admin-seed
just desktop-e2e-seed
```

### Releasing

```bash
# Desktop release PR
just release-desktop              # patch version
just release-desktop 0.6.0        # explicit version

# Relay release PR
just release-relay                # patch version
just release-relay 0.3.0          # explicit version

# Mobile release
# See RELEASING.md for the full mobile release process
```

### Infrastructure Commands

```bash
# Docker service control
docker compose up -d              # Start all services
docker compose down               # Stop all services
docker compose logs -f            # Tail logs
just ps                           # Show service status

# Reset dev environment (WARNING: deletes all data)
just reset

# Admin dashboard
just admin                        # Start admin + relay
just admin-seed                   # Seed admin data
```

### Docker Image Build

```bash
# Production image
docker build -t buzz-relay .

# With cargo caching (much faster rebuilds)
docker build --build-arg EXTRA_CA_CERTS=path/to/ca.pem \
             --build-arg NPM_REGISTRY=https://registry.npmjs.org \
             -t buzz-relay .
```

### Agent Operations

```bash
# Run a goose agent attached to the local relay
just goose

# Run a goose agent in background (screen)
just goose-bg

# Run the ACP harness directly
BUZZ_PRIVATE_KEY=<hex> BUZZ_RELAY_URL=ws://localhost:3000 cargo run -p buzz-acp

# Operator CLI
cargo run -p buzz-admin -- add-member --pubkey <hex> --role admin
cargo run -p buzz-admin -- reconcile-channels
```

---

## 12. Known Limitations & Risks

### Critical Gaps

| # | Issue | Impact |
|---|-------|--------|
| 1 | **No rate limiting implemented** | RateLimiter trait exists but only AlwaysAllowRateLimiter (test stub) exists. 4 defined tiers NOT enforced. Production abuse vector if deployed publicly. |
| 2 | **No sqlx offline query cache** | Uses runtime sqlx::query() not compile-time sqlx::query!(). Queries not validated at compile time. Production stability risk. |
| 3 | **Approval gates not wired end-to-end** | Workflow executor returns Suspended but marks runs as Failed (WF-08). Grant/deny API exists but not connected. |
| 4 | **Workflow actions partially stubbed** | send_dm and set_channel_topic return NotImplError (WF-07). |

### Known Design Limitations

| # | Issue | Detail |
|---|-------|--------|
| 5 | No typing REST endpoint | Typing indicators delivered via WS only; no HTTP API for current typers |
| 6 | Huddle recording not built | Recording and per-track publishing have reserved kinds but no producer |
| 7 | No rate limiting | 4 tiers defined in config; redis-backed limiter never implemented |
| 8 | Multi-node presence unoptimized | Presence events use local-only fan-out; multi-node needs Redis pub/sub |
| 9 | Webhook auth uses plain secret | Constant-time XOR comparison of UUID secret, not HMAC body signature |

### Dependency Pins

| Pin | Reason |
|-----|--------|
| `aws-creds` fork (tlongwell-block/rust-s3) | EKS Pod Identity credentials support; revert when crates.io catch up |
| `@radix-ui/react-dismissable-layer@1.1.19` | Prevents pointer-events freeze from multiple Radix versions |
| `linkify-it@^5.0.2` | CVE fixes for GHSA-22p9-wv53-3rq4, GHSA-v245-v573-v5vm |

### Build Gotchas

1. **Desktop crate excluded from root workspace** — cargo test at root does NOT run desktop tests.
2. **Desktop Tauri fmt fails in worktrees** — cargo fmt resolves paths relative to worktree root.
3. **Worktree cd does not persist** between tool calls — use one compound command.
4. **pnpm build:e2e is required** for E2E tests — plain pnpm run build strips mock bridge.
5. **ReuseExistingServer in Playwright** can serve stale code — kill port 4173 and re-build.
6. **React.memo is all-or-nothing** — one unstable prop defeats it; use StableReference.

---

## 13. Security Model

### Authentication

| Concern | Mechanism |
|---------|-----------|
| NIP-42 timestamp | +/-60 second tolerance — prevents replay attacks |
| AUTH events | Never stored in Postgres, never logged in audit chain |
| NIP-98 HTTP Auth | Schnorr-signed kind:27235 events — URL and method verification |

### Input Validation

| Concern | Mechanism |
|---------|-----------|
| Schnorr signatures | verify_event() in buzz-core — every event verified before storage |
| Event ID | SHA-256 of canonical serialization verified independently of signature |
| Frame size | MAX_FRAME_BYTES = 65,536 — oversized frames rejected |
| Search event IDs | 64-char hex validation — prevents path injection |
| Workflow step IDs | Alphanumeric + underscore only — prevents evalexpr injection |
| Partition names | Allowlist of table names + strict validators — prevents DDL injection |

### SSRF Protection

is_private_ip() in buzz-core covers all RFC-specified private ranges on both IPv4 and IPv6, including CGNAT and IPv4-mapped IPv6.

### Audit Integrity

- Hash chain: SHA-256 covers all fields including prev_hash
- Single-writer lock: pg_advisory_lock
- Panic-safe: catch_unwind ensures lock release

### Access Control

- Channel membership is the only gate — enforced at every relay operation
- REQ handler checks access before subscription registration
- TOCTOU-safe membership: all check-then-modify runs inside Postgres transactions
- Approval tokens: UUID (CSPRNG), stored as SHA-256 hash, single-use

### Cross-Tenant Isolation

- community_id leads every PK and unique constraint on tenant tables
- community_id immutable on channels (trigger prevents re-tenanting)
- Host resolution before any handler runs
- Unknown hosts fail closed

---

## 14. Codebase Structure

### Repository Layout

```
buzz/
  crates/                    # 26 Rust crates
    buzz-relay/              # Axum WebSocket server (main binary)
    buzz-core/               # Shared types, kind registry, verification
    buzz-db/                 # Postgres data access layer
    buzz-auth/               # Authentication + authorization
    buzz-pubsub/             # Redis pub/sub + presence + typing
    buzz-search/             # Postgres full-text search
    buzz-audit/              # Hash-chain audit log
    buzz-workflow/           # YAML-as-code workflow engine
    buzz-media/              # Blossom/S3 media storage
    buzz-acp/                # Agent Communication Protocol harness
    buzz-agent/              # Minimal ACP-compliant agent
    buzz-dev-mcp/            # Developer MCP server
    buzz-cli/                # Agent-first CLI
    buzz-sdk/                # Typed Nostr event builders
    buzz-admin/              # Operator CLI
    buzz-conformance/        # Multi-tenant conformance checker
    buzz-push-gateway/       # Push notification gateway
    buzz-pair-relay/         # Device pairing sidecar relay
    buzz-pairing-cli/        # Device pairing CLI
    buzz-relay-mesh/         # Iroh-based inter-relay mesh
    buzz-persona/            # Agent persona packs
    buzz-ws-client/          # Shared NIP-42 WebSocket client
    buzz-test-client/        # Integration test harness
    sprig/                   # All-in-one agent harness bundle
    git-sign-nostr/          # Sign git objects with Nostr key
    git-credential-nostr/    # Git credential helper for Nostr auth
  desktop/                   # Tauri 2 + React 19 desktop app
    src/                     # React TypeScript source
    src-tauri/               # Tauri Rust backend
    tests/                   # Playwright E2E tests
  web/                       # Vite + React web UI
    src/                     # React TypeScript source
    tests/                   # Playwright E2E tests
  admin-web/                 # Admin dashboard (Vite + React)
    src/                     # React TypeScript source
    tests/                   # Playwright E2E tests
  mobile/                    # Flutter mobile app
    lib/                     # Dart source
    test/                    # Flutter tests
  migrations/                # SQL migration files
  schema/                    # Authoritative schema.sql
  deploy/                    # Deployment configurations
  scripts/                   # Development scripts
  docs/                      # NIP proposals and guides
  benchmarks/                # Benchmarking infrastructure
  examples/                  # Example bots
```

### Key Files at Root

| File | Purpose |
|------|---------|
| Cargo.toml | Rust workspace manifest |
| Cargo.lock | Dependency lock file |
| Justfile | Task runner (dev, test, release) |
| Dockerfile | Multi-stage relay container build |
| docker-compose.yml | Local dev infrastructure |
| .env.example | Configuration template |
| CLAUDE.md -> AGENTS.md | AI agent contributor guide |
| ARCHITECTURE.md | System architecture |
| CONTRIBUTING.md | Contributor guide |
| TESTING.md | Multi-agent E2E testing guide |
| RELEASING.md | Release process |
| pnpm-workspace.yaml | JS monorepo config |
| rust-toolchain.toml | Rust toolchain pin (1.95.0) |
| deny.toml | Cargo deny config |
| lefthook.yml | Git hook configuration |
| prometheus.yml | Prometheus scrape config |
| renovate.json | Dependency update automation |
| biome.json | JS/TS linter + formatter config |



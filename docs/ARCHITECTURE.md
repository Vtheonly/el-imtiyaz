# Architecture

## Design Principles

1. **One-way dependencies** — outer layers depend on inner layers, never the reverse.
2. **Explicit boundaries** — every layer has a contract (`core/interfaces/`) that implementations satisfy.
3. **No shortcuts** — the renderer cannot call Node APIs. It goes through the preload bridge → IPC → main process → service → repository → SQLite.
4. **Observability first** — every IPC call is logged with correlation ID & duration. Every domain mutation emits an audit event.
5. **Offline by default** — no network calls. SQLite + local files. Sync layer can be added later without changing the domain.

## Layer Composition

```
UI (React)
  ↓ window.elImtiyaz.students.create(...)
Preload (contextBridge)
  ↓ ipcRenderer.invoke('students:create', ...)
Main IPC Handler
  ↓ wrap(channel, handler) — logging, error normalisation
StudentService
  ↓ students.create() + eventBus.publish('student.created')
StudentRepository
  ↓ db.run('INSERT INTO students ...')
SQLite (better-sqlite3, WAL mode)
```

## Event Flow

Cross-domain reactions happen via the EventBus — synchronous, in-process pub/sub.

```
PaymentService.recordPayment()
  → eventBus.publish('payment.recorded', {…})
      ↓
  AuditService.subscribe('payment.recorded')  → writes audit_logs row
  NotificationService.subscribe('payment.recorded')  → queues SMS reminder
  ReceiptService.subscribe('payment.recorded')  → generates PDF receipt
```

If a handler throws, it's logged but doesn't block other handlers. If multiple handlers throw, the bus re-throws the first error after running all handlers.

## Pipelines

Multi-stage flows are explicit so ordering is observable in logs:

- `PaymentPipeline` — validate → persist → audit → receipt → notify
- `DiscountPipeline` — eligibility → compute → apply → audit
- `ReportPipeline` — collect → combine → export

Each stage records its name in the context, so failures point to the exact failing stage.

## Error Handling

Every layer throws `AppError` (or subclasses: `ValidationError`, `NotFoundError`, `ConflictError`, `PermissionError`, `BusinessRuleError`, `InfrastructureError`).

The IPC boundary normalises unknown errors via `toAppError()` so the renderer always receives `{ ok: false, error: { code, message, details } }`.

The global error handler catches uncaught exceptions & unhandled rejections, logs them with stack traces, and surfaces a structured event to the renderer for toast notifications.

## Migrations

Applied in order at app startup by `MigrationsRunner`. Tracked in `_migrations` table.

Rules:
- Never edit an applied migration
- Always include `IF NOT EXISTS` on table creation
- Add new migrations at the end of `migrations.ts`

## Audit Trail

Append-only. Every mutation publishes a domain event; `AuditService` subscribes to a curated list of events and writes to `audit_logs` with before/after JSON snapshots.

Audit entries cannot be edited or deleted — the repository throws on `update` / `delete`.

## Currency Safety

The `Money` value object enforces:
- DZD-only (rejects other currency codes)
- 2-decimal rounding on every arithmetic operation
- Consistent formatting with Arabic locale

All database columns store raw numbers; the value object is used at the service layer for arithmetic and validation.

# El-Imtiyaz School System

> A professional, offline-first desktop administration system for **El-Imtiyaz Private School**. Built with Electron, React, TypeScript, and SQLite. All financial amounts in **Algerian Dinar (DZD)**.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![Electron](https://img.shields.io/badge/Electron-32-blue.svg)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://react.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Run in development (Vite + Electron together)
npm run start:dev

# 3. Build for production
npm run build

# 4. Package as installable desktop app
npm run package          # current OS
npm run package:win      # Windows
npm run package:mac      # macOS
npm run package:linux    # Linux
```

The app runs entirely offline. All data lives in a local SQLite database under your OS user-data folder.

---

## Architecture

The project follows a **clean architecture** with explicit layers and one-way dependencies. The renderer never touches Node APIs directly — it goes through the preload bridge, which exposes a typed API surface, which calls IPC handlers in the main process, which orchestrates services, which compose repositories, which talk to SQLite.

```
┌─────────────────────────────────────────────────────────────┐
│  Renderer (React + Vite)                                    │
│  ─────────────────────────────────────────────────────────  │
│  Pages · Components · State · Hooks                         │
│   (window.elImtiyaz — typed API)                          │
├─────────────────────────────────────────────────────────────┤
│  Preload (contextBridge)                                    │
│  ─────────────────────────────────────────────────────────  │
│  Whitelisted IPC channels only                              │
│   (ipcRenderer.invoke)                                    │
├─────────────────────────────────────────────────────────────┤
│  Main Process                                               │
│  ─────────────────────────────────────────────────────────  │
│  IPC Handlers → Services → Repositories → SQLite            │
│  Logger · EventBus · ErrorHandler · Audit                   │
└─────────────────────────────────────────────────────────────┘
```

### Layers

| Layer | Responsibility | Key files |
|---|---|---|
| **Core / Domain** | Entities, enums, value objects, interfaces. Zero dependencies on infrastructure. | `src/core/` |
| **Infrastructure** | SQLite client, repositories, logger, event bus, error handling, exporters. | `src/infrastructure/` |
| **Services** | Business logic. Composes repositories, emits domain events. | `src/services/` |
| **Pipelines** | Explicit multi-stage flows (payment recording, discount application, report export). | `src/pipelines/` |
| **Main** | Electron main process: window lifecycle, IPC routing, menu, bootstrap. | `src/main/` |
| **Preload** | Secure bridge exposing typed API to renderer. | `src/preload/` |
| **UI** | React renderer: pages, components, design system, state. | `src/ui/` |

---

## Core Modules

| Module | Status | Description |
|---|---|---|
| Student Management |  | Full CRUD, documents, financial profile, payment timeline |
| Parent Management |  | One parent → many students |
| Payment System |  | DZD, installments, multiple payment methods (cash, cheque, BaridiMob…) |
| Invoice System |  | Auto-generated invoice numbers, partial payment tracking |
| Debt Management |  | School-wide debt dashboard, overdue detection, largest debtors |
| Academic Years |  | Semester / Trimester / Quarter / Month structures auto-generated |
| Classes |  | Capacity enforcement, enrolment tracking |
| Attendance |  | Daily recording, per-student rate, per-class reports |
| Employees |  | Role-based permissions (Super Admin / Administrator / Accountant / Receptionist / Teacher / Viewer) |
| Fee Templates |  | Reusable charge plans, bulk apply to many students |
| Scholarships |  | Full / partial, sibling discounts auto-computed, revocable |
| Receipt Generator |  | PDF + QR code, professional layout |
| Audit Logs |  | Append-only, every mutation logged with before/after |
| Reports |  | Revenue (daily/weekly/monthly/yearly), outstanding, per-student |
| Export |  | PDF (pdfmake), Excel (ExcelJS), CSV (Papa Parse) |
| **Workflow Builder** |  | **Drag-and-drop node graph, 15+ node types, execution engine, versioning** |
| **Notification Center** |  | **In-app, email, SMS, WhatsApp templates with auto-subscription to domain events** |

---

## UI Features

These are the patterns that separate this from a generic CRUD app:

| Feature | How |
|---|---|
| **Smart tables (DataGrid)** | Sortable columns, multi-select, bulk actions, sticky headers, saved views (extensible) |
| **Command Palette** | `Cmd+K` opens fuzzy-search action launcher with keyboard navigation |
| **Global Search** | `Cmd+Shift+F` opens structured query search (`student:john status:active year:2026`) |
| **Contextual Autocomplete** | Graph-aware suggestions — selecting a student suggests unpaid invoices, parents, etc. |
| **Drag-and-Drop Workflow Builder** | Visual DAG editor with palette, ports, conditional branching, live execution |
| **Inline editing** | Click-to-edit on table cells (extensible via DataGrid render prop) |
| **Undo/Redo** | `Cmd+Z` reverses last destructive action via `UndoManager` |
| **Activity Timeline** | Audit-grade event log on every page |
| **Batch Actions** | Multi-select rows → bulk edit / promote / delete |
| **Split View** | Master-detail layouts via `SplitView` component |
| **Smart Forms (adaptive)** | Schema-driven forms with conditional field visibility (`visibleWhen`) |
| **State Visualization** | Explains WHY an entity is in its current state (rule evaluations) |
| **Persistent Workspace State** | Filters, table sort, selections, sidebar collapse — restored on next launch |
| **Keyboard-First** | Every action has a shortcut; menu items route through `menu:command` channel |
| **Dynamic Particle Logo** | Black-and-white image processing converts logo to interactive particle field, morphs to spinner / progress bar |
| **Notification Center** | Auto-populated from domain events via templates; unread count badge in topbar |

---

## Design System — El-Imtiyaz Academic Brand Palette

The entire UI is themed via CSS custom properties in `src/ui/styles/theme.css`. The palette is enforced consistently across:

| Role | Color | Usage |
|---|---|---|
| Primary Blue | `#349bd4` | Interaction, motion, primary CTAs |
| Deep Blue | `#2b7fb0` | Gradients, secondary surfaces |
| Light Blue | `#6ec1e4` | Highlights, glows |
| Dark Background | `#242526` | App background |
| Panel Background | `#1e1f20` | Cards, panels |
| Off-White | `#eff2f3` | Primary text |
| Slate Gray | `#3b464c` | Structural elements, borders |
| Warm Accent | `#c8a98c` | Human warmth, sparingly used |
| Success | `#3fa66e` | Paid status, positive deltas |
| Danger | `#c0504d` | Overdue, destructive actions |

### Motion Language

- **Blue = interaction + motion** (glows on hover, gradient loading bars)
- **Dark gray = structure** (cards, panels, borders)
- **Beige = human warmth** (used sparingly on avatars, soft accents)
- **Glow only on active state** — never static background

All animations use the palette-aware easings (`--ease-out`, `--ease-spring`) defined in `theme.css`.

---

## Dynamic Particle Logo

The logo system scans an image, extracts dark regions via brightness threshold, and converts them into a field of spring-physics particles. Three modes:

1. **Interactive Logo** — particles form the logo, react to mouse proximity (pushed away, pulse white), spring back to original positions.
2. **Circular Loader** — particles morph into a 3-ring spinning loader (rings alternate direction).
3. **Linear Progress Bar** — particles morph into a wave-swept progress bar.

The default demo pattern (no image uploaded) renders a stylised silhouette of two students with a graduation-cape sweep — drag-and-drop your own `image.jpeg` to replace it.

The LoadingScreen uses the **Circular Loader** mode for the app boot splash.

---

## Database & Migrations

SQLite (via `better-sqlite3`) in WAL mode for concurrent reads. The schema is split across three migrations in `src/infrastructure/database/migrations/`:

1. `001_initial_schema` — students, parents, employees, classes, academic years
2. `002_payments_invoices_receipts` — invoices, payments, receipts, payment-invoice links
3. `003_audit_attendance_templates` — audit log, attendance, fee templates, scholarships

Migrations are tracked in the `_migrations` table and applied idempotently at app startup. To add a new migration, append to `migrations.ts` — never edit an applied migration.

---

## Logging

Structured JSON logs via Winston with daily-rotating file transports:

- `logs/app-YYYY-MM-DD.log` — all levels (info and above in production)
- `logs/error-YYYY-MM-DD.log` — error-only, kept for 90 days
- Console (colorised) in development

Every IPC call produces a structured log entry with correlation ID and duration. The audit log captures every domain mutation with before/after snapshots.

---

## Project Structure

```
el-imtiyaz/
├── src/
│   ├── main/                     # Electron main process
│   │   ├── index.ts              # Entry point
│   │   ├── window-manager.ts     # BrowserWindow lifecycle
│   │   ├── bootstrap.ts          # Startup pipeline
│   │   ├── ipc/                  # IPC handlers + channel registry
│   │   └── system/               # App paths, menu
│   ├── preload/                  # Secure contextBridge
│   ├── core/                     # Domain layer
│   │   ├── entities/             # Student, Payment, Invoice, …
│   │   ├── enums/                # Status, role, type definitions
│   │   ├── interfaces/           # Repository, Service, Logger, EventBus contracts
│   │   └── value-objects/        # Money (DZD), DateRange, Identifier
│   ├── infrastructure/           # Implementations
│   │   ├── database/             # SQLite client + migrations
│   │   ├── repositories/         # Per-entity persistence
│   │   ├── logger/               # Winston adapter
│   │   ├── event-bus/            # In-process pub/sub
│   │   ├── export/               # PDF / Excel / CSV exporters
│   │   └── error/                # AppError hierarchy + global handler
│   ├── services/                 # Application services (business logic)
│   ├── pipelines/                # Multi-stage flows
│   ├── shared/                   # Constants, currency helpers
│   └── ui/                       # React renderer
│       ├── components/           # Logo, layout, data, forms, search, timeline, undo
│       ├── pages/                # One file per route
│       ├── state/                # Redux store + slices
│       ├── hooks/                # useIpc, useKeyboardShortcut
│       ├── styles/               # theme.css, global.css, animations.css, components.css
│       └── types/                # global.d.ts
├── assets/logo/                  # Logo placeholder
├── resources/                    # Electron build resources (icons)
├── docs/                         # ARCHITECTURE.md, DEVELOPMENT.md
├── package.json
├── tsconfig.json
├── tsconfig.main.json
├── tsconfig.preload.json
└── vite.config.ts
```

---

## Development

```bash
# Typecheck everything (main + preload + renderer)
npm run typecheck

# Lint
npm run lint

# Clean build artifacts
npm run clean
```

### Adding a new entity

1. Define the entity in `src/core/entities/`
2. Add the migration in `src/infrastructure/database/migrations/migrations.ts`
3. Implement the repository in `src/infrastructure/repositories/`
4. Add a service in `src/services/`
5. Register IPC handlers in `src/main/ipc/index.ts`
6. Expose the API in `src/preload/index.ts`
7. Build the UI page in `src/ui/pages/`
8. Add the route to `src/ui/App.tsx`

### Adding a new audit event

```ts
await eventBus.publish('yourDomain.action', {
  entityId: '…',
  entityType: 'YourEntity',
  before: previousState,
  after: newState,
  actor: { actorId: '…', actorName: '…' }
});
```

The `AuditService` auto-logs any event matching its registered list (see `audit.service.ts`).

---

## Currency

All amounts in the system are in **Algerian Dinar (DZD)**. The `Money` value object enforces:

- 2-decimal rounding on every arithmetic operation
- Currency code check (rejects non-DZD)
- Consistent formatting: `12,500.00 د.ج`

Use `formatDZD(amount)` in the renderer for display, and `Money.from(amount)` in the main process for arithmetic.

---

## Security

- `contextIsolation: true` — renderer cannot touch Node globals
- `nodeIntegration: false`
- Only whitelisted IPC channels are exposed via `contextBridge`
- All file paths from renderer are sanitised before disk access
- Renderer cannot open new windows — `setWindowOpenHandler` forces external links to the OS browser
- CSP header set on the renderer HTML

---

## License

MIT  El-Imtiyaz Engineering

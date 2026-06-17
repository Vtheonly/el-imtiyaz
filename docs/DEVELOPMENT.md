# Development Guide

## Setup

```bash
npm install
npm run start:dev
```

This launches Vite (renderer) and Electron (main) concurrently. The renderer hot-reloads; the main process requires a manual restart after changes (or use `npm run dev:main` for watch-mode compilation).

## TypeScript Configurations

- `tsconfig.json` — renderer (UI + shared + core types)
- `tsconfig.main.json` — main process (compiles to `dist-main/`)
- `tsconfig.preload.json` — preload script (compiles to `dist-preload/`)

Run `npm run typecheck` to verify all three.

## Adding a Feature (end-to-end example)

Let's say we want to add a "Bus Routes" module.

### 1. Domain layer

```ts
// src/core/entities/bus-route.entity.ts
export interface BusRoute {
  id: Identifier<'BusRoute'>;
  name: string;
  driverName: string;
  capacity: number;
  // …
}
```

Add `'BusRoute'` to the `EntityTag` union in `src/core/value-objects/identifier.ts`.

### 2. Migration

Append to `src/infrastructure/database/migrations/migrations.ts`:

```ts
{
  id: '004_bus_routes',
  description: 'Bus routes table',
  up: `CREATE TABLE IF NOT EXISTS bus_routes ( … );`
}
```

### 3. Repository

```ts
// src/infrastructure/repositories/bus-route.repository.ts
export class BusRouteRepository extends BaseRepository<BusRoute> { … }
```

### 4. Service

```ts
// src/services/bus-route.service.ts
export class BusRouteService {
  constructor(private readonly repo: BusRouteRepository) {}
  async list() { return this.repo.list(); }
  // …
}
```

### 5. IPC channel

Add to `src/main/ipc/channels.ts`:

```ts
BUS_ROUTES_LIST: 'bus-routes:list',
BUS_ROUTES_CREATE: 'bus-routes:create',
```

### 6. IPC handler

In `src/main/ipc/index.ts`, register the repository + service, then wire handlers:

```ts
wrap(IPC.BUS_ROUTES_LIST, () => services.busRoute.list());
wrap(IPC.BUS_ROUTES_CREATE, (_e, input) => services.busRoute.create(input));
```

### 7. Preload bridge

In `src/preload/index.ts`:

```ts
busRoutes: {
  list: () => invoke('bus-routes:list'),
  create: (input) => invoke('bus-routes:create', input),
}
```

### 8. UI page

```tsx
// src/ui/pages/BusRoutes.tsx
export function BusRoutes() {
  const [routes, setRoutes] = useState([]);
  useEffect(() => { window.elImtiyaz.busRoutes.list().then(setRoutes); }, []);
  return <DataGrid columns={…} data={routes} … />;
}
```

### 9. Route

In `src/ui/App.tsx`:

```tsx
<Route path="/bus-routes" element={<BusRoutes />} />
```

### 10. Sidebar nav

In `src/ui/components/layout/Sidebar.tsx`, add to `NAV_SECTIONS`.

---

## Debugging

- **Logs**: `Help → Open Logs Folder` in the app menu, or check `~/Library/Application Support/El-Imtiyaz School System/logs/` (macOS), `%APPDATA%/El-Imtiyaz School System/logs/` (Windows).
- **Database**: `Help → Open Data Folder` to inspect the SQLite file directly. Use `sqlite3` CLI or a GUI like DB Browser for SQLite.
- **DevTools**: `Cmd+Option+I` (or `View → Toggle DevTools`) — available in dev mode only.

## Building Distributables

```bash
npm run package         # current OS
npm run package:win     # Windows NSIS installer
npm run package:mac     # macOS DMG
npm run package:linux   # AppImage + deb
```

Output appears in `release/`. The build uses `electron-builder` with configuration in `package.json` under the `"build"` key.

## Performance Notes

- SQLite is in WAL mode — readers don't block writers.
- Statement cache in `DatabaseClient` avoids re-parsing prepared statements.
- Renderer uses Vite's HMR in dev; production build is bundled & minified.
- React Router v6 with lazy routes (extensible).
- Recharts for visualisations — kept lazy-loaded where possible.
- Particle engine caps at ~16k particles (180px max image dim × density step 2).

## Known Limitations (v1)

- No authentication — single-user local desktop use. The session slice assumes SUPER_ADMIN.
- No network sync — all data is local. Cloud sync is a future extension point.
- Undo/redo reverses mutations via snapshot replay; not all actions implement undo yet.
- Receipt PDF uses basic pdfmake layout — for branded receipts, edit `receipt.service.ts`.
- BaridiMob integration is stubbed (no actual API call).

## Testing Strategy (recommended, not yet implemented)

- **Unit tests** for value objects (`Money`, `DateRange`, `Identifier`) and enums.
- **Repository tests** using an in-memory SQLite database (`:memory:`).
- **Service tests** mocking repositories + event bus.
- **Pipeline tests** verifying stage ordering & error propagation.
- **IPC integration tests** spinning up the full main process.
- **Renderer component tests** with React Testing Library.
- **E2E tests** with Playwright driving the packaged app.

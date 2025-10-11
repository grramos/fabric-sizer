# Fabric Sizer

Fabric Sizer is a lightweight web application that computes switch counts and fiber counts for three common data-center topologies: 3-stage Clos, 5-stage Clos, and a simplified Dragonfly+. The UI runs entirely in the browser and the sizing math lives in pure TypeScript modules so it can be reused outside of the app.

## Getting started

Fabric Sizer has no runtime dependencies beyond Node.js 20+ and pnpm.

```bash
pnpm install
pnpm dev
```

The `dev` script starts a tiny static server on <http://localhost:4173>. The app persists the last used inputs in `localStorage`, so you can refresh without losing your configuration.

To create a production bundle of the static assets:

```bash
pnpm build
```

The generated files land in `dist/` and can be published directly to GitHub Pages or any static host.

## Testing

The topology calculators are covered by focused unit tests. Run them with:

```bash
pnpm test
```

The tests exercise representative fixtures for 3-stage Clos, 5-stage Clos, and Dragonfly+ sizing including oversubscription and error handling cases.

## Project structure

```
public/
  app/
    calculators.js      # Browser-friendly implementations of the sizing functions
    main.js             # UI glue, validation, and rendering
    zod-lite.js         # Minimal validation helpers mirroring the zod API subset we need
  index.html            # Application shell
  styles.css            # Tailwind-inspired utility styles + shadcn-like cards
src/
  lib/fabric-calculators/
    types.ts            # Shared type declarations and SizingResult documentation
    common.ts           # Utility helpers shared by all calculators
    clos3.ts            # 3-stage Clos calculator (exports calculate)
    clos5.ts            # 5-stage Clos calculator (exports calculate)
    dragonflyPlus.ts    # Dragonfly+ calculator (exports calculate)
scripts/
  dev-server.js         # Simple Node static file server used by pnpm dev
  build.js              # Copies public/ into dist/
tests/
  run-tests.js          # Node-based test harness for the calculators
```

## Sizing result contract

All calculators return a `SizingResult` object shaped as follows (see [`src/lib/fabric-calculators/types.ts`](src/lib/fabric-calculators/types.ts) for inline documentation):

```ts
interface SizingResult {
  switchCounts: {
    leaves: number;
    spines: number;
    superSpines?: number;
    total: number;
  };
  fiberCounts: {
    hostToLeafPerPod: number;
    hostToLeafTotal: number;
    leafToSpinePerPod: number;
    leafToSpineTotal: number;
    spineToSuperPerPod?: number;
    spineToSuperTotal?: number;
    interGroupPerGroup?: number;
    interGroupTotal?: number;
  };
  assumptions: Array<{ label: string; description: string }>;
  metadata: Record<string, number | string>;
}
```

The `assumptions` array captures every `ceil()` or `floor()` operation that impacts the totals so that the UI can render a human-readable audit trail. The `metadata` bag holds secondary values (pods, leaves per pod, group counts, etc.) that populate the “Per-pod breakdown” card.

## Deployment

Because the app is a static site, deploying to GitHub Pages is just a matter of publishing the contents of `dist/`. For example, a GitHub Actions workflow could run `pnpm build` and push the resulting directory to your `gh-pages` branch.

## License

Fabric Sizer is released under the MIT License. See [LICENSE](LICENSE) for details.

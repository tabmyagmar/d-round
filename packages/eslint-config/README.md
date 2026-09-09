# @repo/eslint-config

ESLint 10 flat-config presets. Every workspace has an `eslint.config.mjs` that picks one:

| Preset                      | Use for                      |
| --------------------------- | ---------------------------- |
| `@repo/eslint-config/base`  | framework-less TS packages   |
| `@repo/eslint-config/node`  | apps/api, apps/worker, queue |
| `@repo/eslint-config/react` | packages/ui                  |
| `@repo/eslint-config/next`  | apps/web                     |

```js
import { nodeConfig } from "@repo/eslint-config/node";

export default nodeConfig({ tsconfigRootDir: import.meta.dirname });
```

The layer contract lives in `boundaries.js`; the rationale for every rule group is in
`docs/conventions.md`.

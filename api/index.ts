// Vercel Function entry point.
//
// Vercel only auto-detects an Express app at the repository root, so the API is exposed
// explicitly from this `api/` entry. `vercel.json` rewrites every `/api/*` request here while
// forwarding the original path, which is why the Express app can keep its `/api/...` routes.
// Local development bypasses this file: `npm run dev` still starts `server/index.ts`.
import { app } from '../server/app.js';

export default app;

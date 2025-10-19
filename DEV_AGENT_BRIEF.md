# Project Rules for AI Assistants

- Backend must use Vercel serverless functions under /api (ESM .js files).
- Do NOT create or modify Express servers. Ignore /server (legacy).
- Frontend is Vite; build output is dist/public; do not change scripts:
  - "dev": "vite"
  - "build": "vite build"
  - "preview": "vite preview"
- Keep vercel.json and .vercelignore as-is.
- Use ESM imports (import/export). Include .js extensions in relative imports.
- When adding endpoints, follow the existing examples:
  - GET: /api/property/lookup?geocode=...
  - POST body is JSON.
- Prefer small, composable helpers in /api/_lib.

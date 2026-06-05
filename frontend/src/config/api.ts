/**
 * Single source of truth for the backend origin (no trailing slash).
 *
 * Next.js client env (set in Vercel → Settings → Environment Variables):
 *   NEXT_PUBLIC_API_URL=https://your-backend.example.com
 *
 * Local dev: copy frontend/.env.local.example → .env.local
 */

function resolveApiBase(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, "");
  if (!raw) {
    throw new Error(
      "NEXT_PUBLIC_API_URL is not set. Add it to .env.local for local dev or to Vercel Environment Variables for production.",
    );
  }
  return raw;
}

export const API_BASE = resolveApiBase();

export default API_BASE;

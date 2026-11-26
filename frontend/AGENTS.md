<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Jadi Link frontend

- Sesi dipilih pengguna sebagai **memory-only**. Jangan simpan JWT di cookies,
  localStorage, sessionStorage, URL, atau log. Refresh halaman memang meminta login ulang.
- Browser memanggil Nest API langsung. `NEXT_PUBLIC_API_URL` berakhiran `/api`
  dan dipasang pada build; jangan memasukkan secret backend ke frontend.
- Client guard hanya mengatur tampilan/navigasi. JWT dan ownership tetap
  diverifikasi oleh backend pada setiap endpoint privat.
- Hindari SSR fetch data privat karena token tidak tersedia di server Next.
  Gunakan struktur Server/Client Component App Router sesuai panduan versi terpasang.
- Verifikasi lint, typecheck, unit test, browser test, dan production build.
  Browser test default memakai mock API lokal, tidak mengakses Neon.
- Ikuti workflow commit/push dan penghentian per fase pada `../AGENTS.md`.

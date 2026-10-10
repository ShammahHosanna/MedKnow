# MedKnow

> **Understand your medications from a photo.** Information tool, **not medical advice.**

MedKnow is a privacy-first PWA (installable web app) that analyzes photos of medication packaging (boxes, leaflets) and returns clear, multilingual information: what the medication is, what it is for, how to take it, key warnings, and critical interactions. Analysis is powered by AI (Gemini or OpenAI), with a deterministic **mock** mode for CI/dev. The app works **offline** for saved analyses and can run fully locally via Docker.

---

## 🚀 Quick start

```bash
# 1) Install dependencies
npm install

# 2) Configure your API key
cp .env.example .env.local
#    → paste your Gemini key (https://aistudio.google.com/app/apikey)
#    → or set LLM_PROVIDER=mock for a no-API-key deterministic mode

# 3) Run
npm run dev          # http://localhost:3000
```

With Docker (recommended — app exposed on **http://localhost:3001**):

```bash
docker compose up --build
```

> ⚠️ API keys are **server-side only** — never prefix them with `NEXT_PUBLIC_`, never commit `.env.local`.

---

## 🧱 Tech stack

### Languages

| Language | Where it is used |
|---|---|
| **TypeScript** (strict mode, target ES2020) | The entire codebase (app, components, libraries, API routes) |
| **TSX/JSX** | React components |
| **CSS / Tailwind (utility classes)** | Styling (no standalone `.css` besides Tailwind pipeline) |
| **Node.js scripts (.mjs)** | Icon generation (`scripts/generate-icons.mjs`), Next.js config |
| **YAML** | Docker Compose |
| **JSON** | Manifest PWA, TypeScript/ESLint/PostCSS/Vitest configs, package manifests |

### Core framework & runtime

| Technology | Version | Role |
|---|---|---|
| **Next.js** (App Router) | `^14.2.5` | Full-stack React framework: UI, API routes, security headers (CSP, HSTS…), standalone output for Docker |
| **React / React DOM** | `^18.3.1` | UI library |
| **Node.js** | 20 (Alpine images) | Runtime (dev, Docker, standalone server) |
| **npm** | — | Package manager (`package-lock.json`, `npm ci` in Docker) |

### UI & styling

| Technology | Version | Role |
|---|---|---|
| **Tailwind CSS** | `^3.4.14` | Utility-first styling |
| **tailwindcss-animate** | `^1.0.7` | Animation utilities |
| **Radix UI** (`react-accordion`, `react-dialog`) | — | Accessible headless primitives |
| **Lucide React** | `^0.454.0` | Icon set |
| **class-variance-authority** | `^0.7.0` | Component variants (shadcn-style pattern) |
| **clsx + tailwind-merge** | `^2.1.1` / `^2.5.4` | Conditional class composition |

### Validation & data

| Technology | Version | Role |
|---|---|---|
| **Zod** | `^3.23.8` | Runtime schemas: request/response validation for `/api/analyze`, env parsing |

### AI providers

The app talks to LLM providers **server-side only**, through a provider abstraction with retry, automatic fallback, and rate limiting:

| Provider | Configuration |
|---|---|
| **Google Gemini** (default) | `GEMINI_API_KEY`, `GEMINI_MODEL` (e.g. `gemini-3.5-flash-lite`) |
| **OpenAI** | `OPENAI_API_KEY`, `OPENAI_MODEL` (e.g. `gpt-4o-mini`) |
| **Mock** | `LLM_PROVIDER=mock` — deterministic, no API call (CI/dev/tests) |

`FALLBACK_PROVIDER` / `FALLBACK_API_KEY` / `FALLBACK_MODEL` provide a secondary provider for automatic failover on 429/5xx.

### Browser APIs (client-side)

| API | Purpose |
|---|---|
| **MediaDevices `getUserMedia`** | Camera capture of the medication packaging |
| **Canvas API** | Image preprocessing (crop, scale) before upload |
| **Web Speech API** | Speech synthesis ("read aloud" of results) for accessibility |
| **Service Worker + Web App Manifest** | PWA: installation, offline mode, icons, `OfflineBadge` UI |

### Testing, linting & tooling

| Technology | Version | Role |
|---|---|---|
| **Vitest** | `^2.1.3` | Unit & integration test runner (`tests/**/*.test.{ts,tsx}`) |
| **happy-dom** | `^15.11.7` | DOM environment for component tests |
| **ESLint** (`eslint-config-next`) | `^8.57.1` | Linting |
| **Prettier** | `^3.3.3` | Formatting |
| **TypeScript compiler (`tsc --noEmit`)** | `^5.6.3` | Typecheck (`npm run typecheck`) |
| **PostCSS + Autoprefixer** | `^8.4.47` / `^10.4.20` | CSS pipeline |
| **Sharp** | `^0.33.5` | Image processing for PWA icon generation script |

### DevOps / deployment

| Technology | Role |
|---|---|
| **Docker** (multi-stage `Dockerfile`) | Production image: `deps → builder → runner` on `node:20-alpine`, non-root user, Next.js standalone output |
| **Docker Compose** | One-command local run (`docker compose up --build`, port 3001→3000) |
| **Vercel** (ready) | `next.config.mjs` targets standalone; env vars have to be set in project settings |

### Security

Security features are enforced in `next.config.mjs` and server code:

- **Content-Security-Policy** (no `unsafe-eval` in production), `X-Frame-Options: DENY`
- **HSTS** (production), `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` (camera restricted to self, mic/geolocation denied)
- Server-side API keys, in-memory rate limiting per IP, request timeouts
- Application-level safety filters: no-diagnosis rules, identity redaction, critical-interaction checks

> MedKnow is an **information tool**, not a medical device: it never delivers a diagnosis, and outputs include standardized disclaimers.

---

## 📜 Available scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the dev server (http://localhost:3000) |
| `npm run build` | Production build (standalone output) |
| `npm start` | Run the production server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript (`tsc --noEmit`) |
| `npm test` | Run the Vitest test suite |
| `npm run test:watch` | Vitest in watch mode |
| `npm run format` | Prettier formatting |
| `npm run icons` | Generate the PWA icons (Sharp) |

---

## 🔐 Environment variables

Copy `.env.example` to `.env.local` and fill in at least one key.

| Variable | Role | Default |
|---|---|---|
| `LLM_PROVIDER` | `gemini` \| `openai` \| `mock` | `gemini` |
| `GEMINI_API_KEY` | Gemini server-side key | — |
| `OPENAI_API_KEY` | OpenAI server-side key | — |
| `GEMINI_MODEL` | Model name (pin the ID) | `gemini-3.5-flash-lite` |
| `OPENAI_MODEL` | Model name | `gpt-4o-mini` |
| `FALLBACK_PROVIDER` / `_API_KEY` / `_MODEL` | Secondary provider on 429/5xx | empty |
| `RATE_LIMIT_PER_MIN` | Requests/min per IP (in-memory) | `10` |
| `REQUEST_TIMEOUT_MS` | Provider timeout | `25000` |

---

## ⚖️ Disclaimer

MedKnow provides **informational summaries generated by AI** from photos of medication packaging. It is **not a substitute** for medical advice, diagnosis or treatment. Always read the leaflet and consult a healthcare professional.

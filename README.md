# Wafflehaüs Organized Workspaces (WOW)

Welcome to WOW! This is a puzzle-hunt collaboration platform to provide teams with a central workspace where they can manage and collaborate on puzzles, track progress, and communicate effectively.

The platform is available at [www.wafflehaus.io](https://www.wafflehaus.io) for use. If you would like to contribute to the codebase, please follow the instructions below to set up the development environment.

## Getting Started

You need to install Node.js prior to running this project. The recommended method is to use [nvm](https://github.com/nvm-sh/nvm):

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
```

Next, clone the repository and navigate into the project directory.

```bash
git clone git@github.com:ammubhave/wow.git
cd wow
```

You will require a `.env.keys` file in the project root that contains the private keys for decrypting the secrets necessary to run the project. Please reach out to the project maintainer to obtain this file. Note that project can still be run locally for development purposes without all the secrets, but certain features will not work as expected.

Next, run the following commands to install dependencies, set up the database, and start the development server:

```bash
nvm use
corepack enable pnpm
pnpm install
pnpm db:migrate
pnpm run dev
```

## Tech Stack

WOW is a single-page React app served by one Cloudflare Worker. The Worker serves the app shell as a static file and runs only `/api/*`.

### Frontend

- [React](https://react.dev/) with [TanStack Router](https://tanstack.com/router) (file-based routes in `src/routes/`), built by [TanStack Start](https://tanstack.com/start) in SPA mode.
- [TanStack Query](https://tanstack.com/query) for server data and [TanStack Form](https://tanstack.com/form) for forms. [Redux Toolkit](https://redux-toolkit.js.org/) holds a little client state, such as presence.
- [HeroUI](https://heroui.com/) and HeroUI Pro for components (on [React Aria](https://react-spectrum.adobe.com/react-aria/)), styled with [Tailwind CSS](https://tailwindcss.com/) v4. [Lucide](https://lucide.dev/) icons, plus a few [React Bits](https://reactbits.dev/) effects.
- [Univer](https://univer.ai/) for the built-in collaborative spreadsheet, [Excalidraw](https://excalidraw.com/) for whiteboards, [Tiptap](https://tiptap.dev/) for rich text, and [Recharts](https://recharts.org/) (through HeroUI Pro) for charts.

### Backend

- [Cloudflare Workers](https://developers.cloudflare.com/workers/) host everything. The API uses [oRPC](https://orpc.unnoq.com/) procedures (`src/server/router/`) validated with [Zod](https://zod.dev/), plus a few [Hono](https://hono.dev/) routes.
- [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite) for data, through [Drizzle ORM](https://orm.drizzle.team/).
- [Durable Objects](https://developers.cloudflare.com/durable-objects/) for anything live over WebSockets: the workspace board, chat, presence, notifications, whiteboards and spreadsheets (`src/server/do/`).
- [R2](https://developers.cloudflare.com/r2/) for uploaded files, [Workflows](https://developers.cloudflare.com/workflows/) for delayed jobs, and [Email Routing and Sending](https://developers.cloudflare.com/email-routing/) for email.
- [Cloudflare Realtime](https://developers.cloudflare.com/realtime/) through [PartyTracks](https://github.com/threepointone/partytracks) for voice chat.
- [Better Auth](https://www.better-auth.com/) for accounts (email, Google sign-in and passkeys), with [Turnstile](https://developers.cloudflare.com/turnstile/) against bots.

### Integrations

- The Google Drive and Sheets APIs, for teams that keep puzzle sheets in Google Drive (optional).
- A Discord bot, for puzzle channels and voice.
- [PostHog](https://posthog.com/) for product analytics and error tracking.

### Tooling

- [Vite+](https://viteplus.dev/) (`vp`) runs the dev server, build, tests ([Vitest](https://vitest.dev/)), linting ([Oxlint](https://oxc.rs/), with type checks) and formatting.
- [pnpm](https://pnpm.io/) for packages, [Wrangler](https://developers.cloudflare.com/workers/wrangler/) for Cloudflare, and [dotenvx](https://dotenvx.com/) for encrypted secrets.
- Pushes to `main` deploy to production through [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/).

Before sending a change, run:

```bash
pnpm lint
pnpm build
```

## Database Migrations

Schema changes go through Drizzle migrations in `migrations/`:

1. Edit `src/lib/db/schema.ts`.
2. `pnpm db:generate` writes a new migration. Review the SQL before committing it.
3. `pnpm db:migrate` applies pending migrations to your local database.
4. After merging, `pnpm db:migrate:prod` applies them to production (`node scripts/migrate-d1-prod.mjs --dry-run` lists what is pending). Apply migrations before deploying code that depends on them.

`drizzle-kit push` is disabled for production. On D1, a migration that rebuilds a table (`DROP TABLE`) cascade-deletes every row that references it, because D1 ignores `PRAGMA foreign_keys=OFF`. `pnpm db:generate` and both migrate commands refuse such migrations until the dependent rows are preserved (see `scripts/2026-10-01-d1-reconcile-schema.sql`) and the migration is marked `-- d1-cascade-reviewed`.

## Secrets Management

All secrets are checked in encrypted format using [DotenvX](https://dotenvx.com). To make changes to your secrets, follow the instructions below.

1. Make changes in .env.local file.

2. Encrypt the .env.local file using the command below.

```bash
pnpm encrypt
```

3. Commit the changes to the .env.local.encrypted file to source control.

4. Update the secret in the Cloudflare dashboard.

## License and Contributions

Please refer to the `LICENSE` file for the applicable terms.

Contributions are welcome. By submitting a contribution (e.g. a pull request), you agree that it may be used and incorporated into the project and that the ownership of such contributions shall be assigned to the project maintainer in accordance with the terms of the `LICENSE` file.

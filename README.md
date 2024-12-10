# Wafflehäus Organized Workspace

## Getting Started

1. Install [Visual Studio Code](https://code.visualstudio.com/) or [Cursor](https://www.cursor.com/)
2. Install the [Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) extension in your IDE.
3. Open the repository inside the IDE and click on "Reopen in Container" in the bottom right corner. If this doesn't appear, then type `Command+Shift+P` and select "Dev Containers: Rebuild and Reopen in Container".
4. Ask Amol for secrets that need to be set in `.env.local` file.
5. Open a new terminal inside vscode (i.e. inside the dev container) and run
6. If this is the first time you're running the app, you will have to synchronize your local database instance schema by running `pnpm run db:push:local`.
7. Run the following command to start the dev server.

```bash
pnpm run dev
```

8. After the dev server starts, the web app will be available at `http://localhost:8788`.

## Code Structure

### Frontend

The frontend is built using [Remix](https://remix.run/). Most of the code is in the `src` directory.

### Backend

The backend is built using [Cloudflare Workers](https://workers.cloudflare.com/) and [Durable Objects](https://developers.cloudflare.com/durable-objects/). Most of the code is in the `src/server` directory.

### Database

The database a SQLite database is powered by [Turso](https://turso.tech/). The schema is defined in the `schema.zmodel` file and uses [Zenstack](https://zenstack.dev/) as the ORM.

### Authentication

The app uses [Kinde](https://kinde.com/) for authentication.

### Deployment

The app is deployed to Cloudflare. The repository is configured to automatically deploy the `main` branch on every push to the repository.

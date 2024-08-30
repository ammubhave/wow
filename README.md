# Wafflehäus Organized Workspace

## Getting Started

1. Install [Visual Studio Code](https://code.visualstudio.com/) and the [Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) extension.
2. Open the repository inside vscode and click on "Reopen in Container" in the bottom right corner. If this doesn't appear, then type `Command+Shift+P` and select "Dev Containers: Rebuild and Reopen in Container".
3. Ask Amol for secrets that need to be set in `do/.dev.vars`, `web/.dev.vars`, and `web/.env` files.
4. Open a new terminal inside vscode (i.e. inside the dev container) and run

```bash
bun dev
```

5. After the dev server starts, the web app will be available at `http://localhost:8788`.
6. If this is the first time you're running the app, or your local dev database schema is out of date, run `bun db:push:local`

## Getting Started without using Dev Containers

1. Install [nvm](https://github.com/nvm-sh/nvm?tab=readme-ov-file#installing-and-updating)

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
```

2. Install Node.js 22

```bash
nvm install 22
nvm alias default 22
nvm use default
```

3. Install [Bun](https://bun.sh/docs/installation#installing)

```bash
curl -fsSL https://bun.sh/install | bash
```

4. Install [Turso CLI](https://docs.turso.tech/cli/introduction)

```bash
# macOS
## Install Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
## Install Turso CLI
brew install tursodatabase/tap/turso

# OR

# Linux
curl -sSfL https://get.tur.so/install.sh | bash
```

5. Open the repository inside a terminal and run the following command to start a local database server

```bash
turso dev --db-file dev.sqlite
```

6. In a new terminal, run the following command to start the dev server. Ask Amol for secrets that need to be set in `do/.dev.vars`, `web/.dev.vars`, and `web/.env` files.

```bash
bun dev
```

7. After the dev server starts, the web app will be available at `http://localhost:8788`.
8. If this is the first time you're running the app, or your local dev database schema is out of date, run `bun db:push:local`

## Code Structure

### `do`

The `do` directory contains the [Durable Objects](https://developers.cloudflare.com/durable-objects/) that powers the chat and presence features of the app.

### `web`

The `web` directory contains the [Remix](https://remix.run/) app that powers the web interface of the app.

## Authentication

The app uses [Kinde](https://kinde.com/) for authentication.

## Deployment

The app is deployed to [Cloudflare Pages](https://pages.cloudflare.com/). The repository is configured to automatically deploy the `main` branch on every push to the repository.

```

```

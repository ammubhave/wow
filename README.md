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
pnpm drizzle-kit push
pnpm run dev
```

## Technologies Used

This project uses:

- [Tanstack Start](https://tanstack.com/start) as the full-stack framework for React applications.
- [Tailwind CSS](https://tailwindcss.com/) for styling.
- [Base UI](https://baseui.design/) for the headless component library.
- [Shadcn UI](https://shadcn.com/ui) for pre-built components.
- [Cloudflare Workers](https://developers.cloudflare.com/workers/) as the hosting platform.

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

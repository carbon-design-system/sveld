# Contributing

## Prerequisites

[Bun](https://bun.sh/docs/installation).

## Set-up

Fork the repository and clone your fork:

```sh
git clone <YOUR_FORK>
cd sveld
```

Set the original repository as the upstream:

```sh
git remote add upstream git@github.com:IBM/sveld.git
# verify that the upstream is added
git remote -v
```

Finally, install the project dependencies:

```sh
bun install
```

## Workflow

### Unit tests

Ensure the unit tests pass by running `bun test`.

### End-to-end (e2e) tests

Because this library is written in TypeScript, it must be transpiled to JavaScript before it can be used by e2e tests in the `tests/e2e` folder.

Run `bun run build` to build the library. The transpiled JavaScript code is emitted to the `lib` folder.

To build the library in watch mode, run `bun run build -w`.

### Continuous Integration

This project uses GitHub Actions for continuous integration (CI).

It does the following:

1. Build the library
2. Run unit tests

The CI should pass if no unexpected errors occur.

## Submitting a Pull Request

### Sync Your Fork

Before submitting a pull request, make sure your fork is up to date with the latest upstream changes.

```sh
git fetch upstream
git checkout main
git merge upstream/main
```

### Submit a PR

After you've pushed your changes to remote, submit your PR. Make sure you are comparing `<YOUR_USER_ID>/feature` to `origin/main`.

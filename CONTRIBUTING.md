# Contributing

## Prerequisites

For MacOS, prerequisites include [Node.js](https://nodejs.org/en/download/package-manager/#macos)(version 12 or greater) and [Yarn](https://yarnpkg.com/en/docs/install#mac-stable).

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
yarn install
```

## Workflow

### Unit tests

Ensure the unit tests pass by running `yarn test:unit`.

### Integration tests

Because this library is written in TypeScript, it must be transpiled to JavaScript before it can be used by integration tests in the `integration` folder.

Run `yarn build` to build the library. The transpiled JavaScript code is emitted to the `lib` folder.

To build the library in watch mode, run `yarn build:watch`.

### Continuous Integration

The `yarn prepack` command is executed in Travis CI.

It does the following:

1. Build the library
2. Run unit/svelte-check/integration tests in parallel

The CI should pass if no unexpected errors occur.

## Submitting a Pull Request

### Sync Your Fork

Before submitting a pull request, make sure your fork is up to date with the latest upstream changes.

```sh
git fetch upstream
git checkout master
git merge upstream/master
```

### Submit a PR

After you've pushed your changes to remote, submit your PR. Make sure you are comparing `<YOUR_USER_ID>/feature` to `origin/master`.

# @mfbtech/changelog-generator

A changelog generator not authored by git data but by the developer implementing the fix, feature, breaking change, ...

This package helps developers manage changelogs and package version while keeping their freedom to put what ever they want in their commit messages, tags, ....

## Usage

The general workflow of a developer would be something like,

1. Branch off of the main development branch of the repository.
1. Commit changes and, before making a pull request, run `ccg change` next to the `package.json` of your project to generate a change file.
1. Create a pull requests and merge the changes. `ccg change --verify` can be run in CI/CD to verify that a change file has been generated.
1. When publishing the package, run `ccg publish` to bump the package.json version and update the changelog file with all of the change files.

Change files contain date/time, a short description of the change and an associated version bump for the change (i.e. major, minor, patch, or none).

```text
Usage: ccg [options] [command]

Options:
  -h, --help         display help for command

Commands:
  change [options]   Generates a change file if a change is detected.
  publish [options]  Combines all of the existing changes files into the change log and consolidates the version bumps in the change files down to a single version
  help [command]     display help for command
```

### change

```text
Usage: ccg change [options]

Generates a change file if a change is detected.

Options:
  -v, --verify    Verify the change file has been generated and is valid.
  -h, --help      display help for command
```

### publish

```text
Usage: ccg publish [options]

Combines all of the existing changes files into the change log and consolidates the version bumps in the change files down to a single version

Options:
  -a, --apply  By default this command will perform a readonly operation. If you want to update the change log files and the project's version (i.e. package.json), then specify this argument.
  -h, --help   display help for command
```

### Configuration

```json
{
  "repoUrl": "https://github.com/MFB-Technologies-Inc/changelog-generator.git",
  "branchName": "develop",
  "remoteName": "origin",
  "packagePath": "./package.json"
}
```

- `repoUrl`: the remote URL of the repository.
- `branchName`: the default branch name to be compared against the local branch for changes.
- `remoteName`: the default remote name for comparing against.
- `packagePath`: the path to the `package.json` of the package that should be checked for changes.

## Scripts

- `build`: Builds the CLI.
- `ccg`: Run the built CLI. Use `--` before any arguments that you want to pass to the script.
- `lint`: Fixes all lint errors.
- `check-linting`: Checks for lint errors without fixing them.
- `format`: Fixes all format errors.
- `check-formatting`: Checks for format errors without fixing them.
- `test`: Runs all tests and re-runs them when changes are made.
- `test:ci`: Runs all tests, generates a test coverage report and exits.

## Changelog

[Link to changelog](./CHANGELOG.md).

## Publishing

TODO

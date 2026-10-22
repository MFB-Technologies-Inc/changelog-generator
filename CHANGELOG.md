# Changelog - @mfbtech/changelog-generator

This log was last generated on Thu, 22 Oct 2026 16:29:27 GMT and should not be manually modified.

## 1.0.3

Thu, 22 Oct 2026 16:29:27 GMT

### Dependency changes

- Upgrade minimatch, rollup, and other transitive dependencies to fix security vulnerabilities including CVE-2026-27903 (minimatch ReDoS)

### Patch changes

- Terminate every JSON file the CLI writes with a newline, so a consumer's `prettier --check` no longer fails on the `package.json` that `publish --apply` rewrites (#22)
- Update js-yaml to a secure version
- Automate version bump pull requests and GitHub/npm releases with accumulated changelog notes, and document the release process.

## 1.0.2

Fri, 14 Nov 2025 16:14:00 GMT

### Patch changes

- Upgrade @inquirer/prompts to resolve tmp vulnerability

## 1.0.1

Fri, 16 May 2025 13:01:28 GMT

### Patch changes

- Improve error messages and logging
- Fix the sonar cloud step in the build action

## 1.0.0

Fri, 10 Jan 2025 20:40:53 GMT

Version update only.

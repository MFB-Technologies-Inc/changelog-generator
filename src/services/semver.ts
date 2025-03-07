// Copyright 2024 MFB Technologies, Inc.

import { parse } from "semver"

export type Semver = {
  major: number
  minor: number
  patch: number
}

export function parseSemver(version: string): Semver | null {
  const parsedSemver = parse(version)
  if (parsedSemver === null) {
    return null
  }
  return {
    major: parsedSemver.major,
    minor: parsedSemver.minor,
    patch: parsedSemver.patch
  }
}

export function getSemverString(version: Semver): string {
  return `${version.major}.${version.minor}.${version.patch}`
}

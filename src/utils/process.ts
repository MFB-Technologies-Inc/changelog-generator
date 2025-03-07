// Copyright 2024 MFB Technologies, Inc.

/** Immediately exits the process. */
export function exitProcessWithError(args: {
  /** The error to be logged. */
  error: unknown
  /** The code to exit the process with. Defaults to 1. */
  code?: number
}): void {
  console.error(args.error)
  process.exit(args.code ?? 1)
}

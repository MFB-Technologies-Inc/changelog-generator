// Copyright 2024 MFB Technologies, Inc.

export function hasToStringMethod(
  obj: unknown
): obj is { toString: () => string } {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "toString" in obj &&
    typeof obj.toString === "function"
  )
}

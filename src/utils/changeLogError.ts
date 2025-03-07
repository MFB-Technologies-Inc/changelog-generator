// Copyright 2024 MFB Technologies, Inc.

export const changeLogErrorCodes = {
  NO_SUCH_FILE_OR_DIRECTORY: "CLEC0001",
  UNKNOWN_FILE_SYSTEM_ERROR: "CLEC0002",
  INVALID_CHANGELOG_JSON: "CLEC0003"
} as const

export type ChangeLogErrorCodeEnum =
  (typeof changeLogErrorCodes)[keyof typeof changeLogErrorCodes]

export type ChangeLogError = {
  __brandChangeLogError: Record<string, unknown>
  code: ChangeLogErrorCodeEnum
  message: string
  cause?: unknown
}

export function isChangeLogErrorCodesEnum(
  x: unknown
): x is ChangeLogErrorCodeEnum {
  return (
    typeof x === "string" &&
    Object.values<string>(changeLogErrorCodes).includes(x)
  )
}

export function isChangeLogError(x: unknown): x is ChangeLogError {
  return (
    typeof x === "object" &&
    x !== null &&
    "code" in x &&
    isChangeLogErrorCodesEnum(x.code) &&
    "message" in x &&
    typeof x.message === "string"
  )
}

export function createChangeLogError(args: {
  code: ChangeLogErrorCodeEnum
  message: string
  cause?: unknown
}): ChangeLogError {
  return {
    code: args.code,
    message: args.message,
    cause: args.cause
  } as ChangeLogError
}

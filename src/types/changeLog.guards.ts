// Copyright 2024 MFB Technologies, Inc.

import { changeTypeEnum } from "./changeFile.js"
import {
  ChangeLog,
  ChangeLogEntry,
  ChangeLogEntryComment,
  ChangeLogEntryComments
} from "./changeLog.js"

export function isChangeLogEntryComment(
  obj: unknown
): obj is ChangeLogEntryComment {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "comment" in obj &&
    typeof obj.comment === "string"
  )
}

export function isChangeLogEntryComments(
  obj: unknown
): obj is ChangeLogEntryComments {
  return (
    typeof obj === "object" &&
    obj !== null &&
    Object.keys(obj).every(key =>
      Object.values<string>(changeTypeEnum).includes(key)
    ) &&
    Object.values(obj).every(
      value => Array.isArray(value) && value.every(isChangeLogEntryComment)
    )
  )
}

export function isChangeLogEntry(obj: unknown): obj is ChangeLogEntry {
  return (
    obj !== null &&
    typeof obj === "object" &&
    "version" in obj &&
    typeof obj.version === "string" &&
    "date" in obj &&
    typeof obj.date === "string" &&
    "comments" in obj &&
    isChangeLogEntryComments(obj.comments)
  )
}

export function isChangeLog(obj: unknown): obj is ChangeLog {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "name" in obj &&
    typeof obj.name === "string" &&
    "entries" in obj &&
    Array.isArray(obj.entries) &&
    obj.entries.every(isChangeLogEntry)
  )
}

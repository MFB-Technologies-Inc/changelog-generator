// Copyright 2024 MFB Technologies, Inc.

import path from "path"
import { ChangeLog } from "../types/changeLog.js"
import { readJson, writeJson, writeString } from "./fileSystem.js"
import { isChangeLog } from "../types/changeLog.guards.js"
import {
  ChangeLogError,
  changeLogErrorCodes,
  createChangeLogError,
  isChangeLogError
} from "../utils/changeLogError.js"

const changeLogJsonFileName = "CHANGELOG.json"
const changeLogMarkdownFileName = "CHANGELOG.md"

export async function getChangelogJsonFile(args: {
  projectRootDirectory: string
}): Promise<ChangeLog | ChangeLogError> {
  const fullPath = path.join(args.projectRootDirectory, changeLogJsonFileName)
  const result = await readJson(fullPath)
  if (isChangeLog(result) || isChangeLogError(result)) {
    return result
  }
  return createChangeLogError({
    code: changeLogErrorCodes.INVALID_CHANGELOG_JSON,
    message: "Failed to parse the change log JSON file."
  })
}

export async function createChangelogJsonFile(args: {
  projectName: string
  projectRootDirectory: string
}): Promise<ChangeLog | ChangeLogError> {
  const data = getInitChangeLogJsonFile({ projectName: args.projectName })
  try {
    await writeJson({
      path: args.projectRootDirectory,
      fileName: changeLogJsonFileName,
      data
    })
  } catch (e) {
    return createChangeLogError({
      code: changeLogErrorCodes.UNKNOWN_FILE_SYSTEM_ERROR,
      message: "Failed to create change log JSON file.",
      cause: e
    })
  }
  return data
}

function getInitChangeLogJsonFile(args: { projectName: string }): ChangeLog {
  return {
    name: args.projectName,
    entries: []
  }
}

export async function saveChangelogJsonFile(args: {
  projectRootDirectory: string
  changeLog: ChangeLog
}): Promise<void | ChangeLogError> {
  try {
    await writeJson({
      path: args.projectRootDirectory,
      fileName: changeLogJsonFileName,
      data: args.changeLog
    })
  } catch (e) {
    return createChangeLogError({
      code: changeLogErrorCodes.UNKNOWN_FILE_SYSTEM_ERROR,
      message: "Failed to save the changes to the change log JSON file.",
      cause: e
    })
  }
}

export async function saveChangelogMarkdownFile(args: {
  projectRootDirectory: string
  markdown: string
}): Promise<void | ChangeLogError> {
  try {
    await writeString({
      path: args.projectRootDirectory,
      fileName: changeLogMarkdownFileName,
      data: args.markdown
    })
  } catch (e) {
    return createChangeLogError({
      code: changeLogErrorCodes.UNKNOWN_FILE_SYSTEM_ERROR,
      message: "Failed to save the changes to the change log Markdown file.",
      cause: e
    })
  }
}

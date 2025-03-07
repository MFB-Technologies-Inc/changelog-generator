// Copyright 2024 MFB Technologies, Inc.

import * as nodeFs from "fs"
import * as nodeAsyncFs from "node:fs/promises"
import path from "path"
import {
  ChangeLogError,
  changeLogErrorCodes,
  createChangeLogError
} from "../utils/changeLogError.js"

export async function readJson(
  path: string
): Promise<Record<string, unknown> | ChangeLogError> {
  return new Promise(resolve => {
    nodeFs.readFile(path, { encoding: "utf8" }, (err, data) => {
      if (err !== null) {
        if (err.message.includes("no such file or directory")) {
          resolve(
            createChangeLogError({
              code: changeLogErrorCodes.NO_SUCH_FILE_OR_DIRECTORY,
              message: err.message,
              cause: err
            })
          )
        } else {
          resolve(
            createChangeLogError({
              code: changeLogErrorCodes.UNKNOWN_FILE_SYSTEM_ERROR,
              message: err.message,
              cause: err
            })
          )
        }
        return
      }
      const result = JSON.parse(data)
      resolve(result)
    })
  })
}

/** Overwrites/creates the file with the data. */
export async function writeJson(args: {
  path: string
  fileName: string
  data: Record<string, unknown>
}): Promise<void> {
  await ensureFullPathExists(args.path)
  return new Promise((resolve, reject) => {
    const json = JSON.stringify(args.data, null, 2)
    const fullPath = path.join(args.path, args.fileName)
    nodeFs.writeFile(fullPath, json, { encoding: "utf-8" }, err => {
      if (err !== null) {
        reject(err)
      } else {
        resolve()
      }
    })
  })
}

/** Ensures that the given path exists using recursion. If it doesn't then it is created. */
async function ensureFullPathExists(path: string): Promise<void> {
  return new Promise((resolve, reject) => {
    nodeFs.mkdir(path, { recursive: true }, err => {
      if (err !== null) {
        reject(err)
      } else {
        resolve()
      }
    })
  })
}

/** Gets a list of full file paths of files in the specified directory. */
export async function getFilesListInDirectory(args: {
  path: string
}): Promise<string[]> {
  if (!nodeFs.existsSync(args.path)) {
    return []
  }
  return nodeAsyncFs.readdir(args.path)
}

/** Overwrites/creates the file with the data. */
export async function writeString(args: {
  path: string
  fileName: string
  data: string
}): Promise<void> {
  await ensureFullPathExists(args.path)
  return new Promise((resolve, reject) => {
    const fullPath = path.join(args.path, args.fileName)
    nodeFs.writeFile(fullPath, args.data, { encoding: "utf-8" }, err => {
      if (err !== null) {
        reject(err)
      } else {
        resolve()
      }
    })
  })
}

/** Attempts to delete all of the files. */
export async function deleteFiles(args: { paths: string[] }): Promise<void> {
  const existingPaths = args.paths.filter(nodeFs.existsSync)
  for (let i = 0; i < existingPaths.length; i++) {
    const path = existingPaths[i]
    if (path === undefined) continue
    await nodeAsyncFs.rm(path)
  }
}

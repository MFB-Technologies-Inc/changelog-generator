// Copyright 2024 MFB Technologies, Inc.

import path from "path"
import { readJson, writeJson } from "./fileSystem.js"

const npmPackageJsonFileName = "package.json"

/** @throws an error if the package.json is invalid. */
export async function getCurrentProjectName(
  projectRootDir: string
): Promise<string> {
  const projectPackageJsonPath = path.resolve(
    projectRootDir,
    npmPackageJsonFileName
  )
  const rawPackageJson = await readJson(projectPackageJsonPath)
  if (!isPackageJson(rawPackageJson)) {
    throw new Error(`Invalid package.json at ${projectPackageJsonPath}.`)
  }
  return rawPackageJson.name
}

/** @throws an error if the package.json is invalid. */
export async function getCurrentProjectVersion(
  projectRootDir: string
): Promise<string> {
  const projectPackageJsonPath = path.resolve(
    projectRootDir,
    npmPackageJsonFileName
  )
  const rawPackageJson = await readJson(projectPackageJsonPath)
  if (!isPackageJson(rawPackageJson)) {
    throw new Error(`Invalid package.json at ${projectPackageJsonPath}.`)
  }
  return rawPackageJson.version
}

type PackageJson = {
  name: string
  version: string
}
export function isPackageJson(obj: unknown): obj is PackageJson {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "name" in obj &&
    typeof obj.name === "string" &&
    "version" in obj &&
    typeof obj.version === "string"
  )
}

/** @throws an error if the package.json is invalid. */
export async function setCurrentProjectVersion(args: {
  projectRootDir: string
  newSemVer: string
}): Promise<void> {
  const projectPackageJsonPath = path.resolve(
    args.projectRootDir,
    npmPackageJsonFileName
  )
  const rawPackageJson = await readJson(projectPackageJsonPath)
  if (!isPackageJson(rawPackageJson)) {
    throw new Error(`Invalid package.json at ${projectPackageJsonPath}.`)
  }
  rawPackageJson.version = args.newSemVer
  await writeJson({
    path: args.projectRootDir,
    fileName: npmPackageJsonFileName,
    data: rawPackageJson
  })
}

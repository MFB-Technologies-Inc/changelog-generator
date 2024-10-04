// Copyright 2024 MFB Technologies, Inc.

import { spawn } from "child_process"
import * as path from "path"
import { exitProcessWithError } from "../utils/process.js"
import {
  ChangeFile,
  changeTypeEnum,
  getChangeTypeDescription
} from "../types/changeFile.js"
import { selectionPrompt, textPrompt } from "../utils/prompt.js"
import { readJson, writeJson } from "../services/fileSystem.js"

const changeFileDirectoryRoot = "changes" + path.sep

/**
 * Checks for changes from "HEAD" to remote "main" branch. If changes exist and a change file
 * doesn't exist then the user will be prompted with a series of questions about what kind of change
 * is being made to generate a change file in the format of <branch name>-<timestamp>.json. If no
 * changes are detected then nothing happens.
 *
 * If a change file already exists then the user will be shown the existing change comments from
 * each change file and they will be prompted to append to the existing comments or do nothing.
 * Appending to the existing comments will prompt the user with a series of questions and generate a
 * new (additional) change file in the respective format.
 *
 * The change files will be generated in a `changes/` directory with `[branch name]_[date/time]`,
 * where the branch name uses numbers, letters and "-"s as separators and an example of the
 * date/time format is "yyyy-mm-dd-hh-mm". This directory and its contents needs to be tracked.
 *
 * If the user does not specify a message for the change file then a default change file will be
 * created.
 */
export async function change(args?: {
  /** Verify the change file has been generated and is valid. */
  verify?: boolean
}): Promise<void> {
  /* 
    TODO:
      1. get the current branch name: `git branch --show-current`
      1. get the remote name using the current branch name: `git config branch.<branch name>.remote`
      1. get the "main" origin branch by parsing out "HEAD branch:" from `git remote show <remote name>`
      1. check for a diff from HEAD against "main" origin branch `git diff HEAD..<remote name>/<main branch name> --shortstat`
      1. if a diff does not exist then exit 
      1. otherwise,
      1. if `verify` is true, then throw an error
      1. show the user what branch they are on
      1. show the user what the target branch is (i.e. "main" branch name with remote name)
      1. check for existing change files for the project 
      1. if there are no existing change files then prompt the user
      =>
       1. otherwise, 
        1. show the user the existing comments from the existing change files
        1. prompt the user do nothing or append comments
        1. if the user wants to append comments, then prompt the user to generate a new change file
       1. load the config and use those values

      prompting the user to generate a change file or append comments looks like this

      1. prompt the user for a change description
      1. prompt the user for a change type (use the types and descriptions from types module)
      1. generate a new change file with file name <branch name>-<timestamp>.json in ./changes/
  */

  const currentBranchName = await getCurrentGitBranchName()
  // TODO: verify against the remote name in the config
  const remoteName = await getRemoteName(currentBranchName)
  // TODO: use the branch name from the config instead
  const headBranchName = await getHeadBranchName(remoteName)
  // assume script is run from the root of the project
  const projectRootDirectory = process.cwd()
  const projectName = await getCurrentProjectName(projectRootDirectory)
  // TODO: what does the response look like when there are no changes?
  const changeSummary = await getCompactChangeSummary({
    currentBranchName,
    remoteName,
    targetBranch: headBranchName
  })

  if (changeSummary.changedFilePaths.length < 1) {
    console.log(
      `No changes were detected when comparing branch ${currentBranchName} against ${remoteName}/${headBranchName}.`
    )
    return
  }
  // intentionally not checking untracked files, so the user can (if they want) generate "duplicates"
  const currentChangeFilePaths = changeSummary.changedFilePaths.filter(
    changedFilePath => changedFilePath.startsWith(changeFileDirectoryRoot)
  )
  if (args?.verify === true) {
    if (currentChangeFilePaths.length < 1) {
      exitProcessWithError({
        error:
          "Changes were detected but no change files! Please run `ccg change` to generate change files."
      })
    } else {
      console.log(
        "Verified; the current branch has changes and has one or more change files."
      )
      return
    }
  }

  console.log(`current branch: ${remoteName}/${currentBranchName}`)
  console.log(`target branch: ${remoteName}/${headBranchName}`)
  // prompt the user
  if (currentChangeFilePaths.length < 1) {
    const changeFileContent = await promptToCreateChangeFile(projectName)
    await saveChangeFile({
      projectRootDir: projectRootDirectory,
      currentBranchName,
      file: changeFileContent
    })
  } else {
    throw new Error("not implemented")
  }
}

async function promptToCreateChangeFile(
  projectName: string
): Promise<ChangeFile> {
  const changeMessage = await textPrompt({
    message: "Describe changes or leave blank for no changes:"
  })
  const patch = await selectionPrompt({
    message: "Select change type:",
    options: [
      {
        value: changeTypeEnum.MAJOR,
        name: changeTypeEnum.MAJOR,
        description: getChangeTypeDescription(changeTypeEnum.MAJOR)
      },
      {
        value: changeTypeEnum.MINOR,
        name: changeTypeEnum.MINOR,
        description: getChangeTypeDescription(changeTypeEnum.MINOR)
      },
      {
        value: changeTypeEnum.PATCH,
        name: changeTypeEnum.PATCH,
        description: getChangeTypeDescription(changeTypeEnum.PATCH)
      },
      {
        value: changeTypeEnum.NONE,
        name: changeTypeEnum.NONE,
        description: getChangeTypeDescription(changeTypeEnum.NONE)
      }
    ]
  })
  return {
    changes: [
      {
        packageName: projectName,
        comment: changeMessage,
        type: patch
      }
    ]
  }
}

// TODO: move these are related functions into a git service
async function getCurrentGitBranchName(): Promise<string> {
  return runCommand({ command: "git", args: ["branch", "--show-current"] })
}

async function getRemoteName(currentBranchName: string): Promise<string> {
  return runCommand({
    command: "git",
    args: ["config", `branch.${currentBranchName}.remote`]
  })
}

async function showRemoteOrigin(remoteName: string): Promise<string> {
  return runCommand({
    command: "git",
    args: ["remote", "show", remoteName]
  })
}

async function getHeadBranchName(remoteName: string): Promise<string> {
  const remoteOrigin = await showRemoteOrigin(remoteName)
  const headBranchKey = "HEAD branch: "
  const newLineChar = "\n"
  const headBranchName = remoteOrigin
    .split(newLineChar)
    .find(line => line.includes(headBranchKey))
  if (headBranchName === undefined) {
    throw new Error("unable to find the head branch name.")
  }
  return headBranchName.trim().replace(headBranchKey, "")
}

// TODO: move into service
/** Runs a command and returns its output. */
async function runCommand(args: {
  command: string
  args?: readonly string[]
}): Promise<string> {
  const command = spawn(args.command, args.args)
  return new Promise((resolve, reject) => {
    let result = ""
    command.on("error", err => {
      reject("command failed: failed to start the subprocess: " + err.message)
    })
    command.on("close", code => {
      if (code !== 0) {
        reject("command failed with exit code " + code)
      } else {
        resolve(result)
      }
    })
    command.stdout.on("data", (data: unknown) => {
      if (!hasToStringMethod(data)) {
        reject("unknown response data: " + JSON.stringify(data))
        command.kill(1)
        return
      }
      result += data.toString().trim()
    })
    command.stderr.on("data", data => {
      reject(`command failed: ${data}`)
      command.kill(1)
    })
  })
}

// TODO: move to utils module
function hasToStringMethod(obj: unknown): obj is { toString: () => string } {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "toString" in obj &&
    typeof obj.toString === "function"
  )
}

/**
 * Checks for changes between the current branch to the remote head branch.
 *
 * @returns `true` if there are changes, otherwise `false`.
 */
async function checkForChanges(args: {
  remoteName: string
  headBranchName: string
}): Promise<boolean> {
  /*
    - `--shortstat` summarizes the changes. e.g., "27 files changed, 5743 insertions(+), 2 deletions(-)" 
    - if there are no changes then "" is returned
   */
  const output = await runCommand({
    command: "git",
    args: ["diff", "--shortstat", `${args.remoteName}/${args.headBranchName}`]
  })
  return output.trim().length > 0
}

async function getChangeFiles(args: {
  // Use this to build the change file directory path
  pathToProjectRootDirectory: string
  // use this to check for change files associated with the current branch
  currentBranchName: string
}): Promise<ChangeFile[]> {
  // TODO: finish implementing
  /*
    what if you are on branch A, you generate change files, merge A into your main branch, then push
    more changes to A and run the cli?

    should you see the change files for the changes you already made? or, should the changes on your
    main branch be excluded (i.e. if the main branch has those change files already in it, then don't
    show skips)?

    https://git-scm.com/docs/git-diff

    `git diff origin/main --compact-summary` can be used to list the files with their relative paths.
    if there are no change files in that list, then we should prompt to generate some. if there are
    one or more change files in that list then prompt with skip.
  */
  return []
}

const newlineRegex = new RegExp(/\n/)
const singleSpaceChar = " "
/**
 * Gets the collection of file paths that have been changed between the current checked out branch
 * and the remote branch.
 *
 * @returns `true` if there are changes, otherwise `false`.
 */
async function getCompactChangeSummary(args: {
  /** The name of the current branch that is checked out. */
  currentBranchName: string
  /** The name of the remote. */
  remoteName: string
  /** The name of the branch you want to compare against. */
  targetBranch: string
}): Promise<{
  /** Paths of the changed files relative to the root directory of the repository. */
  changedFilePaths: string[]
  /**
   * A short summary of changes.
   *
   * @example
   * ```text
   * 2 files changed, 2 insertions(+), 1 deletions(-)
   * ```
   */
  shortStat: string | undefined
}> {
  const output = await runCommand({
    command: "git",
    args: [
      "diff",
      `${args.remoteName}/${args.targetBranch}...${args.currentBranchName}`,
      "--compact-summary"
    ]
  })
  const rawList = output.split(newlineRegex)
  const shortStat = rawList[rawList.length - 1]
  const changedFilePaths = rawList
    .slice(0, rawList.length - 1)
    .map(rawSummaryRow => rawSummaryRow.trim())
    .map(rawSummaryRow => {
      const firstSpaceIndex = rawSummaryRow.indexOf(singleSpaceChar)
      return rawSummaryRow.slice(0, firstSpaceIndex)
    })
  return {
    changedFilePaths,
    shortStat
  }
}

/*
 * The change files will be generated in a `changes/` directory with `[branch name]_[date/time]`,
 * where the branch name uses numbers, letters and "-"s as separators and an example of the
 * date/time format is "yyyy-mm-dd-hh-mm". This directory and its contents needs to be tracked.
 */
async function saveChangeFile(args: {
  projectRootDir: string
  currentBranchName: string
  file: ChangeFile
}): Promise<void> {
  const fileNameDelimiter = "_"
  const changeFileFullRootDir = path.join(
    args.projectRootDir,
    changeFileDirectoryRoot
  )
  const dateTimeStr = getFormattedChangeFileDateTimeStamp()
  const branchNameFormatted = getFormattedChangeFileBranchName(
    args.currentBranchName
  )
  const changeFileFileNameWithExtension = `${branchNameFormatted}${fileNameDelimiter}${dateTimeStr}.json`
  await writeJson({
    path: changeFileFullRootDir,
    fileName: changeFileFileNameWithExtension,
    data: args.file
  })
}

function getFormattedChangeFileDateTimeStamp(): string {
  const nowUtc = new Date()
  return `${nowUtc.getFullYear()}-${nowUtc.getMonth()}-${nowUtc.getDate()}-${nowUtc.getHours()}-${nowUtc.getMinutes()}`
}

function getFormattedChangeFileBranchName(branchName: string): string {
  const dashChar = "-"
  const notAlphaNumOrDashChar = new RegExp("[^a-zA-Z0-9-]")
  return branchName.split(notAlphaNumOrDashChar).join(dashChar)
}

// TODO: move into an npm service
async function getCurrentProjectName(projectRootDir: string): Promise<string> {
  const projectPackageJsonPath = path.resolve(projectRootDir, "package.json")
  const rawPackageJson = await readJson(projectPackageJsonPath)
  if (!isPackageJson(rawPackageJson)) {
    throw new Error(`Invalid package.json at ${projectPackageJsonPath}.`)
  }
  return rawPackageJson.name
}

type PackageJson = {
  name: string
}
function isPackageJson(obj: unknown): obj is PackageJson {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "name" in obj &&
    typeof obj.name === "string"
  )
}

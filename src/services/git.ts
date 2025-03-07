// Copyright 2024 MFB Technologies, Inc.

import { newlineRegex, singleSpaceChar } from "../constants.js"
import { runCommand } from "./processes.js"

export async function getCurrentGitBranchName(): Promise<string> {
  return runCommand({ command: "git", args: ["branch", "--show-current"] })
}

export async function getRemoteName(
  currentBranchName: string
): Promise<string> {
  return runCommand({
    command: "git",
    args: ["config", `branch.${currentBranchName}.remote`]
  })
}

export async function showRemoteOrigin(remoteName: string): Promise<string> {
  return runCommand({
    command: "git",
    args: ["remote", "show", remoteName]
  })
}

/**
 * Checks for changes between the current branch to the remote head branch.
 *
 * @returns `true` if there are changes, otherwise `false`.
 */
export async function checkForChanges(args: {
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

/**
 * Gets the collection of file paths that have been changed between the current checked out branch
 * and the remote branch.
 *
 * @returns `true` if there are changes, otherwise `false`.
 */
export async function getCompactChangeSummary(args: {
  /** The name of the current branch that is checked out. */
  currentBranchName: string
  /** The name of the remote. */
  remoteName: string
  /** The name of the branch you want to compare against. */
  targetBranch: string
}): Promise<{
  /**
   * A collection of file paths of files that have changed with respect to the target branch. The
   * paths are relative to the root directory of the repository.
   */
  pathsOfMutatedFiles: string[]
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
    pathsOfMutatedFiles: changedFilePaths,
    shortStat
  }
}

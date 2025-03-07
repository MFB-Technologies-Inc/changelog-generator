// Copyright 2024 MFB Technologies, Inc.

import { exitProcessWithError } from "../utils/process.js"
import {
  ChangeFile,
  ChangeType,
  changeTypeEnum,
  getChangeTypeDescription
} from "../types/changeFile.js"
import { booleanPrompt, selectionPrompt, textPrompt } from "../utils/prompt.js"
import {
  getCompactChangeSummary,
  getCurrentGitBranchName,
  getRemoteName,
  showRemoteOrigin
} from "../services/git.js"
import { getCurrentProjectName } from "../services/npm.js"
import {
  getBranchesChangeFiles,
  isLocalChangeFile,
  readChangeFile,
  saveChangeFile
} from "../services/changeFile.js"

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
  const currentBranchName = await getCurrentGitBranchName()
  const remoteName = await getRemoteName(currentBranchName)
  const headBranchName = await getHeadBranchName(remoteName)
  // assume script is run from the root of the project
  const projectRootDirectory = process.cwd()
  const projectName = await getCurrentProjectName(projectRootDirectory)
  const gitChanges = await getCompactChangeSummary({
    currentBranchName,
    remoteName,
    targetBranch: headBranchName
  })
  const localChangeFileFullPaths = await getBranchesChangeFiles({
    targetBranchName: currentBranchName,
    projectRootDir: projectRootDirectory
  })
  if (gitChanges.pathsOfMutatedFiles.length < 1) {
    console.log(
      `No changes were detected when comparing branch ${currentBranchName} against ${remoteName}/${headBranchName}.`
    )
    return
  }
  // intentionally not checking untracked files for change files, so the user can (if they want)
  // generate duplicate change files.
  const allTrackedChangeFilePaths =
    gitChanges.pathsOfMutatedFiles.filter(isLocalChangeFile)
  const allChangeFilePaths = [
    ...new Set([...localChangeFileFullPaths, ...allTrackedChangeFilePaths])
  ]
  if (args?.verify === true) {
    if (allChangeFilePaths.length < 1) {
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
  if (allChangeFilePaths.length < 1) {
    const changeFileContent = await promptToCreateChangeFile(projectName)
    await saveChangeFile({
      projectRootDir: projectRootDirectory,
      currentBranchName,
      file: changeFileContent
    })
  } else {
    console.log(projectName, "existing change logs:")
    const loadedChangeFiles = await Promise.all(
      allChangeFilePaths.map(readChangeFile)
    )
    console.log(
      loadedChangeFiles.reduce((listOfFormattedChanges, loadedChangeFile) => {
        const listAdditions = loadedChangeFile.changes
          .map(change => {
            return `  - ${change.type}: ${change.comment.length < 1 ? "<no comment>" : change.comment}\n`
          })
          .join("")
        return listOfFormattedChanges + listAdditions
      }, "")
    )
    const changeFileContent =
      await promptToAppendChangeFileToExisting(projectName)
    if (changeFileContent !== undefined) {
      await saveChangeFile({
        projectRootDir: projectRootDirectory,
        currentBranchName,
        file: changeFileContent
      })
    }
  }
}

async function promptToCreateChangeFile(
  projectName: string
): Promise<ChangeFile> {
  const changeMessage = await textPrompt({
    message: "Describe changes or leave blank for no changes:"
  })
  let patch: ChangeType = changeTypeEnum.NONE
  if (changeMessage.trim().length > 0) {
    patch = await selectionPrompt({
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
  }
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

async function promptToAppendChangeFileToExisting(
  projectName: string
): Promise<ChangeFile | undefined> {
  const appendComments = await booleanPrompt({
    message: "Append to existing comments?"
  })
  if (appendComments === true) {
    return promptToCreateChangeFile(projectName)
  }
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

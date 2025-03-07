// Copyright 2024 MFB Technologies, Inc.

import {
  deleteChangeFiles,
  getAllLocalChangeFilePaths,
  readChangeFile
} from "../services/changeFile.js"
import {
  createChangelogJsonFile,
  getChangelogJsonFile,
  saveChangelogJsonFile,
  saveChangelogMarkdownFile
} from "../services/changeLogFile.js"
import { createJsonConverter } from "../services/markdown.js"
import {
  getCurrentProjectName,
  getCurrentProjectVersion,
  setCurrentProjectVersion
} from "../services/npm.js"
import { getSemverString, parseSemver } from "../services/semver.js"
import { changeTypeEnum } from "../types/changeFile.js"
import { ChangeLogEntry, ChangeLogEntryComments } from "../types/changeLog.js"
import { isChangeLogError } from "../utils/changeLogError.js"

/**
 * Combines all of the existing changes files into the change log and consolidates the version bumps
 * in the change files down to a single version, which is used to update the package.json version.
 *
 * If `CHANGELOG.md` and `CHANGELOG.json` files do not exist at the root of your project then they
 * will be created. These files need to be tracked in version control.
 *
 * By default this command will perform a readonly operation. If you want to update the change log
 * files and the project's version (i.e. package.json), then specify `apply`.
 */
export async function publish(args?: {
  /**
   * By default this command will perform a readonly operation. If you want to update the change log
   * files and the project's version (i.e. package.json), then specify this argument.
   */
  apply?: boolean
}): Promise<void> {
  // assume script is run from the root of the project
  const projectRootDirectory = process.cwd()
  const allLocalChangeFilePaths = await getAllLocalChangeFilePaths({
    projectRootDir: projectRootDirectory
  })
  if (allLocalChangeFilePaths.length < 1) {
    console.log("No change files were found. Nothing to do.")
    return
  }
  let currentChangelogJson = await getChangelogJsonFile({
    projectRootDirectory
  })
  if (isChangeLogError(currentChangelogJson)) {
    const projectName = await getCurrentProjectName(projectRootDirectory)
    currentChangelogJson = await createChangelogJsonFile({
      projectName,
      projectRootDirectory
    })
    if (isChangeLogError(currentChangelogJson)) {
      throw currentChangelogJson
    }
  }
  const allComments: ChangeLogEntryComments = {}
  let bumpMajor = false
  let bumpMinor = false
  let bumpPatch = false
  for (let index = 0; index < allLocalChangeFilePaths.length; index++) {
    const localChangeFilePath = allLocalChangeFilePaths[index]
    if (localChangeFilePath === undefined) continue
    const changeFile = await readChangeFile(localChangeFilePath)
    for (let index = 0; index < changeFile.changes.length; index++) {
      const change = changeFile.changes[index]
      if (change === undefined) {
        console.warn("unexpected undefined change entry at index " + index)
        continue
      }
      if (change.type in allComments) {
        allComments[change.type]?.push({ comment: change.comment })
      } else {
        allComments[change.type] = [{ comment: change.comment }]
      }
      switch (change.type) {
        case changeTypeEnum.DEPENDENCY:
        case changeTypeEnum.NONE:
          continue
        case changeTypeEnum.PATCH:
          if (!bumpMajor && !bumpMinor) {
            bumpPatch = true
          }
          break
        case changeTypeEnum.MINOR:
          if (!bumpMajor) {
            bumpMinor = true
            bumpPatch = false
          }
          break
        case changeTypeEnum.MAJOR:
          if (!bumpMajor) {
            bumpMajor = true
            bumpMinor = false
            bumpPatch = false
          }
          break
      }
    }
  }

  const currentVersionStr = await getCurrentProjectVersion(projectRootDirectory)
  const newVersion = parseSemver(currentVersionStr)
  if (newVersion === null) {
    throw new Error("Invalid package version: " + currentVersionStr)
  }
  if (bumpMajor) {
    newVersion.major += 1
    newVersion.minor = 0
    newVersion.patch = 0
  } else if (bumpMinor) {
    newVersion.minor += 1
    newVersion.patch = 0
  } else if (bumpPatch) {
    newVersion.patch += 1
  }

  const newChangeLogEntry: ChangeLogEntry = {
    version: getSemverString(newVersion),
    date: new Date().toUTCString(),
    comments: allComments
  }
  currentChangelogJson.entries = [
    newChangeLogEntry,
    ...currentChangelogJson.entries
  ]

  if (args?.apply === true) {
    await saveChangelogJsonFile({
      projectRootDirectory,
      changeLog: currentChangelogJson
    })
  }

  const initChangelog = [
    {
      h1: "Changelog - " + currentChangelogJson.name,
      p: `This log was last generated on ${newChangeLogEntry.date} and should not be manually modified.`
    }
  ]
  const changeLogEntries = currentChangelogJson.entries.flatMap(entry => {
    const entryComments = Object.entries(entry.comments)
      // sort to get major, minor and then patch changes
      .sort(([changeTypeA], [changeTypeB]) =>
        changeTypeA.localeCompare(changeTypeB)
      )
      .reduce(
        (allEntryComments, commentEntry) => {
          const [changeType, comments] = commentEntry
          if (changeType === changeTypeEnum.NONE) {
            return allEntryComments
          }
          const readableChangeType = capitalizeFirstCharacter(
            changeType.toLocaleLowerCase()
          )
          return allEntryComments.concat([
            {
              h3: readableChangeType + " changes",
              ul: comments.map(comment => comment.comment)
            }
          ])
        },
        [] as { h3: string; ul: string[] }[]
      )
    if (entryComments.length < 1) {
      return [{ h2: entry.version, p: entry.date + "\nVersion update only." }]
    }
    return [{ h2: entry.version, p: entry.date }, ...entryComments]
  })

  const jsonMdChangelog = [...initChangelog, ...changeLogEntries]
  const jsonConverter = createJsonConverter()
  const mdChangelog = jsonConverter.toMarkdown(jsonMdChangelog)

  if (args?.apply !== true) {
    console.log(mdChangelog)
    return
  }

  const markdownChangelogSaveResults = await saveChangelogMarkdownFile({
    projectRootDirectory,
    markdown: mdChangelog
  })
  if (markdownChangelogSaveResults) {
    console.error(markdownChangelogSaveResults)
  }
  const performedVersionBump = bumpMajor || bumpMinor || bumpPatch
  if (!performedVersionBump) {
    return
  }
  await setCurrentProjectVersion({
    projectRootDir: projectRootDirectory,
    newSemVer: getSemverString(newVersion)
  })
  await deleteChangeFiles({ changeFilePaths: allLocalChangeFilePaths })
}

function capitalizeFirstCharacter(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

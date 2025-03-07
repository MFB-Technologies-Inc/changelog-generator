// Copyright 2024 MFB Technologies, Inc.

import path from "path"
import { ChangeType, changeTypeEnum } from "./types/changeFile.js"

export const newlineRegex = new RegExp(/\n/)

export const singleSpaceChar = " "

/** Readable descriptions of each {@link changeTypeEnum}. */
export const ChangeTypeDescription: {
  [Property in ChangeType]: string
} = {
  [changeTypeEnum.MAJOR]:
    "Indicates that these changes are incompatible API changes.",
  [changeTypeEnum.MINOR]:
    "Indicates that these changes add functionality in a backwards compatible manner.",
  [changeTypeEnum.PATCH]:
    "Indicates that these changes fix bugs in a backwards compatible manner.",
  [changeTypeEnum.NONE]:
    "Indicates that these changes make changes to the source code that do not effect the user (e.g. change eslint rules, change a readme file, ...).",
  /*
    auto generated and added to the change log json.

    e.g. "Updating dependency \"align-matters\" to `2.0.1`"

    this probably does not make sense to add because there isn't an api command for updating package versions (e.g., `rush upgrade`)
    */
  [changeTypeEnum.DEPENDENCY]: "Information about package dependency changes."
}

/** Readable names of each {@link changeTypeEnum}. */
export const ChangeTypeString: {
  [Property in ChangeType]: string
} = {
  [changeTypeEnum.MAJOR]: "Major",
  [changeTypeEnum.MINOR]: "Minor",
  [changeTypeEnum.PATCH]: "Patch",
  [changeTypeEnum.NONE]: "None",
  [changeTypeEnum.DEPENDENCY]: "Dependency"
}

/** Readable name of the change command. */
export const ChangeCommandName = "change"

/** Readable description of the change command. */
export const ChangeCommandDescription =
  "Generates a change file if a change is detected."

/** Readable flags of each option in the change command. */
export const ChangeCommandOptionFlag = {
  verify: "-v, --verify"
}

/** Readable descriptions of each option in the change command. */
export const ChangeCommandOptionDescription: {
  [Property in keyof typeof ChangeCommandOptionFlag]: string
} = {
  verify: "Verify the change file has been generated and is valid."
}

export const changeFileDirectoryRoot = "changes" + path.sep

/** Readable name of the publish command. */
export const PublishCommandName = "publish"

/** Readable description of the publish command. */
export const PublishCommandDescription =
  "Combines all of the existing changes files into the change log and consolidates the version bumps in the change files down to a single version"

/** Readable flags of each option in the publish command. */
export const PublishCommandOptionFlag = {
  apply: "-a, --apply"
}

/** Readable descriptions of each option in the publish command. */
export const PublishCommandOptionDescription: {
  [Property in keyof typeof PublishCommandOptionFlag]: string
} = {
  apply:
    "By default this command will perform a readonly operation. If you want to update the change log files and the project's version (i.e. package.json), then specify this argument."
}

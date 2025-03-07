// Copyright 2024 MFB Technologies, Inc.

import { Change, changeTypeEnum } from "../types/changeFile.js"

export function getDefaultChange(packageName: string): Change {
  return {
    comment: "",
    packageName: packageName,
    type: changeTypeEnum.NONE
  }
}

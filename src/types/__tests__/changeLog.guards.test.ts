// Copyright 2025 MFB Technologies, Inc.

import { changeTypeEnum } from "../changeFile"
import { isChangeLog, isChangeLogEntryComments } from "../changeLog.guards"

describe(isChangeLogEntryComments.name, () => {
  it("returns true for a valid changelog entry's comments", () => {
    const data = {
      [changeTypeEnum.NONE]: [
        {
          comment: "none"
        }
      ],
      [changeTypeEnum.PATCH]: [
        {
          comment: "patch"
        }
      ]
    }
    expect(isChangeLogEntryComments(data)).toBe(true)
  })
})

describe(isChangeLog.name, () => {
  it("returns true for a valid changelog", () => {
    const data = {
      name: "@mfbtech/changelog-generator",
      entries: [
        {
          version: "1.0.13",
          date: "Sat, 11 Jan 2025 15:29:31 GMT",
          comments: {
            NONE: [
              {
                comment: "none"
              }
            ],
            PATCH: [
              {
                comment: "patch"
              }
            ]
          }
        }
      ]
    }
    expect(isChangeLog(data)).toBe(true)
  })
})

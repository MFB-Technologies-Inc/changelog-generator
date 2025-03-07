// Copyright 2024 MFB Technologies, Inc.

import { changeTypeEnum } from "../../types/changeFile"
import { getDefaultChange } from "../change"

describe(getDefaultChange.name, () => {
  it("returns the comment as an empty string", () => {
    expect(getDefaultChange("foo")).toEqual(
      expect.objectContaining({
        comment: ""
      })
    )
  })

  it(`returns the type as ${changeTypeEnum.NONE}`, () => {
    expect(getDefaultChange("foo")).toEqual(
      expect.objectContaining({
        type: changeTypeEnum.NONE
      })
    )
  })

  it("returns the expected package name", () => {
    const expectedPackageName = "foo"

    expect(getDefaultChange(expectedPackageName)).toEqual(
      expect.objectContaining({
        packageName: expectedPackageName
      })
    )
  })
})

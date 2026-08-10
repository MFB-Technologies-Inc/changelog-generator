// Copyright 2024 MFB Technologies, Inc.

import * as nodeFs from "fs"
import * as nodeAsyncFs from "node:fs/promises"
import os from "os"
import path from "path"

import { readJson, writeJson } from "../fileSystem"

describe(writeJson.name, () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await nodeAsyncFs.mkdtemp(
      path.join(os.tmpdir(), "ccg-filesystem-test-")
    )
  })

  afterEach(async () => {
    await nodeAsyncFs.rm(tempDir, { recursive: true, force: true })
  })

  const fileName = "example.json"
  const data = { name: "@scope/package", version: "1.2.3" }

  function readRaw(): string {
    return nodeFs.readFileSync(path.join(tempDir, fileName), {
      encoding: "utf-8"
    })
  }

  it("terminates the file with a newline", async () => {
    await writeJson({ path: tempDir, fileName, data })

    expect(readRaw().endsWith("\n")).toBe(true)
  })

  it("terminates the file with exactly one newline", async () => {
    await writeJson({ path: tempDir, fileName, data })

    expect(readRaw()).not.toMatch(/\n\n$/)
  })

  it("writes the data indented with two spaces", async () => {
    await writeJson({ path: tempDir, fileName, data })

    expect(readRaw()).toBe(`${JSON.stringify(data, null, 2)}\n`)
  })

  it("writes JSON that reads back as the original data", async () => {
    await writeJson({ path: tempDir, fileName, data })

    await expect(readJson(path.join(tempDir, fileName))).resolves.toEqual(data)
  })

  it("creates the directory when it does not exist", async () => {
    const nestedDir = path.join(tempDir, "nested", "deeper")

    await writeJson({ path: nestedDir, fileName, data })

    expect(
      nodeFs.readFileSync(path.join(nestedDir, fileName), {
        encoding: "utf-8"
      })
    ).toBe(`${JSON.stringify(data, null, 2)}\n`)
  })

  it("overwrites an existing file without appending to it", async () => {
    await writeJson({ path: tempDir, fileName, data })
    await writeJson({ path: tempDir, fileName, data: { name: "other" } })

    expect(readRaw()).toBe(`${JSON.stringify({ name: "other" }, null, 2)}\n`)
  })
})

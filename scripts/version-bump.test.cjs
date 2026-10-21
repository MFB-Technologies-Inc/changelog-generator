const { test } = require("node:test")
const assert = require("node:assert/strict")
const { checkDuplicateBump } = require("./version-bump.cjs")

test("duplicate preflight blocks open release PRs and leftover remote branches", () => {
  const repository = "owner/repo"
  const pull = {
    head: { ref: "release/v1.0.3", repo: { full_name: repository } }
  }
  const run =
    (pulls, branches = "") =>
    command =>
      command === "gh" ? JSON.stringify([pulls]) : branches
  assert.throws(
    () => checkDuplicateBump(run([pull]), repository),
    /already open/
  )
  assert.throws(
    () =>
      checkDuplicateBump(run([], "sha refs/heads/release/v1.0.3"), repository),
    /branch already exists/
  )
  assert.doesNotThrow(() => checkDuplicateBump(run([]), repository))
  assert.doesNotThrow(() =>
    checkDuplicateBump(
      run([{ head: { ...pull.head, repo: { full_name: "fork/repo" } } }]),
      repository
    )
  )
  assert.throws(
    () =>
      checkDuplicateBump(() => {
        throw new Error("API unavailable")
      }, repository),
    /API unavailable/
  )
})

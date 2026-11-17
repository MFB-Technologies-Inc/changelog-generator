const { test } = require("node:test")
const assert = require("node:assert/strict")
const PACKAGE_NAME = "@mfbtech/changelog-generator"
const {
  integrity,
  registryIntegrity,
  publishArtifact,
  VERIFY_WINDOW_MS,
  VERIFY_FIRST_DELAY_MS,
  VERIFY_MAX_DELAY_MS
} = require("./publish.cjs")

// The verification wait schedule, derived from the exported constants: the
// delay doubles from the first delay up to the cap, and the last wait is cut
// so the waits add up to exactly the window.
function expectedDelays() {
  for (const value of [
    VERIFY_WINDOW_MS,
    VERIFY_FIRST_DELAY_MS,
    VERIFY_MAX_DELAY_MS
  ]) {
    assert.ok(
      Number.isInteger(value) && value > 0,
      "publish.cjs must export the verification window constants"
    )
  }
  const delays = []
  let waited = 0
  let delayMs = VERIFY_FIRST_DELAY_MS
  while (waited < VERIFY_WINDOW_MS) {
    const ms = Math.min(delayMs, VERIFY_WINDOW_MS - waited)
    delays.push(ms)
    waited += ms
    delayMs = Math.min(delayMs * 2, VERIFY_MAX_DELAY_MS)
  }
  return delays
}

function publication(options = {}) {
  const calls = []
  let existing = options.existing ?? null
  const digest = integrity(Buffer.from("release tarball"))
  return {
    calls,
    args: {
      digest,
      lookup: async () => {
        calls.push("lookup")
        if (options.lookupFails) throw new Error("network")
        return existing
      },
      upload: async () => {
        calls.push("upload")
        if (options.uploadFails) throw new Error("upload")
      },
      publish: async () => {
        calls.push("publish")
        if (options.publishFails) throw new Error("publish")
        existing = digest
      },
      finalize: async () => {
        calls.push("finalize")
        if (options.finalizeFails) throw new Error("finalize")
      }
    }
  }
}

test("uploads the artifact before npm and finalizes only after verifying npm integrity", async () => {
  const { calls, args } = publication()
  await publishArtifact(args)
  assert.deepEqual(calls, ["lookup", "upload", "publish", "lookup", "finalize"])
})

test("publication failures leave GitHub unpublished", async () => {
  for (const flag of ["lookupFails", "uploadFails", "publishFails"]) {
    const { calls, args } = publication({ [flag]: true })
    await assert.rejects(publishArtifact(args))
    assert.ok(!calls.includes("finalize"))
    if (flag !== "publishFails") assert.ok(!calls.includes("publish"))
  }
})

test("recovery after GitHub finalization failure skips an existing npm version", async () => {
  const first = publication({ finalizeFails: true })
  await assert.rejects(publishArtifact(first.args), /finalize/)
  const retry = publication({ existing: first.args.digest })
  await publishArtifact(retry.args)
  assert.deepEqual(retry.calls, ["lookup", "upload", "lookup", "finalize"])
})

test("conflicting npm integrity blocks any release mutation", async () => {
  const { calls, args } = publication({
    existing: integrity(Buffer.from("another artifact"))
  })
  await assert.rejects(publishArtifact(args), /different artifact integrity/)
  assert.deepEqual(calls, ["lookup"])
})

function delayedPublication(results) {
  const fixture = publication()
  fixture.args.lookup = async () => {
    fixture.calls.push("lookup")
    assert.ok(results.length, "unexpected registry lookup")
    const result = results.shift()
    if (result instanceof Error) throw result
    return result === "match" ? fixture.args.digest : result
  }
  fixture.waits = []
  fixture.args.wait = async ms => {
    fixture.waits.push(ms)
    fixture.calls.push("wait")
  }
  return fixture
}

test("registry propagation retries verification without repeating publication", async () => {
  const { calls, waits, args } = delayedPublication([
    null,
    null,
    null,
    null,
    "match"
  ])
  await publishArtifact(args)
  assert.deepEqual(calls, [
    "lookup",
    "upload",
    "publish",
    "lookup",
    "wait",
    "lookup",
    "wait",
    "lookup",
    "wait",
    "lookup",
    "finalize"
  ])
  assert.deepEqual(waits, [15000, 30000, 60000])
})

test("verification backs off within a window of at least 10 minutes", async () => {
  const delays = expectedDelays()
  assert.ok(VERIFY_WINDOW_MS >= 10 * 60 * 1000)
  assert.equal(delays[0], VERIFY_FIRST_DELAY_MS)
  assert.ok(delays.every(ms => ms <= VERIFY_MAX_DELAY_MS))
  for (let i = 1; i < delays.length - 1; i++)
    assert.ok(delays[i] >= delays[i - 1], "delays never shrink before the last")
  assert.equal(
    delays.reduce((sum, ms) => sum + ms, 0),
    VERIFY_WINDOW_MS
  )
  const { waits, args } = delayedPublication(
    Array(delays.length + 2).fill(null)
  )
  await assert.rejects(publishArtifact(args), /timed out/)
  assert.deepEqual(waits, delays)
})

test("an absent version exhausts the window and reports retry instructions", async () => {
  const delays = expectedDelays()
  // One lookup before publishing, then one after each wait plus a final one.
  const { calls, waits, args } = delayedPublication(
    Array(delays.length + 2).fill(null)
  )
  await assert.rejects(
    publishArtifact(args),
    /verification timed out after 15 minutes.*Rerun the publish workflow for the existing version tag/
  )
  assert.equal(
    calls.filter(call => call === "lookup").length,
    delays.length + 2
  )
  assert.deepEqual(waits, delays)
  assert.equal(calls.filter(call => call === "publish").length, 1)
  assert.equal(calls.filter(call => call === "upload").length, 1)
  assert.equal(calls.at(-1), "lookup")
  assert.ok(!calls.includes("finalize"))
})

test("a version that appears at the end of the window finalizes the release", async () => {
  const delays = expectedDelays()
  const { calls, waits, args } = delayedPublication([
    ...Array(delays.length + 1).fill(null),
    "match"
  ])
  await publishArtifact(args)
  assert.deepEqual(waits, delays)
  assert.equal(calls.filter(call => call === "publish").length, 1)
  assert.equal(calls.filter(call => call === "upload").length, 1)
  assert.equal(calls.at(-1), "finalize")
})

test("post-publication integrity mismatch fails immediately, including after propagation", async () => {
  for (const missing of [[], [null]]) {
    const { calls, args } = delayedPublication([
      null,
      ...missing,
      "sha512-other"
    ])
    await assert.rejects(publishArtifact(args), /does not match/)
    assert.equal(calls.filter(call => call === "wait").length, missing.length)
    assert.equal(calls.at(-1), "lookup")
    assert.ok(!calls.includes("finalize"))
  }
})

test("post-publication registry errors are preserved without retrying", async () => {
  for (const message of [
    "network",
    "npm registry lookup failed: HTTP 403",
    "npm returned invalid package metadata."
  ]) {
    const error = new Error(message)
    const { calls, args } = delayedPublication([null, error])
    await assert.rejects(publishArtifact(args), error)
    assert.deepEqual(calls, ["lookup", "upload", "publish", "lookup"])
  }
})

test("recovery also waits for a temporarily absent matching npm version without republishing", async () => {
  const { calls, waits, args } = delayedPublication(["match", null, "match"])
  await publishArtifact(args)
  assert.deepEqual(waits, [VERIFY_FIRST_DELAY_MS])
  assert.deepEqual(calls, [
    "lookup",
    "upload",
    "lookup",
    "wait",
    "lookup",
    "finalize"
  ])
})

test("registry lookup only treats HTTP 404 as an absent version", async () => {
  assert.equal(
    await registryIntegrity("2.2.3", async () => ({ status: 404 })),
    null
  )
  for (const status of [401, 403, 429, 500]) {
    await assert.rejects(
      registryIntegrity("2.2.3", async () => ({ status, ok: false })),
      /lookup failed/
    )
  }
  await assert.rejects(
    registryIntegrity("2.2.3", async () => {
      throw new Error("network")
    }),
    /network/
  )
  await assert.rejects(
    registryIntegrity("2.2.3", async () => ({
      ok: true,
      json: async () => ({})
    })),
    /invalid package/
  )
  assert.equal(
    await registryIntegrity("2.2.3", async (url, options) => {
      assert.equal(
        url,
        "https://registry.npmjs.org/%40mfbtech%2Fchangelog-generator/2.2.3"
      )
      assert.equal(options?.headers?.["Cache-Control"], "no-cache")
      assert.equal(options?.cache, "no-store")
      return {
        ok: true,
        json: async () => ({
          name: PACKAGE_NAME,
          version: "2.2.3",
          dist: { integrity: "sha512-test" }
        })
      }
    }),
    "sha512-test"
  )
})

test("draft recovery preserves identical bytes and rejects replacement or unexpected assets", () => {
  const fs = require("node:fs")
  const os = require("node:os")
  const path = require("node:path")
  const { verifyDraftArtifact } = require("./publish.cjs")
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "draft-test-"))
  const filename = "release.tgz"
  const artifact = path.join(directory, filename)
  fs.writeFileSync(artifact, "original tarball")
  const download = contents => (command, args) => {
    assert.equal(command, "gh")
    assert.deepEqual(args.slice(0, 3), ["release", "download", "v1.0.0"])
    fs.writeFileSync(
      path.join(args[args.indexOf("--dir") + 1], filename),
      contents
    )
  }
  try {
    assert.equal(
      verifyDraftArtifact(
        artifact,
        [{ name: filename }],
        "v1.0.0",
        download("original tarball")
      ),
      integrity(Buffer.from("original tarball"))
    )
    assert.throws(
      () =>
        verifyDraftArtifact(
          artifact,
          [{ name: filename }],
          "v1.0.0",
          download("conflicting tarball")
        ),
      /differs/
    )
    assert.equal(fs.readFileSync(artifact, "utf8"), "original tarball")
    assert.throws(
      () => verifyDraftArtifact(artifact, [{ name: "other.tgz" }], "v1.0.0"),
      /Unexpected/
    )
    assert.throws(
      () =>
        verifyDraftArtifact(
          artifact,
          [{ name: filename }, { name: filename }],
          "v1.0.0"
        ),
      /Unexpected/
    )
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

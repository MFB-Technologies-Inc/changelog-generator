const { test } = require("node:test")
const assert = require("node:assert/strict")
const PACKAGE_NAME = "@mfbtech/changelog-generator"
const {
  integrity,
  registryIntegrity,
  publishArtifact
} = require("./publish.cjs")

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
  fixture.args.wait = async ms => {
    assert.equal(ms, 15000)
    fixture.calls.push("wait")
  }
  return fixture
}

test("registry propagation retries verification without repeating publication", async () => {
  const { calls, args } = delayedPublication([null, null, null, "match"])
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
    "finalize"
  ])
})

test("an absent version exhausts the budget and reports retry instructions", async () => {
  const { calls, args } = delayedPublication(Array(11).fill(null))
  await assert.rejects(
    publishArtifact(args),
    /verification timed out after 10 lookups.*Rerun the publish workflow for the existing version tag/
  )
  assert.equal(calls.filter(call => call === "lookup").length, 11)
  assert.equal(calls.filter(call => call === "wait").length, 9)
  assert.equal(calls.filter(call => call === "publish").length, 1)
  assert.equal(calls.filter(call => call === "upload").length, 1)
  assert.equal(calls.at(-1), "lookup")
  assert.ok(!calls.includes("finalize"))
})

test("the final permitted lookup can still finalize the release", async () => {
  const { calls, args } = delayedPublication([...Array(10).fill(null), "match"])
  await publishArtifact(args)
  assert.equal(calls.filter(call => call === "wait").length, 9)
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
  const { calls, args } = delayedPublication(["match", null, "match"])
  await publishArtifact(args)
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
    await registryIntegrity("2.2.3", async url => {
      assert.equal(
        url,
        "https://registry.npmjs.org/%40mfbtech%2Fchangelog-generator/2.2.3"
      )
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

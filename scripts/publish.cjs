const fs = require("node:fs")
const path = require("node:path")
const os = require("node:os")
const { createHash } = require("node:crypto")
const { execFileSync } = require("node:child_process")
const { setTimeout: delay } = require("node:timers/promises")
const PACKAGE_NAME = "@mfbtech/changelog-generator"
const run = (command, args) =>
  execFileSync(command, args, { encoding: "utf8" }).trim()
const getReleases = () =>
  JSON.parse(
    run("gh", ["api", "--paginate", "--slurp", "repos/{owner}/{repo}/releases"])
  ).flat()

const REGISTRY = "https://registry.npmjs.org"
const integrity = bytes =>
  "sha512-" + createHash("sha512").update(bytes).digest("base64")

async function registryIntegrity(version, request = fetch) {
  const response = await request(
    `${REGISTRY}/${encodeURIComponent(PACKAGE_NAME)}/${version}`,
    {
      signal: AbortSignal.timeout(30000)
    }
  )
  if (response.status === 404) return null
  if (!response.ok)
    throw new Error(`npm registry lookup failed: HTTP ${response.status}`)
  const metadata = await response.json()
  if (
    metadata.name !== PACKAGE_NAME ||
    metadata.version !== version ||
    !metadata.dist?.integrity
  ) {
    throw new Error("npm returned invalid package metadata.")
  }
  return metadata.dist.integrity
}

// Keep the publication sequence injectable so failures can be tested without publishing.
async function publishArtifact({
  digest,
  lookup,
  upload,
  publish,
  finalize,
  wait = delay
}) {
  const existing = await lookup()
  if (existing && existing !== digest)
    throw new Error("Existing npm version has different artifact integrity.")
  await upload()
  if (!existing) await publish()
  const attempts = 10
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const published = await lookup()
    if (published === digest) {
      await finalize()
      return
    }
    if (published !== null)
      throw new Error(
        "Published npm integrity does not match the release artifact."
      )
    if (attempt < attempts) await wait(15000)
  }
  throw new Error(
    "npm verification timed out after 10 lookups: the published version is still unavailable. " +
      "Rerun the publish workflow for the existing version tag after registry propagation."
  )
}

function verifyDraftArtifact(artifact, assets, tag, command = run) {
  const filename = path.basename(artifact)
  const digest = integrity(fs.readFileSync(artifact))
  if (assets.some(asset => asset.name !== filename) || assets.length > 1)
    throw new Error("Unexpected draft release artifacts.")
  if (assets.length) {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), "release-artifact-")
    )
    try {
      command("gh", [
        "release",
        "download",
        tag,
        "--pattern",
        filename,
        "--dir",
        directory
      ])
      const original = fs.readFileSync(path.join(directory, filename))
      if (integrity(original) !== digest)
        throw new Error(
          "Rebuilt artifact differs from the existing draft. Refusing to replace it."
        )
      fs.writeFileSync(artifact, original)
    } finally {
      fs.rmSync(directory, { recursive: true, force: true })
    }
  }
  return digest
}

async function main() {
  const { name, version } = JSON.parse(fs.readFileSync("package.json", "utf8"))
  const tag = process.env.RELEASE_TAG
  if (
    name !== PACKAGE_NAME ||
    !/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.test(version) ||
    tag !== "v" + version
  ) {
    throw new Error("Invalid package/tag for publication.")
  }
  const filename = `mfbtech-changelog-generator-${version}.tgz`
  const packed = fs.readdirSync("packed").filter(file => file.endsWith(".tgz"))
  if (packed.length !== 1 || packed[0] !== filename)
    throw new Error("Expected exactly one matching package tarball.")
  const artifact = path.resolve("packed", filename)
  const digest = integrity(fs.readFileSync(artifact))
  const release = getReleases().find(item => item.tag_name === tag)
  if (release && !release.draft)
    throw new Error("GitHub release is already public; refusing to modify it.")
  const assets =
    release?.assets.filter(asset => asset.name.endsWith(".tgz")) ?? []
  verifyDraftArtifact(artifact, assets, tag)
  await publishArtifact({
    digest,
    lookup: () => registryIntegrity(version),
    upload: async () => {
      if (!release) {
        run("gh", [
          "release",
          "create",
          tag,
          artifact,
          "--verify-tag",
          "--draft",
          "--title",
          tag,
          "--notes-file",
          path.join(process.env.RUNNER_TEMP, "release-notes.md")
        ])
      } else {
        if (!assets.length) run("gh", ["release", "upload", tag, artifact])
        run("gh", [
          "release",
          "edit",
          tag,
          "--notes-file",
          path.join(process.env.RUNNER_TEMP, "release-notes.md")
        ])
      }
    },
    publish: async () =>
      run("npm", [
        "publish",
        artifact,
        "--access",
        "public",
        "--ignore-scripts",
        "--registry",
        REGISTRY
      ]),
    finalize: async () =>
      run("gh", ["release", "edit", tag, "--draft=false", "--latest"])
  })
}

module.exports = {
  integrity,
  registryIntegrity,
  publishArtifact,
  verifyDraftArtifact
}
if (require.main === module)
  main().catch(error => {
    console.error(error)
    process.exitCode = 1
  })

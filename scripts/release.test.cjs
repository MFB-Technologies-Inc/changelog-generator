const { test } = require("node:test")
const assert = require("node:assert/strict")
const {
  validateMetadata,
  releaseNotes,
  createTag,
  validateTag
} = require("./release.cjs")

const entry = version => ({
  version,
  date: "today",
  comments: {
    PATCH: [{ comment: "Fix for " + version }],
    NONE: [{ comment: "internal" }]
  }
})
const changelog = { entries: ["1.0.3", "1.0.2", "1.0.1"].map(entry) }
const lock = { version: "1.0.3", packages: { "": { version: "1.0.3" } } }

test("requires matching valid release metadata", () => {
  assert.doesNotThrow(() => validateMetadata("1.0.3", changelog, lock))
  assert.throws(() => validateMetadata("invalid", changelog, lock))
  assert.throws(() => validateMetadata("1.0.2", changelog, lock))
  assert.throws(() =>
    validateMetadata("1.0.3", changelog, { ...lock, version: "1.0.2" })
  )
})

test("includes all bumps after the previous release, excluding published and internal notes", () => {
  const notes = releaseNotes(changelog, "1.0.3", "1.0.1")
  assert.match(notes, /Fix for 1.0.3/)
  assert.match(notes, /Fix for 1.0.2/)
  assert.doesNotMatch(notes, /1.0.1|internal/)
})
test("first release includes all history", () => {
  assert.match(releaseNotes(changelog, "1.0.3"), /Fix for 1.0.1/)
})
test("rejects missing, invalid and newer release boundaries", () => {
  for (const previous of ["0.9.0", "bad", "1.0.3", "2.0.0"]) {
    assert.throws(() => releaseNotes(changelog, "1.0.3", previous))
  }
})

test("tags a merged bump once and validates tags after later commits", () => {
  const fs = require("node:fs")
  const os = require("node:os")
  const path = require("node:path")
  const { execFileSync } = require("node:child_process")
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "release-tag-"))
  const git = (...args) =>
    execFileSync("git", args, {
      cwd: dir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }).trim()
  const writeVersion = version =>
    fs.writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify({ version })
    )
  try {
    git("init", "-b", "main")
    git("config", "user.name", "Test")
    git("config", "user.email", "test@example.com")
    git("init", "--bare", "remote.git")
    git("remote", "add", "origin", path.join(dir, "remote.git"))
    writeVersion("1.0.2")
    git("add", "package.json")
    git("commit", "-m", "Initial")
    git("switch", "-c", "release/v1.0.3")
    writeVersion("1.0.3")
    git("commit", "-am", "Any bump message")
    assert.throws(
      () => createTag(git, "1.0.3", "release/v1.0.3"),
      /two-parent merge commit/
    )
    git("switch", "main")
    git("merge", "--no-ff", "release/v1.0.3", "-m", "Any merge message")
    const merged = git("rev-parse", "HEAD")
    assert.throws(() => createTag(git, "1.0.3", "release/v1.0.4"))
    assert.throws(() => createTag(git, "1.0.2", "release/v1.0.2"))
    assert.throws(
      () =>
        createTag(
          (...args) =>
            args[0] === "show" && args[1] === "HEAD^2:package.json"
              ? JSON.stringify({ version: "1.0.4" })
              : git(...args),
          "1.0.3",
          "release/v1.0.3"
        ),
      /branch version/
    )
    createTag(git, "1.0.3", "release/v1.0.3")
    const original = git("rev-parse", "refs/tags/v1.0.3")
    const calls = []
    createTag(
      (...args) => {
        calls.push(args[0])
        return git(...args)
      },
      "1.0.3",
      "release/v1.0.3"
    )
    assert.equal(git("rev-parse", "refs/tags/v1.0.3"), original)
    assert.equal(calls.includes("push"), false)
    git("commit", "--allow-empty", "-m", "Later work")
    git("push", "origin", "main")
    assert.throws(() => validateTag(git, "v1.0.3", "1.0.3", "main"))
    git("checkout", "--detach", "v1.0.3")
    validateTag(git, "v1.0.3", "1.0.3", "main")
    assert.throws(() => validateTag(git, "v1.0.4", "1.0.3", "main"))
    assert.throws(() => validateTag(git, "v9.0.0", "9.0.0", "main"))
    git("checkout", "-b", "unmerged")
    writeVersion("1.0.4")
    git("commit", "-am", "Unmerged bump")
    git("tag", "v1.0.4")
    assert.throws(() => validateTag(git, "v1.0.4", "1.0.4", "main"))
    git("checkout", "--detach", merged)
    git("tag", "-f", "v1.0.3", "HEAD^1")
    assert.throws(() => createTag(git, "1.0.3", "release/v1.0.3"))
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test("rejects unsupported parent counts and non-increasing versions before tagging", () => {
  const run =
    (parents, previous = "1.0.2") =>
    (...args) => {
      if (args[0] === "rev-list") return parents
      if (args[0] === "show")
        return JSON.stringify({
          version: args[1] === "HEAD^1:package.json" ? previous : "1.0.3"
        })
      assert.fail("Validation must stop before tag creation: " + args.join(" "))
    }
  for (const parents of ["head", "head parent", "head first second third"])
    assert.throws(
      () => createTag(run(parents), "1.0.3", "release/v1.0.3"),
      /two-parent merge commit/
    )
  for (const previous of ["1.0.3", "1.0.4"])
    assert.throws(
      () =>
        createTag(
          run("head first second", previous),
          "1.0.3",
          "release/v1.0.3"
        ),
      /must increase/
    )
})

test("completed release validates the tag and exits without generating notes", () => {
  const fs = require("node:fs")
  const path = require("node:path")
  const vm = require("node:vm")
  const source = fs.readFileSync(path.join(__dirname, "release.cjs"), "utf8")
  const execute = (checkout = "release-commit") => {
    const calls = []
    const outputs = []
    const module = { exports: {} }
    const fakeRequire = name => {
      if (name === "node:fs")
        return {
          readFileSync: file =>
            JSON.stringify(
              {
                "package.json": { version: "1.0.3" },
                "CHANGELOG.json": changelog,
                "package-lock.json": lock
              }[file]
            ),
          appendFileSync: (file, value) => outputs.push([file, value]),
          writeFileSync: () =>
            assert.fail("Completed releases must not regenerate notes")
        }
      if (name === "node:child_process")
        return {
          execFileSync: (command, args) => {
            calls.push([command, ...args])
            if (command === "gh")
              return JSON.stringify([
                [
                  {
                    tag_name: "v1.0.3",
                    draft: false,
                    prerelease: false
                  }
                ]
              ])
            if (args[0] === "rev-parse")
              return args[1] === "HEAD" ? checkout : "release-commit"
            if (args[0] === "merge-base") return ""
            assert.fail("Unexpected command: " + args.join(" "))
          }
        }
      return require(name)
    }
    fakeRequire.main = module
    vm.runInNewContext(source, {
      require: fakeRequire,
      module,
      process: {
        argv: ["node", "release.cjs"],
        env: {
          RELEASE_TAG: "v1.0.3",
          DEFAULT_BRANCH: "main",
          GITHUB_OUTPUT: "output"
        }
      }
    })
    assert.deepEqual(outputs, [["output", "completed=true\n"]])
    assert.equal(calls.at(-1)[0], "gh")
    assert.ok(calls.some(call => call[1] === "merge-base"))
  }
  execute()
  assert.throws(() => execute("wrong-commit"), /Checkout must match/)
})

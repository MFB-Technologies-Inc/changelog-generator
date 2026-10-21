const fs = require("node:fs")
const path = require("node:path")
const { execFileSync } = require("node:child_process")
const semver = require("semver")

function validateMetadata(version, changelog, lock) {
  if (!semver.valid(version)) throw new Error("Invalid package version.")
  if (
    changelog.entries[0]?.version !== version ||
    lock.version !== version ||
    lock.packages[""].version !== version
  ) {
    throw new Error(
      "Package, lockfile, and newest changelog versions must agree."
    )
  }
}

function releaseNotes(changelog, version, previous) {
  if (previous && (!semver.valid(previous) || !semver.lt(previous, version))) {
    throw new Error(
      "The previous release must be older than the package version."
    )
  }
  if (
    previous &&
    !changelog.entries.some(entry => entry.version === previous)
  ) {
    throw new Error("Previous release is missing from CHANGELOG.json.")
  }
  const entries = changelog.entries.filter(
    entry =>
      semver.lte(entry.version, version) &&
      (!previous || semver.gt(entry.version, previous))
  )
  if (!entries.length) throw new Error("No unreleased changelog entries.")
  return (
    entries
      .map(entry => {
        const sections = Object.entries(entry.comments)
          .filter(([type]) => type !== "NONE")
          .map(
            ([type, comments]) =>
              "### " +
              type +
              " changes\n\n" +
              comments.map(({ comment }) => "- " + comment).join("\n")
          )
        return (
          "## " +
          entry.version +
          "\n\n" +
          entry.date +
          "\n\n" +
          (sections.join("\n\n") || "Version update only.")
        )
      })
      .join("\n\n") + "\n"
  )
}

function createTag(git, version, branch) {
  if (branch !== "release/v" + version)
    throw new Error("Version bump branch does not match package version.")
  const parents = git("rev-list", "--parents", "-n", "1", "HEAD").split(/\s+/)
  if (parents.length !== 3)
    throw new Error(
      "Release requires a two-parent merge commit; squash and rebase merges are unsupported."
    )
  if (JSON.parse(git("show", "HEAD^2:package.json")).version !== version)
    throw new Error(
      "Merged release branch version must match the package version."
    )
  const previous = JSON.parse(git("show", "HEAD^1:package.json")).version
  if (!semver.gt(version, previous))
    throw new Error("Merged PR must increase the package version.")
  const tag = "v" + version
  const ref = "refs/tags/" + tag
  if (git("tag", "--list", tag)) {
    if (git("rev-parse", ref + "^{commit}") !== git("rev-parse", "HEAD")) {
      throw new Error(
        "Existing tag points to a different commit; tags must never move."
      )
    }
    return
  }
  git("tag", "-a", tag, "-m", tag)
  git("push", "origin", ref)
}

function validateTag(git, tag, version, defaultBranch) {
  if (tag !== "v" + version)
    throw new Error("Tag must match the package version.")
  if (
    git("rev-parse", "refs/tags/" + tag + "^{commit}") !==
    git("rev-parse", "HEAD")
  ) {
    throw new Error("Checkout must match the existing release tag.")
  }
  git(
    "merge-base",
    "--is-ancestor",
    "HEAD",
    "refs/remotes/origin/" + defaultBranch
  )
}

function main() {
  const git = (...args) =>
    execFileSync("git", args, { encoding: "utf8" }).trim()
  const read = file => JSON.parse(fs.readFileSync(file, "utf8"))
  const { version } = read("package.json")
  const changelog = read("CHANGELOG.json")
  validateMetadata(version, changelog, read("package-lock.json"))
  if (process.argv[2] === "tag") {
    git(
      "merge-base",
      "--is-ancestor",
      "HEAD",
      "refs/remotes/origin/" + process.env.DEFAULT_BRANCH
    )
    createTag(git, version, process.env.BUMP_BRANCH)
    return
  }
  const tag = process.env.RELEASE_TAG
  validateTag(git, tag, version, process.env.DEFAULT_BRANCH)
  const pages = JSON.parse(
    execFileSync(
      "gh",
      ["api", "--paginate", "--slurp", "repos/{owner}/{repo}/releases"],
      { encoding: "utf8" }
    )
  )
  const releases = pages
    .flat()
    .filter(release => !release.draft && !release.prerelease)
  if (releases.some(release => release.tag_name === tag)) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, "completed=true\n")
    return
  }
  releases.sort((a, b) => b.published_at.localeCompare(a.published_at))
  const previousTag = releases[0]?.tag_name
  if (previousTag) git("merge-base", "--is-ancestor", previousTag, "HEAD")
  const notes = releaseNotes(changelog, version, previousTag?.replace(/^v/, ""))
  fs.writeFileSync(
    path.join(process.env.RUNNER_TEMP, "release-notes.md"),
    notes
  )
  fs.appendFileSync(process.env.GITHUB_OUTPUT, "tag=" + tag + "\n")
}

module.exports = { validateMetadata, releaseNotes, createTag, validateTag }
if (require.main === module) main()

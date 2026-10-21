const { execFileSync } = require("node:child_process")

function checkDuplicateBump(run, repository) {
  const pulls = JSON.parse(
    run("gh", [
      "api",
      "--paginate",
      "--slurp",
      "repos/{owner}/{repo}/pulls?state=open&per_page=100"
    ])
  ).flat()
  if (
    pulls.some(
      pr =>
        pr.head.repo?.full_name === repository &&
        pr.head.ref.startsWith("release/v")
    )
  )
    throw new Error(
      "A release PR is already open. Finish it or close it and delete its branch before retrying."
    )
  if (run("git", ["ls-remote", "--heads", "origin", "refs/heads/release/v*"]))
    throw new Error(
      "A release branch already exists. Recover its PR or delete the abandoned branch before retrying."
    )
}

module.exports = { checkDuplicateBump }
if (require.main === module)
  checkDuplicateBump(
    (command, args) => execFileSync(command, args, { encoding: "utf8" }).trim(),
    process.env.GITHUB_REPOSITORY
  )

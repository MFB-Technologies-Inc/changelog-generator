# Docker

1. Generate an SSH key and add it to GitHub.
1. Clone the repository.
1. Run `eval "$(ssh-agent)"`.
1. Run `ssh-add`.
1. Run `docker build --ssh default -t mfb-changelog-generator-dev-env .`.
1. Run `docker create --mount type=bind,src=${HOME}/.ssh,target=/home/vscode/.ssh --name mfb-changelog-generator-dev-env-active -h mfb-changelog-generator-dev-env -it mfb-changelog-generator-dev-env`.
1. Install the "Remote Development" extension pack in VS Code.
1. Navigate to Remote Explorer in the VSCode sidebar.
1. Select Containers from the drop down at the top.
1. Attach to the new container.
1. Click Open Folder and open `~/workspace/changelog-generator`.

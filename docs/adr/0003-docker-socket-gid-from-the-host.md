# Setup Devcontainer gives vscode the host's Docker socket group

The scaffolded devcontainer bind-mounts the host's `/var/run/docker.sock`, which keeps the host's group id. `vscode` is in the image's `docker` group, whose id is fixed at image build time (996 in `vscode-devcontainers-thecore:3`), so on most hosts every `docker` command failed with `permission denied while trying to connect to the docker API` and worked only through `sudo` (found on 2026-11-19, host gid 973).

**Decision**: "Setup Devcontainer" scaffolds `.devcontainer/docker-socket-gid.sh`, run last by `initializeCommand` on the host. It writes `DOCKER_SOCKET_GID=<the socket's gid>` to `.devcontainer/.env`, and the scaffolded `docker-compose.yml` adds it to the app container with `group_add: ["${DOCKER_SOCKET_GID:-996}"]` (996, the previous behaviour, when there is no `.env`). It also scaffolds `.devcontainer/.gitignore` with `/.env`, because Rails' own `.gitignore` ignores `/.env*` only at the root. Its template is named `gitignore`, without the dot, since `.vscodeignore` drops `.gitignore` files from the packaged extension.

The script is byte-identical to `thecore_devcontainer`'s canonical `.devcontainer/docker-socket-gid.sh` (ADR 0006 there, with the options considered and its test suite) and to `thecore`'s `samples/devcontainer/` copy (ADR 0009 there). Change it in `thecore_devcontainer` and copy it here; `test/setupDevContainer.test.js` with `THECORE_SAMPLES_DIR` checks parity with the samples.

## Consequences

- `group_add` applies when the container is created: after Docker is reinstalled on the host with a different gid, rebuild the container.

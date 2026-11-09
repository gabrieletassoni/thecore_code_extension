# Publishing the extension

A release goes to three places:

| Where | How |
|---|---|
| GitHub Release (with the `.vsix`) | automatic, `.github/workflows/main.yml` |
| [Open VSX](https://open-vsx.org/extension/gabrieletassoni/thecore) | automatic, same workflow (`npx ovsx publish`) |
| [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=gabrieletassoni.thecore) | **by hand** (`npm run deploy`); the workflow has no Marketplace step |

## One-time setup

**Open VSX** (used by the workflow):

1. Sign in to [open-vsx.org](https://open-vsx.org) with the `gabrieletassoni` GitHub account and create an access token (*Settings → Access Tokens*).
2. Add it to the GitHub repository as the secret `OVSX_PAT` (*Settings → Secrets and variables → Actions*).

**VS Code Marketplace** (manual publish):

1. The publisher `gabrieletassoni` exists on [marketplace.visualstudio.com/manage](https://marketplace.visualstudio.com/manage), under the same Microsoft account.
2. Create an Azure DevOps Personal Access Token: `dev.azure.com` → user icon → *Personal Access Tokens*, *Organization*: **All accessible organizations**, *Scope*: **Marketplace → Manage**. Keep it in your password manager; it never goes into the repository.

## How to release

1. In `CHANGELOG.md`, rename `## [Unreleased]` to the new version (`## [3.12.0]`) and commit it.
2. From a terminal, on `release/3` and in sync with `origin`, run one of:

   ```bash
   npm run release:patch   # x.y.Z → x.y.(Z+1)  — bug fixes
   npm run release:minor   # x.Y.z → x.(Y+1).0  — new features
   npm run release:major   # X.y.z → (X+1).0.0  — breaking changes
   ```

   Each runs `npm version <level>`, which updates `package.json` and `package-lock.json`, commits, and creates the tag. Then it runs `git push --follow-tags`. The tag has no `v` prefix (`3.12.0`), because `.npmrc` sets `tag-version-prefix=` and the workflow only triggers on `[0-9]+.[0-9]+.[0-9]+`. A `v3.12.0` tag would not trigger it.
3. The workflow runs the tests, packages the `.vsix`, creates the GitHub Release and publishes to Open VSX. Check that the run is green. Open VSX can take a few minutes to show the new version.
4. Publish to the VS Code Marketplace by hand, from the same commit:

   ```bash
   VSCE_PAT=<your Azure DevOps PAT> npm run deploy   # vsce publish
   ```

   The Marketplace rejects a version it already has, so this only works once per version.

The workflow can also be started by hand (*Actions → Publish GitHub Release → Run workflow*) with a `version` input. It uses that as the release tag, so the tag must already exist and match `package.json`.

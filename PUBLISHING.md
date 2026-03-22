# Publishing to the VS Code Marketplace

## One-time setup

1. **Create the publisher** on [marketplace.visualstudio.com/manage](https://marketplace.visualstudio.com/manage) using the same Microsoft account as `gabrieletassoni`.

2. **Create a Personal Access Token (PAT)** on Azure DevOps:
   - Go to `dev.azure.com` → user icon → *Personal Access Tokens*
   - *Organization*: **All accessible organizations**
   - *Scope*: **Marketplace → Manage**

3. **Add the secret to the GitHub repository**:
   - Go to `Settings → Secrets and variables → Actions → New repository secret`
   - Name: `VSCE_PAT`, value: the token created above

## How to release

Bump the version in `package.json` before tagging — the Marketplace rejects versions that have already been published.

```bash
# From the thecore_code_extension repository
git tag v3.0.7
git push origin v3.0.7
```

The workflow triggers on `v*` tags, builds the extension, creates a GitHub Release with the `.vsix` attached, and publishes to the Marketplace.

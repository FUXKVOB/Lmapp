# Updater Release Flow

This project uses the Tauri updater plugin and signed release artifacts.

## Required GitHub Secrets

Create these repository secrets before running the release workflow:

- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- `TAURI_UPDATER_PUBKEY`

`TAURI_UPDATER_PUBKEY` is the public key that matches the private signing key used by Tauri updater.

## Generate the Tauri Updater Key Pair

Run the Tauri signer locally and store the private key somewhere outside the repository:

```powershell
npm run tauri signer generate
```

Keep the private key in your password manager or CI secret store. Put the public key into the `TAURI_UPDATER_PUBKEY` GitHub secret.

## Release Flow

1. Bump versions consistently in:
   - `package.json`
   - `src-tauri/Cargo.toml`
   - `src-tauri/tauri.conf.json`
2. Commit the release changes.
3. Create and push a tag such as `v0.2.1`.
4. GitHub Actions runs `.github/workflows/release.yml`.
5. The workflow injects `TAURI_UPDATER_PUBKEY` into `src-tauri/tauri.conf.json` for the build only.
6. `tauri-action` builds signed updater artifacts and publishes the GitHub release.

## Notes

- Do not commit private keys to the repository.
- Do not hardcode the updater public key in CI if you want to rotate keys later; keep it in GitHub Secrets.
- If the workflow fails during signing, verify that the private key and password secrets match the stored public key.

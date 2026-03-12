# Project Improvements

This file tracks the next improvements for `LmApp` after the first cleanup pass.

## Done

- Synced the Rust package version in `src-tauri/Cargo.toml` with the app release version `0.2.0`.

## Next Priority

1. Lock down Tauri security defaults.
   - Replace `csp: null` with a narrow CSP in `src-tauri/tauri.conf.json`.
   - Add an updater public key and enable updater artifact generation.
   - Restrict command exposure with a Tauri command manifest instead of relying on the default command surface.
2. Split the main frontend component.
   - Break `src/App.tsx` into domain views and hooks for chat, models, logs, runtime controls, and window events.
   - Move UI state with many `useState` calls into a reducer-based state flow.
3. Improve runtime process observability.
   - Capture `stdout` and `stderr` from `llama.cpp` and `vLLM` into the Logs view instead of discarding them.
   - Persist logs to disk with rotation so diagnostics survive app restarts.
4. Make downloads more robust.
   - Download into temporary files and rename on success.
   - Add cancellation, resume support, and integrity checks.
   - Keep failed and partial download state explicit in persisted data.
5. Tighten backend typing and module boundaries.
   - Replace free-form string statuses with enums in Rust and TypeScript.
   - Split `src-tauri/src/main.rs` into smaller command modules.
6. Improve model search UX.
   - Add debounce and cancellation for Hugging Face search.
   - Avoid N+1 model file lookups where possible.
   - Replace `console.log` debugging with structured logs.
7. Expand test coverage.
   - Add frontend component tests for the main flows and modals.
   - Add Rust unit tests for state, runtime helpers, and downloads.
   - Add smoke tests for chat creation, model add, download start, and runtime start/stop.
8. Clean up release and config hygiene.
   - Keep the version sourced consistently across `package.json`, `tauri.conf.json`, and `Cargo.toml`.
   - Consider moving Windows-specific settings into a platform-specific Tauri config file.
9. Fix encoding and text quality issues.
   - Remove mojibake comments from TypeScript and Rust files.
   - Standardize visible strings and error messages.

## Suggested Refactor Order

1. Security and updater hardening
2. Frontend decomposition
3. Runtime logging and download reliability
4. Test coverage

# LmApp

LmApp is a desktop workspace for running local AI models on Windows.

It combines:
- local chat history
- model library management
- `llama.cpp` and `vLLM` runtime configuration
- built-in Hugging Face model presets
- desktop onboarding, tray integration, and release-ready desktop UI

## Version

Current release: `0.1.1`

Repository: [FUXKVOB/Lmapp](https://github.com/FUXKVOB/Lmapp)

Developer Telegram: [@rxzsu](https://t.me/rxzsu)

## Features

- Frameless desktop window with custom titlebar
- Tray menu with show/hide and quick actions
- Persistent local chats
- Built-in onboarding flow
- Model catalog and recommended presets
- `llama.cpp` auto-download flow
- Runtime start/stop controls
- GitHub release update check

## Stack

- React
- TypeScript
- Vite
- Tauri 2
- Rust

## Development

Install dependencies:

```powershell
npm install
```

Run checks:

```powershell
npm run check
```

Run in development:

```powershell
npm run tauri dev
```

Build frontend only:

```powershell
npm run build
```

Build desktop release:

```powershell
npm run tauri build
```

## Release Output

Tauri release artifacts are generated in:

- `src-tauri/target/release`
- `src-tauri/target/release/bundle`

## Release Notes 0.1.1

- Dynamic Hugging Face model search via API
- Removed hardcoded model catalog
- Real-time model discovery with download stats and file sizes
- Automatic GGUF file detection and Q4_K_M filtering
- Search any model: llama, qwen, gemma, phi, mistral, deepseek, etc.

## Release Notes 0.1.0

- Initial Windows desktop release
- Frameless desktop shell with tray integration
- Local AI workspace with persistent chat history
- Model presets, downloads, and runtime management
- About screen, release notes, and update check

## License

No license file is currently included in this repository.

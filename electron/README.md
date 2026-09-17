# Electron UI (Fake Game Launcher)

This folder contains an Electron-based GUI for the existing .NET launcher logic.

## Dev prerequisites

- Node.js (LTS recommended)
- .NET SDK 8

## Run

From this folder:

```powershell
npm install
npm run build:dummy
npm run dev
```

## Build an installer (Setup.exe)

```powershell
npm run dist
```

This produces an assisted NSIS installer in `electron/dist/`. It installs for the current user by default, lets the user choose the destination folder, and creates a Start menu shortcut without forcing a desktop shortcut.

## Optional: portable build

```powershell
npm run dist:portable
```

GitHub releases publish both formats with explicit `Setup` and `Portable` filenames. Automatic updates use the installer metadata; portable users are directed to download and replace the portable executable manually.

Notes:
- The UI stores your installed games in Electron userData as `myGames.json`.
- It stores Discord's detectable app list in userData as `gamelist.json`.
- Fake executables are created under userData `games/` (so the app can run without admin rights).

If `DummyGame.exe` cannot be found, set `DUMMYGAME_EXE` to the built exe path.

# Skill Manager

English | [中文](README.md)

Skill Manager is a local desktop app for managing AI agent skills across multiple clients. It scans installed `SKILL.md` packages, displays skill directory trees, supports reading, editing, history, rollback, and starring, and can discover popular skills from skills.sh and install them into one or more agent directories.

The app is built with Electron, React, and Vite.

## Screenshots

### Discover Skills

Browse the skills.sh leaderboard, switch between All Time, Trending, and Hot rankings, search skills, inspect repository information, and install a skill into selected agents.

![Discover skills](docs/screenshots/discover.png)

### Local Skill Detail

Review installed or starred skills, read `SKILL.md`, browse the full directory tree, and see which agent copies exist locally.

![Installed skills](docs/screenshots/installed-skills.jpg)

### Multi-Agent Install

Install, uninstall, restore, and update actions can target multiple agent directories. The app can remember the previous selection or use a configured default.

![Choose install agents](docs/screenshots/install-agents_v2.png)

## Features

- Discover skills from skills.sh with All Time, Trending, and Hot rankings.
- Search local and discover skills with configurable search scopes.
- Manage installed skills across multiple agent directories.
- Browse tags in a tag cloud and filter related skills.
- Run install, uninstall, restore, and update operations as background events with progress and status.
- Move uninstalled skills into the app data directory instead of deleting them.
- Read `SKILL.md` in a skill-friendly view with the full directory tree.
- Edit local skill files with history, diff, and rollback support.
- Star skills from Discover, Installed, and Uninstalled views.
- Configure agents, ignore rules, log/event retention, and default install targets.
- Switch Settings between visual editing and JSON editing.

## Default Agent Sources

By default, Skill Manager scans:

- Codex: `~/.codex/skills`
- Agents: `~/.agents/skills`
- Claude: `~/.claude/skills`
- Qoder: `~/.qoder/skills`
- QoderWork: `~/.qoderwork/skills`
- OpenClaw: `~/.openclaw/skills`

These directories can be changed in Settings.

## App Data Directory

Runtime data is stored in Electron's app data directory:

```text
~/Library/Application Support/skill-manager
```

Important files and folders:

- `settings.json`: settings, logs, events, agents, ignore rules, and related state.
- `history/`: edited file history and rollback versions.
- `managed-skills/uninstalled/`: skills moved by uninstall.
- `managed-skills/skills/`: app-managed copied skills.

## Development Requirements

For development:

- Node.js
- npm
- Git

For Discover install actions on user machines:

- Node.js / `npx`
- Git
- Network access to skills.sh and GitHub

## Install Dependencies

```bash
npm install
```

If your local `package-lock.json` points to an internal registry, regenerate it before sharing development setup:

```bash
rm package-lock.json
npm install --registry=https://registry.npmjs.org/
```

## Run Locally

```bash
npm run start
```

This starts Vite and Electron together.

## Build Frontend

```bash
npm run build
```

The built web assets are written to `dist/`.

## Package for macOS

Build a regular macOS DMG:

```bash
npm run dist:mac
```

Example output:

```text
release/Skill Manager-<version>-arm64.dmg
```

The app icon is configured at:

```text
build/icon.icns
```

macOS builds are configured for Developer ID signing and Apple notarization. Current signing identity:

```text
JUNDE WU (A8DZ968K75)
```

On a Mac with the certificate installed, build a signed and notarized DMG:

```bash
npm run dist:mac:signed
```

Local notarization uses this Keychain profile by default:

```text
skill-manager-notary
```

For the full Apple signing and notarization setup, see:

[docs/apple-notarization.md](docs/apple-notarization.md)

Verify the DMG:

```bash
hdiutil verify "release/Skill Manager-<version>-arm64.dmg"
```

Verify the app signature and Gatekeeper status:

```bash
codesign --verify --deep --strict --verbose=2 "release/mac-arm64/Skill Manager.app"
spctl --assess --type execute --verbose "release/mac-arm64/Skill Manager.app"
```

## Package for Windows

Windows packaging uses NSIS and is configured in `package.json`. The app icon is:

```text
build/icon.ico
```

Build on Windows:

```bash
npm install
npm run dist:win
```

The output is written to `release/`.

Recommended Windows checks:

- Agent directory detection and path handling.
- Install, uninstall, restore, and update flows.
- Opening files and revealing folders.
- `npx skills add` execution.
- Git availability.
- Settings, logs, and events persistence.

Unsigned Windows installers may trigger SmartScreen warnings. For public distribution, use a Windows code signing certificate.

## Project Structure

```text
electron/
  main.cjs       Electron main process, filesystem operations, install/uninstall, events.
  preload.cjs    Safe IPC bridge exposed to React.
  scanner.cjs    Local skill scanner, default sources, ignore rules.

src/
  App.jsx        Main React app.
  styles.css     UI styles.

build/
  icon.svg       Source app icon.
  icon.png       Runtime icon.
  icon.icns      macOS app icon.
  icon.ico       Windows app icon.

dist/            Built frontend assets.
release/         Local packaged installers.
docs/            Documentation and screenshots.
```

## Notes

- Uninstall does not delete skills directly; files are moved into the app-managed uninstalled directory.
- Settings support both visual editing and JSON editing.
- Logs and Events have configurable retention. By default, they are kept forever.
- Tags are computed from local skill metadata and can be used to browse related skills.
- The current experience focuses on macOS, while Windows packaging is also configured.

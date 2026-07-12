# Skill Manager

English | [中文](README.md)

Skill Manager is a local desktop **AI Agent Skill manager**. It scans, browses, installs, uninstalls, recovers, stars, edits, and versions `SKILL.md` packages spread across multiple agent clients. It can also discover popular skills from [skills.sh](https://www.skills.sh/) and install them into selected agent directories.

If you use Codex, Claude, Qoder, Agents, or other agent clients at the same time, Skill Manager is meant to keep local skills from becoming a pile of hard-to-find, hard-to-sync, hard-to-rollback folders.

## What It Solves

- **Skills are scattered locally**: each agent has its own directory, and finding the right `SKILL.md` by hand gets tedious.
- **Install and uninstall are opaque**: it is hard to know which agent a skill was installed into, or whether it can be recovered.
- **Edits are hard to roll back**: a skill may be changed by you or by an agent, but there is no directory-level history.
- **Discovery is fragmented**: you often need to search GitHub or skills.sh manually, then install by hand.
- **Multi-agent sync is awkward**: the same skill may need to exist in multiple clients, each with its own version.

## Screenshots

### Discover

Discover is aligned with skills.sh: All / Trend / Hot rankings, search, install counts, local installed state, source repository, and one-click install.

![Discover skills](docs/screenshots/discover.png)

### Local Skill Detail

The local detail view shows metadata, tags, installed agents, the directory tree, `SKILL.md` reading/editing, and per-agent skill versions.

![Installed skills](docs/screenshots/installed-skills.jpg)

### Multi-Agent Install

Install, uninstall, recover, sync, and publish-version actions can target multiple agents. The target dialog shows whether each agent already has the skill and which version is installed.

![Choose install agents](docs/screenshots/install-agents_v2.png)

## Core Features

### Discover skills.sh

- Uses skills.sh as the default discovery source.
- Supports All, Trend, and Hot rankings.
- Uses the same skills.sh search API as the website, so search results match the official UI.
- Cards show source repository, local installed agents, total installs, and recent 8-week installs.
- Already-installed skills show their local targets and can be uninstalled or updated.

### Local Multi-Agent Management

- Scans skills directories for multiple agents.
- Treats only first-level directories containing `SKILL.md` as skills.
- The All Agents view can merge skills with the same name and show every agent copy in detail.
- Supports Installed, Uninstalled, Starred, and Tags views.
- Tags prefer `tags` / `keywords` / `categories` from `SKILL.md` frontmatter, then fall back to inferred tags.

### Skill-Friendly Reading and Editing

- Shows `SKILL.md` by default.
- Displays the real directory tree on the left.
- Supports creating files/folders, renaming, deleting, copying relative paths, and copying absolute paths.
- Reading and editing modes can be toggled. Once editing is enabled, switching files keeps edit mode active.
- Code files are displayed in a more readable way.

### Install, Uninstall, Recover, and Sync

- Install / Uninstall / Recover / Sync all support multi-agent selection.
- Operations run as background events instead of blocking the UI.
- Events show status transitions and progress.
- Logs record operation results.
- Uninstall does not delete directly; it moves the skill into the app data directory for recovery.
- Uninstalled records are shown by skill, and a record is removed after recovery.

### Versions and History

- Each agent copy has independent skill version management.
- If `SKILL.md` has `version`, that real version is preferred.
- If no version exists, Skill Manager displays a temporary version based on the latest modified file in the directory.
- Publishing a version writes `version` into `SKILL.md` and creates a directory-level version snapshot.
- History shows changed files by directory, supports diff viewing, selecting versions, and deleting old versions.
- Skill history is retained for 30 days by default and can be changed in Settings.

### Settings

- Switch between visual settings and raw JSON settings.
- Configure agent names, directories, and enabled state.
- Configure default install target and install dialog default behavior.
- Configure ignore rules similar to gitignore, such as the default `*.pyc`.
- Configure retention for Logs, Events, and Skill Versions.

## Default Agent Directories

By default, Skill Manager scans:

| Agent | Directory |
| --- | --- |
| Codex | `~/.codex/skills` |
| Agents | `~/.agents/skills` |
| Claude | `~/.claude/skills` |
| Qoder | `~/.qoder/skills` |
| QoderWork | `~/.qoderwork/skills` |
| OpenClaw | `~/.openclaw/skills` |

All of these can be changed, disabled, removed, or extended in Settings.

## Installation

### Download an Installer

Download the package for your platform from GitHub Releases:

- macOS: `Skill Manager-<version>-arm64.dmg` or the Intel build
- Windows: `Skill Manager Setup <version>.exe`

For macOS, a signed and notarized DMG is recommended. Unsigned builds may be reported as damaged or blocked by macOS.

### Runtime Requirements for Discover Install

To install remote skills from Discover, the user machine needs:

- Node.js / `npx`
- Git
- Network access to skills.sh and GitHub

If Git is unavailable or `git clone` fails, the app attempts a GitHub zip download fallback.

## How to Use

1. Open the app and wait for Library and Agents to finish scanning.
2. Use **Discover** to search or browse the skills.sh leaderboard.
3. Select a skill to inspect its source, install counts, Summary, and `SKILL.md`.
4. Click **Install** and choose which agents should receive the skill.
5. Use **Installed** to browse local skills by tags, agent, or search.
6. Open a skill detail view to browse the tree, edit files, publish versions, or inspect history.
7. Uninstalled skills move into **Uninstalled**, where they can be recovered.
8. Star frequently used skills and review them in **Starred**.

## CLI and Local API

Skill Manager starts a local HTTP API that only listens on `127.0.0.1`. By default it starts probing from port `19010`; if that port is occupied, it automatically tries later ports. You can disable the API, set the configured start port, and see the current runtime port in **Settings → Local API**.

The app package includes a CLI. It does not need to write to `/usr/local/bin` or modify PATH. Agents can call it by its packaged path.

macOS:

```text
/Applications/Skill Manager.app/Contents/Resources/bin/skill-manager
```

Windows:

```text
%LOCALAPPDATA%\Programs\Skill Manager\resources\bin\skill-manager.cmd
%ProgramFiles%\Skill Manager\resources\bin\skill-manager.cmd
```

If the CLI is already on PATH, users, agents, and scripts can also call:

```bash
skill-manager status
skill-manager scan --scope installed
skill-manager publish --agent Codex --skill tdd --message "Add mock testing notes"
skill-manager uninstall --agent Codex --skill tdd
skill-manager install-local --dir /path/to/skill --agent Agents
skill-manager recover --dir /path/to/uninstalled-snapshot --agent Codex
```

The CLI auto-detects `19010-19109`, or you can set:

```bash
export SKILL_MANAGER_API_URL=http://127.0.0.1:19010
```

Windows PowerShell:

```powershell
$env:SKILL_MANAGER_API_URL = "http://127.0.0.1:19010"
```

Common API endpoints:

```http
GET  /api/status
GET  /api/skills?scope=installed
POST /api/skills/publish
POST /api/skills/uninstall
POST /api/skills/install-local
POST /api/skills/recover
```

This lets an agent edit skill files directly, then call Skill Manager to publish versions, install, uninstall, recover, and inspect operation state.

The project also includes an agent-facing skill:

```text
skills/skill-manager/SKILL.md
```

It instructs agents to edit skill files directly while delegating publishing, install, uninstall, recovery, and conflict handling to the Skill Manager CLI/API.

## Local Development

### Requirements

- Node.js
- npm
- Git

### Install Dependencies

```bash
npm install
```

If your local `package-lock.json` points to an internal registry, regenerate it before sharing development setup:

```bash
rm package-lock.json
npm install --registry=https://registry.npmjs.org/
```

### Run Locally

```bash
npm run start
```

This starts Vite and Electron together.

### Build Frontend

```bash
npm run build
```

The built web assets are written to `dist/`.

## Packaging

### macOS

Regular DMG:

```bash
npm run dist:mac
```

Apple Developer ID signing and notarization:

```bash
npm run dist:mac:signed
```

Local notarization uses this Keychain profile by default:

```text
skill-manager-notary
```

For Apple signing and notarization setup, see:

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

### Windows

Windows packaging uses NSIS. The icon is `build/icon.ico`.

Build on Windows:

```bash
npm install
npm run dist:win
```

Unsigned Windows installers may trigger SmartScreen warnings. For public distribution, configure a Windows code signing certificate.

## App Data Directory

Runtime data is stored in Electron's app data directory:

```text
~/Library/Application Support/skill-manager
```

Important files and folders:

- `settings.json`: settings, logs, events, agent configuration, ignore rules, and related state.
- `managed-skills/uninstalled/`: skill snapshots moved during uninstall.
- `managed-skills/versions/`: directory-level version snapshots created by publishing versions.
- `managed-skills/skills/`: app-managed copied skill data.

## Project Structure

```text
electron/
  main.cjs       Electron main process, filesystem operations, install/uninstall, versions, events.
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

docs/
  screenshots/   README screenshots.

dist/            Built frontend assets.
release/         Local packaged installers.
```

## Notes

- Skill Manager does not assume `~/.agents/skills` is automatically loaded by every agent. Each agent directory is controlled by Settings.
- Uninstalled records are recovery snapshots, not a long-term version store. Clearing Uninstalled records deletes the corresponding snapshots.
- If a remote skill has no version, Skill Manager does not guess whether it is newer or older. Conflict flows ask the user to skip, replace, or inspect diffs.
- The current experience focuses on macOS, while Windows packaging is also configured.

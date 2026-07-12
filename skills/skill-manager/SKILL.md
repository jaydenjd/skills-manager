---
name: skill-manager
version: "0.0.2"
description: Use when local Agent Skills need inspection, publishing, installation, uninstallation, or recovery after their files change.
tags:
  - skill
  - version
  - cli
  - agent
---

# Skill Manager

Use this skill when you modify, install, uninstall, recover, or inspect local `SKILL.md` based agent skills on a machine that has Skill Manager installed.

## Core Rule

Agents may edit skill files directly, but version publishing and lifecycle operations must go through the Skill Manager CLI so history, events, logs, and multi-agent state stay consistent. Do not bypass the CLI; connection discovery belongs to its implementation.

## CLI

Use the CLI when available on `PATH`:

```bash
skill-manager status
skill-manager scan --scope installed
skill-manager publish --agent Codex --skill tdd --message "Describe what changed"
skill-manager uninstall --agent Codex --skill tdd
skill-manager install-local --dir /path/to/skill --agent Agents
skill-manager recover --dir /path/to/uninstalled-snapshot --agent Codex
```

If `skill-manager` is not on `PATH`, do not ask the user to install it. Resolve the packaged CLI directly.

macOS lookup order:

```text
/Applications/Skill Manager.app/Contents/Resources/bin/skill-manager
~/Applications/Skill Manager.app/Contents/Resources/bin/skill-manager
./release/mac-arm64/Skill Manager.app/Contents/Resources/bin/skill-manager
./release/mac/Skill Manager.app/Contents/Resources/bin/skill-manager
```

Windows lookup order:

```text
%LOCALAPPDATA%\Programs\Skill Manager\resources\bin\skill-manager.cmd
%ProgramFiles%\Skill Manager\resources\bin\skill-manager.cmd
.\release\win-unpacked\resources\bin\skill-manager.cmd
```

The packaged wrappers first use `node` if available. If Node.js is not available, they use the Skill Manager app's Electron runtime, so users do not need to manually create `/usr/local/bin` links or modify PATH. The CLI reads the App configuration and discovers the active connection automatically; never hard-code connection details in an Agent workflow.

## Workflow

1. Edit the target skill files.
2. Run `skill-manager publish --agent <agent> --skill <skill> --message "<summary>"`.
3. Check `skill-manager events` or `skill-manager logs` if an operation is slow or fails.
4. Use CLI install, uninstall, or recover commands instead of manually moving skill directories.

## Conflict Handling

If installing or recovering a skill conflicts with an existing skill, prefer explicit user choice:

- `skip`: keep the existing skill.
- `replace`: archive the existing skill and replace it.

Do not silently create duplicate names such as `skill-1` unless the user explicitly asks for a copy.

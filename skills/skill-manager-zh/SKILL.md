---
name: skill-manager-zh
version: "0.0.1"
description: 当修改 Skill 文件后需要检查、发布、安装、卸载或恢复本地 Agent Skill 时使用。
tags:
  - skill
  - version
  - cli
  - agent
---

# Skill Manager 中文版

在安装了 Skill Manager 的机器上修改、安装、卸载、恢复或检查基于 `SKILL.md` 的本地 Agent Skill 时，使用本 Skill。

## 核心规则

Agent 可以直接编辑 Skill 文件，但版本发布和生命周期操作必须通过 Skill Manager CLI 完成，以确保历史版本、事件、日志和多 Agent 状态保持一致。不得绕过 CLI；连接发现属于 CLI 的实现细节。

## CLI

当 `skill-manager` 位于 `PATH` 时，直接使用：

```bash
skill-manager status
skill-manager scan --scope installed
skill-manager publish --agent Codex --skill tdd --message "Describe what changed"
skill-manager uninstall --agent Codex --skill tdd
skill-manager install-local --dir /path/to/skill --agent Agents
skill-manager recover --dir /path/to/uninstalled-snapshot --agent Codex
```

如果 `skill-manager` 不在 `PATH` 中，不要让用户安装。应直接解析应用内置的 CLI。

macOS 查找顺序：

```text
/Applications/Skill Manager.app/Contents/Resources/bin/skill-manager
~/Applications/Skill Manager.app/Contents/Resources/bin/skill-manager
./release/mac-arm64/Skill Manager.app/Contents/Resources/bin/skill-manager
./release/mac/Skill Manager.app/Contents/Resources/bin/skill-manager
```

Windows 查找顺序：

```text
%LOCALAPPDATA%\Programs\Skill Manager\resources\bin\skill-manager.cmd
%ProgramFiles%\Skill Manager\resources\bin\skill-manager.cmd
.\release\win-unpacked\resources\bin\skill-manager.cmd
```

应用内置包装器会优先使用 `node`；如果 Node.js 不可用，则使用 Skill Manager 应用的 Electron 运行时，因此用户无需手动创建 `/usr/local/bin` 链接或修改 `PATH`。CLI 会读取应用配置并自动发现当前连接；Agent 工作流不得硬编码连接信息。

## 工作流

1. 编辑目标 Skill 文件。
2. 运行 `skill-manager publish --agent <agent> --skill <skill> --message "<summary>"`。
3. 操作缓慢或失败时，运行 `skill-manager events` 或 `skill-manager logs` 检查状态。
4. 安装、卸载和恢复必须使用 CLI 命令，不要手动移动 Skill 目录。

## 冲突处理

安装或恢复 Skill 时若与现有 Skill 冲突，优先要求用户明确选择：

- `skip`：保留现有 Skill。
- `replace`：归档现有 Skill 后替换。

除非用户明确要求创建副本，否则不要静默创建 `skill-1` 等重复名称。

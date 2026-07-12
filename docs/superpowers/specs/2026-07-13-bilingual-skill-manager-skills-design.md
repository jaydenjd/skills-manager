# Skill Manager 双语 Skills 设计

## 目标

为 Skill Manager 提供两份可同时安装的 Agent Skill：

- `skill-manager`：英文版。
- `skill-manager-zh`：中文版。

两份 Skill 的能力、命令、约束和工作流完全一致，仅自然语言不同。

## 命名与安装

两个 Skill 使用不同的 frontmatter `name`，避免安装、扫描、合并和发布时发生同名覆盖：

```yaml
name: skill-manager
```

```yaml
name: skill-manager-zh
```

项目内置目录：

- `skills/skill-manager/SKILL.md`
- `skills/skill-manager-zh/SKILL.md`

Codex 用户目录：

- `~/.codex/skills/skill-manager/SKILL.md`
- `~/.codex/skills/skill-manager-zh/SKILL.md`

## 内容对齐

两份 Skill 使用相同章节结构：

1. Core Rule / 核心规则
2. CLI
3. Workflow / 工作流
4. Conflict Handling / 冲突处理

以下内容必须逐项一致：

- CLI 命令及参数。
- CLI 查找顺序。
- 所有生命周期操作必须通过 CLI 完成。
- 不直接移动 Skill 目录。
- 安装和恢复冲突时使用 `skip` 或 `replace`，不得静默创建重名副本。

只有标题、描述和解释文字进行中英文转换。命令、路径、选项名和示例参数保持原样。

## CLI-only 约束

两份 Skill 均不得包含：

- 固定端口；
- curl 命令；
- HTTP endpoint；
- 本地 API 环境变量；
- 绕过 CLI 的操作方法。

连接发现继续作为 CLI 的实现细节，不进入 Agent Skill 工作流。

## 版本与发布

- 英文版 `skill-manager` 沿用当前版本历史，通过 Skill Manager CLI 发布下一个版本。
- 中文版 `skill-manager-zh` 作为独立 Skill 安装到 Codex 后发布首个版本。
- 英文发布备注使用英文，中文版发布备注使用中文。
- 发布后通过 CLI 扫描安装列表，核验两份 Skill 的名称、版本和目录。

## 同步策略

- 先更新项目内置副本，再同步至 Codex 用户目录。
- 发布过程可能向 Codex Skill frontmatter 写入版本号；发布后将该版本号同步回对应的项目内置副本。
- 使用结构化检查提取两份 Skill 中的 fenced CLI 命令，确保命令集合完全一致。
- 使用禁用模式扫描确保两份 Skill 均无连接细节。

## 验收标准

- Codex 安装列表同时出现 `skill-manager` 和 `skill-manager-zh`。
- 两份 Skill 可以独立触发、独立发布、独立恢复。
- 两份 Skill 的 CLI 示例集合完全一致。
- 英文版正文为英文，中文版正文为简体中文。
- 两份 Skill 均只引导 Agent 使用 CLI。
- 两份 Skill 均存在有效的独立版本记录和清晰发布备注。

## 非目标

- 不根据系统语言自动切换同一个 Skill 的正文。
- 不创建更多语言版本。
- 不修改 Skill Manager CLI 行为。
- 不改变其他 Skill 的安装、扫描或合并逻辑。

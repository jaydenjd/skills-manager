# Skill Manager CLI 动态端口发现设计

## 目标

- Agent 使用 `skill-manager` skill 时只执行 CLI 命令，不直接调用本地 HTTP API。
- Skill 文档不暴露固定端口、curl 示例或 API 环境变量，避免配置端口变化后操作失效。
- CLI 优先读取 Skill Manager App 的持久化配置获得 API 起始端口，并在端口冲突时自动发现实际监听端口。
- 同步维护应用内置 skill 与当前 Codex 安装的 skill，避免打包或安装时恢复旧说明。

## Skill 边界

`skill-manager` skill 只描述用户级操作：状态、扫描、发布、卸载、安装和恢复。所有示例统一使用：

```bash
skill-manager <command> [options]
```

Skill 删除以下内容：

- `19010` 等具体端口；
- `curl` 与 HTTP endpoint 示例；
- `SKILL_MANAGER_API_URL` 配置方式；
- 鼓励 Agent 直接调用 API 的描述。

CLI 的 `--url` 和 `SKILL_MANAGER_API_URL` 继续作为人工诊断覆盖能力保留在 CLI 帮助中，但不属于 Agent Skill 的正常工作流。

## CLI 端口发现

CLI 按以下优先级确定 App API：

1. 若明确传入 `--url`，使用该地址。
2. 若设置 `SKILL_MANAGER_API_URL`，使用该地址。
3. 读取 App 用户数据目录中的 `settings.json`，取得 `apiPort`。
4. 从配置端口开始请求 `/api/status`；若该端口因冲突被其他进程占用，则继续探测有限数量的后续端口。
5. 如果配置文件缺失、损坏或端口无效，使用 App 的默认端口作为兼容起点，再有限探测。

每个候选端口必须通过 `/api/status` 返回的应用身份校验，不能仅以“HTTP 可访问”作为命中条件。

## 配置路径

CLI 根据操作系统解析与 Electron `app.getPath("userData")` 一致的默认目录：

- macOS：`~/Library/Application Support/skill-manager/settings.json`
- Windows：`%APPDATA%/skill-manager/settings.json`
- Linux：`${XDG_CONFIG_HOME:-~/.config}/skill-manager/settings.json`

配置读取失败属于可恢复情况，CLI 自动回退，不要求 Agent 或用户手动修复。

## 文件职责

- `bin/skill-manager-cli.cjs`：解析配置路径、读取端口、生成候选 API 地址并执行连接探测。
- `skills/skill-manager/SKILL.md`：应用内置的 CLI-only Agent 使用说明。
- `~/.codex/skills/skill-manager/SKILL.md`：当前 Codex 安装副本，内容与内置版本保持一致。
- CLI 测试文件：覆盖配置端口、无效配置、环境变量覆盖和后续端口回退。

## 错误处理

- 配置文件不存在、JSON 无效或 `apiPort` 超出合法范围时，回退默认端口。
- 显式 `--url` 或环境变量指向无效地址时直接报告该覆盖地址不可用，不悄悄连接其他实例。
- 自动探测全部失败时提示用户启动 Skill Manager App；错误信息不要求用户设置固定端口。
- 同时运行多个实例时，优先命中从配置端口开始发现的第一个身份合法实例。

## 发布流程

1. 修改项目内置 skill 与 CLI。
2. 运行 CLI 单元测试和项目构建。
3. 将相同 skill 内容同步到 Codex 用户 skill 目录。
4. 使用 Skill Manager CLI 发布 `skill-manager` 新版本，并填写说明端口发现与 CLI-only 工作流。
5. 核验版本记录及当前安装内容。

## 验收标准

- Skill 全文不包含 `19010`、`curl`、HTTP endpoint 或 `SKILL_MANAGER_API_URL`。
- 用户修改 App API 端口后，`skill-manager status` 无须额外参数即可连接。
- 配置端口被占用、App 监听后续端口时，CLI 能找到正确实例。
- 配置文件缺失或损坏时，CLI 仍可通过兼容回退工作。
- 显式覆盖地址继续可用于人工诊断。
- 内置 skill 与 Codex 安装副本一致。
- Skill Manager 发布产生新的可追溯版本记录。

## 非目标

- 不移除 App 的本地 API。
- 不改变 API endpoint 或业务行为。
- 不在 Skill 中教授底层 API 调试方法。
- 不改变其他 Agent skill 的安装与同步逻辑。

# Changelog

本文件记录 Skill Manager 的主要提交变更与版本变更。

## v0.2.13 - 2026-07-19

### Added

- 本地导入与远程安装支持“安装为”重命名，方便将目录、zip 或远程 skill 安装为自定义名称。

### Fixed

- 修复 `qa` 等包含符号链接的 skill 详情目录展示异常，避免把链接到其他 skill 的目录混入当前 skill 树。

## v0.2.8 - 2026-07-15

### Added

- 设置页补充更多主流 agent 的默认 skills 目录与本地化图标展示。
- 顶部区域支持双击最大化 / 还原窗口。

### Changed

- 设置页 Agents 改为更紧凑的 4 列卡片布局，默认最多展示 3 行，更多 agent 通过弹层查看。
- 本地 API 端口改为点击铅笔后才可编辑，减少误修改。
- 发布版本弹窗只允许选择已安装该 skill 的 agent，并正确展示已安装版本。

### Fixed

- 修复发布版本选择弹窗中已安装 agent 被显示为“未安装”的问题。

## v0.2.7 - 2026-07-15

### Changed

- 轻量化主界面视觉风格，统一左侧栏、列表卡片、详情页、设置页、日志与事件页的排版和控件风格。
- 优化 Discover / Installed / Uninstalled / Starred 顶部搜索、筛选与操作栏布局。
- 优化详情页阅读与编辑模式视觉，减少深色块与高饱和收藏状态。

### Added

- 增加本地导入与远程安装入口。

## v0.2.6 - 2026-07-13

### Fixed

- 修复设置页调整 Agents 顺序后未识别为修改、无法保存的问题。
- 修复设置页内容滚动时顶部操作栏消失、底部出现大块空白的问题。
- 优化 Agent 行勾选和聚焦状态样式，避免整行边框错乱。

## v0.2.5 - 2026-07-13

### Changed

- 将全局搜索移动到第二栏顶部，仅在 Discover / Installed / Uninstalled / Starred / Tags 列表页展示。
- 将刷新入口移动到左侧 Library 标题右侧，缩短搜索与列表操作的视觉距离。
- 统一第二栏顶部区域、筛选控件、分割线和列表滚动空间，减少不同栏目切换时的视觉抖动。

## v0.2.4 - 2026-07-12

### Added

- 增加应用菜单中的 Settings 与 Language 入口，保留侧边栏 Settings 入口。
- 增加中英文菜单栏切换，支持从菜单直接切换语言并打开设置页。

### Changed

- Discover 加载策略调整为 All / Trending / Hot 首屏并发加载，每个 tab 独立预加载后两页，滚动后继续预热后续页面。
- skills.sh 请求增加 gzip / br / deflate 压缩解码，并在读取到 `initialSkills` 后提前解析，提升 Discover 加载速度。
- 优化英文长文案、版本下拉与 Uninstalled 操作按钮在双语环境下的布局稳定性。
- 顶部品牌区下移，避开 macOS 窗口控制按钮。

### Fixed

- 修复语言切换后部分页面文案混用的问题。
- 修复 Discover 分页缓存 key 不包含搜索词导致的潜在混用问题。

## v0.2.3 - 2026-07-11

### Added

- 增加冷启动启动页，避免首次打开时出现空白窗口。
- 增加 Installed / Discover 加载时的小动画与随机提示文案。
- 增加目录面板空白区域右键菜单，支持在 skill 根目录创建文件、创建目录、复制相对路径、复制绝对路径。
- 增加主进程剪贴板写入接口，提升复制路径稳定性。

### Changed

- 本地 Installed 首扫改为轻量扫描：只扫描一级 skill 目录并读取必要列表信息，详情页再懒加载完整目录树和版本信息。
- 扫描规则调整为只识别根目录下一级目录中的 `SKILL.md`，避免误扫深层目录。
- 标签生成改为优先使用 `SKILL.md` frontmatter 中的 `tags` / `keywords` / `categories` / `category`，没有显式标签时才自动推断。
- Discover 顶部切换区只保留排序按钮，加载动画移动到列表区域。
- 版本下拉支持点击外部自动关闭，最新版本提示改为更紧凑的非遮挡样式。

### Fixed

- 修复删除文件/目录后目录树延迟消失或被旧详情刷新短暂覆盖的问题。
- 修复复制相对路径/绝对路径不稳定的问题。
- 修复首次扫描中第二栏过早显示“没有本地 skill”的问题。

## v0.2.2 - 2026-07-11

### Added

- 在第二栏和详情页显示 skill 当前版本。
- Discover 详情展示 summary、安装方式、skill 内容等信息。

### Fixed

- 修复 Discover 进入后偶发空白的问题。
- 修复版本显示与 `SKILL.md` frontmatter 不一致的部分问题。

## v0.2.1 - 2026-07-11

### Changed

- Discover 加载策略调整为优先加载第一页和总量，减少一次性加载大量数据导致的等待。

## v0.2.0 - 2026-07-11

### Added

- 设置页增加 App 版本显示。
- 增加中文 README，并保留英文文档入口。

### Changed

- 默认 README 调整为中文项目介绍与本地构建说明。

## v0.1.9 - 2026-07-11

### Added

- 增加 Apple 公证配置文档。
- 增加 macOS 签名与 GitHub Actions 构建配置说明。

## v0.1.8 - 2026-07-11

### Added

- 增加 GitHub Actions 构建流程。
- 支持 macOS arm64、macOS Intel、Windows 安装包构建。

## v0.1.7 - 2026-07-11

### Added

- 初始可安装版本。
- 支持本地多 Agent skill 管理、Discover、Installed、Uninstalled、Starred、Settings 等基础功能。

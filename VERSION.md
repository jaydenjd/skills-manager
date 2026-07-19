# Version

## 当前版本

- App version: `0.2.13`
- Git tag: `v0.2.13`
- Branch: `master`
- Release type: patch

## 版本规则

Skill Manager 使用语义化版本号：

```text
MAJOR.MINOR.PATCH
```

- `MAJOR`: 不兼容的数据结构、配置结构或安装方式变化。
- `MINOR`: 新增功能、较大的交互调整、重要能力增强。
- `PATCH`: Bug 修复、性能优化、文案与样式优化、小交互改进。

## 发布流程

1. 更新 `package.json` 和 `package-lock.json` 中的版本号。
2. 更新 `CHANGELOG.md`，记录本版本的新增、变更与修复。
3. 更新本文件的当前版本信息。
4. 本地执行验证：

```bash
npm run build
node --check electron/main.cjs && node --check electron/scanner.cjs && node --check electron/preload.cjs
git diff --check
```

5. 提交代码并推送主分支。
6. 创建并推送版本 tag，例如：

```bash
git tag v0.2.6
git push origin master
git push origin v0.2.6
```

## 版本记录

| Version | Date | Notes |
| --- | --- | --- |
| `0.2.13` | 2026-07-19 | 增加本地/远程安装重命名，修复包含符号链接的 skill 目录树展示异常。 |
| `0.2.8` | 2026-07-15 | 优化设置页 Agents 紧凑展示、窗口交互、本地 API 端口编辑与发布版本选择。 |
| `0.2.7` | 2026-07-15 | 轻量化整体界面、统一列表与详情样式、增加本地/远程安装入口。 |
| `0.2.6` | 2026-07-13 | 修复设置页 Agents 排序保存与滚动布局问题。 |
| `0.2.5` | 2026-07-13 | 调整搜索与刷新入口位置，统一第二栏顶部布局。 |
| `0.2.4` | 2026-07-12 | 增加菜单语言/设置入口，优化 Discover 加载速度与双语布局。 |
| `0.2.3` | 2026-07-11 | 优化本地扫描、目录操作、启动加载与标签来源。 |
| `0.2.2` | 2026-07-11 | 增加 skill 版本展示，修复 Discover 详情与加载问题。 |
| `0.2.1` | 2026-07-11 | 优化 Discover 首屏加载策略。 |
| `0.2.0` | 2026-07-11 | 增加设置页版本显示，整理 README 文档。 |
| `0.1.9` | 2026-07-11 | 增加 Apple 公证与中文文档。 |
| `0.1.8` | 2026-07-11 | 增加 GitHub Actions 多平台构建。 |
| `0.1.7` | 2026-07-11 | 初始可安装版本。 |

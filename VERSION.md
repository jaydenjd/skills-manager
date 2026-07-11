# Version

## 当前版本

- App version: `0.2.3`
- Git tag: `v0.2.3`
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
git tag v0.2.3
git push origin master
git push origin v0.2.3
```

## 版本记录

| Version | Date | Notes |
| --- | --- | --- |
| `0.2.3` | 2026-07-11 | 优化本地扫描、目录操作、启动加载与标签来源。 |
| `0.2.2` | 2026-07-11 | 增加 skill 版本展示，修复 Discover 详情与加载问题。 |
| `0.2.1` | 2026-07-11 | 优化 Discover 首屏加载策略。 |
| `0.2.0` | 2026-07-11 | 增加设置页版本显示，整理 README 文档。 |
| `0.1.9` | 2026-07-11 | 增加 Apple 公证与中文文档。 |
| `0.1.8` | 2026-07-11 | 增加 GitHub Actions 多平台构建。 |
| `0.1.7` | 2026-07-11 | 初始可安装版本。 |

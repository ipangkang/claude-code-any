# Claude Code 源码分析 - 进度跟踪

> 最后更新：2026-04-01

## 文档列表

| # | 文档 | 状态 | 覆盖目录 |
|---|------|------|---------|
| 00 | 项目概览与核心架构 | ✅ 完成 | src/ 根文件 (QueryEngine, Tool, query, commands) |
| 01 | 工具系统架构 | ✅ 完成 | src/tools/ |
| 02 | 服务层架构 | ✅ 完成 | src/services/ |
| 03 | CLI入口与命令系统 | ✅ 完成 | src/entrypoints/, src/cli/, src/commands/ |
| 04 | 状态管理与权限系统 | ✅ 完成 | src/state/, src/hooks/, src/utils/permissions/ |
| 05 | UI组件与渲染系统 | ✅ 完成 | src/components/, src/ink/, src/screens/ |
| 06 | 任务与技能插件系统 | ✅ 完成 | src/tasks/, src/skills/, src/plugins/, src/coordinator/ |
| 07 | 工具函数与基础设施 | ✅ 完成 | src/utils/, src/constants/ |
| 08 | 启动引导与远程通信 | ✅ 完成 | src/bootstrap/, src/bridge/, src/remote/, src/server/ |
| 09 | 查询引擎与类型系统 | ✅ 完成 | src/query/, src/context/, src/types/, src/schemas/ |
| 10 | 交互模式与记忆系统 | ✅ 完成 | src/vim/, src/voice/, src/keybindings/, src/outputStyles/, src/memdir/, src/migrations/ |
| 11 | 高级功能与原生模块 | ✅ 完成 | src/assistant/, src/buddy/, src/moreright/, src/native-ts/, src/upstreamproxy/ |
| 12 | 构建脚本与外部模块 | ✅ 完成 | scripts/, stubs/, tools/, types/, utils/, vendor/ |

## 覆盖完整性

全部 37 个 src/ 子目录 + 6 个顶层目录均已覆盖。

**Feature-gated 存根目录**（代码为空壳，未单独建文档）：
- `src/jobs/` — 分类器（TEMPLATES flag），见 doc 09
- `src/proactive/` — 主动通知（PROACTIVE flag），见 doc 11

## 项目信息

- **来源**: `@anthropic-ai/claude-code` v2.1.88 反编译
- **语言**: TypeScript (Bun 运行时)
- **架构**: CLI Agent + Ink(React终端UI) + 多工具系统
- **总文件夹**: 37 个 src/ 子目录 + 6 个顶层目录，全部已分析
- **构建状态**: ✅ 已从源码成功构建 `dist/cli.js` (19.8MB)，可通过 `node dist/cli.js` 运行

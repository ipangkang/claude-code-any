# CLI 入口与命令系统

## 一、程序启动流程

### 1.1 入口文件: `src/entrypoints/cli.tsx`

整个 CLI 的真正入口。启动采用**快速路径 (fast-path) 分发**模式，在加载完整 CLI 之前，优先处理轻量级子命令：

```
cli.tsx main()
  │
  ├─ --version/-v         → 直接打印版本号并退出（零模块加载）
  ├─ --dump-system-prompt  → 输出系统提示词（内部构建专用）
  ├─ --claude-in-chrome-mcp → Chrome MCP 服务器
  ├─ --daemon-worker       → Daemon 工作进程（supervisor 生成）
  ├─ remote-control/bridge → Bridge 远程控制模式
  ├─ daemon                → Daemon 长驻进程
  ├─ ps/logs/attach/kill   → 后台会话管理
  ├─ new/list/reply        → 模板任务
  ├─ environment-runner    → BYOC 无头运行器
  ├─ self-hosted-runner    → 自托管运行器
  ├─ --worktree --tmux     → tmux worktree 快速路径
  │
  └─ (无匹配) → 加载完整 CLI
       ├─ startCapturingEarlyInput()  // 捕获早期键盘输入
       ├─ import('../main.js')        // 动态导入主模块
       └─ cliMain()                   // 启动 REPL 交互
```

**设计要点**：所有 import 均为动态 `await import()`，确保快速路径零加载开销。`feature()` 宏在构建时做死代码消除（DCE）。

### 1.2 初始化: `src/entrypoints/init.ts`

`init()` 函数被 `memoize` 包装，全局只执行一次。核心初始化序列：

1. `enableConfigs()` — 验证并启用配置系统
2. `applySafeConfigEnvironmentVariables()` — 应用安全环境变量
3. `applyExtraCACertsFromConfig()` — 加载额外 CA 证书
4. `setupGracefulShutdown()` — 注册优雅退出处理
5. 初始化 1P 事件日志 / OAuth / JetBrains 检测 / 仓库检测（异步）
6. `configureGlobalMTLS()` / `configureGlobalAgents()` — 网络配置
7. `preconnectAnthropicApi()` — TCP/TLS 预连接（节省 100-200ms）
8. 注册清理回调（LSP 管理器、swarm teams、scratchpad 目录）

遥测在信任对话完成后，由 `initializeTelemetryAfterTrust()` 单独初始化。

### 1.3 MCP 入口: `src/entrypoints/mcp.ts`

将 Claude Code 的内置工具暴露为标准 MCP 服务器：

- 使用 `@modelcontextprotocol/sdk` 的 `Server` + `StdioServerTransport`
- `ListToolsRequestSchema` → 列出所有内置工具（含 Zod→JSON Schema 转换）
- `CallToolRequestSchema` → 调用工具，走完整的权限验证流程
- 独立于交互式 REPL，可由外部 MCP 客户端直接调用

### 1.4 SDK 入口: `src/entrypoints/agentSdkTypes.ts`

为 Agent SDK 消费者提供类型导出，组织为三层：

| 模块 | 内容 |
|------|------|
| `sdk/coreTypes.ts` | 可序列化类型（消息、配置） |
| `sdk/runtimeTypes.ts` | 运行时类型（回调、接口） |
| `sdk/controlTypes.ts` | 控制协议类型（stdin/stdout 消息） |

还导出了 `tool()`, `query()`, `session()` 等 SDK 函数签名。

---

## 二、命令注册与路由

### 2.1 命令类型系统: `src/types/command.ts`

三种命令类型：

| 类型 | 说明 | 返回值 |
|------|------|--------|
| `'local'` | 纯文本命令，支持非交互模式 | `LocalCommandResult` |
| `'local-jsx'` | 渲染 Ink JSX 组件的交互命令 | `React.ReactNode` |
| `'prompt'` | 扩展为提示词发送给模型的技能命令 | `ContentBlockParam[]` |

每个命令的基础字段：`name`, `description`, `aliases`, `isEnabled`, `isHidden`, `availability`, `load()`。

**可见性控制**：
- `availability` — 按认证类型过滤（`claude-ai` / `console`）
- `isEnabled()` — 运行时特性开关
- `isHidden` — 隐藏于帮助和自动完成

### 2.2 命令注册: `src/commands.ts`

**静态命令**：`COMMANDS()` 函数（memoized）返回约 80+ 个内置命令的数组。

**动态命令源**：`loadAllCommands()` 并行加载多个来源：

```
loadAllCommands(cwd)
  ├─ getBundledSkills()          — 内置技能
  ├─ getBuiltinPluginSkillCommands() — 内置插件技能
  ├─ getSkillDirCommands(cwd)   — ~/.claude/skills/ 目录
  ├─ getWorkflowCommands(cwd)   — 工作流脚本
  ├─ getPluginCommands()        — 已安装插件
  ├─ getPluginSkills()          — 插件提供的技能
  └─ COMMANDS()                 — 内置命令（合并到末尾）
```

**条件编译命令**：通过 `feature()` 宏实现构建时 DCE：
```typescript
const voiceCommand = feature('VOICE_MODE')
  ? require('./commands/voice/index.js').default : null
```

### 2.3 命令路由

```typescript
// 查找命令：按 name、getCommandName()、aliases 匹配
findCommand(commandName, commands) → Command | undefined

// 获取可用命令：每次调用重新评估 availability 和 isEnabled
getCommands(cwd) → Command[]
```

**特殊命令集合**：
- `REMOTE_SAFE_COMMANDS` — 远程模式下可用的命令子集
- `BRIDGE_SAFE_COMMANDS` — 通过 Bridge 协议可执行的命令子集
- `INTERNAL_ONLY_COMMANDS` — 仅内部构建可见的命令

### 2.4 命令实现模式

每个命令采用**懒加载**模式。`index.ts` 只声明元数据，`load()` 延迟加载实现：

```typescript
// src/commands/help/index.ts
const help = {
  type: 'local-jsx',
  name: 'help',
  description: 'Show help and available commands',
  load: () => import('./help.js'),   // 按需加载
} satisfies Command

// src/commands/compact/index.ts
const compact = {
  type: 'local',
  name: 'compact',
  description: 'Clear conversation history but keep a summary...',
  isEnabled: () => !isEnvTruthy(process.env.DISABLE_COMPACT),
  supportsNonInteractive: true,
  load: () => import('./compact.js'),
} satisfies Command

// src/commands/model/index.ts — 动态描述
export default {
  type: 'local-jsx',
  name: 'model',
  get description() {  // getter 实时反映当前模型
    return `Set the AI model (currently ${renderModelName(getMainLoopModel())})`
  },
  load: () => import('./model.js'),
} satisfies Command
```

---

## 三、CLI Transport 层

### 3.1 结构化 IO: `src/cli/structuredIO.ts`

SDK/非交互模式下的通信层，基于 stdin/stdout 的 NDJSON 协议：

- **输入**：从 stdin 读取 `StdinMessage`（用户消息、权限响应、控制请求）
- **输出**：向 stdout 写入 `StdoutMessage`（助手消息、权限请求、系统事件）
- 实现权限请求的 request-response 协议（通过 `SDKControlRequest`/`SDKControlResponse`）
- 集成 hooks 系统用于权限请求前的回调

### 3.2 Transport 架构: `src/cli/transports/`

用于远程/Bridge 场景的传输层：

| 文件 | 职责 |
|------|------|
| `WebSocketTransport.ts` | WebSocket 读通道 |
| `HybridTransport.ts` | **混合传输**：WebSocket 读 + HTTP POST 写 |
| `SSETransport.ts` | Server-Sent Events 传输 |
| `SerialBatchEventUploader.ts` | 串行批量上传器（防止并发写冲突） |
| `WorkerStateUploader.ts` | Worker 状态同步 |
| `transportUtils.ts` | 传输工具函数 |

**HybridTransport 写入流程**（用于 Bridge 模式）：

```
write(event) → streamEventBuffer（100ms 聚合）
             → SerialBatchEventUploader.enqueue()
             → postOnce()（单个 HTTP POST，失败指数退避重试）
```

串行化保证写入顺序，避免并发 Firestore 写冲突。

---

## 四、辅助模块

| 文件 | 职责 |
|------|------|
| `src/cli/exit.ts` | 退出流程管理 |
| `src/cli/print.ts` | 终端输出格式化 |
| `src/cli/update.ts` | 版本更新检查 |
| `src/cli/remoteIO.ts` | 远程 IO 处理 |
| `src/cli/handlers/auth.ts` | 认证处理 |
| `src/cli/handlers/autoMode.ts` | 自动模式（-p 管道模式） |
| `src/cli/handlers/mcp.tsx` | MCP 处理 |
| `src/cli/handlers/agents.ts` | Agent 处理 |
| `src/cli/handlers/plugins.ts` | 插件处理 |

---

## 五、架构总结

```
用户输入 `claude ...`
     │
     ▼
cli.tsx ─── 快速路径分发（--version, bridge, daemon, ...）
     │
     │ (无匹配)
     ▼
main.js ─── 参数解析 + init() 初始化
     │
     ▼
REPL 循环
     │
     ├─ 用户输入 `/help` → findCommand("help") → help.load() → 渲染 JSX
     ├─ 用户输入 `/compact` → findCommand("compact") → compact.load() → 返回文本
     ├─ 用户输入自然语言 → 发送到模型 → 工具调用 → 结果反馈
     └─ SDK 模式 → structuredIO 接管 stdin/stdout NDJSON 协议
```

核心设计原则：
1. **启动速度优先** — 快速路径 + 全动态 import + 懒加载命令
2. **多模态入口** — CLI 交互 / SDK NDJSON / MCP stdio / Bridge WebSocket
3. **可扩展命令系统** — 内置 + 插件 + 技能目录 + 工作流，统一 Command 接口
4. **构建时优化** — `feature()` 宏实现条件编译和死代码消除

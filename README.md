# anycode — 万能编程智能体

> 基于 Claude Code v2.1.88 源码重构，支持任意 OpenAI 兼容大模型的通用编程智能体 CLI 工具。

**一句话介绍：** 用你喜欢的任何大模型（GPT、DeepSeek、Qwen、GLM、Kimi、MiniMax、Ollama 本地模型等），获得与 Claude Code 完全一致的 AI 编程助手体验。

---

## 目录

- [项目简介](#项目简介)
- [功能总览](#功能总览)
  - [支持的模型与服务商](#支持的模型与服务商)
  - [核心工具列表](#核心工具列表)
  - [斜杠命令列表](#斜杠命令列表)
  - [特殊模式](#特殊模式)
  - [配置系统](#配置系统)
  - [构建系统](#构建系统)
  - [安装方式](#安装方式)
  - [环境变量](#环境变量)
  - [项目指令文件](#项目指令文件)
  - [Feature Gate 功能门控](#feature-gate-功能门控)
  - [智能错误处理](#智能错误处理)
  - [DeepSeek-R1 推理链支持](#deepseek-r1-推理链支持)
  - [MCP 协议支持](#mcp-协议支持)
  - [子代理系统](#子代理系统)
  - [会话管理](#会话管理)
  - [安全与权限系统](#安全与权限系统)
  - [依赖清单](#依赖清单)
- [架构概览](#架构概览)
- [版本更新记录](#版本更新记录)
  - [anycode v1.3.0 (最新)](#anycode-v130-2026-04-04)
  - [anycode v1.2.2](#anycode-v122-2026-04-04)
  - [anycode v1.2.1](#anycode-v121-2026-04-02)
  - [anycode v1.2.0](#anycode-v120-2026-04-02)
  - [anycode v1.1.2 (pip)](#anycode-ai-v112-pip-发行版)
  - [anycode v1.0.4 (构建脚本)](#anycode-v104-构建脚本版)
  - [anycode v1.0.0 (npm)](#anycode-v100-npm-核心版)
  - [Claude Code v2.1.88 (上游基线)](#claude-code-v2188-上游基线)
- [免责声明](#免责声明)

---

## 项目简介

**anycode** 是对 Anthropic 官方 Claude Code CLI（v2.1.88）的深度重构版本。核心创新在于引入了一层 **OpenAI 适配器（Adapter）**，将原本只能连接 Anthropic API 的代码框架改造为 **供应商无关（Provider-Agnostic）** 的通用编程智能体。

这意味着你可以用 **任何支持 OpenAI 兼容接口的大模型** 来驱动 Claude Code 的全部能力：文件读写、代码编辑、终端命令、子代理、MCP 协议、工作流编排——所有这些功能都 **完整保留**。

### 与原版 Claude Code 的关键区别

| 维度 | Claude Code (原版) | anycode (本项目) |
|------|-------------------|------------------|
| 支持的模型 | 仅 Anthropic Claude 系列 | **任意 OpenAI 兼容模型** |
| 认证方式 | OAuth / Anthropic API Key | **供应商 API Key（任意）** |
| 订阅要求 | 需要 Claude Max/Pro 订阅 | **无订阅要求** |
| CLI 命令 | `claude` | `anycode` |
| 配置目录 | `~/.claude/` | `~/.anycode/` |
| 项目指令 | `CLAUDE.md` | `.anycode.md` |
| 安装方式 | npm (`@anthropic-ai/claude-code`) | npm 源码构建 / **pip install anycode-ai** |
| 功能门控 | 大量功能被锁定 | **28+ 功能已解锁** |
| 远程控制 | 需 claude.ai 订阅 | **已绕过订阅检查** |
| 遥测数据 | 发送至 Anthropic | **已移除** |

---

## 功能总览

### 支持的模型与服务商

anycode 内置 **9 个预设服务商** + 自定义端点，支持所有兼容 OpenAI `/v1/chat/completions` 接口的大模型。

#### 预设服务商列表

| 服务商 | API 地址 | 默认模型 | 最大输出 Token | 上下文窗口 |
|--------|---------|---------|--------------|-----------|
| **OpenAI** | `https://api.openai.com/v1` | gpt-4o | 16,384 | 128,000 |
| **DeepSeek（深度求索）** | `https://api.deepseek.com/v1` | deepseek-chat | 8,192 | 64,000 |
| **Qwen（通义千问/DashScope）** | `https://dashscope.aliyuncs.com/compatible-mode/v1` | qwen-max | 8,192 | 32,000 |
| **MiniMax** | `https://api.minimax.io/v1` | MiniMax-M2.7 | 16,384 | 204,800 |
| **GLM（智谱清言）** | `https://open.bigmodel.cn/api/paas/v4` | glm-4-plus | 8,192 | 128,000 |
| **SiliconFlow（硅基流动）** | `https://api.siliconflow.cn/v1` | deepseek-ai/DeepSeek-V3 | 8,192 | 64,000 |
| **Kimi（月之暗面/Moonshot）** | `https://api.moonshot.cn/v1` | moonshot-v1-auto | 8,192 | 128,000 |
| **Ollama（本地模型）** | `http://localhost:11434/v1` | llama3 | 4,096 | 8,000 |
| **自定义（Custom）** | 用户指定 | 用户指定 | 自动探测 | 32,000 |

#### 各服务商已知可用模型

| 服务商 | 可用模型 |
|--------|---------|
| OpenAI | gpt-4o, gpt-4o-mini, gpt-4-turbo, o1, o3, gpt-5.1 |
| DeepSeek | deepseek-chat (V3), deepseek-reasoner (R1) |
| 通义千问 | qwen-max, qwen-plus, qwen-turbo |
| MiniMax | MiniMax-M2.7, MiniMax-M2.7-highspeed, MiniMax-M2.5, MiniMax-M2.5-highspeed, MiniMax-M2.1, MiniMax-M2 |
| 智谱 GLM | glm-4-plus, glm-4 |
| SiliconFlow | DeepSeek-V3, Qwen2.5, Yi 系列 |
| Kimi | moonshot-v1-auto, moonshot-v1-8k/32k/128k |
| Ollama | llama3, codellama, mistral, qwen2 以及任何 GGUF 格式模型 |
| 自定义 | 任何通过 OpenAI 兼容接口暴露的模型（vLLM, TGI, Text Generation WebUI 等） |

#### 模型要求

所有模型必须支持以下能力才能正常工作：
- **函数调用 / 工具使用**（Function Calling / Tool Use）— 这是 anycode 运行的核心前提
- **流式响应**（Streaming）— 用于实时输出
- **JSON 消息格式** — 用于工具参数传递

---

### 核心工具列表

anycode 继承了 Claude Code 的全部 **40+ 内置工具**，以下是完整分类：

#### 文件与系统操作工具

| 工具名 | 功能说明 |
|--------|---------|
| **BashTool** | 执行终端命令（支持超时、后台运行） |
| **FileReadTool (Read)** | 读取文件内容（支持行号范围、PDF、图片、Jupyter Notebook） |
| **FileWriteTool (Write)** | 创建或覆盖文件 |
| **FileEditTool (Edit)** | 精确的字符串替换编辑（支持 replace_all） |
| **GlobTool (Glob)** | 按 glob 模式搜索文件名 |
| **GrepTool (Grep)** | 按正则搜索文件内容（基于 ripgrep） |
| **PowerShellTool** | 执行 PowerShell 命令（Windows 平台） |

#### 代理与执行工具

| 工具名 | 功能说明 |
|--------|---------|
| **AgentTool** | 启动子代理进行并行任务（支持 worktree 隔离） |
| **SkillTool** | 执行技能插件 |
| **MonitorTool** | 监控长时间运行的操作 |

#### 网络与远程工具

| 工具名 | 功能说明 |
|--------|---------|
| **WebFetchTool** | 获取并解析网页内容 |
| **WebSearchTool** | 网页搜索（Bing 集成） |
| **RemoteTriggerTool** | 管理远程代理/定时触发器 |

#### MCP 协议工具

| 工具名 | 功能说明 |
|--------|---------|
| **MCPTool** | Model Context Protocol 集成（连接 MCP 服务器） |
| **McpAuthTool** | MCP 服务器认证 |
| **ListMcpResourcesTool** | 列出 MCP 资源 |
| **ReadMcpResourceTool** | 读取 MCP 资源 |

#### 调度与自动化工具

| 工具名 | 功能说明 |
|--------|---------|
| **ScheduleCronTool** | 定时任务调度（类 cron） |
| **SendMessageTool** | 向用户发送消息 |

#### 计划与工作区工具

| 工具名 | 功能说明 |
|--------|---------|
| **EnterPlanModeTool** | 进入计划模式 |
| **ExitPlanModeTool** | 退出计划模式 |
| **EnterWorktreeTool** | 创建隔离的 Git Worktree |
| **ExitWorktreeTool** | 退出 Worktree |

#### 配置与交互工具

| 工具名 | 功能说明 |
|--------|---------|
| **ConfigTool** | 获取/设置配置项 |
| **AskUserQuestionTool** | 向用户提问并等待回答 |
| **LSPTool** | Language Server Protocol 集成 |
| **NotebookEditTool** | Jupyter Notebook 编辑 |

#### 任务管理工具

| 工具名 | 功能说明 |
|--------|---------|
| **TaskCreate** | 创建任务 |
| **TaskGet** | 获取任务状态 |
| **TaskList** | 列出所有任务 |
| **TaskUpdate** | 更新任务状态 |
| **TaskStop** | 停止任务 |
| **TaskOutput** | 获取任务输出 |

#### Feature Gate 门控工具（已在构建中启用或作为桩代码存在）

| 工具名 | Feature Gate | 功能说明 |
|--------|-------------|---------|
| REPLTool | `ant` (内部) | 交互式 REPL（VM 沙箱执行） |
| SnipTool | `HISTORY_SNIP` | 上下文裁剪 |
| SleepTool | `PROACTIVE` / `KAIROS` | 代理循环中的延迟/休眠 |
| WorkflowTool | `WORKFLOW_SCRIPTS` | 工作流脚本执行 |
| WebBrowserTool | `WEB_BROWSER_TOOL` | 内置浏览器自动化 |
| TerminalCaptureTool | `TERMINAL_PANEL` | 终端面板捕获和监控 |
| VerifyPlanExecutionTool | `CLAUDE_CODE_VERIFY_PLAN` | 计划验证 |
| PushNotificationTool | `KAIROS` | 推送通知 |
| SubscribePRTool | `KAIROS_GITHUB_WEBHOOKS` | GitHub PR 订阅 |
| DiscoverSkillsTool | `EXPERIMENTAL_SKILL_SEARCH` | 技能发现 |
| ListPeersTool | `UDS_INBOX` | 列出活跃对等方 |
| CtxInspectTool | `CONTEXT_COLLAPSE` | 上下文检查 |

---

### 斜杠命令列表

anycode 支持 **80+ 个斜杠命令**，以下列出关键命令：

#### 供应商与配置

| 命令 | 功能说明 |
|------|---------|
| `/provider` | 配置 LLM 供应商（选择预设或自定义） |
| `/switch` | 切换供应商 |
| `/config` | 打开设置面板 |
| `/model` | 切换当前供应商下的模型 |
| `/init` | 创建 `.anycode.md` 项目指令文件 |

#### 代理与计划

| 命令 | 功能说明 |
|------|---------|
| `/loop` | 定时循环执行任务（需 AGENT_TRIGGERS 功能门控） |
| `/fork` | 派生子代理进行并行工作（需 FORK_SUBAGENT 功能门控） |
| `/plan` | 进入计划模式（需 ULTRAPLAN 功能门控） |

#### 会话管理

| 命令 | 功能说明 |
|------|---------|
| `/compact` | 压缩对话上下文（释放 token 空间） |
| `/clear` | 清空当前对话上下文 |
| `/resume` | 恢复上一次会话 |
| `/continue` | 继续上一次会话 |

#### 工具与调试

| 命令 | 功能说明 |
|------|---------|
| `/help` | 显示所有可用命令 |
| `/exit` | 退出 anycode |
| `/tasks` | 任务管理 |
| `/memory` | 记忆/上下文管理 |
| `/mcp` | MCP 服务器管理 |
| `/rc` | 远程控制（连接 claude.ai） |

#### 快捷操作

| 命令 | 功能说明 |
|------|---------|
| `/commit` | 生成 Git 提交 |
| `/review-pr` | 审查 Pull Request |
| `/fast` | 切换快速模式 |

---

### 特殊模式

#### 1. 交互式 TUI 模式（默认）
```bash
anycode
```
启动完整的终端用户界面，支持实时流式输出、工具调用可视化、权限确认对话框。

#### 2. 非交互模式（脚本友好）
```bash
anycode -p "请解释这个代码库的架构"
anycode -p "阅读 main.py 并找出 bug" 
anycode -p "写一个 Python hello world" > hello.py
```
将结果输出到 stdout，适合在脚本、管道、CI/CD 中使用。

#### 3. 供应商配置向导
首次运行时自动触发，引导用户：
1. 从 9 个预设中选择供应商（或选择"自定义"）
2. 输入 API Key
3. （自定义模式下）输入 API Base URL
4. （自定义模式下）输入模型名称
5. 保存到 `~/.anycode/provider.json`

#### 4. 快速供应商切换
```bash
anycode --provider deepseek -p "你好"
```
在命令行直接指定供应商，无需修改配置文件。

#### 5. 计划模式（Plan Mode）
通过 `/plan` 命令或 `EnterPlanModeTool` 进入，用于结构化的多步骤任务规划。需要 ULTRAPLAN 功能门控。

#### 6. 远程控制模式（/rc）
通过 `/rc` 命令连接 claude.ai，实现远程会话桥接。anycode 已绕过原版的订阅检查。

#### 7. API 连接测试
```bash
anycode --test
```
测试当前配置的 API 连接是否正常。

#### 8. 供应商信息查看
```bash
anycode provider-info
```
显示当前配置的供应商详情。

---

### 配置系统

#### 配置文件位置

| 文件 | 用途 |
|------|-----|
| `~/.anycode/provider.json` | 供应商配置（baseUrl、apiKey、model） |
| `~/.anycode/settings.json` | 用户偏好设置（主题、权限规则等） |
| `~/.anycode/projects/` | 按项目存储的工作区信任状态 |
| `.anycode.md`（项目根目录） | 项目级指令文件 |
| `.anycode.local.md`（项目根目录） | 本地项目级指令文件（不提交到 Git） |

#### provider.json 示例

```json
{
  "provider": "DeepSeek",
  "baseUrl": "https://api.deepseek.com/v1",
  "apiKey": "sk-xxxxxxxxxxxxxxxx",
  "model": "deepseek-chat",
  "maxTokens": 8192,
  "contextWindow": 64000
}
```

#### 配置加载优先级

1. **环境变量** (`ANYCODE_*`) — 最高优先级
2. **配置文件** (`~/.anycode/provider.json`)
3. **回退到 Anthropic SDK**（原始认证方式）

---

### 构建系统

#### 构建流程

anycode 使用 **esbuild** 进行构建，分为 4 个阶段：

| 阶段 | 操作 |
|------|------|
| **阶段 1: 复制** | `src/` → `build-src/`（原始源码不修改） |
| **阶段 2: 源码变换** | `feature('X')` → `true`/`false`（编译时门控）<br>`MACRO.VERSION` → `'1.0.4'`（版本注入）<br>品牌替换（Claude Code → anycode）<br>移除 `bun:bundle` 导入 |
| **阶段 3: 入口封装** | 创建入口文件，注入 MACRO 全局变量 |
| **阶段 4: 打包** | esbuild 打包 → `dist/cli.js`<br>自动创建缺失模块桩代码<br>最多 5 轮迭代（打包→发现缺失→创建桩→重试） |

#### 构建命令

```bash
cd claude-code-source-code/
npm install
npm run build          # 执行 node scripts/build.mjs
node dist/cli.js       # 运行构建产物
```

#### 构建产物

- **输出文件：** `dist/cli.js`（单文件 ESM bundle）
- **需要：** Node.js >= 18
- **大小：** 约 10-12 MB

---

### 安装方式

#### 方式 A：从源码构建（推荐）

```bash
git clone https://github.com/ipangkang/claude-code-any.git
cd claude-code-any/claude-code-source-code/
npm install
npm run build
npm link     # 全局安装 anycode 命令
anycode      # 启动
```

#### 方式 B：pip 安装

```bash
pip install anycode-ai
anycode           # 启动交互模式
anycode-setup     # 运行配置向导
```

**要求：** Python >= 3.8, Node.js >= 18

#### 方式 C：直接运行预编译版本

```bash
node dist/cli.js --version
node dist/cli.js -p "Hello"
```

---

### 环境变量

| 环境变量 | 说明 | 示例 |
|---------|------|------|
| `ANYCODE_API_KEY` | API 密钥（优先于配置文件） | `sk-xxxx` |
| `ANYCODE_BASE_URL` | API 地址 | `https://api.deepseek.com/v1` |
| `ANYCODE_MODEL` | 模型名称 | `deepseek-chat` |
| `ANYCODE_MAX_TOKENS` | 最大输出 token 数 | `8192` |
| `ANYCODE_CONTEXT_WINDOW` | 上下文窗口大小 | `64000` |
| `ANYCODE_CONFIG_DIR` | 配置目录位置 | `~/.anycode` |

这些环境变量 **覆盖配置文件中的同名设置**，适合在 CI/CD 环境中使用。

---

### 项目指令文件

在项目根目录创建 `.anycode.md` 文件，为 anycode 提供项目上下文：

```markdown
# 项目：我的应用

## 技术栈
- Python 3.12, FastAPI, PostgreSQL

## 代码规范
- 全部使用类型注解
- 测试放在 tests/ 目录
- 运行 `pytest` 执行测试
```

anycode 按以下顺序查找项目指令文件：
1. `.anycode.md`
2. `.claude.md`（向后兼容）
3. `CLAUDE.md`（旧版兼容）

---

### Feature Gate 功能门控

anycode 在构建时启用了 **28+ 个功能门控**，将原版 Claude Code 中锁定的功能释放出来：

#### 已启用的功能

| Feature Gate | 功能 | 说明 |
|-------------|------|------|
| `AGENT_TRIGGERS` | `/loop` 命令 | 定时循环执行任务 |
| `BRIDGE_MODE` | `/rc` 远程控制 | 远程会话桥接 |
| `FORK_SUBAGENT` | `/fork` 命令 | 派生子代理 |
| `NEW_INIT` | `/init` 命令 | 创建项目指令文件 |
| `TOKEN_BUDGET` | Token 用量追踪 | 静默运行，无 UI 干扰 |
| `EXTRACT_MEMORIES` | 自动记忆提取 | 静默运行 |
| `TRANSCRIPT_CLASSIFIER` | 自动权限授予 | 基于转录分析自动判断 |
| `PROMPT_CACHE_BREAK_DETECTION` | 缓存优化 | 提示词缓存断裂检测 |
| `BASH_CLASSIFIER` | Bash 安全分析 | 命令安全性评估 |
| `CONNECTOR_TEXT` | 文本连接器 | 静默运行 |
| `LODESTONE` | 深度链接 | 静默运行 |
| `MESSAGE_ACTIONS` | 消息按钮 | UI 增强 |
| `MCP_SKILLS` | MCP 技能支持 | MCP 技能发现与加载 |
| `BUDDY` | Buddy 系统 | 伴随通知 |

#### 仍被禁用的功能（Anthropic 内部专用）

| Feature Gate | 功能 | 原因 |
|-------------|------|------|
| `KAIROS` | 完全自主代理模式 | 需要内部基础设施 |
| `VOICE_MODE` | 语音输入 | 需要 Anthropic WebSocket 端点 |
| `COORDINATOR_MODE` | 多代理协调器 | 内部模块缺失 |
| `DAEMON` | 后台守护进程 | 内部模块缺失 |
| `CONTEXT_COLLAPSE` | 上下文折叠 | 实验性功能 |
| `WORKFLOW_SCRIPTS` | 工作流脚本 | 内部模块缺失 |
| `PROACTIVE` | 主动通知 | 内部模块缺失 |

---

### 智能错误处理

OpenAI 适配器内置了完善的错误处理和自动重试机制：

#### 自动重试

| 错误类型 | 行为 |
|---------|------|
| **429 (限流)** | 指数退避重试（最多 2 次，间隔 1s→2s→8s） |
| **5xx (服务器错误)** | 指数退避重试 |
| **网络错误** | 自动重试 |
| **400 (参数不兼容)** | 自动切换 `max_completion_tokens` ↔ `max_tokens` |

#### 友好错误提示

| 错误情况 | 提示信息 |
|---------|---------|
| 连接被拒绝 (ECONNREFUSED) | "API 服务器是否在运行？" |
| 请求超时 (ETIMEDOUT) | "API 可能过载或不可达" |
| DNS 解析失败 (ENOTFOUND) | "检查 baseUrl 配置" |
| 认证失败 (401) | "检查 API Key" |
| 模型不存在 (404) | "检查 baseUrl 和 model 配置" |
| 限流 (429) | "请稍后重试" |

#### Token 参数自适应

不同供应商对 `max_tokens` / `max_completion_tokens` 参数的支持不一致。适配器会：
1. 优先使用 `max_completion_tokens`（OpenAI 新标准）
2. 如果返回 400 错误，自动切换为 `max_tokens`
3. 如果仍然失败，自动减半 token 限制重试

---

### DeepSeek-R1 推理链支持

anycode 对 DeepSeek-R1、QwQ 等推理模型提供了特殊支持。这些模型在最终回答前会返回 `reasoning_content` 推理过程。

**工作原理：**
1. 流式翻译器检测到 `delta.reasoning_content` 字段
2. 将其映射为 Anthropic 格式的 **"thinking block"（思考块）**
3. 在 UI 中作为思考过程展示
4. 当推理结束、正式回答开始时，自动关闭思考块并开启文本块

这意味着使用 DeepSeek-R1 时，你可以在终端中看到模型的推理过程，体验类似 Claude Sonnet 的 "extended thinking" 效果。

---

### MCP 协议支持

anycode 完整支持 **Model Context Protocol (MCP)**，版本 SDK `^1.29.0`。

- **连接 MCP 服务器：** 通过配置文件或 `/mcp` 命令
- **MCP 工具发现：** 自动发现 MCP 服务器提供的工具
- **MCP 资源访问：** 列出和读取 MCP 资源
- **MCP 认证：** 支持 MCP 服务器认证流程
- **MCP 技能：** 通过 MCP_SKILLS 门控启用技能发现

---

### 子代理系统

anycode 支持强大的子代理系统，可以并行处理多个任务：

- **AgentTool：** 启动独立子代理处理复杂多步骤任务
- **Worktree 隔离：** 子代理可以在独立的 Git Worktree 中工作，不影响主工作区
- **并行执行：** 多个子代理可以同时运行
- **专用代理类型：** 支持 general-purpose、Explore、Plan 等多种子代理类型
- **/fork 命令：** 在运行时派生子代理（需 FORK_SUBAGENT 门控）

---

### 会话管理

| 功能 | 说明 |
|------|------|
| **会话恢复** | `anycode --resume` 恢复上一次会话 |
| **会话继续** | `anycode --continue` 继续上一次会话 |
| **上下文压缩** | `/compact` 压缩对话历史释放 token |
| **会话历史** | 自动保存会话历史，支持回溯 |

---

### 安全与权限系统

anycode 完整保留了 Claude Code 的安全机制：

- **工作区信任对话框：** 首次打开项目时需要确认信任
- **工具权限审批：** 危险操作需要用户确认
- **Bash 安全分类器：** 自动分析终端命令的安全性（BASH_CLASSIFIER）
- **转录分类器：** 基于对话转录自动授予权限（TRANSCRIPT_CLASSIFIER）
- **XSS 防护：** 集成 xss 库进行内容过滤

---

### 依赖清单

#### 核心依赖

| 分类 | 依赖包 | 用途 |
|------|--------|------|
| **AI SDK** | `@anthropic-ai/sdk ^0.81.0` | 类型定义（请求通过适配器转译为 OpenAI） |
| **沙箱** | `@anthropic-ai/sandbox-runtime ^0.0.46` | 沙箱执行环境 |
| **MCP** | `@modelcontextprotocol/sdk ^1.29.0` | MCP 服务器集成 |
| **CLI** | `@commander-js/extra-typings ^14.0.0` | 命令行解析 |
| **UI 框架** | `react ^19.2.4` / `react-reconciler ^0.33.0` | 终端 UI 渲染 |
| **HTTP** | `axios ^1.14.0` | HTTP 客户端 |
| **代理** | `https-proxy-agent ^9.0.0` | 代理支持 |
| **WebSocket** | `ws ^8.20.0` | WebSocket 通信 |
| **文件差异** | `diff ^8.0.4` | 文本差异比较 |
| **Markdown** | `marked ^17.0.5` | Markdown 解析 |
| **JSON** | `jsonc-parser ^3.3.1` | 带注释的 JSON 解析 |
| **Gitignore** | `ignore ^7.0.5` | .gitignore 规则解析 |
| **Glob** | `picomatch ^4.0.4` | Glob 模式匹配 |
| **验证** | `zod ^4.3.6` / `ajv ^8.18.0` | 类型验证 / JSON Schema 验证 |
| **特性标记** | `@growthbook/growthbook ^1.6.5` | 功能标记（anycode 中已绕过） |
| **可观测性** | `@opentelemetry/api ^1.9.1` 等 | 日志、指标、追踪 |
| **终端样式** | `chalk ^5.6.2` / `figures ^6.1.0` | 终端颜色和 Unicode 符号 |
| **模糊搜索** | `fuse.js ^7.1.0` | 模糊匹配搜索 |
| **版本比较** | `semver ^7.7.4` | 语义化版本比较 |
| **文件监控** | `chokidar ^5.0.0` | 文件变化监控 |
| **进程** | `execa ^9.6.1` / `tree-kill ^1.2.2` | 进程执行与管理 |
| **QR码** | `qrcode ^1.5.4` | QR 码生成 |
| **安全** | `xss ^1.0.15` | XSS 防护 |

#### 构建依赖

| 依赖包 | 用途 |
|--------|------|
| `esbuild ^0.27.4` | JavaScript/TypeScript 打包器 |
| `typescript ^6.0.2` | TypeScript 编译器（类型检查） |

---

## 架构概览

```
┌─────────────────────────────────────────────────────────────────────┐
│                         入口层                                      │
│  cli.tsx ──> main.tsx ──> REPL.tsx (交互式 TUI)                    │
│                     └──> QueryEngine.ts (无头/SDK 模式)             │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       查询引擎                                      │
│  submitMessage(prompt) ──> AsyncGenerator<SDKMessage>               │
│    ├── fetchSystemPromptParts()    ──> 组装系统提示词               │
│    ├── processUserInput()          ──> 处理 / 命令                  │
│    ├── query()                     ──> 主代理循环                   │
│    │     ├── StreamingToolExecutor ──> 并行工具执行                  │
│    │     ├── autoCompact()         ──> 上下文压缩                   │
│    │     └── runTools()            ──> 工具编排                     │
│    └── yield SDKMessage            ──> 流式传输给消费者             │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    ★ OpenAI 适配器层 (核心创新)                      │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │  client.ts ──> 检测 provider 配置                          │     │
│  │     ├── 有配置 → createOpenAIAdapterClient()              │     │
│  │     └── 无配置 → 原版 Anthropic SDK                        │     │
│  ├────────────────────────────────────────────────────────────┤     │
│  │  openaiAdapter.ts:                                        │     │
│  │     translateRequest()   → Anthropic 格式 → OpenAI 格式   │     │
│  │     streamOpenAIResponse() → 发送请求，解析 SSE 流         │     │
│  │     createOpenAIAdapterClient() → 返回伪 Anthropic 客户端  │     │
│  ├────────────────────────────────────────────────────────────┤     │
│  │  openaiStreamTranslator.ts:                               │     │
│  │     OpenAI SSE chunk → Anthropic stream event             │     │
│  │     支持 reasoning_content → thinking block               │     │
│  ├────────────────────────────────────────────────────────────┤     │
│  │  providerConfig.ts:                                       │     │
│  │     9 个预设供应商 + 自定义                                 │     │
│  │     配置加载/保存/缓存                                     │     │
│  │     模型列表获取 (/v1/models)                              │     │
│  └────────────────────────────────────────────────────────────┘     │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│               任意 OpenAI 兼容 API 端点                             │
│               /v1/chat/completions                                  │
│  (OpenAI / DeepSeek / Qwen / GLM / Kimi / MiniMax / Ollama / ...) │
└─────────────────────────────────────────────────────────────────────┘
```

### 目录结构

```
claude-code-source-code/
├── bin/anycode                # CLI 入口脚本
├── src/                       # TypeScript 源码（~1,884 文件，~512K 行）
│   ├── main.tsx               # REPL 引导程序
│   ├── QueryEngine.ts         # SDK/无头查询引擎
│   ├── query.ts               # 主代理循环（最大文件 ~785KB）
│   ├── Tool.ts                # 工具接口 + buildTool 工厂
│   ├── tools.ts               # 工具注册、预设、过滤
│   ├── commands.ts            # 斜杠命令定义
│   ├── services/
│   │   └── api/
│   │       ├── client.ts            # API 客户端入口（检测供应商配置）
│   │       ├── openaiAdapter.ts     # ★ 核心适配器（请求/响应翻译）
│   │       ├── openaiStreamTranslator.ts  # ★ 流式事件翻译器
│   │       └── providerConfig.ts    # ★ 供应商配置管理
│   ├── components/
│   │   └── ProviderSetup.tsx  # ★ 供应商配置向导 UI
│   ├── bridge/                # 远程桥接
│   ├── cli/                   # CLI 基础设施
│   ├── commands/              # ~80 个斜杠命令实现
│   ├── hooks/                 # React hooks
│   ├── state/                 # 应用状态
│   ├── tasks/                 # 任务实现
│   ├── tools/                 # 40+ 工具实现
│   ├── types/                 # 类型定义
│   ├── utils/                 # 工具函数
│   └── vendor/                # 原生模块存根
├── scripts/
│   └── build.mjs              # 构建脚本（esbuild）
├── stubs/                     # Bun 编译时内建函数存根
├── pip-package/               # pip 发行版
├── docs/                      # 多语言分析文档
│   ├── en/                    # 英文
│   ├── zh/                    # 中文
│   ├── ja/                    # 日文
│   └── ko/                    # 韩文
├── dist/                      # 构建输出
├── package.json               # npm 配置
└── README.anycode.md          # anycode 说明
```

---

## 版本更新记录

---

### anycode v1.3.0 (2026-04-04)

**发行方式：** `pip install anycode-ai` / 源码构建  
**重要更新：** 完成全部 P0 优先级痛点修复

#### 更新内容

##### P0-1: 禁用 Anthropic 遥测

- **彻底切断向 Anthropic 发送遥测数据：** 当检测到第三方供应商配置时，`isAnalyticsDisabled()` 返回 `true`，Datadog 和 FirstParty 事件日志全部禁用
- 事件函数仍可调用（不破坏内部逻辑），但数据不再发送到任何外部端点
- 消除了无意义的网络请求和隐私顾虑

##### P0-2: 禁用 GrowthBook 远程功能标记

- **切断 GrowthBook 服务器连接：** GrowthBook 依赖 `is1PEventLoggingEnabled()`，遥测禁用后 GrowthBook 自动禁用
- 所有功能标记检查立即返回默认值，不再尝试连接 Anthropic 服务器
- 加快启动速度，消除功能被远程意外关闭的风险

##### P0-3: 修复费用显示

- **第三方供应商只显示 token 用量：** 不再显示虚假的美元费用（此前硬编码 Claude 定价，DeepSeek 实际 ¥0.01 显示 $0.50）
- 总计行显示 `Total tokens: xxx input, xxx output` 替代 `Total cost: $x.xx`
- 每个模型的用量明细也去掉了美元标注

##### P0-4: 隐藏不可用的 WebSearch 工具

- **第三方供应商自动隐藏 WebSearchTool：** `isEnabled()` 检测到 `__anycode_has_provider` 时直接返回 `false`
- 工具列表中不再显示 WebSearch，避免用户尝试后才发现不可用

##### P0-5: auth login 命令重定向

- **`anycode auth login` 不再进入 Anthropic OAuth 流程：** 检测到第三方供应商时，直接提示用户编辑 `~/.anycode/provider.json` 或使用 `/provider` 命令
- 避免用户困惑，以为需要 Anthropic 账号才能使用

---

### anycode v1.2.2 (2026-04-04)

**发行方式：** `pip install anycode-ai` / 源码构建

#### 更新内容

##### 新增

- **图片不支持时的用户提醒：** 当用户向不支持图片输入的供应商（如 MiniMax、DeepSeek、SiliconFlow、Ollama）上传图片时，终端会显示黄色警告提示，并建议切换到支持视觉的供应商
- **供应商图片能力标记：** 为 `ProviderPreset` 新增 `supportsImages` 字段，明确标记每个预设供应商的图片支持状态

##### 变更

- **图片安全降级：** 不支持图片的供应商不再将图片发送给 API（避免报错），而是替换为 `[Image omitted: current provider does not support image input]` 文本占位符
- **警告仅显示一次：** 同一会话中多次上传图片时，警告只在首次出现，不会重复刷屏

##### 各供应商图片支持状态

| 支持图片 | 不支持图片 |
|---------|-----------|
| OpenAI, Qwen, GLM, Kimi, Custom | MiniMax, DeepSeek, SiliconFlow, Ollama |

---

### anycode v1.2.1 (2026-04-02)

**发行方式：** `pip install anycode-ai` / 源码构建

#### 更新内容

##### 修复

- **修复 MiniMax M2.7 文本输出为空的问题：** MiniMax M2.7 的推理内容使用 `<think>...</think>` 标签包裹在 `content` 字段中（而非 DeepSeek-R1 的独立 `reasoning_content` 字段）。此前流式翻译器无法识别该格式，导致 `<think>` 标签内容混入正式回答，UI 显示异常（内容为空或显示原始标签）
- **流式翻译器新增 `<think>` 标签解析状态机：** 支持跨 chunk 边界的 `<think>`/`</think>` 标签检测，将推理内容正确分离为 thinking block，正式回答分离为 text block

##### 技术细节

- 新增 `_processContentWithThinkTags()` 方法：解析 content 中的 `<think>` 标签
- 新增 `_findPartialTag()` 方法：处理标签被 chunk 边界截断的情况
- 新增 `_emitThinking()` / `_emitText()` 辅助方法：统一管理 thinking/text block 的生命周期
- 支持两种推理格式：
  - **DeepSeek-R1 格式：** 独立的 `reasoning_content` 字段（原有支持）
  - **MiniMax 格式：** `content` 字段中的 `<think>...</think>` 标签（新增支持）

---

### anycode v1.2.0 (2026-04-02)

**发行方式：** `pip install anycode-ai` / 源码构建  
**版本统一：** npm、pip、构建脚本同步升级至 1.2.0

#### 更新内容

##### 修复

- **修复 MiniMax 服务商 401 认证失败：** MiniMax 已将 API 端点从 `api.minimax.chat` 迁移至 `api.minimax.io`，旧端点返回 401 错误。已更新预设配置
- **修正 MiniMax 上下文窗口：** 从错误的 1,000,000 修正为官方标注的 204,800 tokens
- **同步修复 setup_wizard.py：** pip 包的 Python 配置向导中 MiniMax 预设同步更新

##### 新增

- **功能兼容性对照表：** 新增完整的功能支持状态说明，明确标注每个 Claude Code 功能在 anycode 中属于"完全支持"、"部分支持"还是"不支持"
- **供应商特定限制说明：** 针对 MiniMax、Ollama、SiliconFlow、Kimi 等供应商分别标注已知限制
- **功能支持树状图：** 以直观的树状结构展示核心编程能力、AI 模型交互、网络功能、Anthropic 专属功能的支持状态

##### 变更

- **MiniMax 默认模型：** 从 `MiniMax-Text-01` 更新为 `MiniMax-M2.7`（MiniMax 最新旗舰模型，~60 tokens/s）
- **MiniMax API 端点：** `https://api.minimax.chat/v1` → `https://api.minimax.io/v1`
- **MiniMax 可用模型列表更新：** MiniMax-M2.7, M2.7-highspeed, M2.5, M2.5-highspeed, M2.1, M2.1-highspeed, M2
- **pip 包 README 改为中文：** 包含完整的服务商列表和版本记录
- **版本号统一：** npm (`package.json`)、pip (`pyproject.toml`)、构建脚本 (`build.mjs`) 统一为 1.2.0

---

### anycode-ai v1.1.2 (pip 发行版)

**发行方式：** `pip install anycode-ai`  
**要求：** Python >= 3.8, Node.js >= 18  
**许可证：** MIT

#### 更新内容

- **新增 pip 安装方式：** 通过 `pip install anycode-ai` 即可安装，无需手动 clone 和构建
- **新增 `anycode` CLI 入口：** pip 安装后可直接在终端运行 `anycode` 命令
- **新增 `anycode-setup` 配置向导：** 独立的配置向导命令，方便首次设置
- **打包 Node.js bundle：** 将编译好的 `dist/cli.js` 内嵌到 Python 包中
- **版本号升级至 1.1.2：** 区分于 npm 版本，独立维护 PyPI 版本线
- **关键词标签：** ai, coding, agent, llm, openai, deepseek, qwen, terminal, cli

---

### anycode v1.0.4 (构建脚本版)

**构建方式：** `node scripts/build.mjs`  
**要求：** Node.js >= 18

#### 更新内容

- **Feature Gate 全面启用：** 启用 28+ 个功能门控，包括：
  - `AGENT_TRIGGERS` — `/loop` 定时循环
  - `BRIDGE_MODE` — `/rc` 远程控制
  - `FORK_SUBAGENT` — `/fork` 子代理
  - `NEW_INIT` — `/init` 项目初始化
  - `TOKEN_BUDGET` — Token 用量追踪
  - `EXTRACT_MEMORIES` — 自动记忆提取
  - `TRANSCRIPT_CLASSIFIER` — 自动权限授予
  - `PROMPT_CACHE_BREAK_DETECTION` — 缓存优化
  - `BASH_CLASSIFIER` — Bash 安全分析
  - `CONNECTOR_TEXT` — 文本连接器
  - `LODESTONE` — 深度链接
  - `MESSAGE_ACTIONS` — 消息按钮
  - `MCP_SKILLS` — MCP 技能支持
  - `BUDDY` — Buddy 系统通知
- **品牌替换全覆盖：** 将源码中所有 "Claude Code" 替换为 "anycode"，包括：
  - CLI 命令 `claude` → `anycode`
  - 配置目录 `~/.claude/` → `~/.anycode/`
  - 项目指令 `CLAUDE.md` → `.anycode.md`
  - 系统提示词中的身份描述
  - claude.ai 链接替换
  - 各种 CLI 参数提示文本
- **Node.js 22 兼容性修复：**
  - 注入 `createRequire` 解决 ESM 环境下 CJS 模块兼容问题
  - 修复 `jsonc-parser` 在 Node 22 下的 ESM 导入问题
  - 强制打包 `jsonc-parser` 和 `color-diff-napi` 以避免 ESM 兼容性问题
- **esbuild 构建插件：**
  - `chrome-mcp-stub` — 桩代码替换 Anthropic 内部 Chrome MCP 包
  - `src-alias` — 修复 `src/` 和 `build-src/src/` 路径重复问题
  - `force-bundle-broken-esm` — 强制打包 ESM 不兼容的包
- **迭代式桩代码生成：** 最多 5 轮自动发现缺失模块并创建桩代码
- **版本注入：** `MACRO.VERSION` → `'1.0.4'`

---

### anycode v1.0.0 (npm 核心版)

**基于：** Claude Code v2.1.88  
**类型：** Provider-Agnostic 重构版

#### 核心新增

##### 1. OpenAI 适配器层（核心创新）

新增三个核心文件，实现 Anthropic SDK → OpenAI API 的完整翻译：

**`src/services/api/openaiAdapter.ts`**
- 请求翻译：将 Anthropic 消息格式转换为 OpenAI 消息格式
- 工具翻译：Anthropic `tools[]` → OpenAI `functions[]`
- 参数映射：`tool_choice`、`max_tokens`、`temperature` 等
- 流式 SSE 解析：解析 OpenAI 的 Server-Sent Events 流
- 自动重试：429/5xx 指数退避重试
- Token 参数自适应：自动切换 `max_completion_tokens` ↔ `max_tokens`
- 友好错误提示：DNS/连接/超时/认证/模型错误的诊断提示
- 伪 Anthropic 客户端工厂：返回与 Anthropic SDK 完全兼容的客户端对象

**`src/services/api/openaiStreamTranslator.ts`**
- 状态机设计：追踪活跃的内容块（text、tool_use、thinking）
- OpenAI chunk → Anthropic event 逐事件翻译
- DeepSeek-R1 推理链支持：`reasoning_content` → thinking block
- 工具调用缓冲：累积 JSON 片段
- 使用量统计：收集 prompt_tokens / completion_tokens
- 停止原因映射：`"stop"` → `"end_turn"`, `"tool_calls"` → `"tool_use"`

**`src/services/api/providerConfig.ts`**
- 9 个预设供应商定义（含 baseUrl、默认模型、token 限制、上下文窗口）
- 配置文件读写：`~/.anycode/provider.json`
- 环境变量覆盖支持：`ANYCODE_*` 系列变量
- 同步/异步配置缓存
- 供应商查找（大小写不敏感、部分匹配）
- 模型列表获取：通过 `/v1/models` 端点

##### 2. 供应商配置向导 UI

**`src/components/ProviderSetup.tsx`**
- React/Ink 终端 UI 组件
- 交互式分步流程：选择供应商 → 输入 API Key → （自定义）输入 URL → 选择模型
- API Key 输入掩码显示（仅显示后 4 位）
- 配置完成后设置全局标记 `__anycode_has_provider`
- 自动跳过不需要的步骤（预设供应商不需要输入 URL 和模型名）

##### 3. 认证绕过

- `bridgeEnabled.ts` 中检测 `__anycode_has_provider` 全局标记
- `isClaudeAISubscriber()` 对 anycode 用户始终返回 `true`
- 绕过 GrowthBook 功能标记检查
- 绕过 OAuth token 要求
- 绕过 claude.ai 订阅要求

##### 4. API 客户端入口修改

**`src/services/api/client.ts` (第 101-111 行)**
- 检测是否存在供应商配置
- 有配置 → 使用 `createOpenAIAdapterClient()` 创建适配器客户端
- 无配置 → 回退到原版 Anthropic SDK（保持向后兼容）

---

### Claude Code v2.1.88 (上游基线)

**来源：** npm 包 `@anthropic-ai/claude-code` v2.1.88  
**版权：** Anthropic PBC  
**类型：** 原始源码提取

#### 基线统计

| 项目 | 数量 |
|------|------|
| TypeScript 源文件 | ~1,884 个 |
| 代码行数 | ~512,664 行 |
| 最大单文件 | `query.ts` (~785KB) |
| 内置工具 | ~40+ 个 |
| 斜杠命令 | ~80+ 个 |
| npm 依赖 | ~192 个包 |
| 原始运行时 | Bun（编译为 Node.js >= 18 bundle） |

#### 原版功能清单

- **代理循环：** 消息 → Claude API → 响应 → 工具调用 → 循环
- **流式工具执行器：** 并行执行多个工具调用
- **上下文自动压缩：** 接近 token 限制时自动压缩历史
- **权限系统：** 基于工具和操作的分级审批
- **MCP 协议：** 完整的 Model Context Protocol 支持
- **React/Ink TUI：** 基于 React 的终端用户界面
- **会话管理：** 会话保存、恢复、继续
- **Git 集成：** Worktree 隔离、提交生成、PR 审查
- **子代理：** 并行子代理执行
- **网页工具：** 网页获取与搜索

#### 108 个缺失模块

由于 Bun 编译时的 `feature()` 门控机制，有 108 个模块在发布的 npm 包中被死代码消除，仅存在于 Anthropic 内部 monorepo 中。主要包括：

- **守护进程模块 (~5)：** `daemon/main.js`, `daemon/workerRegistry.js` 等
- **主动通知模块 (~3)：** `proactive/index.js` 等
- **上下文折叠模块 (~3)：** `contextCollapse/` 系列
- **远程技能搜索 (~6)：** `skillSearch/` 系列
- **多代理协调器 (~1)：** `coordinator/workerAgent.js`
- **桥接对等会话 (~1)：** `bridge/peerSessions.js`
- **KAIROS 助手 (~2)：** `assistant/` 系列
- **会话转录 (~2)：** `sessionTranscript/` 系列
- **工作流系统 (~2)：** `workflows/`, `LocalWorkflowTask/`
- **内部命令 (~10+)：** `commands/agents-platform/`, `commands/buddy/` 等
- **内部工具 (~17)：** REPLTool, WebBrowserTool, WorkflowTool 等
- **其他内部模块 (~50+)：** 遥测、归属、开发工具等

#### 未来路线图（源码中发现的线索）

| 特性 | 代号/标记 | 状态 | 描述 |
|------|----------|------|------|
| **下一代模型** | Numbat | 开发中 | 下一代模型代号，代码中有 20+ 处 `@[MODEL LAUNCH]` 标记 |
| **Opus 4.7** | — | 开发中 | 下一代 Opus 模型 |
| **Sonnet 4.8** | — | 开发中 | 下一代 Sonnet 模型 |
| **完全自主代理** | KAIROS | 门控 | 通过 `<tick>` 心跳保持活跃，可独立 commit/push |
| **语音输入** | VOICE_MODE | 门控 | Push-to-talk 语音模式，连接 voice_stream WebSocket |
| **浏览器自动化** | WEB_BROWSER_TOOL | 门控 | 内置浏览器自动化（代号 bagel） |
| **工作流脚本** | WORKFLOW_SCRIPTS | 门控 | 预定义工作流执行 |
| **多代理协调** | COORDINATOR_MODE | 门控 | 多代理协作模式 |
| **GitHub PR 订阅** | KAIROS_GITHUB_WEBHOOKS | 门控 | 监控 PR 变更并推送通知 |
| **推送通知** | KAIROS_PUSH_NOTIFICATION | 门控 | 向用户设备发送通知 |
| **终端面板** | TERMINAL_PANEL | 门控 | 终端捕获和监控 |
| **上下文折叠** | CONTEXT_COLLAPSE | 门控 | 实验性上下文折叠服务 |

---

## 功能兼容性对照表（支持 vs 不支持）

> 以下是 anycode 相对于原版 Claude Code 的功能兼容性详细对照。  
> **"支持"** = 使用第三方模型时功能正常可用  
> **"部分支持"** = 功能可用但有限制或降级  
> **"不支持"** = 功能完全不可用或依赖 Anthropic 基础设施

### 完全支持的功能

| 功能 | 说明 |
|------|------|
| **OpenAI 兼容 API 调用** | 核心功能。所有 API 请求通过适配器翻译为 OpenAI 格式，上层代码无感知 |
| **文件操作工具** | Read、Write、Edit、Glob、Grep 全部可用，与模型供应商无关 |
| **终端命令 (Bash)** | BashTool 完全可用，命令执行在本地，不依赖任何 API |
| **代码编辑 (Edit)** | 精确字符串替换编辑，本地执行 |
| **文件搜索 (Glob/Grep)** | 本地文件搜索，与模型无关 |
| **网页获取 (WebFetch)** | 直接通过 HTTP 获取网页内容，不经过 Anthropic 代理 |
| **子代理系统 (Agent)** | 子代理自动继承父代理的供应商配置，并行执行正常 |
| **Git Worktree 隔离** | 完全本地操作，与模型无关 |
| **MCP 协议** | Model Context Protocol 服务器连接、工具发现、资源访问均正常 |
| **权限系统** | 工具审批、工作区信任对话框完整保留 |
| **上下文自动压缩 (/compact)** | 根据配置的 contextWindow 自动压缩，适配各供应商 |
| **会话管理** | 保存、恢复、继续会话完全可用 |
| **自动记忆提取** | 通过 EXTRACT_MEMORIES 门控启用，使用配置的模型执行 |
| **沙箱运行时** | `@anthropic-ai/sandbox-runtime` 是本地组件，不依赖 Anthropic |
| **项目指令文件 (.anycode.md)** | 本地文件读取，与模型无关 |
| **非交互模式 (-p)** | 脚本/管道模式完全可用 |
| **环境变量配置** | ANYCODE_* 系列环境变量正常工作 |
| **供应商配置向导** | 首次运行的交互式配置完全可用 |
| **Jupyter Notebook 编辑** | NotebookEditTool 本地执行 |
| **LSP 集成** | Language Server Protocol 本地通信 |
| **PowerShell (Windows)** | 本地执行，与模型无关 |

### 部分支持的功能

| 功能 | 支持程度 | 限制说明 |
|------|---------|---------|
| **图片/多模态输入** | 大部分可用 | 适配器正确转换 Anthropic 图片格式为 OpenAI 格式（base64 和 URL）。但需要模型本身支持视觉能力（如 gpt-4o 支持，gpt-3.5 不支持） |
| **PDF 文件阅读** | 大部分可用 | 通过 FileReadTool 读取后作为图片块发送。需要模型支持视觉能力 |
| **DeepSeek-R1 推理链** | 仅限特定模型 | 适配器将 `reasoning_content` 映射为 thinking block。仅 DeepSeek-R1、QwQ 等返回该字段的模型可用 |
| **Extended Thinking（扩展思考）** | 仅限特定模型 | 需要模型支持 thinking 配置。Claude 原生支持，OpenAI o1/o3 部分支持，其他模型不支持 |
| **费用追踪** | 显示但不准确 | 定价表硬编码为 Claude 模型价格。使用第三方模型时会回退到 Sonnet 定价（默认值），**显示的费用与实际不符** |
| **Bash 安全分类器** | 取决于模型能力 | 使用配置的模型进行命令安全分析，模型能力较弱时分类准确度下降 |
| **转录分类器（自动权限）** | 取决于模型能力 | 使用配置的模型判断是否自动授予权限，模型能力较弱时可能误判 |
| **远程控制 (/rc)** | 需额外条件 | `__anycode_has_provider` 标记绕过了订阅检查，但仍依赖 GrowthBook 功能标记和 Anthropic 的桥接服务基础设施。实际连接可能失败 |
| **斜杠命令 /model** | 基本可用 | 可切换模型，但模型列表通过 `/v1/models` 端点获取，部分供应商不支持该端点或返回格式不同 |
| **自动更新检查** | 指向错误源 | 仍检查原版 `@anthropic-ai/claude-code` 的 npm 包版本，不适用于 anycode |

### 不支持的功能

| 功能 | 原因 |
|------|------|
| **网页搜索 (WebSearch)** | 使用 Anthropic SDK 的 `BetaWebSearchTool20250305`，直接调用 Anthropic 搜索基础设施。**第三方模型无法使用** |
| **语音模式 (Voice Mode)** | 硬编码需要 Anthropic OAuth token，连接 `voice_stream` WebSocket 端点。**架构限制，无法修复** |
| **OAuth 登录 (auth login)** | `anycode auth login` 仍尝试与 Anthropic OAuth 服务通信。**第三方供应商用户不需要此功能** |
| **GrowthBook 功能标记** | 仍尝试连接 Anthropic 的 GrowthBook 服务器获取功能开关。**服务器不可达时使用安全默认值，但部分功能可能被意外禁用** |
| **遥测/数据分析** | 分析事件仍路由到 Anthropic 的 Datadog + FirstParty 日志端点。**未完全禁用，会产生无意义的网络请求** |
| **KAIROS 自主代理** | 需要 108 个缺失的内部模块（daemon、proactive、assistant 等）。**代码在 npm 发布时被死代码消除** |
| **工作流脚本 (Workflow)** | 需要 `WORKFLOW_SCRIPTS` 门控模块，已被编译时移除 |
| **上下文折叠 (Context Collapse)** | 需要内部模块 `contextCollapse/`，已被编译时移除 |
| **多代理协调器 (Coordinator)** | 需要内部模块 `coordinator/workerAgent.js`，已被编译时移除 |
| **主动通知 (Proactive)** | 需要内部模块 `proactive/`，已被编译时移除 |
| **远程技能搜索** | 需要内部模块 `skillSearch/`，已被编译时移除 |
| **浏览器自动化 (WebBrowser)** | 需要 `WEB_BROWSER_TOOL` 门控模块，已被编译时移除 |
| **终端面板捕获** | 需要 `TERMINAL_PANEL` 门控模块，已被编译时移除 |
| **GitHub PR 订阅** | 需要 `KAIROS_GITHUB_WEBHOOKS` 门控模块，已被编译时移除 |
| **推送通知** | 需要 `KAIROS_PUSH_NOTIFICATION` 门控模块，已被编译时移除 |

### 供应商特定限制

| 供应商 | 已知限制 |
|--------|---------|
| **MiniMax** | 已更新至新版 API 端点 (`api.minimax.io`)。不支持图片和文档输入。`-highspeed` 后缀变体速度更快（~100 tokens/s vs ~60 tokens/s）。温度参数范围 (0.0, 1.0]，推荐值 1.0。多轮工具调用时需保留完整助手消息（含 thinking 内容） |
| **Ollama** | 不支持 `stream_options.include_usage`（适配器已做特殊处理跳过）。本地模型能力有限，复杂工具调用可能失败 |
| **SiliconFlow** | 作为模型聚合平台，不同底层模型的工具调用能力差异大 |
| **Kimi (Moonshot)** | 工具调用格式可能有细微差异，复杂场景下可能出错 |
| **通用限制** | 所有供应商的 `max_tokens` / `max_completion_tokens` 参数兼容性不同，适配器会自动尝试切换，但某些供应商可能仍然报错 |

### 功能支持一览图

```
功能状态图例: ✅ 完全支持  ⚠️ 部分支持  ❌ 不支持

核心编程能力
├── ✅ 文件读取/写入/编辑
├── ✅ 终端命令执行
├── ✅ 代码搜索 (Glob/Grep)
├── ✅ 子代理并行执行
├── ✅ Git Worktree 隔离
├── ✅ MCP 协议
└── ✅ 权限与安全系统

AI 模型交互
├── ✅ OpenAI 兼容 API 调用
├── ✅ 流式响应
├── ✅ 函数调用 / 工具使用
├── ⚠️ 图片/多模态 (需模型支持)
├── ⚠️ 推理链显示 (仅 DeepSeek-R1/QwQ)
├── ⚠️ Extended Thinking (仅特定模型)
└── ⚠️ 费用追踪 (显示不准确)

网络功能
├── ✅ 网页获取 (WebFetch)
├── ❌ 网页搜索 (WebSearch) — 需 Anthropic 后端
└── ⚠️ 远程控制 (/rc) — 需 Anthropic 基础设施

Anthropic 专属功能
├── ❌ 语音模式
├── ❌ OAuth 登录
├── ❌ GrowthBook 功能标记
├── ❌ 遥测数据 (仍发送至 Anthropic)
└── ❌ 自动更新 (检查原版包)

被编译时移除的功能 (108 个内部模块)
├── ❌ KAIROS 自主代理
├── ❌ 工作流脚本
├── ❌ 上下文折叠
├── ❌ 多代理协调器
├── ❌ 主动通知
├── ❌ 浏览器自动化
├── ❌ 远程技能搜索
└── ❌ 终端面板捕获
```

---

## 免责声明

> **本仓库中所有源码版权归 Anthropic 和 Claude 所有。** 本仓库仅用于技术研究和科研爱好者交流学习参考。**严禁任何个人、机构及组织将其用于商业用途、盈利性活动、非法用途及其他未经授权的场景。** 若内容涉及侵犯您的合法权益、知识产权或存在其他侵权问题，请及时联系我们，我们将第一时间核实并予以删除处理。

---

## 技术支持

如有问题或建议，请在 GitHub Issues 中提出。

**系统要求：**
- Node.js >= 18
- 模型需支持函数调用（Function Calling / Tool Use）
- 模型需支持流式响应（Streaming）

# anycode

万能编程智能体 — 用 **任意 OpenAI 兼容大模型** 驱动你的终端 AI 编程助手。

基于 Claude Code v2.1.88 重构，完整保留所有代理能力，支持第三方模型。

## 安装

```bash
pip install anycode-ai
```

**要求：** Node.js >= 18（[安装](https://nodejs.org)）

## 快速开始

```bash
# 首次运行 — 交互式配置向导
anycode

# 非交互模式
anycode -p "解释这个代码库"

# 测试连接
anycode --test

# 查看当前配置
anycode provider-info
```

## 支持的服务商

| 服务商 | 模型 | API 地址 |
|--------|------|---------|
| **OpenAI** | gpt-4o, gpt-4o-mini, o1, o3 | api.openai.com |
| **DeepSeek** | deepseek-chat, deepseek-reasoner (R1) | api.deepseek.com |
| **Qwen（通义千问）** | qwen-max, qwen-plus, qwen-turbo | dashscope.aliyuncs.com |
| **MiniMax** | MiniMax-M2.7, M2.5, M2.1, M2 | api.minimax.io |
| **GLM（智谱清言）** | glm-4-plus, glm-4 | open.bigmodel.cn |
| **SiliconFlow（硅基流动）** | DeepSeek-V3, Qwen2.5 | api.siliconflow.cn |
| **Kimi（月之暗面）** | moonshot-v1-auto | api.moonshot.cn |
| **Ollama（本地模型）** | llama3, codellama, mistral | localhost:11434 |
| **任意 OpenAI 兼容 API** | 任意模型 | 任意端点 |

## 配置

```bash
# 环境变量（CI/CD 友好）
export ANYCODE_API_KEY="sk-..."
export ANYCODE_BASE_URL="https://api.deepseek.com/v1"
export ANYCODE_MODEL="deepseek-chat"
anycode -p "修复这个 bug"

# 或使用配置文件：~/.anycode/provider.json
```

## 核心能力

- **Bash** — 执行终端命令
- **Read / Write / Edit** — 文件读写编辑
- **Grep / Glob** — 代码搜索
- **Agent** — 子代理并行执行
- **WebFetch** — 获取网页内容
- **MCP** — Model Context Protocol 协议支持
- **Worktree** — Git 工作区隔离

## 版本记录

### v1.2.0
- 修复 MiniMax 服务商配置：API 端点迁移至 `api.minimax.io`，默认模型更新为 MiniMax-M2.7
- 新增 Kimi（月之暗面）预设服务商
- 更新上下文窗口配置（MiniMax: 204,800 tokens）
- 新增详尽的中文功能支持列表与功能兼容性对照表
- 明确标注支持/部分支持/不支持的功能

### v1.1.2
- 首个 PyPI 发行版
- pip install 一键安装
- 交互式供应商配置向导
- 支持 8 个预设服务商 + 自定义端点

## GitHub

[github.com/ipangkang/claude-code-any](https://github.com/ipangkang/claude-code-any)

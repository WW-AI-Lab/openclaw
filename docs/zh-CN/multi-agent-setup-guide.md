# OpenClaw 多 Agent 协同配置指南

> 更新日期：2026-03-03  
> 适用版本：OpenClaw 2026.3.x  
> 验证状态：已在本地实测通过

## 概述

OpenClaw 支持在单个 Gateway 上运行多个独立 Agent，每个 Agent 拥有独立的工作空间、会话存储和身份配置。通过 `sessions_spawn`（子 agent 派遣）和 `sessions_send`（跨 agent 消息）两种机制，可以让多个 Agent 像一个团队一样协同工作。

## 团队架构

```
┌──────────────────────────────────────────────┐
│              AI旺旺 (main)                    │
│           团队总指挥 / 调度中心                 │
│                                              │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐      │
│  │sessions │ │sessions  │ │sessions  │      │
│  │_spawn   │ │_spawn    │ │_send     │      │
│  └────┬────┘ └─────┬────┘ └─────┬────┘      │
└───────┼────────────┼────────────┼────────────┘
        │            │            │
   ┌────▼────┐  ┌────▼─────┐  ┌──▼───────┐
   │CodeClaw │  │Research  │  │TradeClaw │
   │  💻     │  │Claw 🔬   │  │  🌐      │
   │工程执行  │  │技术调研   │  │电商分析   │
   └─────────┘  └──────────┘  └──────────┘
```

## 配置要点

### 1. 核心配置项（openclaw.json）

#### 全局子 agent 默认配置

```json
{
  "agents": {
    "defaults": {
      "subagents": {
        "maxConcurrent": 12,
        "maxSpawnDepth": 2,
        "maxChildrenPerAgent": 5,
        "archiveAfterMinutes": 120,
        "model": {
          "primary": "bailian/qwen3.5-plus"
        },
        "thinking": "medium",
        "runTimeoutSeconds": 300
      }
    }
  }
}
```

| 参数 | 说明 | 建议值 |
|------|------|-------|
| `maxConcurrent` | 全局子 agent 并发数上限 | 8-12 |
| `maxSpawnDepth` | 最大嵌套深度（A spawn B, B spawn C） | 2 |
| `maxChildrenPerAgent` | 每个会话最多活跃子 agent 数 | 5 |
| `archiveAfterMinutes` | 子 agent 完成后自动归档时间 | 60-120 |
| `model` | 子 agent 默认使用的模型（可选用更便宜的） | 按成本选择 |
| `thinking` | 子 agent 默认 thinking 级别 | "medium" |
| `runTimeoutSeconds` | 单次 run 超时秒数 | 300 |

#### 每个 Agent 的 spawn 权限

```json
{
  "agents": {
    "list": [
      {
        "id": "main",
        "subagents": {
          "allowAgents": ["*"]
        }
      },
      {
        "id": "coder",
        "subagents": {
          "allowAgents": ["main", "coder", "ai-researcher"]
        }
      }
    ]
  }
}
```

**注意：** `allowAgents` 只在 `agents.list[].subagents` 下有效，不在 `agents.defaults.subagents` 下。

#### Agent-to-Agent 消息（tools.agentToAgent）

```json
{
  "tools": {
    "agentToAgent": {
      "enabled": true,
      "allow": ["main", "coder", "ai-researcher", "ecommerce"]
    },
    "sessions": {
      "visibility": "all"
    }
  }
}
```

**关键：** 必须同时满足：
1. `tools.agentToAgent.enabled` = `true`
2. `tools.agentToAgent.allow` 列出允许互通的 agent
3. `tools.sessions.visibility` = `"all"`（否则跨 agent 访问被拒绝）

#### Ping-Pong 回合数

```json
{
  "session": {
    "agentToAgent": {
      "maxPingPongTurns": 3
    }
  }
}
```

控制 `sessions_send` 的请求-回复最大往返次数（0-5），避免无限对话循环。

### 2. SOUL.md 团队协作指令

#### main agent（总指挥）

在 SOUL.md 中必须包含：
- 团队成员表（agent id、名字、专长、何时派遣）
- 协作协议（何时 spawn vs send vs 自己处理）
- spawn 指令模板（目标、上下文、产出要求、约束）
- 结果整合规则

#### 专家 agent（coder/researcher/ecommerce）

在 SOUL.md 中必须包含：
- 明确自己在团队中的角色
- 说明任务来源（通常来自 main 的 sessions_spawn）
- 回报格式要求（结构化、可直接使用）
- 可以请求协助的其他 agent

### 3. AGENTS.md 协作规则

在各 agent 的 AGENTS.md 中记录：
- 可用的协作工具（sessions_spawn, sessions_send, agents_list 等）
- 任务分派决策树
- spawn 关键参数说明
- 结果整合流程

## 可用的协作工具

| 工具 | 用途 | 使用场景 |
|------|------|---------|
| `agents_list` | 列出所有可用 agent | 发现团队成员 |
| `sessions_spawn` | 创建子 agent 执行任务 | 派遣专家执行深度任务 |
| `sessions_send` | 向已有会话发送消息 | 跨 agent 消息传递 |
| `sessions_list` | 列出所有会话 | 监控任务状态 |
| `sessions_history` | 查看会话历史 | 获取任务结果 |
| `session_status` | 查看会话状态 | 检查任务进度 |

## 协作流程

### sessions_spawn（子 agent 派遣）

```
main 收到用户任务
  → main 分析任务性质
  → main 调用 sessions_spawn(agentId="coder", task="...")
  → coder 在独立会话中执行任务
  → coder 完成后自动 announce 结果回传给 main
  → main 整合结果回复用户
```

### sessions_send（跨 agent 消息）

```
main 需要查询 ecommerce 的专业意见
  → main 调用 sessions_send(target="agent:ecommerce:main", message="...")
  → ecommerce 在自己的会话中处理消息
  → ecommerce 回复
  → main 收到回复（ping-pong 模式，最多 maxPingPongTurns 轮）
```

## 验证检查清单

1. `openclaw doctor --fix` — 检查配置合法性
2. `openclaw agents list --bindings` — 确认所有 agent 正确加载
3. `openclaw channels status --probe` — 确认 gateway 运行正常
4. 发送测试消息验证 `agents_list` 工具可用
5. 发送测试消息验证 `sessions_spawn` 端到端流程
6. 发送测试消息验证 `sessions_send` 跨 agent 通信

## 常见问题

### Q: sessions_spawn 后看不到结果？
A: 子 agent 完成后会自动回传（announce），不需要轮询。如果长时间无回传，检查：
- gateway.log 中子 agent 的 runId 是否有错误
- 子 agent 使用的模型是否可用
- `runTimeoutSeconds` 是否设置过短

### Q: sessions_send 报 "forbidden"？
A: 检查三个配置是否同时满足：
- `tools.agentToAgent.enabled = true`
- `tools.agentToAgent.allow` 包含了请求方和目标方
- `tools.sessions.visibility = "all"`

### Q: allowAgents 配置在哪里？
A: 只能在 `agents.list[].subagents.allowAgents`，不能在 `agents.defaults.subagents`。
`agents.defaults.subagents` 只支持 `maxConcurrent`、`maxSpawnDepth`、`model` 等全局默认值。

### Q: 子 agent 可以再 spawn 子 agent 吗？
A: 可以，由 `maxSpawnDepth` 控制。设为 2 表示允许两层嵌套（A→B→C）。

## 成本优化

- 主 agent 使用高能力模型（如 gpt-5.3-codex）做判断和调度
- 子 agent 使用较便宜的模型（如 qwen3.5-plus）做具体执行
- 通过 `agents.defaults.subagents.model` 设置全局子 agent 默认模型
- 简单任务自己处理，只有深度任务才 spawn

## 参考资源

- [OpenClaw 多 Agent 路由文档](https://docs.openclaw.ai/concepts/multi-agent)
- [OpenClaw 多 Agent 最佳实践 (GitHub Discussion #16075)](https://github.com/openclaw/openclaw/discussions/16075)
- 源码：`src/agents/subagent-spawn.ts`、`src/agents/tools/sessions-access.ts`

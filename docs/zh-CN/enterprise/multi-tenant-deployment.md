# 企业多租户 OpenClaw 部署方案

> **文档版本**: v1.2
> **更新日期**: 2026-03-04
> **重要更新**: 发现 OpenClaw 内置支持用户级过滤！

---

## 🎯 快速结论

**OpenClaw 已经内置了用户级别的消息过滤！**

你只需要：
1. **所有电脑使用同一个飞书应用凭证**
2. **每个人配置不同的 `allowFrom`（自己的 open_id）**
3. **设置 `dmPolicy: "allowlist"`**

不需要任何外部代理或额外开发！

---

## 目录

1. [方案对比](#1-方案对比)
2. [方案一：allowList 过滤（推荐）](#2-方案一allowlist-过滤推荐)
3. [方案二：外部代理层](#3-方案二外部代理层)
4. [部署指南](#4-部署指南)
5. [故障排查](#5-故障排查)

---

## 1. 方案对比

| 特性 | 方案一：allowList 过滤 | 方案二：外部代理层 |
|------|---------------------|------------------|
| **实现复杂度** | ✅ 极低（只需配置） | ❌ 高（需开发代理服务） |
| **部署成本** | ✅ 无需额外服务器 | ❌ 需要中心服务器 |
| **网络要求** | ✅ 无需公网 IP | ❌ 需要公网 IP + 域名 |
| **数据隔离** | ✅ 完全隔离 | ✅ 完全隔离 |
| **故障影响** | ✅ 单机故障不影响他人 | ❌ 代理故障影响所有 |
| **维护成本** | ✅ 几乎为零 | ❌ 需要运维 |
| **适用场景** | 个人/小团队（推荐） | 大规模集中管理 |

---

## 2. 方案一：allowList 过滤（推荐）

### 2.1 工作原理

```
┌─────────────────────────────────────────────────────────────────────┐
│                          飞书服务器                                  │
│                      (单一飞书应用)                                   │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            │ 广播消息到所有连接
          ┌─────────────────┼─────────────────┐
          │                 │                 │
          ▼                 ▼                 ▼
    ┌───────────┐     ┌───────────┐     ┌───────────┐
    │ OpenClaw A │     │ OpenClaw B │     │ OpenClaw C │
    │ 电脑A      │     │ 电脑B      │     │ 电脑C      │
    │ allowFrom: │     │ allowFrom: │     │ allowFrom: │
    │ ["ou_abc"] │     │ ["ou_def"] │     │ ["ou_ghi"] │
    └───────────┘     └───────────┘     └───────────┘
          │                 │                 │
          │ ❌ 忽略         │ ✅ 处理         │ ❌ 忽略
          │ (不是他的用户)   │ (是他的用户!)   │ (不是他的用户)
```

### 2.2 核心机制

OpenClaw 飞书插件在 `extensions/feishu/src/bot.ts:890-920` 中实现：

```typescript
// DM 消息处理
if (!isGroup && dmPolicy !== "open" && !dmAllowed) {
  // 如果用户不在白名单，直接忽略消息
  log(`feishu: blocked unauthorized sender ${senderId}`);
  return;  // ❌ 不处理，直接返回
}

// ✅ 继续处理消息...
```

### 2.3 配置步骤

#### 步骤 1：获取用户 OpenID

让用户在飞书中私聊机器人发送任意消息，OpenClaw 会返回配对信息，包含用户的 `open_id`（格式如 `ou_xxxxx`）。

#### 步骤 2：配置 OpenClaw

在**每个人自己的电脑**上编辑 `~/.openclaw/openclaw.json`：

```json
{
  "channels": {
    "feishu": {
      "enabled": true,

      // 所有电脑使用相同的飞书应用凭证
      "appId": "cli_xxxxxxxxx",
      "appSecret": "xxxxxxxxxxxxxxxx",
      "encryptKey": "xxxxxxxxxxxxxxxx",
      "verificationToken": "xxxxxxxxxxxxxxxx",

      // 连接模式：WebSocket（推荐，无需公网 IP）
      "connectionMode": "websocket",

      // 关键配置：私聊策略
      "dmPolicy": "allowlist",        // 使用白名单模式
      "allowFrom": ["ou_abc123xxx"],  // 只处理这个用户的消息

      // 群聊策略：禁用（可选）
      "groupPolicy": "disabled",       // 不处理群聊消息

      // 其他配置
      "requireMention": false,
      "resolveSenderNames": true
    }
  },
  "agents": {
    "defaultAgentId": "main",
    "list": [{
      "id": "main",
      "modelProvider": "anthropic",
      "modelId": "claude-sonnet-4-20250514"
    }]
  }
}
```

#### 步骤 3：启动 Gateway

每个人在自己的电脑上启动：

```bash
openclaw gateway
```

### 2.4 配置参数说明

| 参数 | 值 | 说明 |
|------|---|------|
| `dmPolicy` | `"allowlist"` | 只处理 `allowFrom` 中的用户 |
| `dmPolicy` | `"pairing"` | 需要配对才能使用（默认） |
| `dmPolicy` | `"open"` | 处理所有用户（需配合 `allowFrom: ["*"]`） |
| `allowFrom` | `["ou_xxx"]` | 允许的用户 open_id 列表 |
| `groupPolicy` | `"disabled"` | 不处理群聊消息 |
| `groupPolicy` | `"allowlist"` | 只处理白名单群聊 |

### 2.5 多用户配置示例

**用户 A（张三）的配置**：

```json
{
  "channels": {
    "feishu": {
      "dmPolicy": "allowlist",
      "allowFrom": ["ou_aaa111bbb222"],
      "groupPolicy": "disabled"
    }
  }
}
```

**用户 B（李四）的配置**：

```json
{
  "channels": {
    "feishu": {
      "dmPolicy": "allowlist",
      "allowFrom": ["ou_ccc333ddd444"],
      "groupPolicy": "disabled"
    }
  }
}
```

**管理员（接收所有用户消息）的配置**：

```json
{
  "channels": {
    "feishu": {
      "dmPolicy": "open",
      "allowFrom": ["*"],
      "groupPolicy": "allowlist",
      "groupAllowFrom": ["oc_xxx", "oc_yyy"]
    }
  }
}
```

### 2.6 验证配置

启动 Gateway 后，检查日志：

```bash
# 查看日志
openclaw logs --follow

# 当其他用户发送消息时，应该看到：
# feishu[default]: blocked unauthorized sender ou_xxx (dmPolicy=allowlist)
```

---

## 3. 方案二：外部代理层

仅在需要集中管理或大规模部署时考虑。

详细架构见之前的设计文档...

---

## 4. 部署指南

### 4.1 前置准备

1. **创建飞书应用**
   - 访问 https://open.feishu.cn
   - 创建企业内部应用
   - 启用机器人能力
   - 获取凭证：App ID、App Secret、Encrypt Key、Verification Token

2. **配置事件订阅**
   - 方案一（allowList）：无需配置 Webhook（使用 WebSocket 模式）
   - 方案二（代理）：需要配置 Webhook URL

### 4.2 分发配置给用户

创建配置模板，让用户填入自己的 open_id：

```json
{
  "channels": {
    "feishu": {
      "enabled": true,
      "appId": "{{APP_ID}}",          // 统一应用 ID
      "appSecret": "{{APP_SECRET}}",  // 统一 App Secret
      "encryptKey": "{{ENCRYPT_KEY}}", // 统一 Encrypt Key
      "connectionMode": "websocket",
      "dmPolicy": "allowlist",
      "allowFrom": ["{{YOUR_OPEN_ID}}"], // 每个人填自己的 open_id
      "groupPolicy": "disabled"
    }
  }
}
```

### 4.3 启动脚本

为用户创建便捷启动脚本：

```bash
#!/bin/bash
# start-claw.sh

echo "Starting OpenClaw for Feishu..."
cd ~/.openclaw
openclaw gateway
```

---

## 5. 故障排查

### 5.1 消息无响应

**检查 1**：确认 open_id 正确

```bash
# 查看日志，看是否显示 "blocked unauthorized sender"
openclaw logs --follow | grep "blocked"
```

**检查 2**：确认 dmPolicy 配置

```bash
# 查看当前配置
openclaw config get channels.feishu.dmPolicy
# 应该输出: allowlist
```

**检查 3**：确认 allowFrom 配置

```bash
# 查看当前配置
openclaw config get channels.feishu.allowFrom
# 应该输出: ["ou_xxx"]
```

### 5.2 多个实例冲突

如果两个实例配置了相同的 `allowFrom`，两个都会响应消息。

**解决方案**：确保每个人的 `allowFrom` 是唯一的。

### 5.3 Gateway 无法启动

**检查飞书凭证**：确保所有电脑使用相同的飞书应用凭证。

**检查网络**：确保电脑可以访问飞书服务器。

---

## 6. 总结

**推荐使用方案一（allowList 过滤）**，因为：

1. ✅ **无需额外开发**：OpenClaw 内置功能
2. ✅ **无需中心服务器**：每个用户独立运行
3. ✅ **完全数据隔离**：每个人有独立的配置和会话
4. ✅ **故障隔离**：一个人的问题不影响其他人
5. ✅ **部署简单**：只需配置文件

这个方案完美满足你的需求：**同一个飞书机器人，按用户路由到完全独立的 OpenClaw 实例**。

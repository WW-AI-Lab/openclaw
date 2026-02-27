## Context

OpenClaw 的渠道访问控制由三层组成：

1. **配对（Pairing）**：新用户首次联系机器人时收到配对码，管理员批准后才能对话
2. **白名单（Allowlist）**：仅允许特定用户/群组使用机器人
3. **策略（Policy）**：全局开关控制私聊和群聊的可用性

飞书插件已完整实现了这三层控制，钉钉可复用相同的架构模式。关键差异在于用户 ID 格式（飞书用 `ou_xxx`，钉钉用 `senderStaffId`）和通知发送方式。

Onboarding 方面，飞书的 `feishuOnboardingAdapter` 提供了 `getStatus`、`configure`（多步骤凭证输入）、`dmPolicy`、`disable` 等方法。钉钉的流程类似但凭证字段不同（`clientId`/`clientSecret` 而非 `appId`/`appSecret`）。

## Goals / Non-Goals

**Goals:**

- 实现完整的配对流程（生成配对码 → 用户收到码 → 管理员 CLI 批准 → 通知用户）
- 实现 dmPolicy 和 groupPolicy 的运行时策略检查
- 实现白名单匹配逻辑
- 实现 CLI onboarding 向导（引导创建钉钉应用、输入凭证）
- 实现 directory 适配器（已知用户/群组列表）
- 实现 security 适配器（安全警告）

**Non-Goals:**

- 群组级别的细粒度 requireMention 配置（基础版已在提案 1 的 config schema 中定义，执行逻辑在提案 2 的消息处理中）
- 多 Agent 路由（属于 OpenClaw 核心功能，不在插件范围）
- 动态 Agent 创建（提案 4）

## Decisions

### D1: 配对通知方式

**选择：通过服务端 API 发送单聊消息通知配对结果**

理由：

- 配对批准后需要通知用户，此时没有活跃的 sessionWebhook
- 使用 `POST /v1.0/robot/oToMessages/batchSend` 向用户发送批准通知
- 配对码生成使用 OpenClaw 核心的 `PAIRING_APPROVED_MESSAGE` 和 `formatPairingApproveHint`

### D2: 白名单 ID 格式

**选择：使用 `senderStaffId` 作为白名单条目格式**

理由：

- `senderStaffId` 是钉钉企业内部的员工 ID，稳定且唯一
- 用户可以在日志中看到发送者的 `senderStaffId`，便于添加到白名单
- 群组白名单使用 `openConversationId`（从日志中获取）

### D3: Onboarding 流程步骤

1. 检查钉钉渠道当前状态（是否已配置）
2. 引导用户访问钉钉开发者后台创建应用
3. 交互式输入 Client ID 和 Client Secret
4. 验证凭证有效性（调用 probeAccount）
5. 设置默认策略（dmPolicy: pairing, groupPolicy: open）
6. 提示用户在开发者后台启用机器人能力和 Stream 模式

### D4: Directory 数据来源

**选择：基于配置 + 运行时数据**

理由：

- `listPeers`：从配置中的 `allowFrom` 列表获取已知用户
- `listGroups`：从配置中的 `groups` 获取已知群组
- 暂不实现 `listPeersLive`/`listGroupsLive`（需要额外的钉钉 API 权限和实现复杂度）

## Risks / Trade-offs

### R1: 配对通知依赖有效凭证

**风险**：如果凭证失效，配对批准后无法通知用户。

**缓解**：通知失败时记录错误日志，不影响配对批准本身。用户下次发送消息时会自动通过。

### R2: senderStaffId 在跨企业场景下的唯一性

**风险**：如果机器人被多个企业使用，不同企业的 senderStaffId 可能冲突。

**缓解**：当前仅支持企业内部应用，不存在跨企业场景。如果未来支持第三方应用，需要加上 corpId 前缀。

## Context

OpenClaw 采用插件架构扩展消息渠道，飞书（Feishu）插件是已有的成熟参考实现。飞书插件使用 `@larksuiteoapi/node-sdk` 的 `WSClient` 实现 WebSocket 长连接，钉钉则使用官方 `dingtalk-stream` SDK（v2.1.4）的 `DWClient` 实现类似功能。

两者在连接管理模式上高度相似：

- 飞书：`WSClient.start({ eventDispatcher })` → 自动维护连接
- 钉钉：`DWClient.connect()` → 自动维护连接（内置重连机制）

钉钉 Stream SDK 的核心差异在于：

1. 回调注册方式不同：钉钉使用 `registerCallbackListener(topic, callback)` + `registerAllEventListener(callback)`
2. 消息 ACK 机制：钉钉需要通过 `socketCallBackResponse(messageId, data)` 返回响应，60 秒内未响应会重试
3. 认证方式：钉钉使用 `clientId`（AppKey）+ `clientSecret`（AppSecret），通过旧版 API 获取 access_token

当前代码库状态：`extensions/dingtalk/` 目录不存在，需要从零创建。

## Goals / Non-Goals

**Goals:**

- 创建符合 OpenClaw 插件规范的钉钉渠道插件骨架（`extensions/dingtalk/`）
- 实现 `ChannelPlugin<ResolvedDingtalkAccount>` 完整接口，包含 `id`、`meta`、`capabilities`、`config`、`setup`、`gateway`、`status` 适配器
- 封装 `dingtalk-stream` SDK 的 `DWClient`，提供稳定的 Stream 连接管理
- 实现可扩展的配置 Schema，支持单账号和多账号模式
- 实现账号健康探测（probeAccount），验证凭证有效性
- 编写核心模块的单元测试

**Non-Goals:**

- 消息收发逻辑（提案 2 范围）
- 配对/访问控制/onboarding（提案 3 范围）
- 流式卡片输出/媒体上传下载（提案 4 范围）
- Webhook 模式支持（仅支持 Stream 模式）
- 文档编写（后续提案统一处理）

## Decisions

### D1: 插件模式 vs 内置实现

**选择：插件模式**（在 `extensions/dingtalk/` 中实现）

理由：

- 飞书渠道已验证了纯插件模式的可行性和完整性
- 插件模式不修改核心代码，降低对现有功能的影响风险
- 符合 OpenClaw 架构约定——新渠道优先通过插件扩展
- 独立的 `package.json` 便于依赖管理和版本控制

备选方案：在 `src/dingtalk/` 中作为内置渠道实现。放弃原因：不符合项目惯例，会增加核心包体积。

### D2: Stream SDK 封装策略

**选择：薄封装 + 直接使用 `DWClient`**

理由：

- `dingtalk-stream` SDK 的 `DWClient` 已内置自动重连（`autoReconnect: true`）和心跳保活
- SDK API 相对简单（`registerCallbackListener`、`connect`、`disconnect`），无需额外抽象层
- 在 `client.ts` 中创建工厂函数 `createDingtalkClient(config)`，按 accountId 缓存实例
- 在 `monitor.ts` 中管理连接生命周期，与飞书的 `monitorFeishuProvider` 模式保持一致

备选方案：重新实现 WebSocket 客户端。放弃原因：重复造轮子，且 SDK 已处理好重连/心跳/消息路由逻辑。

### D3: 配置结构设计

**选择：与飞书保持一致的嵌套配置结构**

```jsonc
{
  "channels": {
    "dingtalk": {
      "enabled": true,
      "clientId": "dingxxx", // 顶层默认凭证
      "clientSecret": "xxx",
      "robotCode": "dingxxx",
      "accounts": {
        "main": {
          // 多账号覆盖
          "enabled": true,
          "clientId": "dingyyy",
          "clientSecret": "yyy",
        },
      },
    },
  },
}
```

理由：

- 与飞书、Discord 等现有渠道配置风格一致
- 支持顶层默认值 + 账号级覆盖的灵活模式
- `clientId` + `clientSecret` 是钉钉最核心的两个凭证，`robotCode` 通常与 `clientId` 相同但允许独立配置

### D4: 凭证验证策略

**选择：通过 access_token 获取 API 验证凭证**

实现方式：

1. 调用 `DWClient.getAccessToken()` 尝试获取 access_token
2. 成功则说明 clientId/clientSecret 有效
3. 失败则报告凭证无效

理由：

- 这是最轻量的验证方式，不需要额外的 API 调用
- 获取到的 access_token 可缓存供后续消息发送使用
- 与飞书 probe 的实现模式一致（飞书通过获取 bot info 验证）

### D5: 文件结构规划

```
extensions/dingtalk/
├── package.json              # 插件元数据与依赖
├── index.ts                  # 插件入口与注册
├── src/
│   ├── channel.ts            # ChannelPlugin 主定义
│   ├── types.ts              # 类型定义
│   ├── client.ts             # DWClient 工厂与缓存
│   ├── config-schema.ts      # 配置 Schema（Zod）
│   ├── accounts.ts           # 账号解析逻辑
│   ├── monitor.ts            # Stream 连接生命周期管理
│   ├── probe.ts              # 凭证验证与健康检查
│   └── runtime.ts            # PluginRuntime 注入
├── tests/
│   ├── accounts.test.ts
│   ├── config-schema.test.ts
│   └── client.test.ts
```

## Risks / Trade-offs

### R1: `dingtalk-stream` SDK 维护活跃度

**风险**：SDK 最后一次 npm 发布是 2024 年 3 月（v2.1.4），GitHub 仓库活跃度较低。

**缓解**：

- SDK 核心功能（WebSocket 连接、消息路由）已稳定，无需频繁更新
- 依赖简洁（`ws`、`axios`、`debug`），出问题时可自行 fork 维护
- 钉钉 Stream 协议本身稳定，API 端变更风险低

### R2: access_token 过期管理

**风险**：钉钉 access_token 默认有效期 7200 秒（2 小时），需要定期刷新。

**缓解**：

- `DWClient.getAccessToken()` 每次调用都会获取新 token
- 消息发送时按需获取 token，不做全局缓存（简化实现）
- 后续提案可优化为带 TTL 缓存的 token 管理

### R3: SDK 的 ESM 兼容性

**风险**：`dingtalk-stream` SDK 同时提供 CJS 和 ESM 构建，但 OpenClaw 使用 ESM。

**缓解**：

- SDK 的 `package.json` 已配置 `exports` 字段，支持 ESM 导入
- 通过 jiti（OpenClaw 的插件加载器）加载，进一步兼容性保障
- 实际测试确认导入路径正确

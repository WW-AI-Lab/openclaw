## Why

OpenClaw 已支持 Telegram、Discord、Slack、飞书等多种消息渠道，但缺少对**钉钉（DingTalk）**的支持。钉钉在中国企业市场拥有超过 6 亿用户，是国内企业即时通讯的主要平台之一。实现钉钉渠道将显著扩大 OpenClaw 在中国企业用户中的覆盖面。

钉钉开放平台已成熟支持 Stream 模式（基于 WebSocket 长连接），与飞书的接入模式高度一致，无需公网 IP、证书和防火墙配置，技术风险低、实现路径清晰。官方 Node.js SDK `dingtalk-stream`（v2.1.4，MIT 许可）状态稳定，可直接集成。

本提案为钉钉渠道系列提案的**第 1 个（共 4 个）**，聚焦于核心插件骨架与 Stream 连接管理。

## What Changes

- **新增 `extensions/dingtalk/` 插件目录**：创建完整的钉钉渠道插件，遵循 OpenClaw 插件架构规范
- **实现 `ChannelPlugin` 接口**：包含 `id`、`meta`、`capabilities`、`config`、`setup`、`gateway`、`status` 等核心适配器
- **集成 `dingtalk-stream` SDK**：封装 `DWClient`，实现 Stream 模式的 WebSocket 长连接管理（自动重连、心跳保活、优雅停止）
- **实现配置 Schema**：定义钉钉渠道的配置结构（clientId、clientSecret、robotCode 等），支持单账号和多账号模式
- **实现账号解析逻辑**：从 OpenClaw 配置中解析钉钉账号信息，支持 `resolveAccount`、`listAccountIds`、`setAccountEnabled` 等操作
- **实现 Gateway 适配器**：通过 `startAccount` 启动 Stream 连接，通过 abort signal 实现优雅停止
- **实现基础 Status 适配器**：通过钉钉 API 验证凭证有效性（`probeAccount`），构建账号状态快照
- **新增 `package.json` 与插件注册**：配置插件元数据，通过 `index.ts` 注册渠道插件

## Capabilities

### New Capabilities

- `dingtalk-stream-connection`: 钉钉 Stream 模式 WebSocket 连接管理，包括连接建立、自动重连、心跳保活、优雅关闭
- `dingtalk-plugin-skeleton`: 钉钉渠道插件骨架，包含 ChannelPlugin 接口实现、配置 Schema、账号解析、Gateway/Status 适配器
- `dingtalk-config-schema`: 钉钉渠道配置结构定义，包含凭证管理、单/多账号模式、基础策略选项

### Modified Capabilities

（无，本提案为全新插件，不修改现有能力）

## Impact

- **新增依赖**：`dingtalk-stream`（v2.1.4，MIT 许可，依赖 `ws`、`axios`、`debug`）
- **新增目录**：`extensions/dingtalk/`（独立插件包，不影响核心代码）
- **配置影响**：新增 `channels.dingtalk` 配置节（不影响现有渠道配置）
- **构建影响**：新增 workspace 包，需要在 `pnpm-workspace.yaml` 中引用（如尚未包含 `extensions/*`）
- **文档影响**：后续提案会补充文档（`docs/channels/dingtalk.md`），本提案不涉及
- **测试影响**：需为核心模块编写单元测试
- **标签配置**：需在 `.github/labeler.yml` 中新增 `dingtalk` 标签规则

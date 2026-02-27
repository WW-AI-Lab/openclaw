## Why

前三个提案完成了钉钉渠道的核心功能：插件骨架、消息收发和访问控制。本提案实现**高级功能**，将钉钉渠道的体验提升到与飞书渠道接近的水平，包括：流式卡片输出（实时显示 AI 生成进度）、媒体文件的上传和下载、用户文档编写，以及完善的群组精细化配置。

流式卡片输出是用户体验的关键提升——它让用户在 AI 生成长回复时不再面对空白等待，而是实时看到生成进度。媒体支持则让用户可以向机器人发送图片、文件等内容并获得处理。

本提案为钉钉渠道系列提案的**第 4 个（共 4 个）**，是最后一个提案，完成后钉钉渠道将具备完整的生产级能力。

## What Changes

- **实现流式卡片输出**：使用钉钉互动卡片（Interactive Card）API 实现流式输出，在 AI 生成过程中实时更新卡片内容
- **实现媒体上传/下载**：支持接收和发送图片、文件、音频、视频等媒体类型
- **实现群组精细化配置**：支持按群组设置 `requireMention`、`allowFrom`、工具权限等
- **编写用户文档**：创建 `docs/channels/dingtalk.md`，提供完整的配置和使用指南
- **实现 typing 指示器**：在 AI 处理期间显示"正在输入"状态
- **完善标签配置**：更新 `.github/labeler.yml` 添加 dingtalk 标签
- **实现动态 Agent 创建**：支持按用户自动创建独立 Agent 实例

## Capabilities

### New Capabilities

- `dingtalk-streaming-card`: 钉钉流式卡片输出，使用互动卡片实现 AI 回复的实时流式显示
- `dingtalk-media`: 钉钉媒体处理，包括接收媒体消息的文件下载、发送媒体消息的文件上传
- `dingtalk-docs`: 钉钉渠道用户文档，包含完整的配置指南、故障排除和高级配置说明

### Modified Capabilities

（无）

## Impact

- **新增文件**：`src/streaming-card.ts`（流式卡片会话）、`src/media.ts`（媒体处理）、`src/typing.ts`（输入指示器）、`src/dynamic-agent.ts`（动态 Agent）
- **修改文件**：`src/channel.ts`（挂载 streaming 适配器）、`src/reply-dispatcher.ts`（集成流式卡片）、`src/outbound.ts`（完善 sendMedia）、`src/bot.ts`（集成媒体下载）
- **新增文档**：`docs/channels/dingtalk.md`
- **API 依赖**：钉钉互动卡片 API（`/v1.0/card/instances`）、文件下载 API（`/v1.0/robot/messageFiles/download`）
- **配置影响**：新增 `streaming`、`blockStreaming`、`textChunkLimit`、`mediaMaxMb` 等配置项
- **标签影响**：更新 `.github/labeler.yml`

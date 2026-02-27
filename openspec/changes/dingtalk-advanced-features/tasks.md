## 1. 流式卡片输出

- [ ] 1.1 创建 `src/streaming-card.ts`，实现 `DingtalkStreamingCardSession` 类，管理单次流式卡片的生命周期
- [ ] 1.2 实现卡片创建逻辑：调用 `POST /v1.0/card/instances` 创建互动卡片实例，返回卡片 ID
- [ ] 1.3 实现卡片内容更新逻辑：调用 `PUT /v1.0/card/instances` 更新 Markdown 内容，支持 500ms 频率限制
- [ ] 1.4 实现卡片完成逻辑：发送最终内容并标记流式结束
- [ ] 1.5 实现块级流式（blockStreaming）：累积到完整 Markdown 块后才触发更新
- [ ] 1.6 实现更新失败降级逻辑：连续失败 3 次后回退到普通消息
- [ ] 1.7 编写 `tests/streaming-card.test.ts`，测试卡片创建、更新、完成和降级场景

## 2. 集成流式输出到回复分发器

- [ ] 2.1 修改 `src/reply-dispatcher.ts`，在 `streaming: true` 时使用 `DingtalkStreamingCardSession` 代替普通消息发送
- [ ] 2.2 实现 streaming adapter 接口（`ChannelStreamingAdapter`），挂载到 `channel.ts`
- [ ] 2.3 实现 typing 指示器逻辑（创建 `src/typing.ts`），在 AI 处理期间显示"正在输入"状态

## 3. 媒体下载

- [ ] 3.1 创建 `src/media.ts`，实现 `downloadDingtalkMedia(config, downloadCode)` 函数
- [ ] 3.2 调用 `POST /v1.0/robot/messageFiles/download` 获取文件下载链接，下载并保存到临时目录
- [ ] 3.3 实现文件大小检查（`mediaMaxMb` 配置），超限时返回描述文本
- [ ] 3.4 实现不同媒体类型的下载处理：图片（`pictureDownloadCode`）、文件（`downloadCode`）、音频/视频
- [ ] 3.5 编写 `tests/media.test.ts`，测试下载逻辑和错误处理

## 4. 媒体上传与发送

- [ ] 4.1 在 `src/media.ts` 中实现 `uploadDingtalkMedia(config, filePath, mediaType)` 函数
- [ ] 4.2 调用钉钉文件上传 API，获取 mediaId
- [ ] 4.3 修改 `src/outbound.ts` 的 `sendMedia` 实现：下载外部文件 → 上传到钉钉 → 使用 mediaId 构建媒体消息发送
- [ ] 4.4 实现上传失败时的 URL 链接 fallback

## 5. 集成媒体到消息处理

- [ ] 5.1 修改 `src/bot.ts`，在消息处理流程中调用 `downloadDingtalkMedia` 下载接收到的媒体文件
- [ ] 5.2 将下载的媒体文件路径传递给 OpenClaw 核心的 `saveMediaBuffer` 函数
- [ ] 5.3 处理下载失败的场景：生成描述文本占位符

## 6. 群组精细化配置

- [ ] 6.1 扩展 `src/config-schema.ts`，添加 `groups` 配置结构（按 conversationId 配置 requireMention、enabled、allowFrom 等）
- [ ] 6.2 修改 `src/policy.ts`，在策略检查中支持群组级别的覆盖配置
- [ ] 6.3 在 `src/channel.ts` 中实现 `groups.resolveToolPolicy` 方法

## 7. 流式输出和媒体的配置项

- [ ] 7.1 扩展 `src/config-schema.ts`，添加 `streaming`（默认 true）、`blockStreaming`（默认 true）、`textChunkLimit`（默认 2000）、`mediaMaxMb`（默认 30）配置项
- [ ] 7.2 在 `src/channel.ts` 的 capabilities 中添加 `blockStreaming: true`

## 8. 用户文档

- [ ] 8.1 创建 `docs/channels/dingtalk.md`，编写完整的用户文档，参考 `docs/channels/feishu.md` 结构
- [ ] 8.2 包含以下章节：概述/状态、快速开始、创建钉钉应用（分步指南）、配置 OpenClaw、启动并测试、访问控制、群组配置、常用命令、故障排除、高级配置（多账号/流式输出/消息限制）、配置参考
- [ ] 8.3 更新 Mintlify 导航配置（`docs/mint.json` 或 `docs/docs.json`），添加钉钉渠道页面
- [ ] 8.4 确保文档内部链接使用根相对路径且不含 `.md` 后缀

## 9. GitHub 标签与 CI 配置

- [ ] 9.1 更新 `.github/labeler.yml`，添加 dingtalk 标签规则（匹配 `extensions/dingtalk/**`、`docs/channels/dingtalk*`）
- [ ] 9.2 创建对应的 GitHub 标签（使用现有渠道/扩展标签颜色）

## 10. 动态 Agent 创建

- [ ] 10.1 创建 `src/dynamic-agent.ts`，实现 `maybeCreateDynamicAgent` 函数，支持按用户自动创建独立 Agent 实例
- [ ] 10.2 在配置 Schema 中添加 `dynamicAgentCreation` 选项
- [ ] 10.3 在 `src/bot.ts` 中集成动态 Agent 创建逻辑

## 11. 最终验证

- [ ] 11.1 运行全部测试确认通过（`pnpm test`）
- [ ] 11.2 运行 `pnpm build` 和 `pnpm check` 确认编译和 lint 通过
- [ ] 11.3 端到端测试：发送文本消息 → 验证流式卡片输出正常
- [ ] 11.4 端到端测试：发送图片消息 → 验证下载和 AI 处理正常
- [ ] 11.5 端到端测试：验证多账号配置下各账号独立运行
- [ ] 11.6 文档预览：在 Mintlify 本地预览中检查文档渲染效果
- [ ] 11.7 验证 `openclaw channels status` 显示完整的钉钉渠道状态信息

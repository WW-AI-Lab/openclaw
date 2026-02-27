## 1. 消息类型与解析

- [ ] 1.1 扩展 `src/types.ts`，定义 `DingtalkMessageContext`（chatType、senderId、senderNick、conversationId、msgId、content、contentType、mentionedBot、sessionWebhook、sessionWebhookExpiredTime 等字段）
- [ ] 1.2 定义 `DingtalkRobotMessage` 类型，匹配钉钉 Stream 回调的 `data` JSON 结构（含 text、richText、picture、file、audio、video 等 msgtype 变体）
- [ ] 1.3 定义 `DingtalkTarget` 类型（`{ type: "user"; staffId: string }` | `{ type: "chat"; openConversationId: string }`）

## 2. 消息去重

- [ ] 2.1 创建 `src/dedup.ts`，实现基于 msgId 的消息去重逻辑，使用 OpenClaw 核心的 `tryRecordMessagePersistent` 函数
- [ ] 2.2 编写 `tests/dedup.test.ts`，测试首次消息通过、重复消息拒绝的场景

## 3. @提及处理

- [ ] 3.1 创建 `src/mention.ts`，实现 `extractDingtalkMention(message, botName)` 函数，从消息文本中检测和清理 @机器人前缀
- [ ] 3.2 实现 `stripMentionPrefix(content, botName)` 函数，清理消息文本中的 `@机器人名称` 前缀
- [ ] 3.3 编写 `tests/mention.test.ts`，测试各种 @格式的检测和清理

## 4. 消息接收处理主逻辑

- [ ] 4.1 创建 `src/bot.ts`，实现 `handleDingtalkMessage(downstream, context)` 主处理函数
- [ ] 4.2 实现 `parseDingtalkMessageEvent(data)` 函数，将 `DWClientDownStream.data` JSON 字符串解析为 `DingtalkMessageContext`
- [ ] 4.3 实现消息内容提取：文本消息直接取 `text.content`，富文本提取纯文本，图片/文件/音频/视频生成描述占位符
- [ ] 4.4 集成消息去重检查（`tryRecordMessagePersistent`）
- [ ] 4.5 集成 @提及检测和文本清理
- [ ] 4.6 构建 inbound context（channel、accountId、chatType、senderId、senderName、text 等），调用 `dispatchReplyFromConfig`
- [ ] 4.7 编写 `tests/bot.test.ts`，测试消息解析、去重、@处理的完整流程

## 5. 钉钉 ID 标准化

- [ ] 5.1 创建 `src/external-keys.ts`，实现 `normalizeDingtalkUserId(senderId, senderStaffId)` 和 `normalizeDingtalkChatId(conversationId)` 函数
- [ ] 5.2 实现 `formatDingtalkPeerId(type, id)` 函数，格式化为 OpenClaw 内部标识

## 6. 消息发送

- [ ] 6.1 创建 `src/send.ts`，实现 `sendViaSessisonWebhook(webhook, accessToken, body)` 函数，通过 sessionWebhook 发送回复
- [ ] 6.2 实现 `sendViaServerApi(config, target, msgKey, msgParam)` 函数，通过服务端 API 主动发送
- [ ] 6.3 实现 `sendDingtalkMessage(options)` 统一入口，自动选择 sessionWebhook 或服务端 API
- [ ] 6.4 实现 sessionWebhook 过期检测（对比 `sessionWebhookExpiredTime` 与当前时间）
- [ ] 6.5 实现 Markdown 和纯文本两种消息格式的构建逻辑
- [ ] 6.6 编写 `tests/send.test.ts`，测试两种发送方式和格式构建

## 7. 目标解析

- [ ] 7.1 创建 `src/send-target.ts`，实现 `resolveDingtalkSendTarget(to)` 函数，解析目标字符串为 `DingtalkTarget`
- [ ] 7.2 支持 `user:staffId`、`chat:conversationId`、裸 staffId、裸 `cid*==` 格式
- [ ] 7.3 编写 `tests/send-target.test.ts`，测试各种目标格式的解析

## 8. 回复分发器

- [ ] 8.1 创建 `src/reply-dispatcher.ts`，实现 `createDingtalkReplyDispatcher(ctx)` 函数
- [ ] 8.2 在 deliver 回调中实现：sessionWebhook 优先 → 过期时 fallback 到服务端 API
- [ ] 8.3 在 deliver 回调中实现 @发送者功能（群聊场景，在回复中 at 原消息发送者）

## 9. Outbound 适配器

- [ ] 9.1 创建 `src/outbound.ts`，实现 `dingtalkOutbound: ChannelOutboundAdapter` 对象
- [ ] 9.2 配置 `deliveryMode: "direct"`、`textChunkLimit: 2000`、`chunkerMode: "markdown"`
- [ ] 9.3 实现 `sendText` 方法，调用 `sendDingtalkMessage`
- [ ] 9.4 实现 `sendMedia` 方法（临时：文本 + URL fallback，完整媒体支持在提案 4）
- [ ] 9.5 实现 `resolveTarget` 方法，调用 `resolveDingtalkSendTarget`

## 10. 集成到 channel.ts

- [ ] 10.1 在 `src/channel.ts` 中挂载 `outbound: dingtalkOutbound`
- [ ] 10.2 在 `src/channel.ts` 中挂载 `messaging` 适配器（`normalizeTarget`、`targetResolver`）
- [ ] 10.3 更新 `src/monitor.ts`，在消息回调中调用 `handleDingtalkMessage`

## 11. 验证

- [ ] 11.1 运行全部测试确认通过
- [ ] 11.2 运行 `pnpm build` 和 `pnpm check` 确认编译和 lint 通过
- [ ] 11.3 端到端测试：通过钉钉发送消息，验证机器人能收到并回复

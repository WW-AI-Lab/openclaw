## 1. 访问策略逻辑

- [ ] 1.1 创建 `src/policy.ts`，实现 `isDingtalkDmAllowed(cfg, senderStaffId)` 函数，根据 `dmPolicy` 和 `allowFrom` 判断私聊消息是否放行
- [ ] 1.2 实现 `isDingtalkGroupAllowed(cfg, conversationId)` 函数，根据 `groupPolicy` 和 `groupAllowFrom` 判断群聊消息是否放行
- [ ] 1.3 实现 `resolveDingtalkAllowlistMatch(cfg, senderStaffId)` 函数，返回白名单匹配结果（含通配符 `"*"` 支持）
- [ ] 1.4 编写 `tests/policy.test.ts`，测试各种 dmPolicy/groupPolicy 组合下的放行和拒绝场景

## 2. 配对适配器

- [ ] 2.1 在 `src/channel.ts` 中实现 `pairing` 适配器属性：
  - `idLabel`: `"staffId"`
  - `normalizeAllowEntry`: 保留 staffId 原始格式
  - `notifyApproval`: 通过钉钉服务端 API 向用户发送批准通知
- [ ] 2.2 在 `src/bot.ts` 的消息处理流程中集成配对逻辑：检查 dmPolicy → 判断是否需要配对 → 发送配对码或放行
- [ ] 2.3 编写 `tests/pairing.test.ts`，测试配对码发送和批准通知场景

## 3. 安全适配器

- [ ] 3.1 在 `src/channel.ts` 中实现 `security` 适配器，`collectWarnings` 方法在 `groupPolicy` 为 `"open"` 时返回警告信息
- [ ] 3.2 编写安全警告的测试用例

## 4. 策略集成到消息处理

- [ ] 4.1 修改 `src/bot.ts`，在 `handleDingtalkMessage` 中添加策略检查步骤（在消息去重之后、AI 分发之前）
- [ ] 4.2 实现私聊策略检查流程：disabled → 直接丢弃；pairing → 检查授权 → 未授权则发送配对码；allowlist → 检查白名单 → 不在则丢弃
- [ ] 4.3 实现群聊策略检查流程：disabled → 直接丢弃；allowlist → 检查群组白名单 → 不在则丢弃
- [ ] 4.4 编写集成测试，验证策略检查与消息处理流程的联动

## 5. Onboarding 适配器

- [ ] 5.1 创建 `src/onboarding.ts`，实现 `dingtalkOnboardingAdapter: ChannelOnboardingAdapter`
- [ ] 5.2 实现 `getStatus` 方法：检查钉钉渠道是否已配置凭证，返回配置状态
- [ ] 5.3 实现 `configure` 方法的凭证配置步骤：
  - 展示创建钉钉企业内部应用的说明文本和链接
  - 交互式输入 Client ID（AppKey）
  - 交互式输入 Client Secret（AppSecret）
  - 调用 probeAccount 验证凭证
  - 凭证无效时提示重试
- [ ] 5.4 实现 `configure` 方法的策略配置步骤：选择 dmPolicy（默认 pairing）
- [ ] 5.5 实现 `disable` 方法：设置 `channels.dingtalk.enabled` 为 `false`
- [ ] 5.6 编写 onboarding 流程的测试用例

## 6. Directory 适配器

- [ ] 6.1 创建 `src/directory.ts`，实现 `ChannelDirectoryAdapter`
- [ ] 6.2 实现 `listPeers` 方法：从 `allowFrom` 配置返回已知用户列表
- [ ] 6.3 实现 `listGroups` 方法：从 `groups` 和 `groupAllowFrom` 配置返回已知群组列表
- [ ] 6.4 实现 `self` 方法：返回机器人自身信息（robotCode 和机器人名称）

## 7. 集成到 channel.ts

- [ ] 7.1 在 `src/channel.ts` 中挂载 `pairing` 适配器
- [ ] 7.2 在 `src/channel.ts` 中挂载 `security` 适配器
- [ ] 7.3 在 `src/channel.ts` 中挂载 `onboarding: dingtalkOnboardingAdapter`
- [ ] 7.4 在 `src/channel.ts` 中挂载 `directory` 适配器

## 8. 验证

- [ ] 8.1 运行全部测试确认通过
- [ ] 8.2 运行 `pnpm build` 和 `pnpm check` 确认编译和 lint 通过
- [ ] 8.3 测试 onboarding 流程：`openclaw channels add` → 选择 DingTalk → 完成配置
- [ ] 8.4 测试配对流程：新用户发消息 → 收到配对码 → `openclaw pairing approve dingtalk <code>` → 用户收到通知 → 正常对话
- [ ] 8.5 测试策略：设置 `dmPolicy: "disabled"` → 验证私聊消息被忽略

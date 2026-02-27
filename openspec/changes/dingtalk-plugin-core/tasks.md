## 1. 项目初始化

- [ ] 1.1 创建 `extensions/dingtalk/` 目录和基础文件结构（`src/`、`tests/`）
- [ ] 1.2 创建 `extensions/dingtalk/package.json`，配置插件元数据（name、version、openclaw channel 配置、dependencies 含 dingtalk-stream）
- [ ] 1.3 确认 `pnpm-workspace.yaml` 已包含 `extensions/*`，运行 `pnpm install` 安装依赖
- [ ] 1.4 在 `.github/labeler.yml` 中新增 `dingtalk` 标签规则

## 2. 类型定义

- [ ] 2.1 创建 `src/types.ts`，定义 `DingtalkAccountConfig`、`ResolvedDingtalkAccount`、`DingtalkConfig` 等核心类型
- [ ] 2.2 定义钉钉消息相关类型（`DingtalkRobotMessage`、`DingtalkTarget` 等），基于 `dingtalk-stream` SDK 的 `RobotMessage` 接口扩展

## 3. 配置 Schema

- [ ] 3.1 创建 `src/config-schema.ts`，使用 Zod 定义钉钉渠道配置 Schema（含 clientId、clientSecret、robotCode、enabled、dmPolicy、groupPolicy、requireMention、accounts 等字段）
- [ ] 3.2 实现 clientSecret 的敏感标记（secret: true），确保不在日志/状态输出中明文显示
- [ ] 3.3 编写 `tests/config-schema.test.ts`，测试 Schema 验证逻辑（有效配置、缺少必要字段、无效 dmPolicy 值等）

## 4. 运行时注入

- [ ] 4.1 创建 `src/runtime.ts`，实现 `setDingtalkRuntime` / `getDingtalkRuntime` 函数（参考飞书 `runtime.ts` 模式）

## 5. 账号解析

- [ ] 5.1 创建 `src/accounts.ts`，实现 `resolveDingtalkAccount(cfg, accountId?)` 函数，支持顶层默认值 + 账号级覆盖合并
- [ ] 5.2 实现 `listDingtalkAccountIds(cfg)` 函数，返回所有已配置的账号 ID
- [ ] 5.3 实现 `setDingtalkAccountEnabled(cfg, accountId, enabled)` 函数
- [ ] 5.4 实现 `deleteDingtalkAccount(cfg, accountId)` 函数
- [ ] 5.5 编写 `tests/accounts.test.ts`，测试单账号模式、多账号模式、配置继承、默认值等场景

## 6. Stream 客户端封装

- [ ] 6.1 创建 `src/client.ts`，实现 `createDingtalkStreamClient(config)` 工厂函数，封装 `DWClient` 创建逻辑
- [ ] 6.2 实现客户端实例缓存（按 accountId 缓存），避免重复创建
- [ ] 6.3 实现 `getAccessToken(config)` 辅助函数，用于凭证验证和 API 调用
- [ ] 6.4 编写 `tests/client.test.ts`，测试客户端创建和缓存逻辑（mock DWClient）

## 7. 凭证探测

- [ ] 7.1 创建 `src/probe.ts`，实现 `probeDingtalk(account)` 函数，通过获取 access_token 验证凭证有效性
- [ ] 7.2 实现探测结果缓存（TTL 10 分钟），减少 API 调用频率

## 8. Stream 连接管理

- [ ] 8.1 创建 `src/monitor.ts`，实现 `monitorDingtalkProvider(opts)` 函数，管理 Stream 连接的完整生命周期
- [ ] 8.2 实现消息回调注册（topic: `/v1.0/im/bot/messages/get`），解析 `DWClientDownStream.data` 为结构化消息
- [ ] 8.3 实现 AbortSignal 监听，支持优雅停止（调用 `DWClient.disconnect()`）
- [ ] 8.4 实现消息 ACK 响应逻辑（`socketCallBackResponse`），确保不触发钉钉服务端重试

## 9. ChannelPlugin 主定义

- [ ] 9.1 创建 `src/channel.ts`，实现 `dingtalkPlugin: ChannelPlugin<ResolvedDingtalkAccount>` 对象
- [ ] 9.2 实现 `meta` 属性（id、label、selectionLabel、docsPath、blurb、aliases、order）
- [ ] 9.3 实现 `capabilities` 属性（chatTypes、media、reply、polls、threads、reactions、edit）
- [ ] 9.4 实现 `config` 适配器（listAccountIds、resolveAccount、setAccountEnabled、deleteAccount、isConfigured、describeAccount）
- [ ] 9.5 实现 `setup` 适配器（applyAccountConfig，接受 clientId/clientSecret 输入并写入配置）
- [ ] 9.6 实现 `gateway` 适配器（startAccount，调用 monitorDingtalkProvider）
- [ ] 9.7 实现 `status` 适配器（probeAccount、buildAccountSnapshot、defaultRuntime）
- [ ] 9.8 实现 `reload` 属性（configPrefixes: `["channels.dingtalk"]`）

## 10. 插件入口

- [ ] 10.1 创建 `extensions/dingtalk/index.ts`，导出默认插件对象（id、name、configSchema、register 方法）
- [ ] 10.2 在 `register` 方法中调用 `setDingtalkRuntime(api.runtime)` 和 `api.registerChannel({ plugin: dingtalkPlugin })`

## 11. 验证与集成测试

- [ ] 11.1 运行 `pnpm build` 确认 TypeScript 编译通过
- [ ] 11.2 运行 `pnpm check` 确认 lint/format 通过
- [ ] 11.3 本地安装插件（`openclaw plugins install ./extensions/dingtalk`）验证加载成功
- [ ] 11.4 运行 `openclaw channels status` 确认钉钉渠道出现在列表中

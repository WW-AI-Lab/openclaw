## ADDED Requirements

### Requirement: 用户文档

系统 SHALL 提供完整的钉钉渠道用户文档，位于 `docs/channels/dingtalk.md`。

#### Scenario: 文档结构完整

- **WHEN** 用户访问钉钉渠道文档
- **THEN** 文档 SHALL 包含以下章节：
  1. 概述和状态（插件安装命令）
  2. 快速开始（向导和命令行两种方式）
  3. 创建钉钉应用的分步指南（含开发者后台操作截图说明）
  4. 配置 OpenClaw（向导配置、配置文件、环境变量）
  5. 启动并测试
  6. 访问控制（dmPolicy、groupPolicy、配对、白名单）
  7. 群组配置示例
  8. 常用命令
  9. 故障排除
  10. 高级配置（多账号、流式输出、消息限制）
  11. 配置参考表

#### Scenario: 文档格式符合 Mintlify

- **WHEN** 文档发布到 docs.openclaw.ai
- **THEN** 文档 SHALL 使用 Mintlify 兼容的 Markdown 格式，包含正确的 frontmatter（title、summary、read_when）

### Requirement: 文档导航配置

系统 SHALL 在 Mintlify 导航配置中添加钉钉渠道页面。

#### Scenario: 导航中出现钉钉

- **WHEN** 用户浏览 docs.openclaw.ai 的渠道文档
- **THEN** 钉钉 SHALL 出现在渠道列表中，链接到 `/channels/dingtalk`

### Requirement: GitHub 标签配置

系统 SHALL 在 `.github/labeler.yml` 中配置钉钉相关的标签规则。

#### Scenario: 自动标签匹配

- **WHEN** PR 修改了 `extensions/dingtalk/**` 下的文件
- **THEN** PR SHALL 自动添加 `dingtalk` 标签

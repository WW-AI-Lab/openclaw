# OpenClaw Release Skill

Use this skill when asked to cut and publish an OpenClaw release (npm + GitHub) with reproducible checks.

## Scope

- Publish patch/sub-release versions that follow same-day versioning.
- Push validated release commit to target remote branch (usually `main`).
- Create/publish Git tag + GitHub Release notes.
- Run post-release smoke checks for gateway/UI/chat/channel delivery.

## Preconditions

- Operator explicitly approved version bump and publish.
- Working tree for release branch is clean.
- Target remote is reachable and authenticated (`git`, `gh`, `npm`/`op` when needed).

## Versioning Guardrails

- Version format must be one of:
  - `YYYY.M.D`
  - `YYYY.M.D-N`
  - `YYYY.M.D-beta.N`
- Release date in version must equal local current date.
- Never use next-day or cross-date versions (example invalid on Mar 9: `2026.3.10`).
- Enforce with `pnpm lint:version-date` and keep it in `prepack` and `release:check`.

## Workflow

1. Sync baseline and check divergence (reference: `.agent/workflows/update_clawdbot.md`)
   - `git fetch <target-remote>`
   - `git rev-list --left-right --count <target-remote>/main...HEAD`
   - If needed: rebase/merge per branch policy.
2. Verify release commit scope
   - Keep only intended release files.
   - Exclude unrelated docs/openspec/tests when operator requires code-only landing.
3. Run pre-release checks
   - `pnpm lint:version-date`
   - `pnpm release:check`
   - Optional if environment allows: `pnpm test:install:smoke`
4. Publish npm package (when requested)
   - Use 1Password flow in tmux (`op signin`, OTP read, `npm publish --otp=...`).
   - Verify with `npm view @ww-ai-lab/openclaw version --userconfig "$(mktemp)"`.
5. Push release commit and tag
   - `git push <target-remote> <branch>`
   - `git tag -a v<version> <sha> -m "OpenClaw v<version>"`
   - `git push <target-remote> v<version>`
6. Create/update GitHub release notes
   - Use heredoc/file body, never escaped `\n`.
   - Example:
     - `gh release create v<version> -R <owner/repo> --title "openclaw <version>" -F - <<'EOF' ... EOF`
7. Post-release runtime smoke
   - `openclaw --version`
   - `openclaw gateway restart`
   - `openclaw gateway status`
   - Open dashboard and validate chat send/receive.
   - Validate inbound/outbound delivery on configured channels (e.g., Feishu).

## Reporting Template

- Release commit SHA and branch push result.
- Tag + GitHub release URL.
- npm version verification result.
- Gateway/UI/chat/channel smoke outcomes.
- Any skipped checks with concrete reason and impact.

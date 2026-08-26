# Supabase 与 GitHub Pages 接入说明

当前代码默认运行在 `demo` 模式。完成以下配置后，才会启用真实账号、照片、跨设备同步与通知。

## 1. 创建 Supabase 项目

在 Supabase Dashboard 创建一个新项目。项目创建完成后，在 **Project Settings → API** 中记录：

- Project URL
- Publishable key（名称通常以 `sb_publishable_` 开头）

Publishable key 可以出现在浏览器和公开 GitHub 仓库中。Secret key / legacy `service_role` key 绝不能写入 `config.js`、GitHub 仓库或聊天记录。

## 2. 创建数据表与权限

在 Supabase SQL Editor 中执行：

`supabase/migrations/202608250001_initial.sql`

该迁移会创建：

- 单孩子、双家长家庭结构
- 家长邀请与孩子设备登录
- 模板、时间段、每日任务、家长确认
- 奖励、兑换与不可重复发放的星星流水
- 私有照片桶 `task-evidence`
- 全部业务表和照片的 RLS 权限
- 实时同步所需 publication

执行前可以先整体查看 SQL；不要只运行其中一部分。

## 3. 部署 Edge Functions

需要部署以下函数：

- `create-child-login`：家长设置或重置孩子四位 PIN
- `invite-parent`：给第二位家长发送邀请邮件
- `send-push`：孩子提交后提醒家长
- `send-reminders`：定时提醒孩子完成任务
- `ai-material-assistant`：在服务端安全调用家长配置的 AI 接口，不把 API Key 发送给网页

部署需要 Supabase CLI。安装和登录属于环境配置操作，应在用户确认后进行。

函数需要这些服务端环境变量：

```text
SITE_URL=https://你的用户名.github.io/仓库名/
ALLOWED_ORIGINS=https://你的用户名.github.io/仓库名/,http://127.0.0.1:4173
VAPID_SUBJECT=mailto:你的邮箱
VAPID_PUBLIC_KEY=公开的 VAPID 公钥
VAPID_PRIVATE_KEY=私密的 VAPID 私钥
CRON_SECRET=随机生成的长字符串
AI_API_URL=https://你的接口地址/v1/chat/completions
AI_API_KEY=你的私密_API_Key
AI_MODEL=接口对应的模型名称
```

`SUPABASE_URL`、`SUPABASE_ANON_KEY` 和 `SUPABASE_SERVICE_ROLE_KEY` 通常由 Supabase Edge Functions 运行环境提供。Secret key 只允许在服务端环境中使用。

AI 参数可先填写到本机的 `supabase/functions/.env.local`。该文件已被 `.gitignore` 排除，不能提交到 GitHub。部署前需要使用 Supabase CLI 的 `secrets set --env-file`，或在 Supabase Dashboard 的 Edge Functions Secrets 页面录入；本机 `.env.local` 不会自行上传。

## 4. 配置认证地址

在 **Authentication → URL Configuration** 中设置：

- Site URL：最终 GitHub Pages 地址
- Redirect URLs：最终 GitHub Pages 地址，以及本地测试地址 `http://127.0.0.1:4173/`

第二位家长的邀请链接必须在允许的 Redirect URLs 中，否则 Supabase 会忽略自定义跳转地址。

## 5. 配置网页端

复制 `config.example.js` 的字段到 `config.js`，填写：

```js
window.KOALA_CONFIG = {
  mode: 'cloud',
  supabaseUrl: 'https://项目编号.supabase.co',
  supabasePublishableKey: 'sb_publishable_...',
  siteUrl: 'https://你的用户名.github.io/仓库名/',
  vapidPublicKey: '公开的 VAPID 公钥',
};
```

这里只能填写公开值。

## 6. 配置定时提醒

在 Supabase Dashboard 的 **Integrations → Cron** 中创建每分钟运行一次的任务，调用 `send-reminders` Edge Function，并在请求头中加入：

```text
x-cron-secret: 与服务端 CRON_SECRET 相同的值
```

如果使用 SQL 创建 Cron，请按照 Supabase 官方方式把 URL 和令牌放进 Vault，不要把 Secret 直接写进迁移文件。

## 7. iPhone / iPad 通知要求

- 先通过浏览器菜单把网页添加到主屏幕。
- 从主屏幕图标打开应用。
- 在家长或孩子账号的设置页，由用户主动点击通知开关。
- iOS/iPadOS 会显示系统权限弹窗；拒绝后需要在系统设置中重新开启。

## 8. GitHub Pages

仓库已包含 `.github/workflows/deploy-pages.yml`。推送到 `main` 后，在仓库 **Settings → Pages** 中把 Source 设为 **GitHub Actions**。

推送和启用 Pages 都属于远程操作，应在用户确认后执行并检查 Actions 与线上网页，不能用“已提交”代替“已部署”。

# 考拉的宇宙任务 Demo

一个面向二年级孩子的作业与锻炼打卡 PWA。未配置 Supabase 时可作为本机 Demo 使用；配置后支持双家长、孩子设备、照片、跨设备同步和通知。

## 本地预览

直接打开 `index.html` 可以查看大部分交互。若要验证离线缓存与安装到主屏幕，请通过本地 HTTP 服务或 HTTPS 访问。

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

然后打开 `http://127.0.0.1:4173`。

## Demo 使用

- 孩子端可以提交任务，需要照片的任务会弹出照片选择框。
- 家长端 Demo PIN：`2580`。
- 家长确认任务后，星星会真实增加并同步到孩子端。
- 家长可新增、编辑任务与奖励，并演示连续多日发布。
- Demo 数据保存在浏览器 `localStorage`。

## 云端模式

- Supabase 数据库迁移：`supabase/migrations/202608250001_initial.sql`
- Edge Functions：`supabase/functions/`
- 浏览器云端适配：`cloud.js`
- 安全配置模板：`config.example.js`
- 完整配置步骤：`docs/SUPABASE_SETUP.md`
- GitHub Pages 工作流：`.github/workflows/deploy-pages.yml`

## 当前边界

- 云端代码和部署文件已经准备好，但尚未创建或连接真实 Supabase 项目。
- GitHub 仓库尚未创建或推送。
- Service Worker 提供页面离线缓存；云端数据写入的完整离线队列仍待后续增强。

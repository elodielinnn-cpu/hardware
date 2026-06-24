# 硬件产业雷达上线说明

当前网站是纯静态站点，发布目录是 `site/`。最快上线不需要改成 Next.js。

## 最快方式：Netlify Drop

1. 打开 https://app.netlify.com/drop
2. 登录 Netlify
3. 把整个 `site/` 文件夹拖进去
4. Netlify 会生成一个 `https://xxx.netlify.app` 的公开网址

适合马上发给别人看，但后续自动更新不如 GitHub 连接方式稳定。

## 推荐方式：GitHub + Netlify

1. 在 GitHub 新建一个 repo，例如 `hardware-radar`
2. 把当前项目 push 到这个 repo
3. Netlify 选择 `Add new site` -> `Import an existing project`
4. 选择这个 GitHub repo
5. Build settings:
   - Build command: 留空
   - Publish directory: `site`
6. Deploy

项目根目录已经有 `netlify.toml`，Netlify 通常会自动识别 `site` 是发布目录。

## Vercel 方式

Vercel 也可以部署，但导入 GitHub repo 时建议直接把 Root Directory 设置为 `site`。

如果使用 Vercel CLI，也可以在 `site/` 目录内运行：

```bash
vercel --prod
```

## 自动更新

项目已经包含 GitHub Actions 定时任务：

```text
.github/workflows/update-news.yml
```

它会在每天北京时间 08:00 自动运行：

```bash
node scripts/fetch_real_sources.mjs
```

如果数据发生变化，会自动提交这些文件：

```text
real-data.js
taxonomy.js
site/real-data.js
site/taxonomy.js
```

GitHub Pages 会在提交后自动重新发布线上网站。

也可以在 GitHub 页面手动触发：

1. 打开仓库的 `Actions`
2. 选择 `Update news data`
3. 点击 `Run workflow`

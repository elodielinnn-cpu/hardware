# 硬件产业雷达部署说明

这个目录是可以公开部署的静态网站目录，只包含网页运行所需文件。

## 最快生成可分享网址

推荐先用 Netlify Drop：

1. 打开 https://app.netlify.com/drop
2. 登录或注册 Netlify
3. 把整个 `site` 文件夹拖进去
4. Netlify 会生成一个类似 `https://xxx.netlify.app` 的公开网址

这一步不需要写代码，也不需要配置服务器。

## 更适合长期维护的方式

如果后续要像正式网站一样持续更新，建议用 Vercel 或 Netlify 连接 GitHub 仓库：

1. 把 `site` 目录作为静态网站发布目录
2. 每次更新后提交代码
3. 平台自动重新部署
4. 后续可以绑定自定义域名

## 本地预览

在项目根目录运行：

```bash
/Users/elodie/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -m http.server 4173
```

然后打开：

```text
http://127.0.0.1:4173/site/index.html
```

或者在 `site` 目录内启动服务器后打开 `/index.html`。

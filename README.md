# 审判前夜

一个零依赖静态写作网站。日常流程是：在 `posts/` 写 Markdown，然后运行一条命令发布到 GitHub Pages。

## 写文章

在 `posts/` 新建 Markdown 文件，例如：

```text
posts/2026-06-15-night-note.md
```

文件开头使用 frontmatter：

```md
---
title: 夜间笔记
date: 2026-06-15
description: 一句话摘要。
tags: 日记, 小说
---

正文写在这里。
```

也可以不用完整 frontmatter，在正文最前两行写快捷元数据：

```md
desc: 这一句会成为文章摘要。
tags 日记、小说、读书

正文从这里开始。
```

`desc: ` 后面是摘要。`tags ` 后面是标签，多个标签用 `、` 分开。

## 本地构建

```bash
npm run build
```

生成结果在 `dist/`。

## 一条命令发布

```bash
npm run publish
```

这个命令会执行构建、提交变更并 `git push`。GitHub Actions 会把 `dist/` 发布到 GitHub Pages。

## 第一次部署

1. 在 GitHub 新建一个仓库。
2. 把 `site.config.json` 里的 `siteUrl` 改成你的 Pages 地址。
3. 在本目录运行：

```bash
git init
git add .
git commit -m "Initial writing site"
git branch -M main
git remote add origin git@github.com:YOUR_GITHUB_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

4. 在 GitHub 仓库页面打开 `Settings -> Pages`，Source 选择 `GitHub Actions`。
5. 以后只需要写 Markdown 并运行 `npm run publish`。

## 手机发表

适合在锤子便签里写完后快速发布：

1. 复制便签全文。
2. 打开 GitHub 仓库的 `Issues`。
3. 新建 Issue，标题写文章标题。
4. 正文粘贴 Markdown。
5. 可选：正文前两行写：
   ```text
   desc: 这一句会成为文章摘要。
   tags 日记、小说
   ```
6. 给 Issue 添加 `publish` 标签。

保存后 GitHub Actions 会自动把 Issue 变成 `posts/` 里的 Markdown 文件，并触发 Pages 发布。

## 配置

编辑 `site.config.json`：

- `title`: 网站标题
- `description`: 首页说明和 SEO 描述
- `author`: 作者名
- `siteUrl`: GitHub Pages 地址
- `basePath`: 站点子路径。留空时会从 `siteUrl` 自动推导
- `postsDir`: Markdown 文章目录，默认 `posts`

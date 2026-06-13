import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const configPath = path.join(root, "site.config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const postsDir = path.join(root, config.postsDir || "posts");
const publicDir = path.join(root, "public");
const distDir = path.join(root, "dist");
const watchMode = process.argv.includes("--watch");
const basePath = getBasePath();
const dailyQuotes = [
  { text: "生存还是毁灭，这是一个问题。", author: "莎士比亚", work: "哈姆雷特" },
  { text: "人不是生来要给打败的。", author: "海明威", work: "老人与海" },
  { text: "黑夜给了我黑色的眼睛。", author: "顾城", work: "一代人" },
  { text: "凡是过去，皆为序章。", author: "莎士比亚", work: "暴风雨" },
  { text: "世界以痛吻我，要我报之以歌。", author: "泰戈尔", work: "飞鸟集" },
  { text: "生活不可能像你想象得那么好。", author: "莫泊桑", work: "一生" },
  { text: "我荒废了时间，时间便把我荒废了。", author: "莎士比亚", work: "理查二世" }
];

function getBasePath() {
  if (typeof config.basePath === "string" && config.basePath.trim()) {
    return normalizeBasePath(config.basePath);
  }

  try {
    const parsed = new URL(config.siteUrl);
    return normalizeBasePath(parsed.pathname);
  } catch {
    return "";
  }
}

function normalizeBasePath(value) {
  const clean = value.trim().replace(/\/+$/, "");
  return clean === "/" ? "" : clean;
}

function urlPath(value) {
  if (/^https?:\/\//.test(value)) return value;
  const pathValue = value.startsWith("/") ? value : `/${value}`;
  return `${basePath}${pathValue}`;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/\.md$/, "")
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseFrontmatter(raw, fileName) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    return {
      data: {
        title: fileName.replace(/\.md$/, ""),
        date: "1970-01-01",
        description: ""
      },
      body: raw
    };
  }

  const data = {};
  for (const line of match[1].split("\n")) {
    const index = line.indexOf(":");
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    data[key] = value;
  }

  return { data, body: match[2] };
}

function inlineMarkdown(text) {
  let html = escapeHtml(text);
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, href) => {
    return `<a href="${escapeHtml(href)}">${label}</a>`;
  });
  return html;
}

function markdownToHtml(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let paragraph = [];
  let list = [];
  let code = [];
  let inCode = false;
  let codeLang = "";

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (!list.length) return;
    blocks.push(`<ul>${list.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</ul>`);
    list = [];
  };

  const flushCode = () => {
    blocks.push(`<pre><code class="language-${escapeHtml(codeLang)}">${escapeHtml(code.join("\n"))}</code></pre>`);
    code = [];
    codeLang = "";
  };

  for (const line of lines) {
    const codeFence = line.match(/^```(.*)$/);
    if (codeFence) {
      if (inCode) {
        flushCode();
        inCode = false;
      } else {
        flushParagraph();
        flushList();
        inCode = true;
        codeLang = codeFence[1].trim();
      }
      continue;
    }

    if (inCode) {
      code.push(line);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      blocks.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    const listItem = line.match(/^[-*]\s+(.+)$/);
    if (listItem) {
      flushParagraph();
      list.push(listItem[1]);
      continue;
    }

    paragraph.push(line.trim());
  }

  if (inCode) flushCode();
  flushParagraph();
  flushList();

  return blocks.join("\n");
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat(config.language || "zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(new Date(`${dateString}T00:00:00`));
}

function quoteForToday() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const day = Math.floor((now - start) / 86400000);
  return dailyQuotes[day % dailyQuotes.length];
}

function renderDailyQuoteScript() {
  return `<script type="application/json" id="daily-quotes">${JSON.stringify(dailyQuotes).replaceAll("<", "\\u003c")}</script>
    <script>
      (() => {
        const quoteNode = document.getElementById("daily-quote");
        const sourceNode = document.getElementById("daily-quote-source");
        const dataNode = document.getElementById("daily-quotes");
        if (!quoteNode || !sourceNode || !dataNode) return;
        try {
          const quotes = JSON.parse(dataNode.textContent);
          const start = new Date(new Date().getFullYear(), 0, 0);
          const day = Math.floor((new Date() - start) / 86400000);
          const quote = quotes[day % quotes.length];
          quoteNode.textContent = quote.text;
          sourceNode.textContent = \`\${quote.author}《\${quote.work}》\`;
        } catch {
          return;
        }
      })();
    </script>`;
}

function plainTextFromMarkdown(markdown = "") {
  return markdown
    .replace(/^---\n[\s\S]*?\n---\n?/, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_`>#-]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .split(/\n{2,}/)
    .map((block) => block.replace(/\s+/g, " ").trim())
    .filter(Boolean)[0] || "";
}

function readPosts() {
  if (!fs.existsSync(postsDir)) return [];

  return fs
    .readdirSync(postsDir)
    .filter((file) => file.endsWith(".md"))
    .map((file) => {
      const raw = fs.readFileSync(path.join(postsDir, file), "utf8");
      const { data, body } = parseFrontmatter(raw, file);
      const slug = data.slug || slugify(file);
      const tags = data.tags ? data.tags.split(",").map((tag) => tag.trim()).filter(Boolean) : [];
      return {
        file,
        slug,
        title: data.title || file.replace(/\.md$/, ""),
        date: data.date || "1970-01-01",
        time: data.time || "00:00:00",
        description: data.description || "",
        tags,
        html: markdownToHtml(body),
        excerpt: plainTextFromMarkdown(body)
      };
    })
    .sort((a, b) => {
      const byDateTime = new Date(`${b.date}T${b.time}`) - new Date(`${a.date}T${a.time}`);
      if (byDateTime !== 0) return byDateTime;
      return b.file.localeCompare(a.file, "zh-CN");
    });
}

function pageShell({ title, description, body, canonical = "", footerText = "" }) {
  const fullTitle = title === config.title ? title : `${title} | ${config.title}`;
  const canonicalUrl = canonical ? `${config.siteUrl.replace(/\/$/, "")}${canonical}` : config.siteUrl;
  const footer = footerText || config.description;

  return `<!doctype html>
<html lang="${escapeHtml(config.language || "zh-CN")}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(fullTitle)}</title>
  <meta name="description" content="${escapeHtml(description || config.description)}">
  <meta name="author" content="${escapeHtml(config.author)}">
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
  <link rel="alternate" type="application/rss+xml" title="${escapeHtml(config.title)}" href="${escapeHtml(urlPath("/rss.xml"))}">
  <link rel="stylesheet" href="${escapeHtml(urlPath("/css/style.css"))}">
</head>
<body>
  <header class="site-header">
    <a class="brand" href="${escapeHtml(urlPath("/"))}" aria-label="${escapeHtml(config.title)} 首页">${escapeHtml(config.title)}</a>
    <nav class="nav" aria-label="主导航">
      <a href="${escapeHtml(urlPath("/"))}">文章</a>
      <a href="${escapeHtml(urlPath("/archive.html"))}">归档</a>
    </nav>
  </header>
  ${body}
  <footer class="site-footer">
    <p>${escapeHtml(footer)}</p>
  </footer>
</body>
</html>`;
}

function renderHome(posts) {
  const latest = posts[0];
  const quote = quoteForToday();
  const footerText = latest?.excerpt || config.description;
  const list = posts
    .map((post) => `<article class="post-row">
      <time datetime="${escapeHtml(post.date)}">${escapeHtml(formatDate(post.date))}</time>
      <div>
        <h2><a href="${escapeHtml(urlPath(`/posts/${post.slug}/`))}">${escapeHtml(post.title)}</a></h2>
        <p>${escapeHtml(post.description)}</p>
      </div>
    </article>`)
    .join("\n");

  const body = `<main>
    <section class="hero">
      <div class="hero-media" role="img" aria-label="一张黑白写字台照片，纸张散落在窗边"></div>
      <div class="hero-copy">
        <figure class="hero-quote">
          <blockquote>
            <h1 id="daily-quote">${escapeHtml(quote.text)}</h1>
          </blockquote>
          <figcaption id="daily-quote-source">${escapeHtml(quote.author)}《${escapeHtml(quote.work)}》</figcaption>
        </figure>
        <p>${escapeHtml(footerText)}</p>
        ${latest ? `<a class="primary-link" href="${escapeHtml(urlPath(`/posts/${latest.slug}/`))}">读最新一篇</a>` : ""}
      </div>
    </section>
    <section class="writing-list" aria-labelledby="latest-writing">
      <div class="section-title">
        <h2 id="latest-writing">最近文章</h2>
        <p>Markdown 写在 <code>posts/</code>，页面由脚本生成。</p>
      </div>
      <div class="post-list">${list || "<p>还没有文章。</p>"}</div>
    </section>
    ${renderDailyQuoteScript()}
  </main>`;

  return pageShell({ title: config.title, description: config.description, body, canonical: "/", footerText });
}

function renderArchive(posts) {
  const grouped = new Map();
  for (const post of posts) {
    const year = post.date.slice(0, 4);
    if (!grouped.has(year)) grouped.set(year, []);
    grouped.get(year).push(post);
  }

  const archive = Array.from(grouped.entries())
    .map(([year, items]) => `<section class="archive-year">
      <h2>${escapeHtml(year)}</h2>
      <div class="archive-items">
        ${items.map((post) => `<a class="archive-item" href="${escapeHtml(urlPath(`/posts/${post.slug}/`))}">
        <span>${escapeHtml(post.title)}</span>
        <time datetime="${escapeHtml(post.date)}">${escapeHtml(formatDate(post.date))}</time>
      </a>`).join("\n")}
      </div>
    </section>`)
    .join("\n");

  const body = `<main class="page-narrow">
    <header class="plain-header">
      <h1>归档</h1>
      <p>所有已经发表的文字。</p>
    </header>
    ${archive}
  </main>`;

  return pageShell({ title: "归档", description: "所有文章归档", body, canonical: "/archive.html", footerText: posts[0]?.excerpt });
}

function renderPost(post) {
  const tags = post.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
  const body = `<main class="article-shell">
    <article class="article">
      <header class="article-header">
        <a class="back-link" href="${escapeHtml(urlPath("/"))}">返回文章列表</a>
        <time datetime="${escapeHtml(post.date)}">${escapeHtml(formatDate(post.date))}</time>
        <h1>${escapeHtml(post.title)}</h1>
        ${post.description ? `<p>${escapeHtml(post.description)}</p>` : ""}
        ${tags ? `<div class="tags">${tags}</div>` : ""}
      </header>
      <div class="prose">${post.html}</div>
    </article>
  </main>`;

  return pageShell({
    title: post.title,
    description: post.description || config.description,
    body,
    canonical: `/posts/${post.slug}/`,
    footerText: post.excerpt
  });
}

function renderRss(posts) {
  const siteUrl = config.siteUrl.replace(/\/$/, "");
  const items = posts
    .slice(0, 20)
    .map((post) => `<item>
      <title>${escapeHtml(post.title)}</title>
      <link>${escapeHtml(`${siteUrl}/posts/${post.slug}/`)}</link>
      <guid>${escapeHtml(`${siteUrl}/posts/${post.slug}/`)}</guid>
      <pubDate>${new Date(`${post.date}T00:00:00`).toUTCString()}</pubDate>
      <description>${escapeHtml(post.description)}</description>
    </item>`)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
  <channel>
    <title>${escapeHtml(config.title)}</title>
    <link>${escapeHtml(siteUrl)}</link>
    <description>${escapeHtml(config.description)}</description>
    <language>${escapeHtml(config.language || "zh-CN")}</language>
    ${items}
  </channel>
</rss>`;
}

function copyDir(source, target) {
  if (!fs.existsSync(source)) return;
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      copyDir(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

function build() {
  const posts = readPosts();
  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(distDir, { recursive: true });
  copyDir(publicDir, distDir);

  fs.writeFileSync(path.join(distDir, "index.html"), renderHome(posts));
  fs.writeFileSync(path.join(distDir, "archive.html"), renderArchive(posts));
  fs.writeFileSync(path.join(distDir, "rss.xml"), renderRss(posts));

  for (const post of posts) {
    const postDir = path.join(distDir, "posts", post.slug);
    fs.mkdirSync(postDir, { recursive: true });
    fs.writeFileSync(path.join(postDir, "index.html"), renderPost(post));
  }

  console.log(`Built ${posts.length} post(s) into dist/`);
}

build();

if (watchMode) {
  console.log("Watching posts, public, and site.config.json. Press Ctrl+C to stop.");
  fs.watch(postsDir, { recursive: true }, build);
  fs.watch(publicDir, { recursive: true }, build);
  fs.watch(configPath, build);
}

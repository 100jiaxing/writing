import fs from "node:fs";
import path from "node:path";

const titleInput = process.env.ISSUE_TITLE || "";
const bodyInput = process.env.ISSUE_BODY || "";
const issueNumber = process.env.ISSUE_NUMBER || "0";
const postsDir = path.join(process.cwd(), "posts");

function stripPublishPrefix(value) {
  return value
    .replace(/^\s*(发布|publish)\s*[:：-]\s*/i, "")
    .trim();
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function escapeYaml(value = "") {
  return String(value).replaceAll('"', '\\"');
}

function findPostByIssue(number) {
  if (!number || number === "0" || !fs.existsSync(postsDir)) return "";

  for (const file of fs.readdirSync(postsDir)) {
    if (!file.endsWith(".md")) continue;
    const raw = fs.readFileSync(path.join(postsDir, file), "utf8");
    const frontmatter = raw.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatter) continue;
    const hasIssue = frontmatter[1]
      .split("\n")
      .some((line) => line.trim() === `issue: ${number}`);
    if (hasIssue) return file;
  }

  return "";
}

function parseBody(raw) {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  let tags = [];
  let description = "";

  while (lines.length && !lines[0].trim()) lines.shift();

  for (let i = 0; i < Math.min(2, lines.length); i += 1) {
    const line = lines[i].trim();
    const descMatch = line.match(/^desc:\s+(.+)$/i);
    const tagsMatch = line.match(/^tags\s+(.+)$/i) || line.match(/^tags:\s+(.+)$/i) || line.match(/^标签\s*[:：]\s*(.+)$/);

    if (descMatch) {
      description = descMatch[1].trim();
      lines[i] = "";
      continue;
    }

    if (tagsMatch) {
      tags = tagsMatch[1]
        .split(/[、,，]/)
        .map((tag) => tag.trim())
        .filter(Boolean);
      lines[i] = "";
    }
  }

  while (lines.length && !lines[0].trim()) lines.shift();

  return {
    content: lines.join("\n").trim(),
    description,
    tags
  };
}

function excerptFromMarkdown(markdown) {
  const text = markdown
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_`>#-]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .split(/\n{2,}/)
    .map((block) => block.replace(/\s+/g, " ").trim())
    .filter(Boolean)[0] || "";
  const match = text.match(/^.+?[。！？!?]/);
  return match ? match[0] : text;
}

const title = stripPublishPrefix(titleInput);
if (!title) {
  throw new Error("Issue title is empty. Use the article title as the issue title.");
}

const { content, description: inlineDescription, tags } = parseBody(bodyInput);
if (!content) {
  throw new Error("Issue body is empty. Put the article Markdown in the issue body.");
}

const existingPost = findPostByIssue(issueNumber);
if (existingPost) {
  fs.writeFileSync("published-post-path.txt", existingPost);
  console.log(`Issue #${issueNumber} already published as ${existingPost}`);
  process.exit(0);
}

const date = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
}).format(new Date());
const time = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Shanghai",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false
}).format(new Date());
const slug = slugify(title) || `issue-${issueNumber}`;
let fileName = `${date}-${slug}.md`;
let filePath = path.join(postsDir, fileName);

if (fs.existsSync(filePath)) {
  fileName = `${date}-${slug}-${issueNumber}.md`;
  filePath = path.join(postsDir, fileName);
}

const description = (inlineDescription || excerptFromMarkdown(content)).slice(0, 120);
const frontmatter = [
  "---",
  `title: ${escapeYaml(title)}`,
  `date: ${date}`,
  `time: ${time}`,
  `issue: ${issueNumber}`,
  `description: ${escapeYaml(description)}`,
  tags.length ? `tags: ${tags.join(", ")}` : "tags: 写作",
  "---",
  ""
].join("\n");

fs.mkdirSync(postsDir, { recursive: true });
fs.writeFileSync(filePath, `${frontmatter}${content}\n`);
fs.writeFileSync("published-post-path.txt", fileName);

console.log(`Created ${filePath}`);

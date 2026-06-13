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

function parseBody(raw) {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  let tags = [];

  while (lines.length && !lines[0].trim()) lines.shift();

  const tagMatch = lines[0]?.match(/^(?:标签|tags)\s*[:：]\s*(.+)$/i);
  if (tagMatch) {
    tags = tagMatch[1]
      .split(/[,，、]/)
      .map((tag) => tag.trim())
      .filter(Boolean);
    lines.shift();
  }

  while (lines.length && !lines[0].trim()) lines.shift();

  return {
    content: lines.join("\n").trim(),
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

const { content, tags } = parseBody(bodyInput);
if (!content) {
  throw new Error("Issue body is empty. Put the article Markdown in the issue body.");
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

const description = excerptFromMarkdown(content).slice(0, 120);
const frontmatter = [
  "---",
  `title: ${escapeYaml(title)}`,
  `date: ${date}`,
  `time: ${time}`,
  `description: ${escapeYaml(description)}`,
  tags.length ? `tags: ${tags.join(", ")}` : "tags: 写作",
  "---",
  ""
].join("\n");

fs.mkdirSync(postsDir, { recursive: true });
fs.writeFileSync(filePath, `${frontmatter}${content}\n`);
fs.writeFileSync("published-post-path.txt", fileName);

console.log(`Created ${filePath}`);

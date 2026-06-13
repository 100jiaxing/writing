(() => {
  const input = document.getElementById("search-input");
  const status = document.getElementById("search-status");
  const results = document.getElementById("search-results");

  if (!input || !status || !results) return;

  const normalize = (value = "") => value.toLowerCase().replace(/\s+/g, "");
  const escapeHtml = (value = "") => String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

  const formatDate = (date) => {
    try {
      return new Intl.DateTimeFormat(document.documentElement.lang || "zh-CN", {
        year: "numeric",
        month: "long",
        day: "numeric"
      }).format(new Date(`${date}T00:00:00`));
    } catch {
      return date;
    }
  };

  const fuzzyIndex = (source, query) => {
    let start = -1;
    let sourceIndex = 0;

    for (const char of query) {
      const found = source.indexOf(char, sourceIndex);
      if (found === -1) return -1;
      if (start === -1) start = found;
      sourceIndex = found + 1;
    }

    return start;
  };

  const bestMatch = (post, query) => {
    const fields = [
      { key: "title", value: post.title, weight: 120 },
      { key: "tags", value: (post.tags || []).join(" "), weight: 90 },
      { key: "description", value: post.description || post.excerpt, weight: 70 },
      { key: "text", value: post.text, weight: 40 }
    ];

    let best = null;
    for (const field of fields) {
      const source = normalize(field.value);
      if (!source) continue;

      const exact = source.indexOf(query);
      if (exact !== -1) {
        const score = field.weight + Math.max(0, 80 - exact);
        if (!best || score > best.score) best = { ...field, index: exact, score };
        continue;
      }

      const fuzzy = fuzzyIndex(source, query);
      if (fuzzy !== -1) {
        const score = field.weight - 24 + Math.max(0, 50 - fuzzy);
        if (!best || score > best.score) best = { ...field, index: fuzzy, score };
      }
    }

    return best;
  };

  const makeSnippet = (post, match, rawQuery) => {
    const source = match?.key === "text" ? post.text : (post.description || post.excerpt || post.text);
    if (!source) return "";

    const plain = source.replace(/\s+/g, " ").trim();
    const lower = plain.toLowerCase();
    const query = rawQuery.toLowerCase().trim();
    const exact = query ? lower.indexOf(query) : -1;
    const start = Math.max(0, (exact === -1 ? 0 : exact) - 34);
    const end = Math.min(plain.length, start + 116);
    const prefix = start > 0 ? "..." : "";
    const suffix = end < plain.length ? "..." : "";
    return `${prefix}${plain.slice(start, end)}${suffix}`;
  };

  const render = (posts, rawQuery = "") => {
    const query = normalize(rawQuery);
    if (!query) {
      status.textContent = `共 ${posts.length} 篇文章可搜索。`;
      results.innerHTML = "";
      return;
    }

    const matched = posts
      .map((post) => ({ post, match: bestMatch(post, query) }))
      .filter((item) => item.match)
      .sort((a, b) => b.match.score - a.match.score || `${b.post.date}T${b.post.time}`.localeCompare(`${a.post.date}T${a.post.time}`));

    status.textContent = matched.length ? `找到 ${matched.length} 篇文章。` : "没有找到匹配文章。";
    results.innerHTML = matched.map(({ post, match }) => {
      const tags = (post.tags || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
      const snippet = makeSnippet(post, match, rawQuery);
      return `<article class="search-result">
        <time datetime="${escapeHtml(post.date)}">${escapeHtml(formatDate(post.date))}</time>
        <h2><a href="${escapeHtml(post.url)}">${escapeHtml(post.title)}</a></h2>
        ${snippet ? `<p>${escapeHtml(snippet)}</p>` : ""}
        ${tags ? `<div class="tags">${tags}</div>` : ""}
      </article>`;
    }).join("");
  };

  fetch("search-index.json")
    .then((response) => {
      if (!response.ok) throw new Error("Cannot load search index.");
      return response.json();
    })
    .then((posts) => {
      const params = new URLSearchParams(window.location.search);
      const initial = params.get("q") || "";
      input.value = initial;
      render(posts, initial);
      input.addEventListener("input", () => render(posts, input.value));
    })
    .catch(() => {
      status.textContent = "搜索索引加载失败。";
    });
})();

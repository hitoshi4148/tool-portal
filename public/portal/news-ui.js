const NewsUI = (() => {
  const LABELS = {
    dx: "機器・DX",
    industry: "業界・経営",
    general: "一般ニュース",
  };

  const TABS = [
    { id: "all", label: "すべて" },
    { id: "dx", label: LABELS.dx },
    { id: "industry", label: LABELS.industry },
    { id: "general", label: LABELS.general },
  ];

  let root = null;
  let payload = null;
  let activeTab = "all";

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[char]);
  }

  function jstDate(iso) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tokyo",
    }).format(new Date(iso));
  }

  function formatWhen(iso) {
    const date = new Date(iso);
    const day = new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      month: "numeric",
      day: "numeric",
    }).format(date);
    const time = new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(date);
    return `${day} ${time}`;
  }

  function hoverText(item) {
    if (item.category !== "general") return item.summary || "";
    const chars = Array.from(item.summary || item.title || "");
    if (chars.length <= 32) return chars.join("");
    return `${chars.slice(0, 32).join("")}...`;
  }

  function sourceLabel(name) {
    if (name === "日本ゴルフ場経営者協会") return "NGK";
    return name;
  }

  function renderItem(item, showBadge) {
    const summary = hoverText(item);
    const badge = showBadge
      ? `<span class="portal-news-badge">${escapeHtml(LABELS[item.category] || "")}</span>`
      : "";
    const summaryHtml = summary
      ? `<span class="portal-news-summary">${escapeHtml(summary)}</span>`
      : "";
    return `<li class="portal-news-item">
      <a class="portal-news-link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">
        <span class="portal-news-meta">${escapeHtml(formatWhen(item.publishedAt))} · ${escapeHtml(sourceLabel(item.sourceName))}</span>
        <span class="portal-news-titleline">${badge}${escapeHtml(item.title)}</span>
        ${summaryHtml}
      </a>
    </li>`;
  }

  function renderList(items, showBadge) {
    if (items.length === 0) return "";
    return `<ul class="portal-news-list">${items.map((item) => renderItem(item, showBadge)).join("")}</ul>`;
  }

  function render() {
    if (!root || !payload) return;
    const items = (payload.items || []).filter(
      (item) => activeTab === "all" || item.category === activeTab
    );
    const todayItems = items.filter((item) => jstDate(item.publishedAt) === payload.asOf);
    const olderItems = items.filter((item) => jstDate(item.publishedAt) !== payload.asOf);
    const todayShown = todayItems.slice(0, 4);
    const recent = todayItems.slice(4).concat(olderItems);
    const showBadge = activeTab === "all";
    const tabs = TABS.map(
      (tab) =>
        `<button type="button" class="portal-news-tab" role="tab" aria-selected="${tab.id === activeTab ? "true" : "false"}" data-news-tab="${tab.id}">${escapeHtml(tab.label)}</button>`
    ).join("");

    let body = "";
    if (todayShown.length === 0 && recent.length === 0) {
      body = `<p class="portal-news-empty">新しい記事はありません</p>`;
    } else {
      if (todayShown.length > 0) {
        body += `<p class="portal-news-bucket-label">今日</p>${renderList(todayShown, showBadge)}`;
      }
      if (recent.length > 0) {
        body += `<p class="portal-news-bucket-label">最近</p><div class="portal-news-recent">${renderList(recent, showBadge)}</div>`;
      }
    }

    root.innerHTML = `<div class="portal-news-tabs" role="tablist">${tabs}</div><div class="portal-news-body">${body}</div>`;
  }

  function onClick(event) {
    const tab = event.target.closest("[data-news-tab]");
    if (tab) {
      activeTab = tab.getAttribute("data-news-tab") || "all";
      render();
      return;
    }

    const link = event.target.closest(".portal-news-link");
    if (!link || !root.contains(link)) return;
    const coarse = window.matchMedia("(hover: none), (pointer: coarse)").matches;
    const item = link.closest(".portal-news-item");
    const summary = link.querySelector(".portal-news-summary");
    if (!coarse || !summary || !item) return;
    if (!item.classList.contains("is-open")) {
      event.preventDefault();
      root.querySelectorAll(".portal-news-item.is-open").forEach((open) => {
        open.classList.remove("is-open");
      });
      item.classList.add("is-open");
    }
  }

  async function load() {
    root = document.getElementById("portal-news-root");
    if (!root) return;
    root.textContent = "読み込み中...";
    try {
      const response = await fetch("/portal/api/news");
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "news failed");
      }
      payload = data;
      render();
      root.addEventListener("click", onClick);
    } catch (error) {
      console.error(error);
      root.textContent = "ニュースを読み込めませんでした";
    }
  }

  return { init: load };
})();

document.addEventListener("DOMContentLoaded", () => {
  NewsUI.init();
});

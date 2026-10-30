const SnsCheckUI = (() => {
  const LOGOS = {
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M14.23 10.16 22.14 1h-1.87l-6.86 7.95L7.7 1H1.5l8.3 12.07L1.5 23h1.88l7.26-8.4L16.3 23h6.2L14.23 10.16Zm-2.57 2.98-.84-1.2-6.7-9.58h2.88l5.4 7.73.84 1.2 7.03 10.05h-2.88l-5.73-8.2Z"/></svg>',
    instagram:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 7.4A4.6 4.6 0 1 0 16.6 12 4.6 4.6 0 0 0 12 7.4Zm0 7.6A3 3 0 1 1 15 12a3 3 0 0 1-3 3Zm5.2-8.7a1.08 1.08 0 1 1-1.08-1.08A1.08 1.08 0 0 1 17.2 6.3ZM21.2 7.4a5.9 5.9 0 0 0-1.6-4.2 5.9 5.9 0 0 0-4.2-1.6c-1.5-.06-6-.06-7.5 0a5.9 5.9 0 0 0-4.2 1.6 5.9 5.9 0 0 0-1.6 4.2c-.06 1.5-.06 6 0 7.5a5.9 5.9 0 0 0 1.6 4.2 5.9 5.9 0 0 0 4.2 1.6c1.5.06 6 .06 7.5 0a5.9 5.9 0 0 0 4.2-1.6 5.9 5.9 0 0 0 1.6-4.2c.06-1.5.06-6 0-7.5Zm-1.7 9.1a3.4 3.4 0 0 1-1.9 1.9c-1.3.52-4.5.4-6.2.4s-4.9.1-6.2-.4a3.4 3.4 0 0 1-1.9-1.9c-.52-1.3-.4-4.5-.4-6.2s-.1-4.9.4-6.2a3.4 3.4 0 0 1 1.9-1.9c1.3-.52 4.5-.4 6.2-.4s4.9-.12 6.2.4a3.4 3.4 0 0 1 1.9 1.9c.52 1.3.4 4.5.4 6.2s.12 4.9-.4 6.2Z"/></svg>',
    youtube:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31.7 31.7 0 0 0 0 12a31.7 31.7 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31.7 31.7 0 0 0 24 12a31.7 31.7 0 0 0-.5-5.8ZM9.75 15.02V8.98L15.5 12l-5.75 3.02Z"/></svg>',
  };

  let aliases = [];
  let lastFacility = "";
  let bound = false;

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[char]);
  }

  function facilityName() {
    if (typeof loadSettings !== "function") return "";
    return String(loadSettings().facilityName || "").trim();
  }

  function instagramTag(name) {
    const tag = String(name).replace(/[\s\u3000・·]/g, "");
    return tag || "";
  }

  function searchTerms(name) {
    const terms = [];
    const seen = new Set();
    [name, ...aliases].forEach((term) => {
      const value = String(term || "").trim();
      const key = value.toLowerCase();
      if (!value || seen.has(key)) return;
      seen.add(key);
      terms.push(value);
    });
    return terms;
  }

  function orQuery(terms) {
    return terms.map((term) => `"${term.replace(/"/g, "")}"`).join(" OR ");
  }

  function listLink(href, service, label) {
    return `<li class="portal-sns-item"><a class="portal-sns-row" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(label)}"><span class="portal-sns-logo portal-sns-logo--${service}" aria-hidden="true">${LOGOS[service]}</span><span class="portal-sns-row-text">${escapeHtml(label)}</span></a></li>`;
  }

  function aliasListHtml() {
    if (aliases.length === 0) return "";
    const aliasItems = aliases
      .map(
        (alias) =>
          `<li class="portal-sns-alias"><span>${escapeHtml(alias)}</span><button type="button" data-sns-remove="${escapeHtml(alias)}" aria-label="${escapeHtml(alias)}を外す">×</button></li>`
      )
      .join("");
    return `<ul class="portal-sns-aliases">${aliasItems}</ul>`;
  }

  function render() {
    const root = document.getElementById("portal-sns-body");
    if (!root) return;
    const name = facilityName();
    if (!name) {
      root.innerHTML = `
        <p class="portal-sns-empty">設定で施設名を入れてください</p>
        ${aliasListHtml()}
      `;
      return;
    }

    const terms = searchTerms(name);
    const query = encodeURIComponent(orQuery(terms));
    const xHref = `https://x.com/search?q=${query}`;
    const youtubeHref = `https://www.youtube.com/results?search_query=${query}`;
    const tags = terms
      .map((term) => ({ term, tag: instagramTag(term) }))
      .filter((item) => item.tag);
    const primaryTag = tags[0];
    const extraTags = tags.slice(1);

    const instagramLink = primaryTag
      ? listLink(
          `https://www.instagram.com/explore/tags/${encodeURIComponent(primaryTag.tag)}/`,
          "instagram",
          "Instagramでハッシュタグ検索"
        )
      : "";
    const extraLinks = extraTags
      .map((item) =>
        listLink(
          `https://www.instagram.com/explore/tags/${encodeURIComponent(item.tag)}/`,
          "instagram",
          `Instagramで『${item.term}』`
        )
      )
      .join("");

    root.innerHTML = `
      <p class="portal-sns-facility">検索する施設: ${escapeHtml(name)}</p>
      ${aliasListHtml()}
      <ul class="portal-sns-list">
        ${listLink(xHref, "x", `Xで『${name}』の投稿を見る`)}
        ${instagramLink}
        ${listLink(youtubeHref, "youtube", "YouTubeで動画を探す")}
        ${extraLinks}
      </ul>
    `;
  }

  function addAlias(value) {
    const alias = String(value || "").trim();
    if (!alias) return;
    const name = facilityName();
    const exists = [name, ...aliases].some((term) => term.toLowerCase() === alias.toLowerCase());
    if (exists) return;
    aliases.push(alias);
    render();
  }

  function onClick(event) {
    const remove = event.target.closest("[data-sns-remove]");
    if (!remove) return;
    const value = remove.getAttribute("data-sns-remove");
    aliases = aliases.filter((alias) => alias !== value);
    render();
  }

  function onSubmit(event) {
    const form = event.target.closest(".portal-sns-alias-form");
    if (!form) return;
    event.preventDefault();
    const input = form.querySelector("input[name='alias']");
    addAlias(input ? input.value : "");
    if (input) input.value = "";
  }

  function bind() {
    if (bound) return;
    bound = true;
    const root = document.getElementById("portal-sns-body");
    const form = document.getElementById("portal-sns-alias-form");
    if (root) root.addEventListener("click", onClick);
    if (form) form.addEventListener("submit", onSubmit);
  }

  function refresh() {
    const name = facilityName();
    if (lastFacility && name !== lastFacility) {
      aliases = [];
    }
    lastFacility = name;
    bind();
    render();
  }

  return { refresh };
})();

window.SnsCheckUI = SnsCheckUI;

document.addEventListener("DOMContentLoaded", () => {
  SnsCheckUI.refresh();
});

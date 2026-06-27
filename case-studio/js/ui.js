/* ============================================================
   ui.js — 共通UIヘルパー (DOM・モーダル・トースト・整形)
   ============================================================ */

const UI = (() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  /* HTMLエスケープ (XSS対策) */
  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  /* 日付整形 */
  function fmtDate(d) {
    if (!d) return "—";
    const dt = typeof d === "number" ? new Date(d) : new Date(d);
    if (isNaN(dt)) return esc(d);
    return `${dt.getFullYear()}/${String(dt.getMonth() + 1).padStart(2, "0")}/${String(dt.getDate()).padStart(2, "0")}`;
  }

  function relTime(t) {
    const diff = Date.now() - t, m = 60000, h = 3600000, d = 86400000;
    if (diff < m) return "たった今";
    if (diff < h) return `${Math.floor(diff / m)}分前`;
    if (diff < d) return `${Math.floor(diff / h)}時間前`;
    if (diff < d * 30) return `${Math.floor(diff / d)}日前`;
    return fmtDate(t);
  }

  function daysLeft(dateStr) {
    if (!dateStr) return null;
    const diff = Math.ceil((new Date(dateStr) - new Date().setHours(0, 0, 0, 0)) / 86400000);
    return diff;
  }

  function initials(name) {
    if (!name) return "?";
    return name.trim().slice(0, 2);
  }

  function statusBadge(status) {
    const s = Store.STATUSES[status] || Store.STATUSES.lead;
    return `<span class="badge ${s.cls}">${s.label}</span>`;
  }
  function priBadge(p) {
    const x = Store.PRIORITIES[p]; if (!x) return "";
    return `<span class="pri ${x.cls}">優先度 ${x.label}</span>`;
  }

  /* ---------- Modal ---------- */
  function openModal(html) {
    const m = $("#modal"), ov = $("#overlay");
    m.innerHTML = html;
    ov.classList.add("open");
    document.body.style.overflow = "hidden";
    const f = m.querySelector("input,textarea,select"); if (f) setTimeout(() => f.focus(), 60);
  }
  function closeModal() {
    $("#overlay").classList.remove("open");
    document.body.style.overflow = "";
  }

  /* ---------- Toast ---------- */
  function toast(msg) {
    const w = $("#toastWrap");
    const el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 13l4 4L19 7"/></svg>${esc(msg)}`;
    w.appendChild(el);
    setTimeout(() => { el.style.opacity = "0"; el.style.transition = ".3s"; setTimeout(() => el.remove(), 300); }, 2400);
  }

  function confirmModal(title, body, onYes, danger = true) {
    openModal(`
      <div class="modal-head"><h3>${esc(title)}</h3>
        <div class="x" data-close><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></div>
      </div>
      <div class="modal-body"><p style="color:var(--text-muted);font-size:14px;">${esc(body)}</p></div>
      <div class="modal-foot">
        <button class="btn" data-close>キャンセル</button>
        <button class="btn ${danger ? "btn-danger" : "btn-primary"}" id="confirmYes">${danger ? "削除する" : "実行"}</button>
      </div>`);
    $("#confirmYes").onclick = () => { onYes(); closeModal(); };
  }

  return { $, $$, esc, fmtDate, relTime, daysLeft, initials, statusBadge, priBadge, openModal, closeModal, toast, confirmModal };
})();

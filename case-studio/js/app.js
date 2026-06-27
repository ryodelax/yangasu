/* ============================================================
   app.js — ビュー描画とルーティング
   ============================================================ */

(() => {
  const { $, $$, esc, fmtDate, relTime, daysLeft, initials, statusBadge, priBadge,
          openModal, closeModal, toast, confirmModal } = UI;

  const content = $("#content");
  let state = { view: "dashboard", caseId: null, tab: "overview", filter: "all", q: "", sort: "created" };

  /* ============ Icons ============ */
  const ic = {
    folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M10 9l5 3-5 3z"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 13l4 4L19 7"/></svg>',
    doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16v12H7l-3 3z"/><path d="M8 9h8M8 12h5"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l2.4 7.4H22l-6 4.5 2.3 7.1L12 16.8 5.7 21l2.3-7.1-6-4.5h7.6z"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
    cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h4L18 10l-4-4L4 16z"/><path d="M13 5l4 4"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>',
    upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 16V4m0 0l-4 4m4-4l4 4M5 20h14"/></svg>',
  };

  const FB_TYPES = {
    good: { label: "良い点", color: "var(--st-done)" },
    request: { label: "要望", color: "var(--st-progress)" },
    issue: { label: "課題", color: "var(--pri-high)" },
    note: { label: "メモ", color: "var(--st-lead)" },
  };

  /* ============ Router ============ */
  function go(view, opts = {}) {
    state = { ...state, view, ...opts };
    $$("#nav .nav-item").forEach((n) => n.classList.toggle("active", n.dataset.view === view));
    $("#sidebar").classList.remove("open");
    render();
    document.querySelector(".main").scrollTo({ top: 0 });
  }

  const titles = {
    dashboard: ["ダッシュボード", "全体の状況をひと目で"],
    cases: ["案件リスト", "進行中の案件を管理"],
    board: ["ワークフロー", "ドラッグして進行状況を更新"],
    transcripts: ["文字起こし", "打ち合わせの記録"],
    feedback: ["フィードバック", "気づき・要望・課題"],
    detail: ["案件詳細", ""],
  };

  function render() {
    const [t, s] = titles[state.view] || titles.dashboard;
    $("#pageTitle").childNodes[0].nodeValue = t;
    $("#pageSub").textContent = s;
    const map = { dashboard: viewDashboard, cases: viewCases, board: viewBoard, transcripts: viewTranscripts, feedback: viewFeedback, detail: viewDetail };
    content.innerHTML = `<div class="view">${(map[state.view] || viewDashboard)()}</div>`;
    bindView();
  }

  /* ============ View: Dashboard ============ */
  function viewDashboard() {
    const st = Store.stats();
    const cards = [
      { v: st.total, l: "案件総数", c: "var(--st-lead)", ico: ic.folder },
      { v: st.active, l: "進行中・レビュー", c: "var(--st-progress)", ico: ic.play },
      { v: st.done, l: "完了", c: "var(--st-done)", ico: ic.check },
      { v: st.transcripts, l: "文字起こし数", c: "var(--accent-2)", ico: ic.doc },
    ];
    const kpis = cards.map((k) => `
      <div class="kpi">
        <div class="ic" style="background:color-mix(in srgb,${k.c} 18%,transparent);color:${k.c}">${k.ico}</div>
        <div class="val" data-count="${k.v}">0</div>
        <div class="lbl">${k.l}</div>
      </div>`).join("");

    const hero = `
      <div class="hero">
        <div class="hero-txt">
          <h1>おかえりなさい 👋</h1>
          <p>進行中の案件は <b>${st.active}件</b>。平均達成率は <b>${st.avgProgress}%</b> です。今日も一歩ずつ進めましょう。</p>
        </div>
        ${Art.hero()}
      </div>`;

    const active = Store.cases.all().filter((c) => c.status !== "done").slice(0, 4);
    const activeHtml = active.length ? active.map(caseCard).join("") :
      `<p style="color:var(--text-faint);font-size:14px;padding:20px;">進行中の案件はありません 🎉</p>`;

    const feed = Store.activity(7).map((e) => {
      const c = Store.cases.get(e.caseId);
      const icon = e.type === "transcript" ? ic.doc : e.type === "feedback" ? ic.star : ic.folder;
      const verb = e.type === "transcript" ? "文字起こしを追加" : e.type === "feedback" ? "フィードバック" : "案件を作成";
      return `<div class="feed-item">
        <div class="feed-ic">${icon}</div>
        <div><div class="feed-txt"><b>${esc(c ? c.title : "（削除済み）")}</b> — ${verb}</div>
        <div class="feed-time">${relTime(e.t)}</div></div></div>`;
    }).join("") || `<p style="color:var(--text-faint);font-size:13px;">まだ活動がありません</p>`;

    return `
      ${hero}
      <div class="kpi-grid">${kpis}</div>
      <div class="two-col">
        <div>
          <div class="section-head">
            <h2>進行中の案件</h2><span class="count">${active.length} 件</span>
            <div class="right"><button class="btn btn-sm" data-go="cases">すべて見る</button>
            <button class="btn btn-primary btn-sm" data-new-case>${ic.plus}案件を追加</button></div>
          </div>
          <div class="case-grid">${activeHtml}</div>
        </div>
        <div>
          <div class="section-head"><h2>進捗の平均</h2></div>
          <div class="panel" style="margin-bottom:18px;">
            <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:12px;">
              <span style="font-size:34px;font-weight:800;">${st.avgProgress}%</span>
              <span style="color:var(--text-muted);font-size:13px;">全案件の平均達成率</span>
            </div>
            <div class="progress"><i style="width:${st.avgProgress}%"></i></div>
          </div>
          <div class="section-head"><h2>最近の活動</h2></div>
          <div class="panel">${feed}</div>
        </div>
      </div>`;
  }

  /* ============ View: Cases ============ */
  function sortCases(list) {
    const arr = [...list];
    if (state.sort === "due") {
      arr.sort((a, b) => {
        if (!a.dueDate) return 1; if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      });
    } else if (state.sort === "progress") {
      arr.sort((a, b) => (b.progress || 0) - (a.progress || 0));
    } else if (state.sort === "title") {
      arr.sort((a, b) => (a.title || "").localeCompare(b.title || "", "ja"));
    }
    return arr; // "created" は Store.cases.all() の既定順（新しい順）を維持
  }

  function viewCases() {
    let list = Store.cases.all();
    if (state.filter !== "all") list = list.filter((c) => c.status === state.filter);
    if (state.q) list = list.filter((c) => matchCase(c, state.q));
    list = sortCases(list);

    const chips = [["all", "すべて"], ...Object.entries(Store.STATUSES).map(([k, v]) => [k, v.label])]
      .map(([k, l]) => `<div class="chip ${state.filter === k ? "active" : ""}" data-filter="${k}">${l}</div>`).join("");

    const sortOpts = [["created", "新しい順"], ["due", "期限が近い順"], ["progress", "進捗が高い順"], ["title", "名前順"]]
      .map(([k, l]) => `<option value="${k}" ${state.sort === k ? "selected" : ""}>${l}</option>`).join("");

    const grid = list.length
      ? list.map(caseCard).join("")
      : (state.q ? emptyState("search", "見つかりませんでした", `「${esc(state.q)}」に一致する案件はありません。`, "検索をクリア", "clear-search")
                 : emptyState("folder", "案件がありません", "右上のボタンから最初の案件を追加しましょう。", "案件を追加", "new-case"));

    return `
      <div class="section-head" style="margin-bottom:18px;">
        <span class="count">${list.length} 件</span>
        <div class="right" style="margin-left:auto;display:flex;gap:10px;align-items:center;">
          <select data-sort aria-label="並び替え" style="width:auto;padding:9px 32px 9px 12px;">${sortOpts}</select>
          <button class="btn btn-primary" data-new-case>${ic.plus}案件を追加</button>
        </div>
      </div>
      <div class="filters">${chips}</div>
      <div class="case-grid">${grid}</div>`;
  }

  function caseCard(c) {
    const tx = Store.transcripts.byCase(c.id).length;
    const fb = Store.feedbacks.byCase(c.id).length;
    const dl = daysLeft(c.dueDate);
    const dueTxt = c.dueDate
      ? (dl < 0 ? `<span style="color:var(--pri-high)">${-dl}日超過</span>` : dl === 0 ? `<span style="color:var(--st-progress)">本日締切</span>` : `あと${dl}日`)
      : "期限なし";
    return `
      <div class="case-card" data-open="${c.id}">
        <div class="cc-top">
          <div style="flex:1;min-width:0;">
            <div class="cc-title">${esc(c.title)}</div>
            <div class="cc-client">${esc(c.client || "—")}</div>
          </div>
          ${statusBadge(c.status)}
        </div>
        ${c.description ? `<div class="cc-desc">${esc(c.description)}</div>` : ""}
        <div>
          <div style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--text-faint);margin-bottom:6px;">
            <span>進捗</span><span>${c.progress || 0}%</span>
          </div>
          <div class="progress"><i style="width:${c.progress || 0}%"></i></div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">${(c.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>
        <div class="cc-foot">
          ${priBadge(c.priority)}
          <span class="cc-meta">${ic.doc}${tx}</span>
          <span class="cc-meta">${ic.star}${fb}</span>
          <span class="cc-meta" style="margin-left:auto;">${ic.cal}${dueTxt}</span>
        </div>
      </div>`;
  }

  function matchCase(c, q) {
    q = q.toLowerCase();
    return [c.title, c.client, c.description, ...(c.tags || [])].some((x) => (x || "").toLowerCase().includes(q));
  }

  /* ============ View: Board (Kanban workflow) ============ */
  const STATUS_DOT = { lead: "var(--st-lead)", progress: "var(--st-progress)", review: "var(--st-review)", done: "var(--st-done)", hold: "var(--st-hold)" };

  function viewBoard() {
    let all = Store.cases.all();
    if (state.q) all = all.filter((c) => matchCase(c, state.q));
    const order = ["lead", "progress", "review", "done", "hold"];
    const cols = order.map((status) => {
      const s = Store.STATUSES[status];
      const items = all.filter((c) => c.status === status);
      const cards = items.length
        ? items.map((c, i) => boardCard(c, i)).join("")
        : `<div class="board-empty">ここにドラッグ</div>`;
      return `
        <div class="board-col" data-col="${status}">
          <div class="board-col-head">
            <span class="dot" style="background:${STATUS_DOT[status]}"></span>
            <span class="ttl">${s.label}</span>
            <span class="cnt">${items.length}</span>
          </div>
          <div class="board-list" data-list="${status}">${cards}</div>
        </div>`;
    }).join("");
    return `
      <p style="color:var(--text-muted);font-size:13.5px;margin-bottom:16px;">${ic.play}カードを掴んで別の列へドラッグすると、案件のステータスが切り替わります。</p>
      <div class="board-wrap"><div class="board">${cols}</div></div>`;
  }

  function boardCard(c, i) {
    const tx = Store.transcripts.byCase(c.id).length;
    const dl = daysLeft(c.dueDate);
    const due = c.dueDate ? (dl < 0 ? `${-dl}日超過` : dl === 0 ? "本日" : `あと${dl}日`) : "";
    return `
      <div class="board-card" draggable="true" data-id="${c.id}" data-open="${c.id}" style="animation-delay:${i * 0.04}s">
        ${priBadge(c.priority)}
        <div class="bc-title" style="margin-top:${c.priority ? "8px" : "0"}">${esc(c.title)}</div>
        <div class="bc-client">${esc(c.client || "—")}</div>
        <div class="bc-bar"><i style="width:${c.progress || 0}%"></i></div>
        <div class="bc-foot">
          <span class="cc-meta">${ic.doc}${tx}</span>
          ${due ? `<span class="cc-meta" style="margin-left:auto;">${ic.cal}${due}</span>` : ""}
        </div>
      </div>`;
  }

  /* ============ View: Transcripts (global) ============ */
  function viewTranscripts() {
    let list = Store.transcripts.all();
    if (state.q) list = list.filter((t) => (t.title + t.content).toLowerCase().includes(state.q.toLowerCase()));
    const head = `<div class="section-head" style="margin-bottom:18px;">
        <div class="right" style="margin-left:auto;"><button class="btn btn-primary" data-import-tx="">${ic.upload}まとめて取り込み</button></div></div>`;
    if (!list.length) {
      if (state.q) return head + emptyState("search", "見つかりませんでした", `「${esc(state.q)}」に一致する文字起こしはありません。`, "検索をクリア", "clear-search");
      const hasCases = Store.cases.all().length > 0;
      return hasCases
        ? head + emptyState("doc", "文字起こしがありません", "ChatGPTからコピペした文字起こしを、まとめて取り込めます。", "まとめて取り込み", "import-tx", "")
        : emptyState("doc", "まず案件を作りましょう", "文字起こしは案件に紐づけて保存します。先に案件を1つ作成してください。", "案件を作成", "new-case");
    }
    return head + list.map((t) => {
      const c = Store.cases.get(t.caseId);
      return `<div class="item" data-open="${t.caseId}" style="cursor:pointer;">
        <div class="item-head">
          <span class="badge lead" style="background:var(--surface-strong);color:var(--text-muted);">${ic.folder}${esc(c ? c.title : "削除済み")}</span>
          <span class="it-title" style="margin-left:4px;">${esc(t.title)}</span>
          <span class="it-date">${fmtDate(t.date)}</span>
        </div>
        <div class="item-body clamp">${esc(t.content)}</div>
      </div>`;
    }).join("");
  }

  /* ============ View: Feedback (global) ============ */
  function viewFeedback() {
    let list = Store.feedbacks.all();
    if (state.q) list = list.filter((f) => (f.content + (f.author || "")).toLowerCase().includes(state.q.toLowerCase()));
    if (!list.length) return state.q
      ? emptyState("search", "見つかりませんでした", `「${esc(state.q)}」に一致するフィードバックはありません。`, "検索をクリア", "clear-search")
      : emptyState("star", "フィードバックがありません", "案件を開いて気づきや要望を記録しましょう。", "案件リストへ", "go-cases");
    return list.map((f) => {
      const c = Store.cases.get(f.caseId);
      const ft = FB_TYPES[f.type] || FB_TYPES.note;
      return `<div class="item fb-item" data-open="${f.caseId}" style="cursor:pointer;border-left-color:${ft.color};">
        <div class="item-head">
          <div class="avatar">${esc(initials(f.author))}</div>
          <span class="it-title">${esc(f.author || "匿名")}</span>
          <span class="pri" style="color:${ft.color};background:color-mix(in srgb,${ft.color} 16%,transparent);">${ft.label}</span>
          <span class="it-date">${relTime(f.createdAt)}</span>
        </div>
        <div class="item-body">${esc(f.content)}</div>
        <div style="font-size:11.5px;color:var(--text-faint);margin-top:8px;">${ic.folder} ${esc(c ? c.title : "削除済み")}</div>
      </div>`;
    }).join("");
  }

  /* ============ View: Case Detail ============ */
  function viewDetail() {
    const c = Store.cases.get(state.caseId);
    if (!c) { go("cases"); return ""; }
    const tx = Store.transcripts.byCase(c.id), fb = Store.feedbacks.byCase(c.id), ms = Store.milestones.byCase(c.id);
    const dl = daysLeft(c.dueDate);

    const tabs = [
      ["overview", "概要", null],
      ["transcripts", "文字起こし", tx.length],
      ["feedback", "フィードバック", fb.length],
      ["progress", "進捗", ms.length],
    ].map(([k, l, n]) => `<div class="tab ${state.tab === k ? "active" : ""}" data-tab="${k}">${l}${n != null ? `<span class="n">${n}</span>` : ""}</div>`).join("");

    let body = "";
    if (state.tab === "overview") body = detailOverview(c, tx, fb, ms);
    else if (state.tab === "transcripts") body = detailTranscripts(c, tx);
    else if (state.tab === "feedback") body = detailFeedback(c, fb);
    else if (state.tab === "progress") body = detailProgress(c, ms);

    return `
      <button class="btn btn-ghost back-btn" data-go="cases">${ic.back}案件リストに戻る</button>
      <div class="detail-head">
        <div class="dh-main">
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:8px;">
            ${statusBadge(c.status)} ${priBadge(c.priority)}
          </div>
          <div class="detail-title">${esc(c.title)}</div>
          <div class="detail-sub">
            <span>${ic.folder}${esc(c.client || "クライアント未設定")}</span>
            <span class="dot"></span>
            <span>${ic.cal}${c.dueDate ? `${fmtDate(c.dueDate)}${dl != null ? `（${dl < 0 ? `${-dl}日超過` : dl === 0 ? "本日" : `あと${dl}日`}）` : ""}` : "期限なし"}</span>
          </div>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-sm" data-edit-case="${c.id}">${ic.edit}編集</button>
          <button class="btn btn-sm btn-danger" data-del-case="${c.id}" aria-label="案件を削除">${ic.trash}</button>
        </div>
      </div>
      ${flowSteps(c)}
      <div class="tabs">${tabs}</div>
      <div>${body}</div>`;
  }

  function flowSteps(c) {
    const order = ["lead", "progress", "review", "done"];
    const cur = order.indexOf(c.status);
    const parts = order.map((s, i) => {
      const cls = c.status === s ? "active" : i < cur && cur >= 0 ? "passed" : "";
      const inner = (i < cur && cur >= 0) ? ic.check : (i + 1);
      const sep = i < order.length - 1 ? `<div class="flow-sep ${i < cur ? "passed" : ""}"></div>` : "";
      return `<div class="flow-step ${cls}" data-set-status="${s}"><span class="num">${inner}</span>${Store.STATUSES[s].label}</div>${sep}`;
    }).join("");
    const hold = `<div class="flow-step ${c.status === "hold" ? "active" : ""}" data-set-status="hold" style="margin-left:8px;"><span class="num">⏸</span>保留</div>`;
    return `<div class="flow">${parts}${hold}</div>`;
  }

  function detailOverview(c, tx, fb, ms) {
    const doneMs = ms.filter((m) => m.done).length;
    return `
      <div class="two-col">
        <div>
          <div class="panel" style="margin-bottom:18px;">
            <h2 style="font-size:15px;margin-bottom:10px;">説明</h2>
            <p style="color:var(--text-muted);font-size:14px;white-space:pre-wrap;line-height:1.8;">${c.description ? esc(c.description) : "<span style='color:var(--text-faint)'>説明は未入力です。「編集」から追加できます。</span>"}</p>
            ${(c.tags || []).length ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:16px;">${c.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>` : ""}
          </div>
          <div class="section-head"><h2>最近の文字起こし</h2><span class="count">${tx.length}件</span>
            <div class="right"><button class="btn btn-sm" data-tab="transcripts">すべて</button></div></div>
          ${tx.slice(0, 2).map((t) => `<div class="item"><div class="item-head"><span class="it-title">${esc(t.title)}</span><span class="it-date">${fmtDate(t.date)}</span></div><div class="item-body clamp">${esc(t.content)}</div></div>`).join("") || `<p style="color:var(--text-faint);font-size:13px;">まだありません</p>`}
        </div>
        <div>
          <div class="panel" style="margin-bottom:18px;">
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px;">
              <span style="font-size:32px;font-weight:800;">${c.progress || 0}%</span>
              <span style="color:var(--text-muted);font-size:13px;">達成率</span>
            </div>
            <div class="progress" style="margin-bottom:14px;"><i style="width:${c.progress || 0}%"></i></div>
            <input type="range" min="0" max="100" step="5" value="${c.progress || 0}" id="progSlider" style="width:100%;accent-color:var(--accent);" />
          </div>
          <div class="panel">
            <h2 style="font-size:15px;margin-bottom:14px;">サマリー</h2>
            ${statRow(ic.doc, "文字起こし", tx.length)}
            ${statRow(ic.star, "フィードバック", fb.length)}
            ${statRow(ic.check, "マイルストーン", `${doneMs}/${ms.length}`)}
          </div>
        </div>
      </div>`;
  }
  function statRow(icon, label, val) {
    return `<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border);">
      <span style="color:var(--text-faint);width:18px;display:grid;">${icon}</span>
      <span style="font-size:13.5px;color:var(--text-muted);">${label}</span>
      <span style="margin-left:auto;font-weight:700;">${val}</span></div>`;
  }

  function detailTranscripts(c, tx) {
    return `
      <div class="section-head"><h2>文字起こし</h2><span class="count">${tx.length}件</span>
        <div class="right">
          <button class="btn btn-sm" data-import-tx="${c.id}">${ic.upload}まとめて取り込み</button>
          <button class="btn btn-primary btn-sm" data-new-tx="${c.id}">${ic.plus}記録を追加</button></div></div>
      ${tx.length ? tx.map((t) => `
        <div class="item">
          <div class="item-head">
            <span class="it-title">${esc(t.title)}</span>
            <span class="it-date">${ic.cal}${fmtDate(t.date)}</span>
            <div class="item-actions">
              <button class="btn btn-ghost btn-sm" data-edit-tx="${t.id}" aria-label="編集">${ic.edit}</button>
              <button class="btn btn-ghost btn-sm" data-del-tx="${t.id}" aria-label="削除">${ic.trash}</button>
            </div>
          </div>
          <div class="item-body" id="tx-${t.id}">${esc(t.content)}</div>
        </div>`).join("") : emptyState("doc", "記録がありません", "打ち合わせの文字起こしを貼り付けて保存しましょう。", "記録を追加", "new-tx", c.id)}`;
  }

  function detailFeedback(c, fb) {
    return `
      <div class="section-head"><h2>フィードバック</h2><span class="count">${fb.length}件</span>
        <div class="right"><button class="btn btn-primary btn-sm" data-new-fb="${c.id}">${ic.plus}追加</button></div></div>
      ${fb.length ? fb.map((f) => {
        const ft = FB_TYPES[f.type] || FB_TYPES.note;
        return `<div class="item fb-item" style="border-left-color:${ft.color};">
          <div class="item-head">
            <div class="avatar">${esc(initials(f.author))}</div>
            <span class="it-title">${esc(f.author || "匿名")}</span>
            <span class="pri" style="color:${ft.color};background:color-mix(in srgb,${ft.color} 16%,transparent);">${ft.label}</span>
            <span class="it-date">${relTime(f.createdAt)}</span>
            <div class="item-actions">
              <button class="btn btn-ghost btn-sm" data-edit-fb="${f.id}" aria-label="編集">${ic.edit}</button>
              <button class="btn btn-ghost btn-sm" data-del-fb="${f.id}" aria-label="削除">${ic.trash}</button>
            </div>
          </div>
          <div class="item-body">${esc(f.content)}</div>
        </div>`;
      }).join("") : emptyState("star", "フィードバックがありません", "気づき・要望・課題を記録して改善につなげましょう。", "追加", "new-fb", c.id)}`;
  }

  function detailProgress(c, ms) {
    const timeline = ms.length ? `<div class="panel">${ms.map((m) => `
      <div class="milestone ${m.done ? "done" : ""}">
        <div class="ms-mark">
          <div class="ms-dot" data-toggle-ms="${m.id}" style="cursor:pointer;">${m.done ? ic.check : ""}</div>
          <div class="ms-line"></div>
        </div>
        <div class="ms-body">
          <div class="ms-title" data-toggle-ms="${m.id}">${esc(m.title)}</div>
          <div class="ms-date">${ic.cal}${fmtDate(m.date)} ${m.done ? "· 完了" : ""}
            <span data-del-ms="${m.id}" style="cursor:pointer;color:var(--text-faint);margin-left:8px;">削除</span></div>
        </div>
      </div>`).join("")}</div>` : emptyState("check", "マイルストーンがありません", "タスクや節目を登録して進捗を可視化しましょう。", "マイルストーンを追加", "new-ms", c.id);

    return `
      <div class="section-head"><h2>マイルストーン</h2><span class="count">${ms.filter((m) => m.done).length}/${ms.length} 完了</span>
        <div class="right"><button class="btn btn-primary btn-sm" data-new-ms="${c.id}">${ic.plus}追加</button></div></div>
      ${timeline}`;
  }

  const ART = { folder: Art.cases, doc: Art.transcripts, star: Art.feedback, check: Art.board, search: Art.search };
  function emptyState(icon, title, desc, btnLabel, action, arg = "") {
    const art = (ART[icon] || Art.cases)();
    return `<div class="empty">
      ${art}
      <h3>${esc(title)}</h3><p>${esc(desc)}</p>
      <button class="btn btn-primary" data-empty-action="${action}" data-arg="${arg}">${ic.plus}${esc(btnLabel)}</button>
    </div>`;
  }

  /* ============ Forms (modals) ============ */
  function caseForm(existing) {
    const c = existing || {};
    const stOpts = Object.entries(Store.STATUSES).map(([k, v]) => `<option value="${k}" ${c.status === k ? "selected" : ""}>${v.label}</option>`).join("");
    const prOpts = Object.entries(Store.PRIORITIES).map(([k, v]) => `<option value="${k}" ${c.priority === k ? "selected" : ""}>${v.label}</option>`).join("");
    openModal(`
      <div class="modal-head"><h3>${existing ? "案件を編集" : "案件を追加"}</h3>
        <div class="x" data-close>${closeIcon()}</div></div>
      <div class="modal-body">
        <div class="field"><label>案件名 *</label><input id="f-title" value="${esc(c.title || "")}" placeholder="例: ○○社 サイトリニューアル" /></div>
        <div class="field"><label>クライアント</label><input id="f-client" value="${esc(c.client || "")}" placeholder="会社名・担当者" /></div>
        <div class="field-row">
          <div class="field"><label>ステータス</label><select id="f-status">${stOpts}</select></div>
          <div class="field"><label>優先度</label><select id="f-priority"><option value="">なし</option>${prOpts}</select></div>
        </div>
        <div class="field-row">
          <div class="field"><label>期限</label><input type="date" id="f-due" value="${esc(c.dueDate || "")}" /></div>
          <div class="field"><label>タグ（カンマ区切り）</label><input id="f-tags" value="${esc((c.tags || []).join(", "))}" placeholder="GAS, 経理" /></div>
        </div>
        <div class="field"><label>説明</label><textarea id="f-desc" placeholder="案件の概要・ゴール・背景など">${esc(c.description || "")}</textarea></div>
      </div>
      <div class="modal-foot">
        <button class="btn" data-close>キャンセル</button>
        <button class="btn btn-primary" id="saveCase">${existing ? "保存" : "追加する"}</button>
      </div>`);
    $("#saveCase").onclick = () => {
      const title = $("#f-title").value.trim();
      if (!title) { $("#f-title").focus(); $("#f-title").style.borderColor = "var(--pri-high)"; return; }
      const data = {
        title, client: $("#f-client").value.trim(),
        status: $("#f-status").value, priority: $("#f-priority").value,
        dueDate: $("#f-due").value,
        tags: $("#f-tags").value.split(",").map((s) => s.trim()).filter(Boolean),
        description: $("#f-desc").value.trim(),
      };
      if (existing) { Store.cases.update(existing.id, data); toast("案件を更新しました"); }
      else { const nc = Store.cases.add(data); state.caseId = nc.id; toast("案件を追加しました"); }
      closeModal(); render();
    };
  }

  function txForm(caseId, existing) {
    const t0 = existing || {};
    openModal(`
      <div class="modal-head"><h3>${existing ? "文字起こしを編集" : "文字起こしを追加"}</h3><div class="x" data-close aria-label="閉じる">${closeIcon()}</div></div>
      <div class="modal-body">
        <div class="field-row">
          <div class="field"><label>タイトル *</label><input id="t-title" value="${esc(t0.title || "")}" placeholder="例: 第2回 定例MTG" /></div>
          <div class="field"><label>日付</label><input type="date" id="t-date" value="${esc(t0.date || new Date().toISOString().slice(0, 10))}" /></div>
        </div>
        <div class="field"><label>本文（文字起こし）*</label>
          <textarea class="big" id="t-content" placeholder="打ち合わせの文字起こしを貼り付け…">${esc(t0.content || "")}</textarea>
          <div class="hint">議事録ツールや録音アプリの書き起こしをそのまま貼り付けできます。</div>
        </div>
      </div>
      <div class="modal-foot"><button class="btn" data-close>キャンセル</button><button class="btn btn-primary" id="saveTx">${existing ? "保存" : "追加する"}</button></div>`);
    $("#saveTx").onclick = () => {
      const title = $("#t-title").value.trim(), c = $("#t-content").value.trim();
      if (!title || !c) { toast("タイトルと本文を入力してください"); return; }
      const data = { title, date: $("#t-date").value, content: c };
      if (existing) { Store.transcripts.update(existing.id, data); toast("文字起こしを更新しました"); }
      else { Store.transcripts.add({ caseId, ...data }); toast("文字起こしを保存しました"); }
      closeModal(); render();
    };
  }

  /* ChatGPTなどから複数の文字起こしをまとめて取り込む */
  function importForm(fixedCaseId) {
    const cases = Store.cases.all();
    if (!cases.length) { toast("先に案件を作成してください"); caseForm(); return; }
    const caseField = fixedCaseId
      ? `<input type="hidden" id="i-case" value="${fixedCaseId}" />`
      : `<div class="field"><label>取り込み先の案件 *</label>
           <select id="i-case">${cases.map((c) => `<option value="${c.id}">${esc(c.title)}</option>`).join("")}</select></div>`;
    openModal(`
      <div class="modal-head"><h3>文字起こしをまとめて取り込み</h3><div class="x" data-close>${closeIcon()}</div></div>
      <div class="modal-body">
        ${caseField}
        <div class="field-row">
          <div class="field"><label>区切り方</label>
            <select id="i-delim">
              <option value="---">--- (ハイフン3つ) で区切る</option>
              <option value="===">=== (イコール3つ) で区切る</option>
              <option value="blank">空行2つで区切る</option>
              <option value="none">区切らない（全部で1件）</option>
            </select>
          </div>
          <div class="field"><label>日付</label><input type="date" id="i-date" value="${new Date().toISOString().slice(0, 10)}" /></div>
        </div>
        <div class="field"><label>貼り付け *</label>
          <textarea class="big" id="i-text" placeholder="ChatGPTの会話をここに貼り付け…&#10;&#10;複数まとめる場合は、各会話のあいだに &#10;---&#10; のような区切り行を入れてください。&#10;各かたまりの1行目が自動でタイトルになります。"></textarea>
          <div class="hint" id="i-count">各かたまりの先頭行がタイトル、残りが本文になります。会話ごとに <b>---</b> で区切ると複数件にまとまります。</div>
        </div>
      </div>
      <div class="modal-foot"><button class="btn" data-close>キャンセル</button><button class="btn btn-primary" id="doImport">取り込む</button></div>`);

    const parse = () => {
      const raw = $("#i-text").value;
      const delim = $("#i-delim").value;
      let chunks;
      if (delim === "none") chunks = [raw];
      else if (delim === "blank") chunks = raw.split(/\n[ \t]*\n[ \t]*\n+/);
      else chunks = raw.split(new RegExp(`\\n[ \\t]*\\${delim[0]}{3,}[ \\t]*\\n`));
      return chunks.map((s) => s.trim()).filter(Boolean);
    };
    const refresh = () => {
      const n = parse().length;
      $("#i-count").innerHTML = n ? `この内容で <b>${n}件</b> として取り込みます。` :
        `各かたまりの先頭行がタイトル、残りが本文になります。会話ごとに <b>---</b> で区切ると複数件にまとまります。`;
    };
    $("#i-text").addEventListener("input", refresh);
    $("#i-delim").addEventListener("change", refresh);

    $("#doImport").onclick = () => {
      const caseId = $("#i-case").value;
      const date = $("#i-date").value;
      const chunks = parse();
      if (!chunks.length) { toast("取り込む内容を貼り付けてください"); return; }
      chunks.forEach((chunk, i) => {
        const lines = chunk.split("\n");
        let title = (lines.find((l) => l.trim()) || `取り込み ${i + 1}`).trim().replace(/^#+\s*/, "");
        if (title.length > 60) title = title.slice(0, 60) + "…";
        Store.transcripts.add({ caseId, title, date, content: chunk });
      });
      toast(`${chunks.length}件の文字起こしを取り込みました`);
      closeModal();
      const c = Store.cases.get(caseId);
      if (c) { state.caseId = caseId; state.tab = "transcripts"; go("detail", { caseId, tab: "transcripts" }); }
      else render();
    };
  }

  function fbForm(caseId, existing) {
    const f0 = existing || {};
    const opts = Object.entries(FB_TYPES).map(([k, v]) => `<option value="${k}" ${f0.type === k ? "selected" : ""}>${v.label}</option>`).join("");
    openModal(`
      <div class="modal-head"><h3>${existing ? "フィードバックを編集" : "フィードバックを追加"}</h3><div class="x" data-close aria-label="閉じる">${closeIcon()}</div></div>
      <div class="modal-body">
        <div class="field-row">
          <div class="field"><label>記入者</label><input id="b-author" placeholder="名前" value="${esc(f0.author || "長谷川")}" /></div>
          <div class="field"><label>種別</label><select id="b-type">${opts}</select></div>
        </div>
        <div class="field"><label>内容 *</label><textarea id="b-content" placeholder="気づき・要望・課題など">${esc(f0.content || "")}</textarea></div>
      </div>
      <div class="modal-foot"><button class="btn" data-close>キャンセル</button><button class="btn btn-primary" id="saveFb">${existing ? "保存" : "追加する"}</button></div>`);
    $("#saveFb").onclick = () => {
      const c = $("#b-content").value.trim();
      if (!c) { toast("内容を入力してください"); return; }
      const data = { author: $("#b-author").value.trim() || "匿名", type: $("#b-type").value, content: c };
      if (existing) { Store.feedbacks.update(existing.id, data); toast("フィードバックを更新しました"); }
      else { Store.feedbacks.add({ caseId, ...data }); toast("フィードバックを保存しました"); }
      closeModal(); render();
    };
  }

  function msForm(caseId) {
    openModal(`
      <div class="modal-head"><h3>マイルストーンを追加</h3><div class="x" data-close>${closeIcon()}</div></div>
      <div class="modal-body">
        <div class="field"><label>タイトル *</label><input id="m-title" placeholder="例: 初稿提出" /></div>
        <div class="field"><label>予定日</label><input type="date" id="m-date" value="${new Date().toISOString().slice(0, 10)}" /></div>
      </div>
      <div class="modal-foot"><button class="btn" data-close>キャンセル</button><button class="btn btn-primary" id="saveMs">追加</button></div>`);
    $("#saveMs").onclick = () => {
      const t = $("#m-title").value.trim();
      if (!t) { toast("タイトルを入力してください"); return; }
      Store.milestones.add({ caseId, title: t, date: $("#m-date").value });
      toast("マイルストーンを追加しました"); closeModal(); render();
    };
  }

  function closeIcon() { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>'; }

  /* ============ Event delegation ============ */
  function bindView() {
    // progress slider
    const slider = $("#progSlider");
    if (slider) {
      slider.oninput = (e) => {
        const v = +e.target.value;
        Store.cases.update(state.caseId, { progress: v });
        const p = content.querySelector(".panel .progress > i");
        if (p) p.style.width = v + "%";
        const lbl = content.querySelector(".panel span");
        if (lbl) lbl.textContent = v + "%";
      };
    }
    countUp();
    initBoardDnD();
    $$(".case-grid > .case-card").forEach((c, i) => {
      c.classList.add("stagger");
      c.style.animationDelay = (i * 0.05) + "s";
    });
  }

  /* 数字カウントアップ */
  function countUp() {
    $$("[data-count]").forEach((el) => {
      const target = +el.dataset.count || 0;
      if (target === 0) { el.textContent = "0"; return; }
      const dur = 850, start = performance.now();
      const tick = (now) => {
        const p = Math.min((now - start) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased);
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  /* カンバンのドラッグ&ドロップ */
  let dragId = null;
  function initBoardDnD() {
    const cards = $$(".board-card");
    if (!cards.length) return;
    cards.forEach((card) => {
      card.addEventListener("dragstart", (e) => {
        dragId = card.dataset.id;
        card.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
      });
      card.addEventListener("dragend", () => { card.classList.remove("dragging"); dragId = null; });
    });
    $$(".board-col").forEach((col) => {
      col.addEventListener("dragover", (e) => { e.preventDefault(); col.classList.add("drag-over"); });
      col.addEventListener("dragleave", (e) => { if (!col.contains(e.relatedTarget)) col.classList.remove("drag-over"); });
      col.addEventListener("drop", (e) => {
        e.preventDefault();
        col.classList.remove("drag-over");
        const newStatus = col.dataset.col;
        if (dragId) {
          const c = Store.cases.get(dragId);
          if (c && c.status !== newStatus) {
            Store.cases.update(dragId, { status: newStatus });
            toast(`「${c.title.slice(0, 14)}」を「${Store.STATUSES[newStatus].label}」へ`);
            render();
          }
        }
      });
    });
  }

  content.addEventListener("click", (e) => {
    const el = (sel) => e.target.closest(sel);
    let t;
    if ((t = el("[data-open]"))) return go("detail", { caseId: t.dataset.open, tab: "overview" });
    if ((t = el("[data-tab]"))) { state.tab = t.dataset.tab; return render(); }
    if ((t = el("[data-filter]"))) { state.filter = t.dataset.filter; return render(); }
    if ((t = el("[data-go]"))) return go(t.dataset.go);
    if (el("[data-new-case]")) return caseForm();
    if ((t = el("[data-edit-case]"))) return caseForm(Store.cases.get(t.dataset.editCase));
    if ((t = el("[data-new-tx]"))) return txForm(t.dataset.newTx);
    if ((t = el("[data-edit-tx]"))) return txForm(null, Store.transcripts.get(t.dataset.editTx));
    if ((t = el("[data-import-tx]"))) return importForm(t.dataset.importTx || null);
    if ((t = el("[data-new-fb]"))) return fbForm(t.dataset.newFb);
    if ((t = el("[data-edit-fb]"))) return fbForm(null, Store.feedbacks.get(t.dataset.editFb));
    if ((t = el("[data-new-ms]"))) return msForm(t.dataset.newMs);
    if ((t = el("[data-set-status]"))) {
      const ns = t.dataset.setStatus;
      Store.cases.update(state.caseId, { status: ns });
      toast(`ステータスを「${Store.STATUSES[ns].label}」に変更`);
      return render();
    }
    if ((t = el("[data-toggle-ms]"))) { Store.milestones.toggle(t.dataset.toggleMs); return render(); }
    if ((t = el("[data-del-case]"))) return confirmModal("案件を削除", "この案件と関連する文字起こし・FB・進捗もすべて削除されます。", () => { Store.cases.remove(t.dataset.delCase); toast("削除しました"); go("cases"); });
    if ((t = el("[data-del-tx]"))) return confirmModal("文字起こしを削除", "この記録を削除しますか？", () => { Store.transcripts.remove(t.dataset.delTx); toast("削除しました"); render(); });
    if ((t = el("[data-del-fb]"))) return confirmModal("フィードバックを削除", "削除しますか？", () => { Store.feedbacks.remove(t.dataset.delFb); toast("削除しました"); render(); });
    if ((t = el("[data-del-ms]"))) { Store.milestones.remove(t.dataset.delMs); toast("削除しました"); return render(); }
    if ((t = el("[data-empty-action]"))) {
      const a = t.dataset.emptyAction, arg = t.dataset.arg;
      if (a === "new-case") return caseForm();
      if (a === "go-cases") return go("cases");
      if (a === "new-tx") return txForm(arg);
      if (a === "import-tx") return importForm(arg || null);
      if (a === "new-fb") return fbForm(arg);
      if (a === "new-ms") return msForm(arg);
      if (a === "clear-search") { state.q = ""; $("#globalSearch").value = ""; return render(); }
    }
  });

  // 並び替え（案件リスト）
  content.addEventListener("change", (e) => {
    const sel = e.target.closest("[data-sort]");
    if (sel) { state.sort = sel.value; render(); }
  });

  /* ============ Global wiring ============ */
  $("#nav").addEventListener("click", (e) => { const n = e.target.closest(".nav-item"); if (n) go(n.dataset.view); });
  $("#overlay").addEventListener("click", (e) => { if (e.target.id === "overlay" || e.target.closest("[data-close]")) closeModal(); });

  const isTyping = () => { const a = document.activeElement; return a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.tagName === "SELECT"); };
  const modalOpen = () => $("#overlay").classList.contains("open");
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { closeModal(); return; }
    // ⌘/Ctrl+K または / で検索にフォーカス
    if (((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") || (e.key === "/" && !isTyping() && !modalOpen())) {
      e.preventDefault(); $("#globalSearch").focus(); $("#globalSearch").select(); return;
    }
    // n で新規案件（入力中・モーダル表示中は無効）
    if (e.key.toLowerCase() === "n" && !isTyping() && !modalOpen() && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault(); caseForm();
    }
  });

  // 保存失敗（容量超過など）をユーザーに通知
  Store.setSaveErrorHandler((msg) => toast(msg));

  $("#globalSearch").addEventListener("input", (e) => {
    state.q = e.target.value;
    if (["cases", "board", "transcripts", "feedback"].includes(state.view)) render();
    else if (state.q) go("cases");
  });

  // Theme
  const themeToggle = $("#themeToggle"), themeLabel = $("#themeLabel");
  const savedTheme = localStorage.getItem("cs-theme") || "dark";
  document.documentElement.dataset.theme = savedTheme;
  themeLabel.textContent = savedTheme === "dark" ? "🌙 ダーク" : "☀️ ライト";
  themeToggle.onclick = () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("cs-theme", next);
    themeLabel.textContent = next === "dark" ? "🌙 ダーク" : "☀️ ライト";
  };

  // Menu (mobile)
  $("#menuBtn").onclick = () => $("#sidebar").classList.toggle("open");

  // Export / Import
  $("#exportBtn").onclick = () => {
    const blob = new Blob([Store.exportJSON()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `case-studio-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); toast("データを書き出しました");
  };
  $("#importBtn").onclick = () => $("#importFile").click();
  $("#importFile").onchange = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try { Store.importJSON(reader.result); toast("データを読み込みました"); go("dashboard"); }
      catch (err) { toast("読み込みに失敗: " + err.message); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // boot
  render();
})();

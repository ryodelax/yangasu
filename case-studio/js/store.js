/* ============================================================
   store.js — データ層 (localStorage)
   後でSupabase等のAPIに差し替えやすいよう、ここに永続化を集約。
   ============================================================ */

const Store = (() => {
  const KEY = "case-studio-v1";

  const STATUSES = {
    lead:     { label: "リード",   cls: "lead" },
    progress: { label: "進行中",   cls: "progress" },
    review:   { label: "レビュー", cls: "review" },
    done:     { label: "完了",     cls: "done" },
    hold:     { label: "保留",     cls: "hold" },
  };
  const PRIORITIES = {
    high: { label: "高", cls: "high" },
    mid:  { label: "中", cls: "mid" },
    low:  { label: "低", cls: "low" },
  };

  let db = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { console.warn("load failed", e); }
    return seed();
  }

  function save() {
    db.updatedAt = Date.now();
    localStorage.setItem(KEY, JSON.stringify(db));
  }

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  /* ---------- サンプルデータ (初回のみ) ---------- */
  function seed() {
    const now = Date.now();
    const day = 86400000;
    const c1 = "c_demo1", c2 = "c_demo2";
    return {
      version: 1,
      updatedAt: now,
      cases: [
        {
          id: c1, title: "ブリッジ社 CFダッシュボード改修", client: "株式会社ブリッジ",
          status: "progress", priority: "high", progress: 60,
          tags: ["経理", "GAS", "Looker"],
          description: "キャッシュフロー表の自動反映ロジックを刷新。手数料入金の消し込みルールを見直し、Looker連携の再認可も対応する。",
          createdAt: now - day * 12, dueDate: new Date(now + day * 9).toISOString().slice(0, 10),
        },
        {
          id: c2, title: "コンテンツ壁打ちBot 改善", client: "社内プロジェクト",
          status: "review", priority: "mid", progress: 80,
          tags: ["Slack", "GAS", "AI"],
          description: "Slackコマンド追加後の再インストール運用を整備。3秒制約を非同期トリガーで回避する構成に。",
          createdAt: now - day * 30, dueDate: new Date(now + day * 3).toISOString().slice(0, 10),
        },
      ],
      transcripts: [
        {
          id: uid(), caseId: c1, title: "キックオフMTG", date: new Date(now - day * 11).toISOString().slice(0, 10),
          content: "・現行CF表の課題を共有\n・手数料入金の消し込みが手動で月20時間かかっている\n・LookerのID再認可が必要との指摘\n・次回までにソース一覧を整理する",
          createdAt: now - day * 11,
        },
        {
          id: uid(), caseId: c2, title: "運用フロー確認", date: new Date(now - day * 5).toISOString().slice(0, 10),
          content: "・コマンド追加後は必ず再インストールが必要だと判明\n・3秒応答制約に引っかかるケースを非同期トリガーで回避\n・デプロイIDの管理方法を決める",
          createdAt: now - day * 5,
        },
      ],
      feedbacks: [
        { id: uid(), caseId: c1, author: "長谷川", type: "request", content: "消し込みルールはドキュメント化して仕様書に残しておきたい。", createdAt: now - day * 3 },
        { id: uid(), caseId: c2, author: "レビュアー", type: "good", content: "非同期トリガーの設計、運用が安定していて良い。", createdAt: now - day * 1 },
      ],
      milestones: [
        { id: uid(), caseId: c1, title: "ソース一覧の整理", date: new Date(now - day * 8).toISOString().slice(0, 10), done: true },
        { id: uid(), caseId: c1, title: "消し込みロジック実装", date: new Date(now + day * 2).toISOString().slice(0, 10), done: false },
        { id: uid(), caseId: c1, title: "Looker再認可・検証", date: new Date(now + day * 9).toISOString().slice(0, 10), done: false },
        { id: uid(), caseId: c2, title: "再インストール手順の文書化", date: new Date(now - day * 2).toISOString().slice(0, 10), done: true },
      ],
    };
  }

  /* ---------- Cases ---------- */
  const cases = {
    all: () => [...db.cases].sort((a, b) => b.createdAt - a.createdAt),
    get: (id) => db.cases.find((c) => c.id === id),
    add(data) {
      const c = { id: uid(), createdAt: Date.now(), progress: 0, tags: [], ...data };
      db.cases.push(c); save(); return c;
    },
    update(id, data) {
      const c = cases.get(id); if (!c) return; Object.assign(c, data); save(); return c;
    },
    remove(id) {
      db.cases = db.cases.filter((c) => c.id !== id);
      db.transcripts = db.transcripts.filter((t) => t.caseId !== id);
      db.feedbacks = db.feedbacks.filter((f) => f.caseId !== id);
      db.milestones = db.milestones.filter((m) => m.caseId !== id);
      save();
    },
  };

  /* ---------- Transcripts ---------- */
  const transcripts = {
    all: () => [...db.transcripts].sort((a, b) => (b.date || "").localeCompare(a.date || "")),
    byCase: (cid) => transcripts.all().filter((t) => t.caseId === cid),
    get: (id) => db.transcripts.find((t) => t.id === id),
    add(data) { const t = { id: uid(), createdAt: Date.now(), ...data }; db.transcripts.push(t); save(); return t; },
    update(id, data) { const t = transcripts.get(id); if (t) { Object.assign(t, data); save(); } return t; },
    remove(id) { db.transcripts = db.transcripts.filter((t) => t.id !== id); save(); },
  };

  /* ---------- Feedback ---------- */
  const feedbacks = {
    all: () => [...db.feedbacks].sort((a, b) => b.createdAt - a.createdAt),
    byCase: (cid) => feedbacks.all().filter((f) => f.caseId === cid),
    add(data) { const f = { id: uid(), createdAt: Date.now(), ...data }; db.feedbacks.push(f); save(); return f; },
    remove(id) { db.feedbacks = db.feedbacks.filter((f) => f.id !== id); save(); },
  };

  /* ---------- Milestones ---------- */
  const milestones = {
    byCase: (cid) => db.milestones.filter((m) => m.caseId === cid).sort((a, b) => (a.date || "").localeCompare(b.date || "")),
    add(data) { const m = { id: uid(), done: false, ...data }; db.milestones.push(m); save(); return m; },
    toggle(id) { const m = db.milestones.find((x) => x.id === id); if (m) { m.done = !m.done; save(); } return m; },
    remove(id) { db.milestones = db.milestones.filter((m) => m.id !== id); save(); },
  };

  /* ---------- Stats / Activity ---------- */
  function stats() {
    const cs = db.cases;
    return {
      total: cs.length,
      active: cs.filter((c) => c.status === "progress" || c.status === "review").length,
      done: cs.filter((c) => c.status === "done").length,
      transcripts: db.transcripts.length,
      avgProgress: cs.length ? Math.round(cs.reduce((s, c) => s + (c.progress || 0), 0) / cs.length) : 0,
    };
  }

  function activity(limit = 8) {
    const ev = [];
    db.transcripts.forEach((t) => ev.push({ type: "transcript", t: t.createdAt, caseId: t.caseId, label: t.title }));
    db.feedbacks.forEach((f) => ev.push({ type: "feedback", t: f.createdAt, caseId: f.caseId, label: f.content }));
    db.cases.forEach((c) => ev.push({ type: "case", t: c.createdAt, caseId: c.id, label: c.title }));
    return ev.sort((a, b) => b.t - a.t).slice(0, limit);
  }

  /* ---------- Import / Export ---------- */
  function exportJSON() { return JSON.stringify(db, null, 2); }
  function importJSON(str) {
    const parsed = JSON.parse(str);
    if (!parsed.cases) throw new Error("不正なデータ形式です");
    db = { version: 1, updatedAt: Date.now(), cases: [], transcripts: [], feedbacks: [], milestones: [], ...parsed };
    save();
  }
  function reset() { db = seed(); save(); }

  return {
    STATUSES, PRIORITIES,
    cases, transcripts, feedbacks, milestones,
    stats, activity, exportJSON, importJSON, reset,
  };
})();

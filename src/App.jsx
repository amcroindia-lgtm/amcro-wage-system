import React, { useState, useEffect, useMemo } from "react";
import {
  Plus, Trash2, ChevronLeft, Calendar, Users,
  ClipboardList, Download, Check, AlertCircle, X,
  LogOut, ArrowRight, RefreshCw, MapPin, Shield, Building2,
} from "lucide-react";
import logo from "./assets/logo.png";

/* ── Constants ──────────────────────────────────────────────── */
const COMPANY_NAME = "Amcro India Pvt Ltd.";

const SITES = [
  { id: "site-1", name: "Grand Omaxe Site", location: "Lucknow", passcode: "1828" },
  { id: "site-2", name: "Meridian Site",    location: "Lucknow", passcode: "3128" },
];

const ADMIN_PASSCODE = "810128";
const SHEETS_URL =
  "https://script.google.com/macros/s/AKfycbzBIi-K7bg2G6CUJKD5z-sqr40SJgcjEhpSsEH72d5ZP7pUKeN2yOICqncCyGOQjDNj/exec";

// Work types available for selection
const WORK_TYPES = [
  "Mason",
  "Helper / Labour",
  "Carpenter",
  "Plumber",
  "Electrician",
  "Painter",
  "Steel Fixer",
  "Tile Worker",
  "Waterproofing",
  "Excavation",
  "Shuttering",
  "Welder",
  "Supervisor",
  "Other",
];

/* ── Helpers ────────────────────────────────────────────────── */
const getTodayStr = () => {
  const d = new Date();
  return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const fmtDate = (iso) => {
  if (!iso) return "";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
};

const fmtINR = (n) => (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
const uid    = ()  => Math.random().toString(36).slice(2, 9);

/* ══════════════════════════════════════════════════════════════
   ROOT APP
   ══════════════════════════════════════════════════════════════ */
export default function App() {
  const [role,      setRole]      = useState(null);   // 'supervisor' | 'owner'
  const [site,      setSite]      = useState(null);   // selected site object
  const [verified,  setVerified]  = useState(false);
  const [records,   setRecords]   = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [toasts,    setToasts]    = useState([]);

  /* ── Data bootstrap ── */
  useEffect(() => {
    try {
      const c = localStorage.getItem("amcro_records");
      if (c) setRecords(JSON.parse(c));
    } catch {}
    fetchSheets();
  }, []);

  useEffect(() => {
    localStorage.setItem("amcro_records", JSON.stringify(records));
  }, [records]);

  /* ── Toasts ── */
  const toast = (type, msg) => {
    const id = uid();
    setToasts(p => [...p, { id, type, msg }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)),
      type === "error" ? 6000 : 3500);
  };

  /* ── Sheets ── */
  const fetchSheets = async () => {
    if (!SHEETS_URL) return;
    setLoading(true);
    try {
      const res  = await fetch(`${SHEETS_URL}?action=read`);
      const data = await res.json();
      if (data?.records) {
        const rows = data.records.map(r => ({
          site:     r.site     || r.Site     || "",
          date:     r.date     || r.Date     || "",
          name:     r.name     || r["Worker Name"] || "",
          wage:     Number(r.wage || r.Wage) || 0,
          status:   String(r.status || r["Payment Status"] || "unpaid").toLowerCase(),
          workType: r.workType || r["Work Type"] || "",
        }));
        setRecords(rows);
        localStorage.setItem("amcro_records", JSON.stringify(rows));
      }
    } catch { /* use cache */ }
    finally { setLoading(false); }
  };

  const pushSheets = async (siteName, date, rows) => {
    if (!SHEETS_URL) return { ok: false, error: "Not configured" };
    try {
      const res = await fetch(SHEETS_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "write", site: siteName, date,
          rows: rows.map(r => ({ name: r.name, wage: Number(r.wage)||0,
            status: r.status === "paid" ? "Paid" : "Unpaid",
            workType: r.workType || "" })),
        }),
      });
      const d = await res.json().catch(() => null);
      return d?.ok ? { ok: true } : { ok: false, error: d?.error || "Script error" };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  /* ── Save entry (supervisor or owner toggle) ── */
  const saveEntry = async (siteName, date, rows) => {
    const merged = [
      ...records.filter(r => !(r.site === siteName && r.date === date)),
      ...rows.map(r => ({ site: siteName, date, name: r.name.trim(), wage: Number(r.wage)||0, status: r.status, workType: r.workType || "" })),
    ];
    setRecords(merged);
    toast("success", "Saved on device ✓");
    const res = await pushSheets(siteName, date, rows);
    res.ok ? toast("success", "Synced to Google Sheets ✓")
           : toast("error",   `Sheets failed: ${res.error}`);
  };

  const logout = () => { setRole(null); setSite(null); setVerified(false); };

  /* ── Routing ── */
  return (
    <div className="app-container">
      {/* Toasts */}
      <div className="toast-stack">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.type === "success" ? <Check size={15}/> : <AlertCircle size={15}/>}
            <span className="toast-msg">{t.msg}</span>
            <button className="toast-close-btn" onClick={() => setToasts(p => p.filter(x => x.id !== t.id))}>
              <X size={13}/>
            </button>
          </div>
        ))}
      </div>

      {/* Screens */}
      {!role && (
        <RoleGate onSelect={r => { setRole(r); if (r === "owner") setSite(null); }}/>
      )}

      {role === "supervisor" && !site && (
        <SitePicker onSelect={setSite} onBack={logout}/>
      )}

      {role && !verified && (role === "owner" || site) && (
        <PasscodeGate
          role={role} site={site}
          onSuccess={() => setVerified(true)}
          onBack={() => role === "owner" ? setRole(null) : setSite(null)}
        />
      )}

      {role === "supervisor" && site && verified && (
        <SupervisorEntry
          site={site} records={records}
          onSave={saveEntry}
          onBack={() => { setSite(null); setVerified(false); }}
        />
      )}

      {role === "owner" && verified && (
        <OwnerDashboard
          records={records} loading={loading}
          onRefresh={fetchSheets} onSaveEntry={saveEntry}
          onBack={logout}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   ROLE GATE
   ══════════════════════════════════════════════════════════════ */
function RoleGate({ onSelect }) {
  return (
    <div className="role-gate-container">
      {/* Hero */}
      <div className="role-gate-hero">
        <img src={logo} alt="Amcro" className="hero-logo"/>
        <div className="hero-company">{COMPANY_NAME}</div>
        <div className="hero-tagline">Daily Wage Management Portal</div>
        <div className="hero-divider"/>
      </div>

      {/* Cards */}
      <div className="role-cards-area">
        <div className="role-section-label">Select your role to continue</div>

        <div className="role-card" onClick={() => onSelect("supervisor")}>
          <div className="role-icon-wrapper"><Users size={22}/></div>
          <div className="role-info">
            <h3>Supervisor Entry</h3>
            <p>Record daily workers &amp; wages for your site</p>
          </div>
          <ArrowRight className="role-arrow" size={17}/>
        </div>

        <div className="role-card" onClick={() => onSelect("owner")}>
          <div className="role-icon-wrapper"><Shield size={22}/></div>
          <div className="role-info">
            <h3>Owner / Admin</h3>
            <p>View reports, manage payments &amp; export payroll</p>
          </div>
          <ArrowRight className="role-arrow" size={17}/>
        </div>
      </div>

      <div className="role-footer">v1.0 · Secure &amp; Offline-First</div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SITE PICKER
   ══════════════════════════════════════════════════════════════ */
function SitePicker({ onSelect, onBack }) {
  return (
    <div className="site-picker-screen">
      <TopBar title="Select Worksite" subtitle={COMPANY_NAME} onBack={onBack}/>
      <div className="site-picker-body">
        <div className="section-label">Active Construction Sites</div>
        {SITES.map(s => (
          <div key={s.id} className="site-card" onClick={() => onSelect(s)}>
            <div className="site-card-icon"><Building2 size={20}/></div>
            <div className="site-card-info">
              <h3>{s.name}</h3>
              <p><MapPin size={11}/> {s.location}</p>
            </div>
            <ArrowRight className="site-card-arrow" size={17}/>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   PASSCODE GATE
   ══════════════════════════════════════════════════════════════ */
function PasscodeGate({ role, site, onSuccess, onBack }) {
  const [pin,   setPin]   = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  const len    = role === "owner" ? 6 : 4;
  const target = role === "owner" ? ADMIN_PASSCODE : site?.passcode;
  const title  = role === "owner" ? "Admin Access" : site?.name;
  const sub    = role === "owner" ? "Enter 6-digit admin passcode" : "Enter 4-digit site passcode";

  const press = (n) => {
    if (error) { setPin(String(n)); setError(false); return; }
    if (pin.length >= len) return;
    const next = pin + n;
    setPin(next);
    if (next.length === len) {
      if (next === target) {
        setTimeout(onSuccess, 160);
      } else {
        setTimeout(() => {
          setError(true);
          setShake(true);
          setPin("");
          setTimeout(() => setShake(false), 400);
        }, 200);
      }
    }
  };

  const del = () => { if (pin.length > 0 && !error) setPin(p => p.slice(0, -1)); };

  return (
    <div className="passcode-screen">
      <TopBar title="Authentication" subtitle={COMPANY_NAME} onBack={onBack}/>

      <div className="passcode-hero">
        <img src={logo} alt="Amcro" className="passcode-hero-logo"/>
        <h2>{title}</h2>
        <p>{sub}</p>
      </div>

      <div className="passcode-body">
        {/* Dots */}
        <div className={`pin-dots${error ? " error" : ""}${shake ? " shake" : ""}`}>
          {Array.from({ length: len }).map((_, i) => (
            <div key={i} className={`pin-dot${i < pin.length ? " filled" : ""}`}/>
          ))}
        </div>

        <div className="pin-error-msg">
          {error ? "Incorrect passcode. Try again." : ""}
        </div>

        {/* Keypad */}
        <div className="pin-pad">
          {[1,2,3,4,5,6,7,8,9].map(n => (
            <button key={n} className="pin-key" onClick={() => press(n)}>{n}</button>
          ))}
          <div className="pin-key empty"/>
          <button className="pin-key" onClick={() => press(0)}>0</button>
          <button className="pin-key delete" onClick={del}><X size={20}/></button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SUPERVISOR ENTRY
   ══════════════════════════════════════════════════════════════ */
function SupervisorEntry({ site, records, onSave, onBack }) {
  const [date, setDate] = useState(getTodayStr());
  const [rows, setRows] = useState([{ id: uid(), name: "", wage: "", status: "unpaid", workType: "" }]);

  // Keep a ref so we can read latest records without triggering the effect
  const recordsRef = React.useRef(records);
  useEffect(() => { recordsRef.current = records; }, [records]);

  /* Load saved records ONLY when the date or site changes — NOT when records
     updates. This prevents unsaved local deletions/edits from being reset
     whenever the parent re-renders (e.g. after a save or sheet sync). */
  useEffect(() => {
    const existing = recordsRef.current.filter(
      r => r.site === site.name && r.date === date
    );
    setRows(
      existing.length > 0
        ? existing.map(r => ({ id: uid(), name: r.name, wage: r.wage, status: r.status, workType: r.workType || "" }))
        : [{ id: uid(), name: "", wage: "", status: "unpaid", workType: "" }]
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, site.name]); // ← records intentionally excluded

  const add    = () => setRows(p => [...p, { id: uid(), name: "", wage: "", status: "unpaid", workType: "" }]);
  const remove = (id) => setRows(p => p.length === 1
    ? [{ id: uid(), name: "", wage: "", status: "unpaid", workType: "" }]
    : p.filter(r => r.id !== id)
  );
  const change = (id, field, val) => setRows(p => p.map(r => r.id === id ? { ...r, [field]: val } : r));

  const dayTotal   = useMemo(() => rows.reduce((s, r) => s + (Number(r.wage) || 0), 0), [rows]);
  const workerCnt  = rows.filter(r => r.name.trim()).length;
  const formValid  = useMemo(() =>
    rows.some(r => r.name.trim()) &&
    rows.every(r => !r.name.trim() || Number(r.wage) > 0),
    [rows]
  );

  const save = () => onSave(site.name, date, rows.filter(r => r.name.trim()));

  return (
    <div className="entry-screen">
      <TopBar
        title={site.name}
        subtitle={`Supervisor · ${site.location}`}
        onBack={onBack}
        right={<button className="icon-btn" onClick={onBack} title="Log out"><LogOut size={17}/></button>}
      />

      {/* Date & count bar */}
      <div className="entry-subbar">
        <label className="date-chip">
          <Calendar size={14}/>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </label>
        <div className="count-badge">{workerCnt} {workerCnt === 1 ? "Worker" : "Workers"}</div>
      </div>

      {/* Scrollable list */}
      <div className="worker-scroll-area">
        <div className="section-label">Daily Attendance &amp; Wages</div>

        {rows.map((row, i) => (
          <div key={row.id} className="worker-card">
            <div className="worker-card-top">
              <div className="w-index">{i + 1}</div>
              <input
                type="text"
                className="input-name"
                placeholder="Worker full name"
                value={row.name}
                onChange={e => change(row.id, "name", e.target.value)}
              />
              <div className="wage-wrap">
                <span className="wage-sym">₹</span>
                <input
                  type="number"
                  className="input-wage"
                  placeholder="0"
                  value={row.wage}
                  onChange={e => change(row.id, "wage", e.target.value)}
                />
              </div>
            </div>

            {/* Work Type Row */}
            <div className="worker-card-worktype">
              <span className="worktype-label">Work Type</span>
              <select
                className="worktype-select"
                value={row.workType}
                onChange={e => change(row.id, "workType", e.target.value)}
              >
                <option value="">— Select work type —</option>
                {WORK_TYPES.map(w => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            </div>

            <div className="worker-card-bottom">
              <div className="status-toggle">
                <button
                  className={`toggle-btn${row.status === "unpaid" ? " active-unpaid" : ""}`}
                  onClick={() => change(row.id, "status", "unpaid")}
                >Unpaid</button>
                <button
                  className={`toggle-btn${row.status === "paid" ? " active-paid" : ""}`}
                  onClick={() => change(row.id, "status", "paid")}
                >Paid</button>
              </div>
              <button className="del-btn" onClick={() => remove(row.id)}><Trash2 size={15}/></button>
            </div>
          </div>
        ))}

        <button className="add-btn" onClick={add}>
          <Plus size={17}/> Add Worker
        </button>
      </div>

      {/* Fixed bottom bar */}
      <div className="save-bar">
        <div className="save-bar-total">
          <p>Day Total</p>
          <h2>₹ {fmtINR(dayTotal)}</h2>
        </div>
        <button className="btn-save" disabled={!formValid} onClick={save}>
          <Check size={16}/> Save Record
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   OWNER DASHBOARD
   ══════════════════════════════════════════════════════════════ */
function OwnerDashboard({ records, loading, onRefresh, onSaveEntry, onBack }) {
  const [siteF,   setSiteF]   = useState("all");
  const [monthF,  setMonthF]  = useState("");
  const [tab,     setTab]     = useState("all");
  const [detail,  setDetail]  = useState(null);

  useEffect(() => { setMonthF(new Date().toISOString().slice(0, 7)); }, []);

  const filtered = useMemo(() =>
    records.filter(r => {
      const mSite  = siteF  === "all" || r.site === siteF;
      const mMonth = !monthF || r.date.startsWith(monthF);
      const mTab   = tab   === "all"  || r.status === "unpaid";
      return mSite && mMonth && mTab;
    }),
    [records, siteF, monthF, tab]
  );

  const stats = useMemo(() => {
    let paid = 0, pend = 0;
    filtered.forEach(r => r.status === "paid" ? (paid += r.wage) : (pend += r.wage));
    return { total: paid + pend, paid, pend, count: filtered.length };
  }, [filtered]);

  const grouped = useMemo(() => {
    const m = {};
    filtered.forEach(r => {
      const k = `${r.site}:${r.date}`;
      if (!m[k]) m[k] = { site: r.site, date: r.date, total: 0, workers: 0, pending: 0, rows: [] };
      m[k].total   += r.wage;
      m[k].workers += 1;
      if (r.status === "unpaid") m[k].pending += 1;
      m[k].rows.push(r);
    });
    return Object.values(m).sort((a, b) =>
      a.date !== b.date ? b.date.localeCompare(a.date) : a.site.localeCompare(b.site)
    );
  }, [filtered]);

  const exportCSV = () => {
    if (!filtered.length) return;
    let csv = "data:text/csv;charset=utf-8,Site,Date,Worker Name,Work Type,Daily Wage,Status\n";
    filtered.forEach(r => {
      csv += `"${r.site.replace(/"/g,'""')}",${r.date},"${r.name.replace(/"/g,'""')}","${(r.workType||"").replace(/"/g,'""')}",${r.wage},${r.status==="paid"?"Paid":"Unpaid"}\n`;
    });
    const a = Object.assign(document.createElement("a"), {
      href: encodeURI(csv),
      download: `Amcro_${siteF}_${monthF||"all"}.csv`,
    });
    document.body.appendChild(a); a.click(); a.remove();
  };

  const toggleStatus = (workerName, currentStatus) => {
    if (!detail) return;
    const updated = detail.rows.map(r =>
      r.name === workerName ? { ...r, status: currentStatus === "paid" ? "unpaid" : "paid" } : r
    );
    onSaveEntry(detail.site, detail.date, updated);
    setDetail({ ...detail, pending: updated.filter(r => r.status === "unpaid").length, rows: updated });
  };

  const markAllPaid = () => {
    if (!detail) return;
    const updated = detail.rows.map(r => ({ ...r, status: "paid" }));
    onSaveEntry(detail.site, detail.date, updated);
    setDetail({ ...detail, pending: 0, rows: updated });
  };

  return (
    <div className="dashboard-screen">
      <TopBar
        title="Owner Dashboard"
        subtitle={COMPANY_NAME}
        onBack={onBack}
        right={<button className="icon-btn" onClick={onBack} title="Sign out"><LogOut size={17}/></button>}
      />

      <div className="dashboard-body">
        {/* Stats strip */}
        <div className="stats-hero">
          <div className="stat-col">
            <div className="stat-col-label">Total</div>
            <div className="stat-col-value">₹{fmtINR(stats.total)}</div>
          </div>
          <div className="stat-divider"/>
          <div className="stat-col">
            <div className="stat-col-label">Paid</div>
            <div className="stat-col-value sky">₹{fmtINR(stats.paid)}</div>
          </div>
          <div className="stat-divider"/>
          <div className="stat-col">
            <div className="stat-col-label">Pending</div>
            <div className="stat-col-value red">₹{fmtINR(stats.pend)}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="filters-card">
          <div className="filter-row">
            <select className="filter-select" value={siteF} onChange={e => setSiteF(e.target.value)}>
              <option value="all">All Sites</option>
              {SITES.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
            <input type="month" className="filter-select" value={monthF} onChange={e => setMonthF(e.target.value)}/>
          </div>
          <div className="action-row">
            <button className="btn-action" onClick={onRefresh} disabled={loading}>
              <RefreshCw size={14} className={loading ? "spin" : ""}/>
              {loading ? "Syncing…" : "Sync Sheets"}
            </button>
            <button className="btn-action" onClick={exportCSV} disabled={!filtered.length}>
              <Download size={14}/> Export CSV
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs">
          <button className={`tab${tab === "all" ? " active" : ""}`} onClick={() => setTab("all")}>
            All Wages ({stats.count})
          </button>
          <button className={`tab tab-pending${tab === "unpaid" ? " active" : ""}`} onClick={() => setTab("unpaid")}>
            Pending Dues
          </button>
        </div>

        {/* Feed */}
        <div className="feed-label">
          Wage Register · {grouped.length} {grouped.length === 1 ? "Entry" : "Entries"}
        </div>

        {grouped.length === 0 ? (
          <div className="empty-state">
            <ClipboardList size={44} className="empty-icon"/>
            <h3>No records found</h3>
            <p>Change filters or sync the sheets.</p>
          </div>
        ) : (
          grouped.map(g => (
            <div key={`${g.site}:${g.date}`} className="entry-card" onClick={() => setDetail(g)}>
              <div className="entry-left">
                <div className="entry-site">{g.site}</div>
                <div className="entry-meta">
                  <span><Calendar size={11}/> {fmtDate(g.date)}</span>
                  <span><Users size={11}/> {g.workers} workers</span>
                </div>
              </div>
              <div className="entry-right">
                <div className="entry-amount">₹ {fmtINR(g.total)}</div>
                {g.pending > 0 && <div className="pending-dot" title={`${g.pending} unpaid`}/>}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {detail && (
        <DayDetailModal
          entry={detail}
          onClose={() => setDetail(null)}
          onToggle={toggleStatus}
          onAllPaid={markAllPaid}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   DAY DETAIL MODAL
   ══════════════════════════════════════════════════════════════ */
function DayDetailModal({ entry, onClose, onToggle, onAllPaid }) {
  const total = entry.rows.reduce((s, r) => s + (Number(r.wage) || 0), 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="modal-handle"/>

        <div className="modal-header">
          <div className="modal-title">
            <div className="modal-badge"><Building2 size={11}/> {entry.site}</div>
            <h3>{fmtDate(entry.date)}</h3>
            <p>{entry.workers} workers · {entry.pending > 0 ? `${entry.pending} pending` : "All paid ✓"}</p>
          </div>
          <button className="modal-close-btn" onClick={onClose}><X size={17}/></button>
        </div>

        <div className="modal-body">
          {entry.rows.map(row => (
            <div key={row.name} className="modal-row">
              <div className="modal-row-left">
                <div className="modal-row-name">{row.name}</div>
                {row.workType && (
                  <div className="modal-row-worktype">{row.workType}</div>
                )}
              </div>
              <div className="modal-row-right">
                <div className="modal-row-wage">₹ {fmtINR(row.wage)}</div>
                <span
                  className={`status-pill ${row.status}`}
                  onClick={() => onToggle(row.name, row.status)}
                  title="Tap to toggle"
                >
                  {row.status === "paid" ? "✓ Paid" : "Unpaid"}
                </span>
              </div>
            </div>
          ))}

          <div className="modal-summary">
            <span>Total Wages</span>
            <span className="modal-summary-amt">₹ {fmtINR(total)}</span>
          </div>
        </div>

        <div className="modal-footer">
          {entry.pending > 0 && (
            <button className="btn-save" style={{ justifyContent: "center" }} onClick={onAllPaid}>
              <Check size={15}/> Mark All Paid
            </button>
          )}
          <button className="btn-outline" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SHARED: TOP BAR
   ══════════════════════════════════════════════════════════════ */
function TopBar({ title, subtitle, onBack, right }) {
  return (
    <div className="top-bar">
      <div className="top-bar-left">
        {onBack && (
          <button className="icon-btn" onClick={onBack}>
            <ChevronLeft size={20}/>
          </button>
        )}
        <img src={logo} alt="Amcro" className="top-bar-logo"/>
        <div className="top-bar-title">
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

import React, { useState, useEffect, useMemo } from "react";
import {
  Plus,
  Trash2,
  ChevronLeft,
  Calendar,
  IndianRupee,
  Users,
  ClipboardList,
  Download,
  Check,
  AlertCircle,
  X,
  LogOut,
  ArrowRight,
  RefreshCw,
  MapPin,
  Shield,
  TrendingUp,
  Wallet,
  Clock,
  Building2,
} from "lucide-react";
import logo from "./assets/logo.png";

const COMPANY_NAME = "Amcro India Pvt Ltd.";

const SITES = [
  { id: "site-1", name: "Grand Omaxe Site", location: "Lucknow", passcode: "1828" },
  { id: "site-2", name: "Meridian Site", location: "Lucknow", passcode: "3128" },
];

const ADMIN_PASSCODE = "810128";

const SHEETS_WEBHOOK_URL =
  "https://script.google.com/macros/s/AKfycbzQSGuv7-nJsY3_rcnpv8Y7iIP4OK6_YD2ixjH2-D_chlMWGwlEN1UumbrHndtFW1n1/exec";

const getTodayStr = () => {
  const d = new Date();
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d - offset).toISOString().slice(0, 10);
};

const fmtDateLong = (isoStr) => {
  if (!isoStr) return "";
  const d = new Date(isoStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const fmtINR = (num) =>
  (Number(num) || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

const makeId = () => Math.random().toString(36).substring(2, 9);

export default function App() {
  const [role, setRole] = useState(null);
  const [selectedSite, setSelectedSite] = useState(null);
  const [isVerified, setIsVerified] = useState(false);
  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const cached = localStorage.getItem("amcro_wage_records");
    if (cached) {
      try { setRecords(JSON.parse(cached)); } catch (e) {}
    }
    fetchLatestFromSheets();
  }, []);

  useEffect(() => {
    localStorage.setItem("amcro_wage_records", JSON.stringify(records));
  }, [records]);

  const addToast = (type, message) => {
    const id = makeId();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => removeToast(id), type === "error" ? 6000 : 3500);
  };

  const removeToast = (id) =>
    setToasts((prev) => prev.filter((t) => t.id !== id));

  const fetchLatestFromSheets = async () => {
    if (!SHEETS_WEBHOOK_URL) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${SHEETS_WEBHOOK_URL}?action=read`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      if (data && data.records) {
        const formatted = data.records.map((r) => ({
          site: r.site || r.Site || "",
          date: r.date || r.Date || "",
          name: r.name || r["Worker Name"] || r.WorkerName || "",
          wage: Number(r.wage || r.Wage) || 0,
          status: String(
            r.status || r["Payment Status"] || r.PaymentStatus || "unpaid"
          ).toLowerCase(),
        }));
        setRecords(formatted);
        localStorage.setItem("amcro_wage_records", JSON.stringify(formatted));
      }
    } catch (err) {
      console.warn("Failed to fetch from Sheets, using cache:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const syncToSheets = async (siteName, date, rows) => {
    if (!SHEETS_WEBHOOK_URL)
      return { ok: false, error: "Sheets webhook URL not configured." };
    try {
      const payload = {
        action: "write",
        site: siteName,
        date,
        rows: rows.map((r) => ({
          name: r.name,
          wage: Number(r.wage) || 0,
          status: r.status === "paid" ? "Paid" : "Unpaid",
        })),
      };
      const res = await fetch(SHEETS_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const responseData = await res.json().catch(() => null);
      return responseData?.ok ? { ok: true } : { ok: false, error: responseData?.error || "Unknown error" };
    } catch (err) {
      return { ok: false, error: err.message || "Network failure" };
    }
  };

  const handleSaveEntry = async (siteName, date, rows) => {
    const newRecords = records.filter(
      (r) => !(r.site === siteName && r.date === date)
    );
    const addedRows = rows.map((r) => ({
      site: siteName,
      date,
      name: r.name.trim(),
      wage: Number(r.wage) || 0,
      status: r.status,
    }));
    setRecords([...newRecords, ...addedRows]);
    addToast("success", "Saved locally ✓");
    const syncRes = await syncToSheets(siteName, date, rows);
    if (syncRes.ok) {
      addToast("success", "Google Sheets synced ✓");
    } else {
      addToast("error", `Sheets sync failed: ${syncRes.error}`);
    }
  };

  const handleLogOut = () => {
    setRole(null);
    setSelectedSite(null);
    setIsVerified(false);
  };

  return (
    <div className="app-container">
      {/* Toast System */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.type === "success" ? <Check size={16} /> : <AlertCircle size={16} />}
            <span style={{ flex: 1 }}>{t.message}</span>
            <button className="toast-close" onClick={() => removeToast(t.id)}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {!role && <RoleGate onSelectRole={(r) => { setRole(r); if (r === "owner") setSelectedSite(null); }} />}

      {role === "supervisor" && !selectedSite && (
        <SitePicker onSelectSite={setSelectedSite} onBack={handleLogOut} />
      )}

      {role && !isVerified && (role === "owner" || selectedSite) && (
        <PasscodeGate
          role={role}
          site={selectedSite}
          onSuccess={() => setIsVerified(true)}
          onBack={() => {
            if (role === "owner") setRole(null);
            else setSelectedSite(null);
          }}
        />
      )}

      {role === "supervisor" && selectedSite && isVerified && (
        <SupervisorEntry
          site={selectedSite}
          records={records}
          onSave={handleSaveEntry}
          onBack={() => { setSelectedSite(null); setIsVerified(false); }}
        />
      )}

      {role === "owner" && isVerified && (
        <OwnerDashboard
          records={records}
          isLoading={isLoading}
          onRefresh={fetchLatestFromSheets}
          onSaveEntry={handleSaveEntry}
          onBack={handleLogOut}
        />
      )}
    </div>
  );
}

/* ==========================================================================
   COMPONENT: RoleGate
   ========================================================================== */
function RoleGate({ onSelectRole }) {
  return (
    <div className="role-gate-container">
      {/* Hero Banner */}
      <div className="role-gate-hero">
        <img src={logo} alt="Amcro Logo" className="hero-logo" />
        <div className="hero-company">{COMPANY_NAME}</div>
        <div className="hero-tagline">Daily Wage Management Portal</div>
        <div className="hero-divider" />
      </div>

      <div className="role-section-label">Select Your Role to Continue</div>

      <div className="role-card" onClick={() => onSelectRole("supervisor")}>
        <div className="role-icon-wrapper">
          <Users size={24} />
        </div>
        <div className="role-info">
          <h3>Supervisor Entry</h3>
          <p>Record daily workers &amp; wages for your site</p>
        </div>
        <ArrowRight className="role-arrow" size={18} />
      </div>

      <div className="role-card" onClick={() => onSelectRole("owner")}>
        <div className="role-icon-wrapper">
          <Shield size={24} />
        </div>
        <div className="role-info">
          <h3>Owner / Admin</h3>
          <p>View reports, payment status &amp; export payroll</p>
        </div>
        <ArrowRight className="role-arrow" size={18} />
      </div>

      {/* Footer strip */}
      <div style={{ marginTop: "auto", textAlign: "center", paddingTop: 24 }}>
        <p style={{ fontSize: 11, color: "var(--navy-soft)", opacity: 0.5 }}>
          v1.0 · Secure &amp; Offline-First
        </p>
      </div>
    </div>
  );
}

/* ==========================================================================
   COMPONENT: SitePicker
   ========================================================================== */
function SitePicker({ onSelectSite, onBack }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <div className="top-bar">
        <div className="top-bar-left">
          <button className="icon-btn" onClick={onBack}>
            <ChevronLeft size={20} />
          </button>
          <img src={logo} alt="Logo" className="top-bar-logo" />
          <div className="top-bar-title">
            <h1>Select Worksite</h1>
            <p>{COMPANY_NAME}</p>
          </div>
        </div>
      </div>

      <div className="site-picker-container">
        <div className="section-title">Active Construction Sites</div>
        <div className="site-list">
          {SITES.map((site) => (
            <div key={site.id} className="site-item" onClick={() => onSelectSite(site)}>
              <div className="site-item-icon">
                <Building2 size={20} />
              </div>
              <div className="site-item-info">
                <h3>{site.name}</h3>
                <p>
                  <MapPin size={11} /> {site.location}
                </p>
              </div>
              <ArrowRight className="site-arrow" size={18} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   COMPONENT: PasscodeGate
   ========================================================================== */
function PasscodeGate({ role, site, onSuccess, onBack }) {
  const [pin, setPin] = useState("");
  const [isError, setIsError] = useState(false);

  const expectedLength = role === "owner" ? 6 : 4;
  const targetCode = role === "owner" ? ADMIN_PASSCODE : site.passcode;
  const displayTitle = role === "owner" ? "Admin Access" : site.name;
  const displaySubtitle =
    role === "owner" ? "Enter your 6-digit admin passcode" : "Enter the 4-digit site passcode";

  const handleKeyPress = (num) => {
    if (isError) { setPin(String(num)); setIsError(false); return; }
    if (pin.length < expectedLength) {
      const next = pin + num;
      setPin(next);
      if (next.length === expectedLength) {
        if (next === targetCode) {
          setTimeout(onSuccess, 180);
        } else {
          setTimeout(() => { setIsError(true); setPin(""); }, 220);
        }
      }
    }
  };

  const handleBackspace = () => {
    if (pin.length > 0 && !isError) setPin(pin.slice(0, -1));
  };

  return (
    <div className="passcode-screen">
      {/* Top bar */}
      <div className="top-bar" style={{ width: "100%" }}>
        <div className="top-bar-left">
          <button className="icon-btn" onClick={onBack}>
            <ChevronLeft size={20} />
          </button>
          <img src={logo} alt="Logo" className="top-bar-logo" />
          <div className="top-bar-title">
            <h1>Authentication</h1>
            <p>{COMPANY_NAME}</p>
          </div>
        </div>
      </div>

      {/* Passcode header */}
      <div className="passcode-header">
        <img src={logo} alt="Logo" className="passcode-header-logo" />
        <h2>{displayTitle}</h2>
        <p>{displaySubtitle}</p>
      </div>

      <div className="passcode-body">
        {/* PIN Indicator Dots */}
        <div className={`passcode-indicator ${isError ? "shake error" : ""}`}>
          {Array.from({ length: expectedLength }).map((_, i) => (
            <div key={i} className={`passcode-dot ${i < pin.length ? "active" : ""}`} />
          ))}
        </div>

        {isError && (
          <div style={{ color: "var(--unpaid-text)", fontSize: 13, fontWeight: 600, marginBottom: 16, marginTop: -8 }}>
            Incorrect passcode. Try again.
          </div>
        )}

        {/* PIN Pad */}
        <div className="pin-pad">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <button key={n} className="pin-btn" onClick={() => handleKeyPress(n)}>
              {n}
            </button>
          ))}
          <div className="pin-btn empty" />
          <button className="pin-btn" onClick={() => handleKeyPress(0)}>0</button>
          <button className="pin-btn backspace" onClick={handleBackspace}>
            <X size={22} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   COMPONENT: SupervisorEntry
   ========================================================================== */
function SupervisorEntry({ site, records, onSave, onBack }) {
  const [date, setDate] = useState(getTodayStr());
  const [rows, setRows] = useState([]);

  useEffect(() => {
    const existing = records.filter((r) => r.site === site.name && r.date === date);
    if (existing.length > 0) {
      setRows(existing.map((r) => ({ id: makeId(), name: r.name, wage: r.wage, status: r.status })));
    } else {
      setRows([{ id: makeId(), name: "", wage: "", status: "unpaid" }]);
    }
  }, [date, records, site.name]);

  const handleAddRow = () =>
    setRows([...rows, { id: makeId(), name: "", wage: "", status: "unpaid" }]);

  const handleRemoveRow = (id) => {
    if (rows.length === 1) {
      setRows([{ id: makeId(), name: "", wage: "", status: "unpaid" }]);
    } else {
      setRows(rows.filter((r) => r.id !== id));
    }
  };

  const handleRowChange = (id, field, val) =>
    setRows(rows.map((r) => (r.id === id ? { ...r, [field]: val } : r)));

  const dayTotal = useMemo(
    () => rows.reduce((sum, r) => sum + (Number(r.wage) || 0), 0),
    [rows]
  );

  const isFormValid = useMemo(
    () =>
      rows.some((r) => r.name.trim() !== "") &&
      rows.every((r) => r.name.trim() === "" || Number(r.wage) > 0),
    [rows]
  );

  const handleSaveClick = () => {
    const validRows = rows.filter((r) => r.name.trim() !== "");
    onSave(site.name, date, validRows);
  };

  const workerCount = rows.filter((r) => r.name.trim() !== "").length;

  return (
    <div className="entry-form-container">
      {/* Top Bar */}
      <div className="top-bar">
        <div className="top-bar-left">
          <button className="icon-btn" onClick={onBack}>
            <ChevronLeft size={20} />
          </button>
          <img src={logo} alt="Logo" className="top-bar-logo" />
          <div className="top-bar-title">
            <h1>{site.name}</h1>
            <p>Supervisor Entry · {site.location}</p>
          </div>
        </div>
        <button className="icon-btn" onClick={onBack} title="Log out">
          <LogOut size={18} />
        </button>
      </div>

      {/* Date & Count Bar */}
      <div className="entry-form-header">
        <div className="date-picker-wrapper">
          <Calendar size={15} />
          <input
            type="date"
            className="date-input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="worker-count-badge">
          {workerCount} {workerCount === 1 ? "Worker" : "Workers"}
        </div>
      </div>

      {/* Worker List */}
      <div className="worker-list-section">
        <div className="section-title">Daily Attendance &amp; Wages</div>

        {rows.map((row, index) => (
          <div key={row.id} className="worker-row-card">
            <div className="worker-row-top">
              <div className="worker-index">{index + 1}</div>
              <input
                type="text"
                placeholder="Worker Full Name"
                className="input-field input-name"
                value={row.name}
                onChange={(e) => handleRowChange(row.id, "name", e.target.value)}
              />
              <div className="input-wage-wrapper">
                <span className="input-wage-icon">₹</span>
                <input
                  type="number"
                  placeholder="0"
                  className="input-field input-wage"
                  value={row.wage}
                  onChange={(e) => handleRowChange(row.id, "wage", e.target.value)}
                />
              </div>
            </div>

            <div className="worker-row-bottom">
              <div className="payment-toggle-group">
                <button
                  className={`payment-toggle-btn unpaid ${row.status === "unpaid" ? "active" : ""}`}
                  onClick={() => handleRowChange(row.id, "status", "unpaid")}
                >
                  Unpaid
                </button>
                <button
                  className={`payment-toggle-btn paid ${row.status === "paid" ? "active" : ""}`}
                  onClick={() => handleRowChange(row.id, "status", "paid")}
                >
                  Paid
                </button>
              </div>
              <button className="delete-btn" onClick={() => handleRemoveRow(row.id)}>
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}

        <button className="add-worker-btn" onClick={handleAddRow}>
          <Plus size={18} /> Add Worker
        </button>
      </div>

      {/* Pinned Bottom Bar */}
      <div className="pinned-bottom-bar">
        <div className="bottom-total-info">
          <p>Day Total</p>
          <h2>₹ {fmtINR(dayTotal)}</h2>
        </div>
        <button className="save-btn" disabled={!isFormValid} onClick={handleSaveClick}>
          <Check size={17} /> Save Record
        </button>
      </div>
    </div>
  );
}

/* ==========================================================================
   COMPONENT: OwnerDashboard
   ========================================================================== */
function OwnerDashboard({ records, isLoading, onRefresh, onSaveEntry, onBack }) {
  const [siteFilter, setSiteFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [detailEntry, setDetailEntry] = useState(null);

  useEffect(() => {
    setMonthFilter(new Date().toISOString().slice(0, 7));
  }, []);

  const filteredRecords = useMemo(
    () =>
      records.filter((r) => {
        const matchSite = siteFilter === "all" || r.site === siteFilter;
        const matchMonth = !monthFilter || r.date.startsWith(monthFilter);
        const matchStatus = activeTab === "all" || r.status === "unpaid";
        return matchSite && matchMonth && matchStatus;
      }),
    [records, siteFilter, monthFilter, activeTab]
  );

  const stats = useMemo(() => {
    let totalPaid = 0, totalPending = 0;
    filteredRecords.forEach((r) => {
      if (r.status === "paid") totalPaid += r.wage;
      else totalPending += r.wage;
    });
    return { totalPaid, totalPending, totalWages: totalPaid + totalPending, workerDays: filteredRecords.length };
  }, [filteredRecords]);

  const groupedEntries = useMemo(() => {
    const groups = {};
    filteredRecords.forEach((r) => {
      const key = `${r.site}:${r.date}`;
      if (!groups[key]) {
        groups[key] = { site: r.site, date: r.date, totalWage: 0, workersCount: 0, pendingCount: 0, rows: [] };
      }
      groups[key].totalWage += r.wage;
      groups[key].workersCount += 1;
      if (r.status === "unpaid") groups[key].pendingCount += 1;
      groups[key].rows.push(r);
    });
    return Object.values(groups).sort((a, b) =>
      a.date !== b.date ? b.date.localeCompare(a.date) : a.site.localeCompare(b.site)
    );
  }, [filteredRecords]);

  const handleExportCSV = () => {
    if (!filteredRecords.length) return;
    let csv = "data:text/csv;charset=utf-8,Site,Date,Worker Name,Daily Wage,Payment Status\n";
    filteredRecords.forEach((r) => {
      csv += `"${r.site.replace(/"/g, '""')}",${r.date},"${r.name.replace(/"/g, '""')}",${r.wage},${r.status === "paid" ? "Paid" : "Unpaid"}\n`;
    });
    const link = document.createElement("a");
    link.href = encodeURI(csv);
    link.download = `Amcro_Wages_${siteFilter}_${monthFilter || "all"}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleToggleWorkerStatus = (workerName, currentStatus) => {
    if (!detailEntry) return;
    const nextStatus = currentStatus === "paid" ? "unpaid" : "paid";
    const updatedRows = detailEntry.rows.map((row) =>
      row.name === workerName ? { ...row, status: nextStatus } : row
    );
    onSaveEntry(detailEntry.site, detailEntry.date, updatedRows);
    setDetailEntry({ ...detailEntry, pendingCount: updatedRows.filter((r) => r.status === "unpaid").length, rows: updatedRows });
  };

  const handleMarkAllPaid = () => {
    if (!detailEntry) return;
    const updatedRows = detailEntry.rows.map((row) => ({ ...row, status: "paid" }));
    onSaveEntry(detailEntry.site, detailEntry.date, updatedRows);
    setDetailEntry({ ...detailEntry, pendingCount: 0, rows: updatedRows });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      {/* Top Bar */}
      <div className="top-bar">
        <div className="top-bar-left">
          <button className="icon-btn" onClick={onBack}>
            <ChevronLeft size={20} />
          </button>
          <img src={logo} alt="Logo" className="top-bar-logo" />
          <div className="top-bar-title">
            <h1>Owner Dashboard</h1>
            <p>{COMPANY_NAME}</p>
          </div>
        </div>
        <button className="icon-btn" onClick={onBack} title="Sign Out">
          <LogOut size={18} />
        </button>
      </div>

      <div className="owner-dashboard">
        {/* Hero Summary Strip */}
        <div className="dashboard-summary-hero">
          <div className="hero-stat">
            <div className="hero-stat-label">Total Wages</div>
            <div className="hero-stat-value">₹{fmtINR(stats.totalWages)}</div>
          </div>
          <div className="hero-stat">
            <div className="hero-stat-label">Paid</div>
            <div className="hero-stat-value sky">₹{fmtINR(stats.totalPaid)}</div>
          </div>
          <div className="hero-stat">
            <div className="hero-stat-label">Pending</div>
            <div className="hero-stat-value red">₹{fmtINR(stats.totalPending)}</div>
          </div>
        </div>

        {/* Filters Card */}
        <div className="filters-card">
          <div className="filter-row">
            <select
              className="filter-select"
              value={siteFilter}
              onChange={(e) => setSiteFilter(e.target.value)}
            >
              <option value="all">All Sites</option>
              {SITES.map((s) => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
            <input
              type="month"
              className="filter-select"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
            />
          </div>

          <div className="dashboard-actions">
            <button className="btn-secondary" onClick={onRefresh} disabled={isLoading}>
              <RefreshCw size={15} className={isLoading ? "spin" : ""} />
              {isLoading ? "Syncing..." : "Sync Sheets"}
            </button>
            <button
              className="btn-secondary"
              onClick={handleExportCSV}
              disabled={filteredRecords.length === 0}
            >
              <Download size={15} /> Export CSV
            </button>
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="tab-group">
          <button
            className={`tab-btn ${activeTab === "all" ? "active" : ""}`}
            onClick={() => setActiveTab("all")}
          >
            All Wages ({filteredRecords.length})
          </button>
          <button
            className={`tab-btn sky-tab ${activeTab === "unpaid" ? "active" : ""}`}
            onClick={() => setActiveTab("unpaid")}
          >
            Pending Dues
          </button>
        </div>

        {/* Entries Feed */}
        <div className="records-section">
          <div className="section-title">
            Wage Register · {groupedEntries.length} {groupedEntries.length === 1 ? "Entry" : "Entries"}
          </div>

          {groupedEntries.length === 0 ? (
            <div className="empty-state">
              <ClipboardList size={44} className="empty-state-icon" />
              <p style={{ fontWeight: 600, color: "var(--navy)" }}>No records found</p>
              <p style={{ fontSize: 13 }}>Try changing your filters or sync the sheets.</p>
            </div>
          ) : (
            groupedEntries.map((group) => (
              <div
                key={`${group.site}:${group.date}`}
                className="entry-card"
                onClick={() => setDetailEntry(group)}
              >
                <div className="entry-card-left">
                  <div className="entry-card-site">{group.site}</div>
                  <div className="entry-card-meta">
                    <span><Calendar size={11} /> {fmtDateLong(group.date)}</span>
                    <span><Users size={11} /> {group.workersCount} Workers</span>
                  </div>
                </div>
                <div className="entry-card-right">
                  <div className="entry-card-amount">₹ {fmtINR(group.totalWage)}</div>
                  {group.pendingCount > 0 && (
                    <div
                      className="entry-card-pending-dot"
                      title={`${group.pendingCount} unpaid`}
                    />
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {detailEntry && (
        <DayDetailModal
          entry={detailEntry}
          onClose={() => setDetailEntry(null)}
          onToggleStatus={handleToggleWorkerStatus}
          onMarkAllPaid={handleMarkAllPaid}
        />
      )}
    </div>
  );
}

/* ==========================================================================
   COMPONENT: DayDetailModal
   ========================================================================== */
function DayDetailModal({ entry, onClose, onToggleStatus, onMarkAllPaid }) {
  const modalTotal = entry.rows.reduce((sum, r) => sum + (Number(r.wage) || 0), 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />

        <div className="modal-header">
          <div className="modal-header-title">
            <div className="modal-header-badge">
              <Building2 size={11} /> {entry.site}
            </div>
            <h3>{fmtDateLong(entry.date)}</h3>
            <p>{entry.workersCount} workers · {entry.pendingCount > 0 ? `${entry.pendingCount} pending` : "All paid"}</p>
          </div>
          <button className="icon-btn" onClick={onClose} style={{ background: "var(--off-white)", color: "var(--navy)", border: "1.5px solid var(--border)" }}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div className="modal-worker-list">
            {entry.rows.map((row) => (
              <div key={row.name} className="modal-worker-row">
                <div className="modal-row-name">{row.name}</div>
                <div className="modal-row-right">
                  <div className="modal-row-wage">₹ {fmtINR(row.wage)}</div>
                  <span
                    className={`status-pill ${row.status}`}
                    onClick={() => onToggleStatus(row.name, row.status)}
                    title="Tap to toggle"
                  >
                    {row.status === "paid" ? "✓ Paid" : "Unpaid"}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="modal-summary-strip">
            <span>Total Day Wages</span>
            <span className="modal-summary-amount">₹ {fmtINR(modalTotal)}</span>
          </div>
        </div>

        <div className="modal-footer">
          {entry.pendingCount > 0 && (
            <button className="save-btn" style={{ justifyContent: "center" }} onClick={onMarkAllPaid}>
              <Check size={16} /> Mark All Paid
            </button>
          )}
          <button className="btn-outline-close" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

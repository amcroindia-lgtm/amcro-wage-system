import React, { useState, useEffect, useMemo } from "react";
import { 
  Plus, 
  Trash2, 
  ChevronLeft, 
  Building2, 
  Calendar, 
  IndianRupee, 
  Users, 
  ClipboardList, 
  Download, 
  Check, 
  AlertCircle, 
  X, 
  LogOut, 
  Lock,
  ArrowRight
} from "lucide-react";

const COMPANY_NAME = "Amcro India Pvt Ltd.";

const SITES = [
  { id: "site-1", name: "Grand Omaxe Site", location: "Lucknow", passcode: "1828" },
  { id: "site-2", name: "Meridian Site", location: "Lucknow", passcode: "3128" },
];

const ADMIN_PASSCODE = "810128";

// Google Sheets Apps Script URL
const SHEETS_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbzQSGuv7-nJsY3_rcnpv8Y7iIP4OK6_YD2ixjH2-D_chlMWGwlEN1UumbrHndtFW1n1/exec";

// Help function: Get today's date string in YYYY-MM-DD
const getTodayStr = () => {
  const d = new Date();
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d - offset).toISOString().slice(0, 10);
};

// Help function: Format ISO date string to India standard long date
const fmtDateLong = (isoStr) => {
  if (!isoStr) return "";
  const d = new Date(isoStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", { 
    weekday: "short", 
    day: "numeric", 
    month: "short", 
    year: "numeric" 
  });
};

// Help function: Format number as INR currency without symbols
const fmtINR = (num) => {
  return (Number(num) || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
};

// Helper: Generate clean unique IDs
const makeId = () => Math.random().toString(36).substring(2, 9);

export default function App() {
  const [role, setRole] = useState(null); // 'supervisor' | 'owner' | null
  const [selectedSite, setSelectedSite] = useState(null); // Site object
  const [isVerified, setIsVerified] = useState(false); // Passcode verification state
  const [records, setRecords] = useState([]); // All wage records
  const [isLoading, setIsLoading] = useState(false); // Fetching state
  const [toasts, setToasts] = useState([]); // Array of toasts: { id, type, message }

  // 1. Load data from Local Storage on mount
  useEffect(() => {
    const cached = localStorage.getItem("amcro_wage_records");
    if (cached) {
      try {
        setRecords(JSON.parse(cached));
      } catch (e) {
        console.error("Failed to parse cached records:", e);
      }
    }
    // Pull latest data from Sheets
    fetchLatestFromSheets();
  }, []);

  // Sync state to localStorage whenever records change
  useEffect(() => {
    localStorage.setItem("amcro_wage_records", JSON.stringify(records));
  }, [records]);

  // Toast notifier helper
  const addToast = (type, message) => {
    const id = makeId();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      removeToast(id);
    }, type === "error" ? 6000 : 3500);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Fetch all records from Google Sheets
  const fetchLatestFromSheets = async () => {
    if (!SHEETS_WEBHOOK_URL) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${SHEETS_WEBHOOK_URL}?action=read`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      if (data && data.records) {
        // Map Google Sheet columns to local structure
        const formatted = data.records.map((r) => ({
          site: r.site || r.Site || "",
          date: r.date || r.Date || "",
          name: r.name || r["Worker Name"] || r.WorkerName || "",
          wage: Number(r.wage || r.Wage) || 0,
          status: String(r.status || r["Payment Status"] || r.PaymentStatus || "unpaid").toLowerCase(),
        }));
        setRecords(formatted);
        localStorage.setItem("amcro_wage_records", JSON.stringify(formatted));
      }
    } catch (err) {
      console.warn("Failed to fetch from Google Sheets, using local storage cache:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // POST rows to Google Sheets Apps Script Web App
  const syncToSheets = async (siteName, date, rows) => {
    if (!SHEETS_WEBHOOK_URL) return { ok: false, error: "Sheets webhook URL is not configured." };
    try {
      const payload = {
        action: "write",
        site: siteName,
        date: date,
        rows: rows.map((r) => ({
          name: r.name,
          wage: Number(r.wage) || 0,
          status: r.status === "paid" ? "Paid" : "Unpaid"
        }))
      };

      const res = await fetch(SHEETS_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" }, // avoids CORS preflight issues
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const responseText = await res.text();
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        return { ok: false, error: "Invalid JSON response from Sheets Script" };
      }

      if (responseData && responseData.ok) {
        return { ok: true };
      } else {
        return { ok: false, error: responseData.error || "Unknown Apps Script error" };
      }
    } catch (err) {
      console.error("Sync error:", err);
      return { ok: false, error: err.message || "Network failure" };
    }
  };

  // Handle saving data from supervisor screen
  const handleSaveEntry = async (siteName, date, rows) => {
    // 1. Update state & localStorage locally (immediate response)
    const newRecords = records.filter(
      (r) => !(r.site === siteName && r.date === date)
    );
    const addedRows = rows.map((r) => ({
      site: siteName,
      date: date,
      name: r.name.trim(),
      wage: Number(r.wage) || 0,
      status: r.status
    }));

    const updated = [...newRecords, ...addedRows];
    setRecords(updated);
    addToast("success", "Saved locally in device cache.");

    // 2. Sync to Google Sheets
    const syncRes = await syncToSheets(siteName, date, rows);
    if (syncRes.ok) {
      addToast("success", "Google Sheets sync successful!");
    } else {
      addToast("error", `Sheets Sync Failed: ${syncRes.error}. (Saved locally, will retry later)`);
    }
  };

  // Go back to role choice
  const handleLogOut = () => {
    setRole(null);
    setSelectedSite(null);
    setIsVerified(false);
  };

  return (
    <div className="app-container">
      {/* Toast Alert System */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.type === "success" ? <Check size={18} /> : <AlertCircle size={18} />}
            <span style={{ flex: 1 }}>{t.message}</span>
            <button className="toast-close" onClick={() => removeToast(t.id)}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Role Gate Screen */}
      {!role && (
        <RoleGate 
          onSelectRole={(selectedRole) => {
            setRole(selectedRole);
            if (selectedRole === "owner") {
              setSelectedSite(null);
            }
          }} 
        />
      )}

      {/* Supervisor Site Selector Screen */}
      {role === "supervisor" && !selectedSite && (
        <SitePicker 
          onSelectSite={(site) => setSelectedSite(site)}
          onBack={handleLogOut}
        />
      )}

      {/* Passcode Entry Screen */}
      {role && (!isVerified && (role === "owner" || selectedSite)) && (
        <PasscodeGate
          role={role}
          site={selectedSite}
          onSuccess={() => setIsVerified(true)}
          onBack={() => {
            if (role === "owner") {
              setRole(null);
            } else {
              setSelectedSite(null);
            }
          }}
        />
      )}

      {/* Supervisor Entry Screen */}
      {role === "supervisor" && selectedSite && isVerified && (
        <SupervisorEntry
          site={selectedSite}
          records={records}
          onSave={handleSaveEntry}
          onBack={() => {
            setSelectedSite(null);
            setIsVerified(false);
          }}
        />
      )}

      {/* Owner Dashboard Screen */}
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
      <div className="logo-wrapper">
        <Building2 className="logo-icon" />
      </div>
      <h1 className="company-title">{COMPANY_NAME}</h1>
      <p className="company-subtitle">Daily Wage Management Portal</p>
      
      <div className="role-card" onClick={() => onSelectRole("supervisor")}>
        <div className="role-icon-wrapper">
          <Users size={24} />
        </div>
        <div className="role-info">
          <h3>Supervisor Entry</h3>
          <p>Record daily workers and wages for your site</p>
        </div>
        <ArrowRight className="site-arrow" size={18} style={{ marginLeft: "auto" }} />
      </div>

      <div className="role-card" onClick={() => onSelectRole("owner")}>
        <div className="role-icon-wrapper">
          <Lock size={24} />
        </div>
        <div className="role-info">
          <h3>Owner / Admin</h3>
          <p>View stats, change payment status, and export payroll</p>
        </div>
        <ArrowRight className="site-arrow" size={18} style={{ marginLeft: "auto" }} />
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
          <div className="top-bar-title">
            <h1>Select Worksite</h1>
            <p>{COMPANY_NAME}</p>
          </div>
        </div>
      </div>

      <div className="site-picker-container">
        <h2 className="section-title">Active Sites</h2>
        <div className="site-list">
          {SITES.map((site) => (
            <div 
              key={site.id} 
              className="site-item"
              onClick={() => onSelectSite(site)}
            >
              <div className="site-item-info">
                <h3>{site.name}</h3>
                <p>Location: {site.location}</p>
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
  const displaySubtitle = role === "owner" ? "Enter 6-digit passcode" : "Enter 4-digit site passcode";

  const handleKeyPress = (num) => {
    if (isError) {
      setPin(String(num));
      setIsError(false);
      return;
    }
    
    if (pin.length < expectedLength) {
      const nextPin = pin + num;
      setPin(nextPin);
      
      if (nextPin.length === expectedLength) {
        if (nextPin === targetCode) {
          setTimeout(() => {
            onSuccess();
          }, 150);
        } else {
          setTimeout(() => {
            setIsError(true);
            setPin("");
          }, 200);
        }
      }
    }
  };

  const handleBackspace = () => {
    if (pin.length > 0 && !isError) {
      setPin(pin.slice(0, -1));
    }
  };

  return (
    <div className="passcode-screen">
      <div className="top-bar" style={{ width: "100%" }}>
        <div className="top-bar-left">
          <button className="icon-btn" onClick={onBack}>
            <ChevronLeft size={20} />
          </button>
          <div className="top-bar-title">
            <h1>Passcode Gate</h1>
            <p>{COMPANY_NAME}</p>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
        <div className="passcode-header">
          <h2>{displayTitle}</h2>
          <p>{displaySubtitle}</p>
        </div>

        <div className={`passcode-indicator ${isError ? "shake error" : ""}`}>
          {Array.from({ length: expectedLength }).map((_, i) => (
            <div 
              key={i} 
              className={`passcode-dot ${i < pin.length ? "active" : ""}`}
            />
          ))}
        </div>

        {/* Tactile PIN Pad */}
        <div className="pin-pad">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <button key={n} className="pin-btn" onClick={() => handleKeyPress(n)}>
              {n}
            </button>
          ))}
          <div className="pin-btn empty"></div>
          <button className="pin-btn" onClick={() => handleKeyPress(0)}>0</button>
          <button className="pin-btn backspace" onClick={handleBackspace}>
            <X size={24} />
          </button>
        </div>
      </div>
      <div></div>
    </div>
  );
}

/* ==========================================================================
   COMPONENT: SupervisorEntry
   ========================================================================== */
function SupervisorEntry({ site, records, onSave, onBack }) {
  const [date, setDate] = useState(getTodayStr());
  const [rows, setRows] = useState([]);

  // Load existing records for this site and date if they exist
  useEffect(() => {
    const existing = records.filter(
      (r) => r.site === site.name && r.date === date
    );
    if (existing.length > 0) {
      setRows(existing.map(r => ({ id: makeId(), name: r.name, wage: r.wage, status: r.status })));
    } else {
      // Default: one empty row
      setRows([{ id: makeId(), name: "", wage: "", status: "unpaid" }]);
    }
  }, [date, records, site.name]);

  const handleAddRow = () => {
    setRows([...rows, { id: makeId(), name: "", wage: "", status: "unpaid" }]);
  };

  const handleRemoveRow = (id) => {
    if (rows.length === 1) {
      setRows([{ id: makeId(), name: "", wage: "", status: "unpaid" }]);
    } else {
      setRows(rows.filter((r) => r.id !== id));
    }
  };

  const handleRowChange = (id, field, val) => {
    setRows(
      rows.map((r) => (r.id === id ? { ...r, [field]: val } : r))
    );
  };

  // Calculate day total sum
  const dayTotal = useMemo(() => {
    return rows.reduce((sum, r) => sum + (Number(r.wage) || 0), 0);
  }, [rows]);

  const isFormValid = useMemo(() => {
    return rows.some(r => r.name.trim() !== "") && 
           rows.every(r => r.name.trim() === "" || (Number(r.wage) > 0));
  }, [rows]);

  const handleSaveClick = () => {
    const validRows = rows.filter(r => r.name.trim() !== "");
    onSave(site.name, date, validRows);
  };

  return (
    <div className="entry-form-container">
      <div className="top-bar">
        <div className="top-bar-left">
          <button className="icon-btn" onClick={onBack}>
            <ChevronLeft size={20} />
          </button>
          <div className="top-bar-title">
            <h1>{site.name}</h1>
            <p>Supervisor Entry · {site.location}</p>
          </div>
        </div>
        <button className="icon-btn" onClick={onBack} title="Log out of site">
          <LogOut size={18} />
        </button>
      </div>

      <div className="entry-form-header">
        <div className="date-picker-wrapper">
          <Calendar size={16} style={{ color: "var(--primary)" }} />
          <input 
            type="date" 
            className="date-input" 
            value={date} 
            onChange={(e) => setDate(e.target.value)} 
          />
        </div>
        <div style={{ fontSize: "13px", color: "var(--text-secondary)", fontWeight: 500 }}>
          {rows.filter(r => r.name.trim() !== "").length} Workers
        </div>
      </div>

      <div className="worker-list-section">
        <h2 className="section-title">Daily Attendance & Wages</h2>
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
                  placeholder="Wage"
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
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}

        <button className="add-worker-btn" onClick={handleAddRow}>
          <Plus size={18} /> Add Worker Row
        </button>
      </div>

      {/* Pinned Wage strip bottom */}
      <div className="pinned-bottom-bar">
        <div className="bottom-total-info">
          <p>Day Total</p>
          <h2>₹ {fmtINR(dayTotal)}</h2>
        </div>
        <button 
          className="save-btn" 
          disabled={!isFormValid}
          onClick={handleSaveClick}
        >
          <Check size={18} /> Save Day's Record
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
  const [activeTab, setActiveTab] = useState("all"); // 'all' | 'unpaid'
  const [detailEntry, setDetailEntry] = useState(null); // Selected date/site for modal

  // Default month filter to current month (YYYY-MM)
  useEffect(() => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    setMonthFilter(currentMonth);
  }, []);

  // Filter records based on filters
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const matchSite = siteFilter === "all" || r.site === siteFilter;
      const matchMonth = !monthFilter || r.date.startsWith(monthFilter);
      const matchStatus = activeTab === "all" || r.status === "unpaid";
      return matchSite && matchMonth && matchStatus;
    });
  }, [records, siteFilter, monthFilter, activeTab]);

  // Calculations for stats cards
  const stats = useMemo(() => {
    let totalPaid = 0;
    let totalPending = 0;
    const workerDays = filteredRecords.length;

    filteredRecords.forEach((r) => {
      if (r.status === "paid") {
        totalPaid += r.wage;
      } else {
        totalPending += r.wage;
      }
    });

    return {
      totalPaid,
      totalPending,
      totalWages: totalPaid + totalPending,
      workerDays,
    };
  }, [filteredRecords]);

  // Group items by Site & Date for the summary feed
  const groupedEntries = useMemo(() => {
    const groups = {};
    filteredRecords.forEach((r) => {
      const key = `${r.site}:${r.date}`;
      if (!groups[key]) {
        groups[key] = {
          site: r.site,
          date: r.date,
          totalWage: 0,
          workersCount: 0,
          pendingCount: 0,
          rows: []
        };
      }
      groups[key].totalWage += r.wage;
      groups[key].workersCount += 1;
      if (r.status === "unpaid") {
        groups[key].pendingCount += 1;
      }
      groups[key].rows.push(r);
    });

    // Sort groups by date descending, then site name
    return Object.values(groups).sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return a.site.localeCompare(b.site);
    });
  }, [filteredRecords]);

  // CSV Export Utility
  const handleExportCSV = () => {
    if (filteredRecords.length === 0) return;
    
    // CSV Headers
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Site,Date,Worker Name,Daily Wage,Payment Status\n";

    // Row loop
    filteredRecords.forEach((r) => {
      const site = `"${r.site.replace(/"/g, '""')}"`;
      const name = `"${r.name.replace(/"/g, '""')}"`;
      const status = r.status === "paid" ? "Paid" : "Unpaid";
      csvContent += `${site},${r.date},${name},${r.wage},${status}\n`;
    });

    // Download triggers
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const filename = `Amcro_Wages_${siteFilter}_${monthFilter || "all"}.csv`;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Callback to update payment status of a worker
  const handleToggleWorkerStatus = (workerName, currentStatus) => {
    if (!detailEntry) return;
    const nextStatus = currentStatus === "paid" ? "unpaid" : "paid";
    
    // Create new list of rows for this specific day/site
    const updatedRows = detailEntry.rows.map((row) => {
      if (row.name === workerName) {
        return { ...row, status: nextStatus };
      }
      return row;
    });

    // Save using the standard save entry pipeline (updates local state & pushes to sheet)
    onSaveEntry(detailEntry.site, detailEntry.date, updatedRows);

    // Update modal details locally
    setDetailEntry({
      ...detailEntry,
      pendingCount: updatedRows.filter(r => r.status === "unpaid").length,
      rows: updatedRows
    });
  };

  const handleMarkAllPaid = () => {
    if (!detailEntry) return;
    const updatedRows = detailEntry.rows.map((row) => ({ ...row, status: "paid" }));
    onSaveEntry(detailEntry.site, detailEntry.date, updatedRows);
    setDetailEntry({
      ...detailEntry,
      pendingCount: 0,
      rows: updatedRows
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      {/* Top Navigation Bar */}
      <div className="top-bar">
        <div className="top-bar-left">
          <button className="icon-btn" onClick={onBack}>
            <ChevronLeft size={20} />
          </button>
          <div className="top-bar-title">
            <h1>Owner Dashboard</h1>
            <p>{COMPANY_NAME} · Management</p>
          </div>
        </div>
        <button className="icon-btn" onClick={onBack} title="Sign Out">
          <LogOut size={18} />
        </button>
      </div>

      <div className="owner-dashboard">
        {/* Filters Card */}
        <div className="filters-card">
          <div className="filter-row">
            <select 
              className="filter-select"
              value={siteFilter}
              onChange={(e) => setSiteFilter(e.target.value)}
            >
              <option value="all">All Sites</option>
              {SITES.map(s => (
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
              <ClipboardList size={16} /> {isLoading ? "Syncing..." : "Sync Sheets"}
            </button>
            <button 
              className="btn-secondary" 
              onClick={handleExportCSV}
              disabled={filteredRecords.length === 0}
            >
              <Download size={16} /> Export CSV
            </button>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="payment-toggle-group" style={{ padding: "4px", alignSelf: "flex-start" }}>
          <button 
            className={`payment-toggle-btn unpaid ${activeTab === "all" ? "active" : ""}`}
            style={{ padding: "8px 16px" }}
            onClick={() => setActiveTab("all")}
          >
            All Wages
          </button>
          <button 
            className={`payment-toggle-btn paid ${activeTab === "unpaid" ? "active" : ""}`}
            style={{ padding: "8px 16px" }}
            onClick={() => setActiveTab("unpaid")}
          >
            Unpaid Dues
          </button>
        </div>

        {/* Stats Summary Panel */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-card-title">Total Wages</div>
            <div className="stat-card-value">₹ {fmtINR(stats.totalWages)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-title">Total Paid</div>
            <div className="stat-card-value paid">₹ {fmtINR(stats.totalPaid)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-title">Pending</div>
            <div className="stat-card-value pending">₹ {fmtINR(stats.totalPending)}</div>
          </div>
        </div>

        {/* Daily Entry Feed */}
        <div className="records-section">
          <h2 className="section-title">Wage Register Feed</h2>
          
          {groupedEntries.length === 0 ? (
            <div className="empty-state">
              <ClipboardList className="empty-state-icon" />
              <p>No daily records found matching current filters.</p>
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
                    <span><Calendar size={12} /> {fmtDateLong(group.date)}</span>
                    <span><Users size={12} /> {group.workersCount} Workers</span>
                  </div>
                </div>
                
                <div className="entry-card-right">
                  <div className="entry-card-amount">₹ {fmtINR(group.totalWage)}</div>
                  {group.pendingCount > 0 && (
                    <div 
                      className="entry-card-pending-dot" 
                      title={`${group.pendingCount} unpaid workers`} 
                    />
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Day Details Slide-up Modal */}
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
  const modalTotal = entry.rows.reduce((sum, r) => sum + r.wage, 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-title">
            <h3>{entry.site}</h3>
            <p>{fmtDateLong(entry.date)}</p>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X size={20} />
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
                    title="Tap to toggle payment status"
                  >
                    {row.status}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="modal-summary-strip">
            <span>Total Day Wages</span>
            <span style={{ color: "var(--primary)" }}>₹ {fmtINR(modalTotal)}</span>
          </div>
        </div>

        <div className="modal-footer">
          {entry.pendingCount > 0 && (
            <button 
              className="save-btn" 
              style={{ width: "100%", justifyContent: "center" }}
              onClick={onMarkAllPaid}
            >
              <Check size={16} /> Mark All Paid
            </button>
          )}
          <button 
            className="btn-secondary" 
            style={{ border: "1px solid var(--border-color)", color: "var(--text-main)" }}
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================
   Gig Split Calculator (CB mileage only)
   - Mileage ONLY: Colwyn Bay -> Venue -> Colwyn Bay
   - Town auto-fill + save
   - Driver-first cash rounding (£10 notes) with exact total
   - Worth-it + hourly estimate
   - History (delete works even for older entries without id)
   - Monthly totals
   - Share summary
   - CSV export
   - Clear history
   - Install button support (PWA)
   ========================= */

const TOWNS_KEY = "townMiles_v1";
const HISTORY_KEY = "gigHistory_v4";

let deferredPrompt = null;
let lastGig = null;

/* ---------- elements ---------- */
const townInput = document.getElementById("town");
const milesInput = document.getElementById("miles"); // CB -> Venue (one way)
const feeInput = document.getElementById("fee");
const dateInput = document.getElementById("date");

const avgSpeedInput = document.getElementById("avgSpeed");
const setupHoursInput = document.getElementById("setupHours");
const playHoursInput = document.getElementById("playHours");
const rateInput = document.getElementById("rate");

const warningEl = document.getElementById("warning");

const bandEl = document.getElementById("band");
const minFeeEl = document.getElementById("minFee");
const totalMilesEl = document.getElementById("totalMiles");
const mileageCostEl = document.getElementById("mileageCost");
const youGetEl = document.getElementById("youGet");
const heGetsEl = document.getElementById("heGets");
const worthItEl = document.getElementById("worthIt");
const hourlyRateEl = document.getElementById("hourlyRate");
const totalTimeEl = document.getElementById("totalTime");

const mGigsEl = document.getElementById("mGigs");
const mMilesEl = document.getElementById("mMiles");
const mMileageEl = document.getElementById("mMileage");
const mYouEl = document.getElementById("mYou");

const historyEl = document.getElementById("history");

const calcBtn = document.getElementById("calcBtn");
const saveTownBtn = document.getElementById("saveTownBtn");
const saveGigBtn = document.getElementById("saveGigBtn");
const shareBtn = document.getElementById("shareBtn");
const exportCsvBtn = document.getElementById("exportCsvBtn");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const installBtn = document.getElementById("installBtn");

/* ---------- helpers ---------- */
function safeNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function roundTo10(n) {
  return Math.round(n / 10) * 10;
}

function money(n) {
  if (!Number.isFinite(n)) return "—";
  return "£" + n.toFixed(2);
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function todayYMD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseYMD(s) {
  if (!s) return null;
  const parts = s.split("-").map(Number);
  if (parts.length !== 3) return null;
  const [y, m, d] = parts;
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 12, 0, 0); // noon avoids timezone issues
}

/* ---------- rules (based on CB -> Venue miles one way) ---------- */
function bandFor(milesCbToVenue) {
  if (milesCbToVenue <= 20) return ["Local", 250];
  if (milesCbToVenue <= 50) return ["Travel", 300];
  return ["Destination", 350];
}

/* ---------- towns ---------- */
function loadTowns() {
  try { return JSON.parse(localStorage.getItem(TOWNS_KEY)) || {}; }
  catch { return {}; }
}
function saveTowns(towns) {
  localStorage.setItem(TOWNS_KEY, JSON.stringify(towns));
}
function renderTownList() {
  const dl = document.getElementById("townList");
  if (!dl) return;
  dl.innerHTML = "";
  const towns = loadTowns();
  Object.keys(towns).sort().forEach(name => {
    const opt = document.createElement("option");
    opt.value = name;
    dl.appendChild(opt);
  });
}
if (townInput) {
  townInput.addEventListener("change", () => {
    const towns = loadTowns();
    const key = (townInput.value || "").trim();
    if (towns[key] !== undefined) {
      milesInput.value = towns[key];
    }
  });
}

/* ---------- history ---------- */
function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
  catch { return []; }
}
function saveHistory(hist) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(hist));
}

function getGigDateForGrouping(g) {
  const dt = parseYMD(g.date);
  if (dt) return dt;
  return new Date(g.createdAt || Date.now());
}
function isSameMonth(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}
function updateMonthlyTotals() {
  if (!mGigsEl) return;

  const hist = loadHistory();
  const now = new Date();

  let gigs = 0;
  let miles = 0;
  let mileageCost = 0;
  let youTotal = 0;

  hist.forEach(g => {
    const dt = getGigDateForGrouping(g);
    if (!isSameMonth(dt, now)) return;

    gigs += 1;
    miles += safeNumber(g.totalMiles, 0);
    mileageCost += safeNumber(g.mileageCost, 0);
    youTotal += safeNumber(g.you, 0);
  });

  mGigsEl.textContent = String(gigs);
  mMilesEl.textContent = String(Math.round(miles));
  if (mMileageEl) mMileageEl.textContent = "£" + mileageCost.toFixed(2);
  mYouEl.textContent = "£" + Math.round(youTotal);
}

function gigSummaryText(g) {
  const town = (g.town || "").trim() || "(no town)";
  const date = (g.date || "").trim();
  const header = `${date ? date + " " : ""}${town}`;

  return `${header}
Fee: £${Math.round(g.fee || 0)}
Band: ${g.band || "—"} (min £${Math.round(g.minFee || 0)})
Total miles: ${Number.isFinite(g.totalMiles) ? g.totalMiles.toFixed(1) : "—"}
Mileage: £${Number.isFinite(g.mileageCost) ? g.mileageCost.toFixed(2) : "—"}

You: £${Math.round(g.you || 0)}
Steve: £${Math.round(g.he || 0)}`;
}

async function shareText(text) {
  try {
    if (navigator.share) {
      await navigator.share({ text });
      return;
    }
  } catch {}
  try {
    await navigator.clipboard.writeText(text);
    alert("Copied to clipboard. Paste into WhatsApp.");
  } catch {
    alert("Could not share/copy. Try from a normal Chrome tab.");
  }
}

function renderHistory() {
  if (!historyEl) return;

  const hist = loadHistory();
  historyEl.innerHTML = "";

  if (!hist.length) {
    const empty = document.createElement("div");
    empty.style.opacity = "0.8";
    empty.textContent = "No gigs saved yet.";
    historyEl.appendChild(empty);
    updateMonthlyTotals();
    return;
  }

  const ordered = [...hist].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  ordered.forEach(g => {
    const row = document.createElement("div");
    row.className = "history-row";

    const left = document.createElement("div");
    left.className = "history-left";

    const line1 = document.createElement("div");
    const date = (g.date || "").trim();
    const town = (g.town || "").trim() || "(no town)";
    line1.textContent = `${date ? date + " " : ""}${town} — £${Math.round(g.fee || 0)} (${g.band || "—"})`;

    const line2 = document.createElement("div");
    line2.className = "history-meta";
    const tm = Number.isFinite(g.totalMiles) ? g.totalMiles.toFixed(1) : "—";
    const mc = Number.isFinite(g.mileageCost) ? g.mileageCost.toFixed(2) : "—";
    line2.textContent = `Miles: ${tm} • Mileage: £${mc} • You: £${Math.round(g.you || 0)} • Steve: £${Math.round(g.he || 0)}`;

    left.appendChild(line1);
    left.appendChild(line2);

    const right = document.createElement("div");
    right.style.display = "flex";
    right.style.gap = "8px";
    right.style.alignItems = "center";

    const share = document.createElement("button");
    share.className = "small-btn";
    share.textContent = "Share";
    share.onclick = () => shareText(gigSummaryText(g));

    const del = document.createElement("button");
    del.className = "small-btn small-btn-danger";
    del.textContent = "Delete";

    // ✅ Delete works for new entries (with id) and old ones (without id)
    del.onclick = () => {
      const histNow = loadHistory();

      if (g.id !== undefined && g.id !== null && g.id !== "") {
        const next = histNow.filter(x => x.id !== g.id);
        saveHistory(next);
        renderHistory();
        return;
      }

      // fallback signature delete for older entries
      const sig = `${g.createdAt || ""}|${g.date || ""}|${g.town || ""}|${g.fee || ""}|${g.totalMiles || ""}`;
      const idx = histNow.findIndex(x =>
        `${x.createdAt || ""}|${x.date || ""}|${x.town || ""}|${x.fee || ""}|${x.totalMiles || ""}` === sig
      );

      if (idx >= 0) {
        histNow.splice(idx, 1);
        saveHistory(histNow);
        renderHistory();
      }
    };

    right.appendChild(share);
    right.appendChild(del);

    row.appendChild(left);
    row.appendChild(right);
    historyEl.appendChild(row);
  });

  updateMonthlyTotals();
}

/* ---------- worth-it ---------- */
function calcTimeHours(totalMiles, avgSpeed, setupHours, playHours) {
  const travel = avgSpeed > 0 ? (totalMiles / avgSpeed) : 0;
  return travel + setupHours + playHours;
}
function worthItLabel(hourly) {
  if (hourly >= 25) return "✅ Worth it";
  if (hourly >= 18) return "⚠ Marginal";
  return "❌ Not worth it";
}

/* ---------- UI helpers ---------- */
function clearResultsUI() {
  if (bandEl) bandEl.textContent = "—";
  if (minFeeEl) minFeeEl.textContent = "—";
  if (totalMilesEl) totalMilesEl.textContent = "—";
  if (mileageCostEl) mileageCostEl.textContent = "—";
  if (youGetEl) youGetEl.textContent = "—";
  if (heGetsEl) heGetsEl.textContent = "—";
  if (worthItEl) worthItEl.textContent = "—";
  if (hourlyRateEl) hourlyRateEl.textContent = "—";
  if (totalTimeEl) totalTimeEl.textContent = "—";
}
function showWarn(msg) {
  if (!warningEl) return;
  warningEl.textContent = msg;
  warningEl.classList.remove("hidden");
}
function hideWarn() {
  if (!warningEl) return;
  warningEl.textContent = "";
  warningEl.classList.add("hidden");
}

/* ---------- export CSV ---------- */
function exportCSV() {
  const hist = loadHistory().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  if (!hist.length) {
    alert("No history to export.");
    return;
  }

  const cols = [
    "id","createdAt","date","town","fee","milesCbToVenue",
    "totalMiles","mileageCost","band","minFee","you","he","hourly"
  ];

  const lines = [cols.join(",")];

  hist.forEach(g => {
    const row = cols.map(k => {
      const v = g[k];
      const s = (v === null || v === undefined) ? "" : String(v);
      return `"${s.replaceAll('"','""')}"`;
    }).join(",");
    lines.push(row);
  });

  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "gig-history.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

/* ---------- core calculation ---------- */
function calcAndRender() {
  const milesCbToVenue = safeNumber(milesInput.value, 0);
  const fee = safeNumber(feeInput.value, 0);

  const rate = safeNumber(rateInput?.value, 0.45);
  const avgSpeed = safeNumber(avgSpeedInput?.value, 40);
  const setupHours = safeNumber(setupHoursInput?.value, 1);
  const playHours = safeNumber(playHoursInput?.value, 2);

  if (milesCbToVenue <= 0 || fee <= 0) {
    showWarn("Enter a fee and miles first.");
    return;
  }

  // ✅ Mileage ONLY: CB -> Venue -> CB
  const totalMiles = milesCbToVenue * 2;
  const mileageCost = totalMiles * rate;

  const [band, minFee] = bandFor(milesCbToVenue);

  // Split: mileage first, then 50/50
  const remaining = Math.max(0, fee - mileageCost);
  const split = remaining / 2;

  const rawYou = split + mileageCost;

  // Driver-first rounding:
  // 1) round your take to nearest £10
  // 2) he gets exact remainder so total matches fee
  let youCash = roundTo10(rawYou);
  youCash = Math.max(0, Math.min(fee, youCash));
  const heCash = fee - youCash;

  const totalHours = calcTimeHours(totalMiles, avgSpeed, setupHours, playHours);
  const hourly = totalHours > 0 ? (youCash / totalHours) : 0;

  bandEl.textContent = band;
  minFeeEl.textContent = "£" + Math.round(minFee);
  totalMilesEl.textContent = totalMiles.toFixed(1);
  mileageCostEl.textContent = money(mileageCost);

  youGetEl.textContent = "£" + Math.round(youCash);
  heGetsEl.textContent = "£" + Math.round(heCash);

  worthItEl.textContent = worthItLabel(hourly);
  hourlyRateEl.textContent = "£" + hourly.toFixed(2) + " / hr";
  if (totalTimeEl) totalTimeEl.textContent = totalHours.toFixed(2) + " hrs";

  if (fee < minFee) {
    showWarn(`Below minimum for ${band} (£${Math.round(minFee)}).`);
  } else {
    hideWarn();
  }

  lastGig = {
    id: makeId(),
    createdAt: Date.now(),
    date: (dateInput?.value || "").trim(),
    town: (townInput?.value || "").trim(),
    fee,
    milesCbToVenue,
    totalMiles,
    mileageCost,
    band,
    minFee,
    you: youCash,
    he: heCash,
    hourly
  };

  saveGigBtn.disabled = false;
  shareBtn.disabled = false;
}

/* ---------- handlers ---------- */
calcBtn.onclick = () => {
  hideWarn();
  clearResultsUI();
  calcAndRender();
};

saveTownBtn.onclick = () => {
  const town = (townInput.value || "").trim();
  const miles = safeNumber(milesInput.value, 0);

  if (!town || miles <= 0) {
    alert("Type a town and miles first.");
    return;
  }

  const towns = loadTowns();
  towns[town] = miles;
  saveTowns(towns);
  renderTownList();
  alert("Town saved.");
};

saveGigBtn.onclick = () => {
  if (!lastGig) return;

  // Default date if blank (helps monthly totals)
  if (!lastGig.date) lastGig.date = todayYMD();

  const hist = loadHistory();
  hist.push(lastGig);
  saveHistory(hist);

  renderHistory();

  // ✅ Auto-clear inputs after saving
  if (dateInput) dateInput.value = "";
  if (townInput) townInput.value = "";
  if (feeInput) feeInput.value = "";
  if (milesInput) milesInput.value = "";

  // Reset state & UI
  lastGig = null;
  saveGigBtn.disabled = true;
  shareBtn.disabled = true;
  clearResultsUI();
  hideWarn();
};

shareBtn.onclick = () => {
  if (!lastGig) return;
  shareText(gigSummaryText(lastGig));
};

exportCsvBtn.onclick = exportCSV;

clearHistoryBtn.onclick = () => {
  const ok = confirm("Clear all saved gig history on this phone?");
  if (!ok) return;
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
};

/* ---------- install button ---------- */
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (installBtn) installBtn.style.display = "inline-block";
});

if (installBtn) {
  installBtn.onclick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try {
      const choice = await deferredPrompt.userChoice;
      if (choice?.outcome === "accepted") installBtn.style.display = "none";
    } catch {}
    deferredPrompt = null;
  };
}

/* ---------- init ---------- */
function init() {
  renderTownList();
  renderHistory();
  clearResultsUI();
  hideWarn();
}
init();

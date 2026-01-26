/* =========================
   Gig Split Calculator
   - Includes Conwy <-> Colwyn Bay travel (hidden conwyCb)
   - Town auto-fill + save
   - Driver-first cash rounding (aim £10 notes)
   - Worth-it indicator + hourly estimate
   - History (delete)
   - Monthly totals
   - Share summary + CSV export
   - Install button support
   ========================= */

const TOWNS_KEY = "townMiles_v1";
const HISTORY_KEY = "gigHistory_v3";

let deferredPrompt = null;

// Elements
const townInput = document.getElementById("town");
const milesInput = document.getElementById("miles");          // CB → Venue (one way)
const conwyCbInput = document.getElementById("conwyCb");      // hidden, default 12
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

// Buttons
const calcBtn = document.getElementById("calcBtn");
const saveTownBtn = document.getElementById("saveTownBtn");
const saveGigBtn = document.getElementById("saveGigBtn");
const shareBtn = document.getElementById("shareBtn");
const exportCsvBtn = document.getElementById("exportCsvBtn");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const installBtn = document.getElementById("installBtn");

let lastGig = null;

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
  // "YYYY-MM-DD" -> Date at noon to avoid timezone edge cases
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 12, 0, 0);
}

/* ---------- rules (based on CB → Venue miles) ---------- */
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
  // Prefer entered date, else createdAt timestamp
  const dt = parseYMD(g.date);
  if (dt) return dt;
  return new Date(g.createdAt || Date.now());
}

function isSameMonth(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function updateMonthlyTotals() {
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
  mMileageEl.textContent = "£" + mileageCost.toFixed(2);
  mYouEl.textContent = "£" + Math.round(youTotal);
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
    line2.textContent = `Miles: ${tm} • Mileage: £${mc} • You: £${Math.round(g.you || 0)} • He: £${Math.round(g.he || 0)}`;

    left.appendChild(line1);
    left.appendChild(line2);

    const right = document.createElement("div");
    right.style.display = "flex";
    right.style.gap = "8px";
    right.style.alignItems = "center";

    const share = document.createElement("button");
    share.className = "small-btn";
    share.textContent = "Share";
    share.onclick = () => shareGig(g);

    const del = document.createElement("button");
    del.className = "small-btn small-btn-danger";
    del.textContent = "Delete";
    del.onclick = () => {
      const next = loadHistory().filter(x => x.id !== g.id);
      saveHistory(next);
      renderHistory();
    };

    right.appendChild(share);
    right.appendChild(del);

    row.appendChild(left);
    row.appendChild(right);
    historyEl.appendChild(row);
  });

  updateMonthlyTotals();
}

/* ---------- worth-it / hourly ---------- */
function calcTimeHours(totalMiles, avgSpeed, setupHours, playHours) {
  const travel = avgSpeed > 0 ? (totalMiles / avgSpeed) : 0;
  return travel + setupHours + playHours;
}

function worthItLabel(hourly) {
  // Tune these anytime:
  if (hourly >= 25) return "✅ Worth it";
  if (hourly >= 18) return "⚠ Marginal";
  return "❌ Not worth it";
}

/* ---------- share / export ---------- */
function gigSummaryText(g) {
  const town = (g.town || "").trim() || "(no town)";
  const date = (g.date || "").trim();

  const header = `${date ? date + " " : ""}${town}`;
  const fee = `Fee: £${Math.round(g.fee || 0)}`;
  const miles = `Total miles: ${Number.isFinite(g.totalMiles) ? g.totalMiles.toFixed(1) : "—"}`;
  const mileage = `Mileage: £${Number.isFinite(g.mileageCost) ? g.mileageCost.toFixed(2) : "—"}`;
  const split = `You: £${Math.round(g.you || 0)}\nSteve: £${Math.round(g.he || 0)}`;

  const band = `Band: ${g.band || "—"} (min £${Math.round(g.minFee || 0)})`;

  return `${header}\n${fee}\n${band}\n${miles}\n${mileage}\n\n${split}`;
}

async function shareText(text) {
  try {
    if (navigator.share) {
      await navigator.share({ text });
      return true;
    }
  } catch {}
  // fallback: clipboard
  try {
    await navigator.clipboard.writeText(text);
    alert("Copied to clipboard. Paste into WhatsApp.");
    return true;
  } catch {
    alert("Could not share/copy. Try from a normal Chrome tab.");
    return false;
  }
}

function shareGig(g) {
  return shareText(gigSummaryText(g));
}

function exportCSV() {
  const hist = loadHistory().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  if (!hist.length) {
    alert("No history to export.");
    return;
  }

  const cols = [
    "id","createdAt","date","town","fee","milesCbToVenue","conwyCb",
    "totalMiles","mileageCost","band","minFee","you","he"
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

/* ---------- calculate ---------- */
function clearResultsUI() {
  bandEl.textContent = "—";
  minFeeEl.textContent = "—";
  totalMilesEl.textContent = "—";
  mileageCostEl.textContent = "—";
  youGetEl.textContent = "—";
  heGetsEl.textContent = "—";
  worthItEl.textContent = "—";
  hourlyRateEl.textContent = "—";
  totalTimeEl.textContent = "—";
}

function showWarn(msg) {
  warningEl.textContent = msg;
  warningEl.classList.remove("hidden");
}

function hideWarn() {
  warningEl.textContent = "";
  warningEl.classList.add("hidden");
}

function calcAndRender() {
  const milesCbToVenue = safeNumber(milesInput.value, 0);
  const fee = safeNumber(feeInput.value, 0);

  const conwyCb = safeNumber(conwyCbInput?.value, 12) || 12;

  const rate = safeNumber(rateInput?.value, 0.45);
  const avgSpeed = safeNumber(avgSpeedInput?.value, 40);
  const setupHours = safeNumber(setupHoursInput?.value, 1);
  const playHours = safeNumber(playHoursInput?.value, 2);

  if (milesCbToVenue <= 0 || fee <= 0) {
    showWarn("Enter a fee and miles first.");
    return;
  }

  // Route: Conwy → CB → Venue → CB → Conwy
  const totalMiles = (milesCbToVenue * 2) + (conwyCb * 2);
  const mileageCost = totalMiles * rate;

  const [band, minFee] = bandFor(milesCbToVenue);

  // Split: mileage first, then 50/50
  const remaining = Math.max(0, fee - mileageCost);
  const split = remaining / 2;

  const rawYou = split + mileageCost;
  const rawHe = split;

  // Cash rounding: driver-first, aims for £10 notes AND keeps total exact.
  // Strategy:
  // 1) Round your amount to nearest £10
  // 2) Adjust by +/-£10 if needed so the remainder is also a multiple of £10 (when fee is)
  let youCash = roundTo10(rawYou);
  youCash = Math.max(0, Math.min(fee, youCash));

  // If fee is multiple of 10, try to keep his share multiple of 10 too
  if (fee % 10 === 0) {
    const rem = fee - youCash;
    if (rem % 10 !== 0) {
      // push youCash by 10 in the direction that keeps it closest to rawYou
      const up = Math.min(fee, youCash + 10);
      const down = Math.max(0, youCash - 10);
      const upOk = ((fee - up) % 10 === 0);
      const downOk = ((fee - down) % 10 === 0);

      if (upOk && downOk) {
        youCash = (Math.abs(up - rawYou) < Math.abs(down - rawYou)) ? up : down;
      } else if (upOk) {
        youCash = up;
      } else if (downOk) {
        youCash = down;
      }
    }
  }

  const heCash = fee - youCash; // exact remainder

  // Worth-it estimate
  const totalHours = calcTimeHours(totalMiles, avgSpeed, setupHours, playHours);
  const hourly = totalHours > 0 ? (youCash / totalHours) : 0;

  // UI
  bandEl.textContent = band;
  minFeeEl.textContent = "£" + Math.round(minFee);
  totalMilesEl.textContent = totalMiles.toFixed(1);
  mileageCostEl.textContent = money(mileageCost);

  youGetEl.textContent = "£" + Math.round(youCash);
  heGetsEl.textContent = "£" + Math.round(heCash);

  worthItEl.textContent = worthItLabel(hourly);
  hourlyRateEl.textContent = "£" + hourly.toFixed(2) + " / hr";
  totalTimeEl.textContent = totalHours.toFixed(2) + " hrs";

  // Warnings
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
    conwyCb,
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

/* ---------- button handlers ---------- */
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

  // Default date if empty (helps monthly totals)
  if (!lastGig.date) lastGig.date = todayYMD();

  const hist = loadHistory();
  hist.push(lastGig);
  saveHistory(hist);

  renderHistory();

  // Keep lastGig but show quick feedback
  showWarn("Saved ✔");
  setTimeout(() => {
    // keep fee-min warning if relevant
    if (lastGig && lastGig.fee < lastGig.minFee) return;
    hideWarn();
  }, 900);
};

shareBtn.onclick = () => {
  if (!lastGig) return;
  shareGig(lastGig);
};

exportCsvBtn.onclick = exportCSV;

clearHistoryBtn.onclick = () => {
  const ok = confirm("Clear all saved gig history on this phone?");
  if (!ok) return;
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
};

/* ---------- install button support ---------- */
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
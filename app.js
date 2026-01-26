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
function calcTimeHours(totalMiles,
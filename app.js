const RATE = 0.45;
const TOWNS_KEY = "townMiles_v1";
const HISTORY_KEY = "gigHistory_v2";

/* -------- elements -------- */
const townInput = document.getElementById("town");
const milesInput = document.getElementById("miles");     // CB → Venue (one way)
const conwyCbInput = document.getElementById("conwyCb"); // hidden input
const feeInput = document.getElementById("fee");
const warning = document.getElementById("warning");

const bandEl = document.getElementById("band");
const minFeeEl = document.getElementById("minFee");
const totalMilesEl = document.getElementById("totalMiles");
const mileageCostEl = document.getElementById("mileageCost");
const youGetEl = document.getElementById("youGet");
const heGetsEl = document.getElementById("heGets");

const historyEl = document.getElementById("history");

let lastGig = null;

/* -------- helpers -------- */
function roundTo10(n) {
  return Math.round(n / 10) * 10;
}

function safeNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/* -------- towns -------- */
function loadTowns() {
  try {
    return JSON.parse(localStorage.getItem(TOWNS_KEY)) || {};
  } catch {
    return {};
  }
}

function saveTowns(towns) {
  localStorage.setItem(TOWNS_KEY, JSON.stringify(towns));
}

function renderTownList() {
  const dl = document.getElementById("townList");
  if (!dl) return;
  dl.innerHTML = "";
  const towns = loadTowns();
  Object.keys(towns).sort().forEach(t => {
    const o = document.createElement("option");
    o.value = t;
    dl.appendChild(o);
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

/* -------- pricing rules (based on CB → Venue miles) -------- */
function bandFor(milesCbToVenue) {
  if (milesCbToVenue <= 20) return ["Local", 250];
  if (milesCbToVenue <= 50) return ["Travel", 300];
  return ["Destination", 350];
}

/* -------- history -------- */
function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
  } catch {
    return [];
  }
}

function saveHistory(hist) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(hist));
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
    return;
  }

  const ordered = [...hist].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  ordered.forEach(g => {
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.justifyContent = "space-between";
    row.style.alignItems = "center";
    row.style.gap = "10px";
    row.style.padding = "8px 0";
    row.style.borderBottom = "1px solid rgba(255,255,255,0.12)";

    const left = document.createElement("div");
    left.style.flex = "1";

    const line1 = document.createElement("div");
    const date = (g.date || "").trim();
    const town = (g.town || "").trim() || "(no town)";
    line1.textContent = `${date ? date + " " : ""}${town} — £${Math.round(g.fee || 0)} (${g.band || "—"})`;

    const line2 = document.createElement("div");
    line2.style.opacity = "0.8";
    line2.style.fontSize = "12px";
    const tm = Number.isFinite(g.totalMiles) ? g.totalMiles.toFixed(1) : "—";
    const mc = Number.isFinite(g.mileageCost) ? g.mileageCost.toFixed(2) : "—";
    line2.textContent = `Miles: ${tm} • Mileage: £${mc} • You: £${Math.round(g.you || 0)} • He: £${Math.round(g.he || 0)}`;

    left.appendChild(line1);
    left.appendChild(line2);

    const right = document.createElement("div");
    right.style.display = "flex";
    right.style.gap = "8px";

    const del = document.createElement("button");
    del.textContent = "Delete";
    del.style.background = "#7f1d1d";
    del.style.border = "none";
    del.style.color = "white";
    del.style.borderRadius = "6px";
    del.style.padding = "6px 10px";

    del.onclick = () => {
      const histNow = loadHistory();
      const next = histNow.filter(x => x.id !== g.id);
      saveHistory(next);
      renderHistory();
    };

    right.appendChild(del);
    row.appendChild(left);
    row.appendChild(right);
    historyEl.appendChild(row);
  });
}

/* -------- actions -------- */
document.getElementById("calcBtn").onclick = () => {
  const miles = safeNumber(milesInput.value, 0);             // CB → Venue (one way)
  const conwyCb = safeNumber(conwyCbInput?.value, 12) || 12; // Conwy → CB (one way)
  const fee = safeNumber(feeInput.value, 0);

  if (miles <= 0 || fee <= 0) return;

  // Route: Conwy → CB → Venue → CB → Conwy
  const totalMiles = (miles * 2) + (conwyCb * 2);
  const mileageCost = totalMiles * RATE;

  const [band, minFee] = bandFor(miles);

  const remaining = Math.max(0, fee - mileageCost);
  const split = remaining / 2;

  const rawYou = split + mileageCost;
  const rawHe = split;

  const roundedYou = roundTo10(rawYou);
  const roundedHe = roundTo10(rawHe);

  bandEl.textContent = band;
  minFeeEl.textContent = "£" + minFee;
  totalMilesEl.textContent = totalMiles.toFixed(1);
  mileageCostEl.textContent = "£" + mileageCost.toFixed(2);
  youGetEl.textContent = "£" + roundedYou;
  heGetsEl.textContent = "£" + roundedHe;

  if (fee < minFee) {
    warning.textContent = `Below minimum for ${band} (£${minFee})`;
    warning.classList.remove("hidden");
  } else {
    warning.textContent = "";
    warning.classList.add("hidden");
  }

  lastGig = {
    id: makeId(),
    createdAt: Date.now(),
    date: document.getElementById("date")?.value || "",
    town: (townInput?.value || "").trim(),
    milesCbToVenue: miles,
    conwyCb,
    fee,
    band,
    minFee,
    totalMiles,
    mileageCost,
    you: roundedYou,
    he: roundedHe
  };

  document.getElementById("saveGigBtn").disabled = false;
};

document.getElementById("saveTownBtn").onclick = () => {
  const town = (townInput.value || "").trim();
  const miles = safeNumber(milesInput.value, 0);
  if (!town || miles <= 0) return;

  const towns = loadTowns();
  towns[town] = miles;
  saveTowns(towns);
  renderTownList();
  alert("Town saved");
};

document.getElementById("saveGigBtn").onclick = () => {
  if (!lastGig) return;

  const hist = loadHistory();
  hist.push(lastGig);
  saveHistory(hist);
  renderHistory();
};

renderTownList();
renderHistory();
const RATE = 0.45;
const TOWNS_KEY = "townMiles_v1";
const HISTORY_KEY = "gigHistory_v1";

const townInput = document.getElementById("town");
const milesInput = document.getElementById("miles");
const conwyCbInput = document.getElementById("conwyCb");
const feeInput = document.getElementById("fee");
const warning = document.getElementById("warning");

const bandEl = document.getElementById("band");
const minFeeEl = document.getElementById("minFee");
const totalMilesEl = document.getElementById("totalMiles");
const mileageCostEl = document.getElementById("mileageCost");
const youGetEl = document.getElementById("youGet");
const heGetsEl = document.getElementById("heGets");

let lastGig = null;

/* ---------- helpers ---------- */
function roundTo10(n) {
  return Math.round(n / 10) * 10;
}

/* ---------- towns ---------- */
function loadTowns() {
  return JSON.parse(localStorage.getItem(TOWNS_KEY)) || {};
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
    if (towns[townInput.value] !== undefined) {
      milesInput.value = towns[townInput.value];
    }
  });
}

/* ---------- pricing rules ---------- */
function bandFor(milesCbToVenue) {
  if (milesCbToVenue <= 20) return ["Local", 250];
  if (milesCbToVenue <= 50) return ["Travel", 300];
  return ["Destination", 350];
}

/* ---------- calculate ---------- */
document.getElementById("calcBtn").onclick = () => {
  const miles = Number(milesInput.value);      // CB -> Venue (one way)
  const conwyCb = Number(conwyCbInput.value) || 12; // Conwy -> CB (one way)
  const fee = Number(feeInput.value);

  if (!miles || !fee) return;

  // Conwy -> CB -> Venue -> CB -> Conwy
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
    warning.classList.add("hidden");
  }

  lastGig = {
    date: document.getElementById("date")?.value || "",
    town: townInput?.value || "",
    miles,
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

/* ---------- save town ---------- */
document.getElementById("saveTownBtn").onclick = () => {
  const town = townInput.value.trim();
  const miles = Number(milesInput.value);
  if (!town || !miles) return;

  const towns = loadTowns();
  towns[town] = miles;
  saveTowns(towns);
  renderTownList();
  alert("Town saved");
};

/* ---------- history ---------- */
function loadHistory() {
  return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
}

function saveHistory(hist) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(hist));
}

function renderHistory() {
  const hist = loadHistory();
  const el = document.getElementById("history");
  if (!el) return;
  el.innerHTML = "";
  hist.forEach(g => {
    const d = document.createElement("div");
    d.textContent = `${g.date} ${g.town} – £${g.fee} (${g.band})`;
    el.appendChild(d);
  });
}

document.getElementById("saveGigBtn").onclick = () => {
  const hist = loadHistory();
  hist.push(lastGig);
  saveHistory(hist);
  renderHistory();
};

renderTownList();
renderHistory();

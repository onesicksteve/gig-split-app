const RATE = 0.45;
const TOWNS_KEY = "townMiles";
const HISTORY_KEY = "gigHistory";

let deferredPrompt = null;
let lastGig = null;

// Elements
const town = document.getElementById("town");
const milesInput = document.getElementById("miles");
const feeInput = document.getElementById("fee");

const bandEl = document.getElementById("band");
const minFeeEl = document.getElementById("minFee");
const totalMilesEl = document.getElementById("totalMiles");
const mileageCostEl = document.getElementById("mileageCost");
const youGetEl = document.getElementById("youGet");
const heGetsEl = document.getElementById("heGets");
const worthItEl = document.getElementById("worthIt");
const hourlyRateEl = document.getElementById("hourlyRate");
const warning = document.getElementById("warning");

const historyEl = document.getElementById("history");

// Helpers
const round10 = n => Math.round(n / 10) * 10;
const num = v => Number(v) || 0;

// Bands
function bandFor(m) {
  if (m <= 20) return ["Local", 250];
  if (m <= 50) return ["Travel", 300];
  return ["Destination", 350];
}

// Town memory
function loadTowns() {
  return JSON.parse(localStorage.getItem(TOWNS_KEY)) || {};
}
function saveTowns(t) {
  localStorage.setItem(TOWNS_KEY, JSON.stringify(t));
}

// History
function loadHistory() {
  return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
}
function saveHistory(h) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
}

// Calculate
document.getElementById("calcBtn").onclick = () => {
  const milesOneWay = num(milesInput.value);
  const fee = num(feeInput.value);
  if (!milesOneWay || !fee) return;

  const totalMiles = milesOneWay * 2;
  const mileageCost = totalMiles * RATE;

  const [band, minFee] = bandFor(milesOneWay);

  const remaining = Math.max(0, fee - mileageCost);
  const split = remaining / 2;

  let you = round10(split + mileageCost);
  let he = fee - you;

  const hours = (totalMiles / 40) + 3;
  const hourly = you / hours;

  bandEl.textContent = band;
  minFeeEl.textContent = "£" + minFee;
  totalMilesEl.textContent = totalMiles;
  mileageCostEl.textContent = "£" + mileageCost.toFixed(2);
  youGetEl.textContent = "£" + you;
  heGetsEl.textContent = "£" + he;
  hourlyRateEl.textContent = "£" + hourly.toFixed(2) + "/hr";

  worthItEl.textContent =
    hourly >= 25 ? "✅ Worth it" :
    hourly >= 18 ? "⚠ Marginal" :
    "❌ Not worth it";

  warning.classList.toggle("hidden", fee >= minFee);

  lastGig = {
    id: Date.now(),
    town: town.value,
    fee,
    totalMiles,
    mileageCost,
    you,
    he
  };

  document.getElementById("saveGigBtn").disabled = false;
  document.getElementById("shareBtn").disabled = false;
};

// Save town
document.getElementById("saveTownBtn").onclick = () => {
  const t = town.value.trim();
  const m = num(milesInput.value);
  if (!t || !m) return;
  const towns = loadTowns();
  towns[t] = m;
  saveTowns(towns);
  alert("Town saved");
};

// Save gig
document.getElementById("saveGigBtn").onclick = () => {
  if (!lastGig) return;
  const h = loadHistory();
  h.push(lastGig);
  saveHistory(h);
  renderHistory();
};

// Share
document.getElementById("shareBtn").onclick = () => {
  if (!lastGig) return;
  const text =
`${lastGig.town}
Fee £${lastGig.fee}
Miles ${lastGig.totalMiles}
You £${lastGig.you}
Steve £${lastGig.he}`;
  navigator.share
    ? navigator.share({ text })
    : navigator.clipboard.writeText(text);
};

// Render history
function renderHistory() {
  historyEl.innerHTML = "";
  loadHistory().forEach(g => {
    const d = document.createElement("div");
    d.textContent = `${g.town} – You £${g.you} / Steve £${g.he}`;
    historyEl.appendChild(d);
  });
}

renderHistory();
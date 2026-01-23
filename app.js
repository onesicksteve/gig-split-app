const RATE = 0.45;
const TOWNS_KEY = "townMiles_v1";
const HISTORY_KEY = "gigHistory_v1";

const townInput = document.getElementById("town");
const milesInput = document.getElementById("miles");
const feeInput = document.getElementById("fee");
const warning = document.getElementById("warning");

const bandEl = document.getElementById("band");
const minFeeEl = document.getElementById("minFee");
const totalMilesEl = document.getElementById("totalMiles");
const mileageCostEl = document.getElementById("mileageCost");
const youGetEl = document.getElementById("youGet");
const heGetsEl = document.getElementById("heGets");

let lastGig = null;

function loadTowns() {
  return JSON.parse(localStorage.getItem(TOWNS_KEY)) || {};
}
function saveTowns(towns) {
  localStorage.setItem(TOWNS_KEY, JSON.stringify(towns));
}
function renderTownList() {
  const dl = document.getElementById("townList");
  dl.innerHTML = "";
  const towns = loadTowns();
  Object.keys(towns).sort().forEach(t => {
    const o = document.createElement("option");
    o.value = t;
    dl.appendChild(o);
  });
}
townInput.addEventListener("change", () => {
  const towns = loadTowns();
  if (towns[townInput.value] !== undefined) {
    milesInput.value = towns[townInput.value];
  }
});

function bandFor(miles) {
  if (miles <= 20) return ["Local", 250];
  if (miles <= 50) return ["Travel", 300];
  return ["Destination", 350];
}

document.getElementById("calcBtn").onclick = () => {
  const miles = Number(milesInput.value);
  const fee = Number(feeInput.value);
  if (!miles || !fee) return;

  const totalMiles = miles * 2;
  const mileageCost = totalMiles * RATE;
  const [band, minFee] = bandFor(miles);

  const remaining = Math.max(0, fee - mileageCost);
  const split = remaining / 2;

  bandEl.textContent = band;
  minFeeEl.textContent = "£" + minFee;
  totalMilesEl.textContent = totalMiles;
  mileageCostEl.textContent = "£" + mileageCost.toFixed(2);
  const rawYou = split + mileageCost;
const roundedYou = Math.round(rawYou / 10) * 10;
const roundedHe = Math.round((fee - roundedYou) / 10) * 10;

youGetEl.textContent = "£" + roundedYou;
heGetsEl.textContent = "£" + roundedHe;


  warning.classList.toggle("hidden", fee >= minFee);
  warning.textContent = fee < minFee ? `Below minimum for ${band} (£${minFee})` : "";

  lastGig = {
    date: document.getElementById("date").value,
    town: townInput.value,
    miles,
    fee,
    band,
    minFee,
    you: split + mileageCost,
    he: split
  };

  document.getElementById("saveGigBtn").disabled = false;
};

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

function loadHistory() {
  return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
}
function saveHistory(hist) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(hist));
}
function renderHistory() {
  const hist = loadHistory();
  const el = document.getElementById("history");
  el.innerHTML = "";
  hist.forEach(g => {
    const d = document.createElement("div");
    d.textContent = `${g.date || ""} ${g.town} – £${g.fee} (${g.band})`;
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

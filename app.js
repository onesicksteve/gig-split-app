const $ = (id) => document.getElementById(id);

const STORAGE_KEY = "gig_split_history_v1";

const defaults = {
  conwyCbMiles: 12,
  rate: 0.45,
  extras: 0
};

let lastCalc = null;

function money(n){
  if (Number.isNaN(n) || n === null) return "—";
  return "£" + n.toFixed(2);
}
function num(n){
  if (Number.isNaN(n) || n === null) return "—";
  return (Math.round(n * 10) / 10).toString();
}

function bandFor(cbMilesOneWay){
  if (cbMilesOneWay <= 20) return "Local";
  if (cbMilesOneWay <= 50) return "Travel";
  return "Destination";
}
function minFeeFor(cbMilesOneWay){
  if (cbMilesOneWay <= 20) return 250;
  if (cbMilesOneWay <= 50) return 300;
  return 350;
}

function loadHistory(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  }catch{
    return [];
  }
}
function saveHistory(list){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function renderHistory(){
  const history = loadHistory().sort((a,b) => (b.createdAt||0) - (a.createdAt||0));
  const container = $("history");
  container.innerHTML = "";

  $("historyEmpty").style.display = history.length ? "none" : "block";

  for (const gig of history){
    const el = document.createElement("div");
    el.className = "item";

    const top = document.createElement("div");
    top.className = "item-top";

    const left = document.createElement("div");
    const title = document.createElement("h4");
    title.textContent = gig.venue || "(No venue)";
    const meta = document.createElement("div");
    meta.className = "meta";
    const dateTxt = gig.date ? gig.date : "No date";
    meta.textContent = `${dateTxt} • Fee ${money(gig.fee)} • Band ${gig.band} • Min ${money(gig.minFee)}`;

    left.appendChild(title);
    left.appendChild(meta);

    const right = document.createElement("div");
    right.className = "item-actions";

    const btnUse = document.createElement("button");
    btnUse.className = "btn small";
    btnUse.textContent = "Use";
    btnUse.onclick = () => fillFromGig(gig);

    const btnDel = document.createElement("button");
    btnDel.className = "btn btn-danger small";
    btnDel.textContent = "Delete";
    btnDel.onclick = () => deleteGig(gig.id);

    right.appendChild(btnUse);
    right.appendChild(btnDel);

    top.appendChild(left);
    top.appendChild(right);

    const bottom = document.createElement("div");
    bottom.className = "meta";
    bottom.textContent = `Miles ${num(gig.totalMiles)} • Mileage ${money(gig.mileageCost)} • You ${money(gig.youGet)} • He ${money(gig.heGets)}`;

    el.appendChild(top);
    el.appendChild(bottom);

    container.appendChild(el);
  }
}

function fillFromGig(gig){
  $("date").value = gig.date || "";
  $("venue").value = gig.venue || "";
  $("fee").value = gig.fee ?? "";
  $("cbMiles").value = gig.cbMilesOneWay ?? "";
  $("conwyCbMiles").value = gig.conwyCbMilesOneWay ?? defaults.conwyCbMiles;
  $("rate").value = gig.rate ?? defaults.rate;
  $("extras").value = gig.extras ?? defaults.extras;

  calculate();
  window.scrollTo({top: 0, behavior: "smooth"});
}

function deleteGig(id){
  const history = loadHistory();
  const next = history.filter(g => g.id !== id);
  saveHistory(next);
  renderHistory();
}

function getInputs(){
  const fee = Number($("fee").value);
  const venue = $("venue").value.trim();
  const date = $("date").value;

  const cbMilesOneWay = Number($("cbMiles").value);
  const conwyCbMilesOneWay = Number($("conwyCbMiles").value || defaults.conwyCbMiles);
  const rate = Number($("rate").value || defaults.rate);
  const extras = Number($("extras").value || defaults.extras);

  return { fee, venue, date, cbMilesOneWay, conwyCbMilesOneWay, rate, extras };
}

function validate(inputs){
  const errs = [];
  if (!Number.isFinite(inputs.fee) || inputs.fee < 0) errs.push("Enter a valid agreed fee.");
  if (!Number.isFinite(inputs.cbMilesOneWay) || inputs.cbMilesOneWay < 0) errs.push("Enter a valid Colwyn Bay → venue distance.");
  if (!Number.isFinite(inputs.conwyCbMilesOneWay) || inputs.conwyCbMilesOneWay < 0) errs.push("Enter a valid Conwy → Colwyn Bay distance.");
  if (!Number.isFinite(inputs.rate) || inputs.rate < 0) errs.push("Enter a valid mileage rate.");
  if (!Number.isFinite(inputs.extras) || inputs.extras < 0) errs.push("Enter valid extra costs (or 0).");
  return errs;
}

function calculate(){
  const inputs = getInputs();
  const errs = validate(inputs);

  $("btnSave").disabled = true;
  lastCalc = null;

  if (errs.length){
    showWarning(errs.join(" "));
    clearResults();
    return;
  }

  const totalMiles = 2 * inputs.cbMilesOneWay + 2 * inputs.conwyCbMilesOneWay;
  const mileageCost = totalMiles * inputs.rate;
  const band = bandFor(inputs.cbMilesOneWay);
  const minFee = minFeeFor(inputs.cbMilesOneWay);

  const remainingPot = Math.max(0, inputs.fee - mileageCost - inputs.extras);
  const eachShare = remainingPot / 2;
  const youGet = mileageCost + eachShare;
  const heGets = eachShare;

  if (inputs.fee < minFee){
    showWarning(`Heads up: fee (£${inputs.fee.toFixed(0)}) is below your minimum for this distance (${band}: £${minFee}).`);
  } else {
    hideWarning();
  }

  $("band").textContent = band;
  $("minFee").textContent = "£" + minFee.toFixed(0);
  $("totalMiles").textContent = num(totalMiles);
  $("mileageCost").textContent = money(mileageCost);
  $("remainingPot").textContent = money(remainingPot);
  $("youGet").textContent = money(youGet);
  $("heGets").textContent = money(heGets);

  lastCalc = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    ...inputs,
    totalMiles, mileageCost, band, minFee, remainingPot, eachShare, youGet, heGets
  };

  $("btnSave").disabled = false;
}

function clearResults(){
  $("band").textContent = "—";
  $("minFee").textContent = "—";
  $("totalMiles").textContent = "—";
  $("mileageCost").textContent = "—";
  $("remainingPot").textContent = "—";
  $("youGet").textContent = "—";
  $("heGets").textContent = "—";
}

function showWarning(msg){
  const w = $("warning");
  w.textContent = msg;
  w.classList.remove("hidden");
}
function hideWarning(){
  const w = $("warning");
  w.textContent = "";
  w.classList.add("hidden");
}

function saveCurrent(){
  if (!lastCalc) return;

  const history = loadHistory();
  history.push(lastCalc);
  saveHistory(history);
  renderHistory();

  showWarning("Saved ✔");
  setTimeout(() => {
    if (lastCalc && lastCalc.fee < lastCalc.minFee) return;
    hideWarning();
  }, 900);
}

function exportCSV(){
  const history = loadHistory().sort((a,b) => (a.createdAt||0) - (b.createdAt||0));
  if (!history.length){
    showWarning("No history to export.");
    return;
  }

  const cols = [
    "date","venue","fee","cbMilesOneWay","conwyCbMilesOneWay","rate","extras",
    "band","minFee","totalMiles","mileageCost","remainingPot","eachShare","youGet","heGets","createdAt"
  ];
  const lines = [cols.join(",")];

  for (const g of history){
    const row = cols.map(c => {
      const v = g[c];
      if (v === null || v === undefined) return "";
      const s = String(v).replaceAll('"','""');
      return `"${s}"`;
    }).join(",");
    lines.push(row);
  }

  const blob = new Blob([lines.join("\n")], {type:"text/csv"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "gig-history.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function clearHistory(){
  const ok = confirm("Clear all saved gig history on this phone?");
  if (!ok) return;
  localStorage.removeItem(STORAGE_KEY);
  renderHistory();
  showWarning("History cleared.");
  setTimeout(hideWarning, 900);
}

function init(){
  $("conwyCbMiles").value = defaults.conwyCbMiles;
  $("rate").value = defaults.rate;
  $("extras").value = defaults.extras;

  $("btnCalc").addEventListener("click", (e) => { e.preventDefault(); calculate(); });
  $("btnSave").addEventListener("click", (e) => { e.preventDefault(); saveCurrent(); });
  $("btnExport").addEventListener("click", exportCSV);
  $("btnClear").addEventListener("click", clearHistory);

  renderHistory();
  clearResults();
  hideWarning();
}

init();

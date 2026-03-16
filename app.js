import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, push, onValue, remove, update }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

/* ===== FIREBASE ===== */
const firebaseConfig = {
  apiKey: "AIzaSyAvz5vVadBCJ4k-BbPmUup4wxRT-E1ydsk",
  authDomain: "twosicksteves-7489a.firebaseapp.com",
  databaseURL: "https://twosicksteves-7489a-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "twosicksteves-7489a",
  storageBucket: "twosicksteves-7489a.firebasestorage.app",
  messagingSenderId: "657952916089",
  appId: "1:657952916089:web:968ac06abcc63b2654caa8"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);

/* ===== SYNC INDICATOR ===== */
function setSyncStatus(status) {
  const dot = document.getElementById("syncIndicator");
  if (!dot) return;
  dot.className = "sync-dot";
  if (status === "on")  dot.classList.add("sync-on");
  if (status === "off") dot.classList.add("sync-off");
  if (status === "err") dot.classList.add("sync-err");
}

/* ===== LOCAL SETTINGS ===== */
const SETTINGS_KEY = "gigSplitSettings_v1";
const TOWNS_KEY    = "townMiles_v2";
function loadSettings() { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch { return {}; } }
function saveSettings(s) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); }
function loadTowns() { try { return JSON.parse(localStorage.getItem(TOWNS_KEY)) || {}; } catch { return {}; } }
function saveTowns(t) { localStorage.setItem(TOWNS_KEY, JSON.stringify(t)); }

/* ===== HELPERS ===== */
function safeNum(v, fb = 0) { const n = Number(v); return Number.isFinite(n) ? n : fb; }
function roundTo10(n) { return Math.round(n / 10) * 10; }
function money(n) { return Number.isFinite(n) ? "£" + n.toFixed(2) : "—"; }
function makeId() { return `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function todayYMD() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function parseYMD(s) {
  if (!s) return null;
  const [y,m,d] = s.split("-").map(Number);
  if (!y||!m||!d) return null;
  return new Date(y, m-1, d, 12, 0, 0);
}
function formatDateNice(ymd) {
  if (!ymd) return "";
  const d = parseYMD(ymd);
  return d ? d.toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" }) : ymd;
}
function bandFor(miles) {
  if (miles <= 20) return ["Local", 250];
  if (miles <= 50) return ["Travel", 300];
  return ["Destination", 350];
}
function calcFuelCost(totalMiles, mpg, ppl) {
  if (!mpg || !ppl || mpg <= 0 || ppl <= 0) return null;
  return (totalMiles / mpg) * 4.54609 * (ppl / 100);
}
function worthItLabel(h) {
  if (h >= 25) return "✅ Worth it";
  if (h >= 18) return "⚠️ Marginal";
  return "❌ Not worth it";
}

/* ===== TOAST ===== */
let toastTimer = null;
function showToast(msg) {
  let t = document.getElementById("toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add("show");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2500);
}

/* ===== TOWN LIST ===== */
function renderTownList() {
  const dl = document.getElementById("townList");
  if (!dl) return;
  dl.innerHTML = "";
  Object.keys(loadTowns()).sort().forEach(name => {
    const o = document.createElement("option"); o.value = name; dl.appendChild(o);
  });
}

document.getElementById("town").addEventListener("change", () => {
  const rec = loadTowns()[document.getElementById("town").value.trim()];
  if (!rec) return;
  if (typeof rec === "number") { document.getElementById("miles").value = rec; }
  else {
    if (rec.miles) document.getElementById("miles").value = rec.miles;
    if (rec.notes) document.getElementById("notes").value = rec.notes;
  }
  updateFeeHint();
});

/* ===== FEE HINT ===== */
function updateFeeHint() {
  const fee = safeNum(document.getElementById("fee").value, 0);
  const miles = safeNum(document.getElementById("miles").value, 0);
  const feeEl = document.getElementById("fee");
  const hintEl = document.getElementById("feeHint");
  if (miles > 0 && fee > 0) {
    const [band, min] = bandFor(miles);
    if (fee < min) {
      feeEl.classList.add("input-warn");
      hintEl.textContent = `Below ${band} minimum (£${min})`;
      hintEl.classList.remove("hidden");
      return;
    }
  }
  feeEl.classList.remove("input-warn");
  hintEl.classList.add("hidden");
}
document.getElementById("fee").addEventListener("input", updateFeeHint);
document.getElementById("miles").addEventListener("input", updateFeeHint);

/* ===== FIREBASE DATA ===== */
let gigsData = {};
let myUnavail = {};
let steveUnavail = {};

// Listen to gigs
onValue(ref(db, "gigs"), snap => {
  gigsData = snap.val() || {};
  setSyncStatus("on");
  renderHistory();
  renderStats();
  renderCalendar();
}, err => { setSyncStatus("err"); console.error(err); });

// Listen to my unavailability
onValue(ref(db, "unavail/steve1"), snap => {
  myUnavail = snap.val() || {};
  renderCalendar();
});

// Listen to Steve's unavailability
onValue(ref(db, "unavail/steve2"), snap => {
  steveUnavail = snap.val() || {};
  renderCalendar();
  renderSteveUnavailList();
});

/* ===== AVAILABILITY CALENDAR ===== */
let calYear  = new Date().getFullYear();
let calMonth = new Date().getMonth();

function renderCalendar() {
  const container = document.getElementById("availCalendar");
  if (!container) return;

  const todayStr = todayYMD();
  const gigDates = new Set(Object.values(gigsData).map(g => g.date).filter(Boolean));

  // Header
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const firstDay = new Date(calYear, calMonth, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(calYear, calMonth+1, 0).getDate();
  const startOffset = (firstDay === 0 ? 6 : firstDay - 1); // Mon-first

  let html = `
    <div class="avail-month-header">
      <button class="avail-nav" id="calPrev">‹</button>
      <span class="avail-month-label">${monthNames[calMonth]} ${calYear}</span>
      <button class="avail-nav" id="calNext">›</button>
    </div>
    <div class="avail-grid">
      ${["M","T","W","T","F","S","S"].map(d => `<div class="avail-day-name">${d}</div>`).join("")}
  `;

  for (let i = 0; i < startOffset; i++) html += `<div class="avail-day empty"></div>`;

  for (let d = 1; d <= daysInMonth; d++) {
    const ymd = `${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const isPast  = ymd < todayStr;
    const isToday = ymd === todayStr;
    const meOff   = !!myUnavail[ymd];
    const steveOff= !!steveUnavail[ymd];
    const hasGig  = gigDates.has(ymd);

    let cls = "avail-day";
    if (isPast)           cls += " past";
    else if (isToday)     cls += " today";
    if (meOff && steveOff) cls += " both-off";
    else if (meOff)       cls += " me-off";
    else if (steveOff)    cls += " steve-off";
    if (hasGig)           cls += " has-gig";

    html += `<div class="${cls}" data-date="${ymd}">${d}</div>`;
  }

  html += `</div>
    <div class="avail-legend">
      <div class="legend-item"><div class="legend-dot legend-me"></div> You unavailable</div>
      <div class="legend-item"><div class="legend-dot legend-steve"></div> SWJ unavailable</div>
      <div class="legend-item"><div class="legend-dot legend-gig"></div> Gig booked</div>
    </div>`;

  container.innerHTML = html;

  document.getElementById("calPrev").onclick = () => {
    calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; }
    renderCalendar();
  };
  document.getElementById("calNext").onclick = () => {
    calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; }
    renderCalendar();
  };

  container.querySelectorAll(".avail-day[data-date]").forEach(el => {
    if (el.classList.contains("past")) return;
    el.addEventListener("click", () => toggleMyUnavail(el.dataset.date));
  });
}

async function toggleMyUnavail(ymd) {
  const r = ref(db, `unavail/steve1/${ymd}`);
  if (myUnavail[ymd]) {
    await remove(r);
    showToast("Available again: " + formatDateNice(ymd));
  } else {
    await set(r, true);
    showToast("Blocked: " + formatDateNice(ymd));
  }
}

function renderSteveUnavailList() {
  const el = document.getElementById("steveUnavail");
  if (!el) return;
  const dates = Object.keys(steveUnavail).filter(d => d >= todayYMD()).sort();
  if (!dates.length) { el.innerHTML = ""; return; }
  el.innerHTML = `<div class="unavail-title">SWJ unavailable</div>` +
    dates.map(d => `<div class="unavail-item">⚠ ${formatDateNice(d)}</div>`).join("");
}

/* ===== STATS ===== */
let activeTab = "month";

function computeStats(filter) {
  const now = new Date();
  let gigs = 0, miles = 0, you = 0, fuel = 0, hasFuel = false;
  Object.values(gigsData).forEach(g => {
    const d = parseYMD(g.date) || new Date(g.createdAt || 0);
    if (filter === "month" && (d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth())) return;
    if (filter === "year"  && d.getFullYear() !== now.getFullYear()) return;
    gigs++;
    miles += safeNum(g.totalMiles);
    you   += safeNum(g.you);
    if (g.fuelCost != null) { fuel += safeNum(g.fuelCost); hasFuel = true; }
  });
  return { gigs, miles: Math.round(miles), you: Math.round(you), fuel: hasFuel ? fuel : null };
}

function renderStats() {
  const s = computeStats(activeTab);
  document.getElementById("statGigs").textContent  = s.gigs;
  document.getElementById("statMiles").textContent = s.miles;
  document.getElementById("statYou").textContent   = "£" + s.you;
  document.getElementById("statFuel").textContent  = s.fuel != null ? "£" + s.fuel.toFixed(2) : "—";
}

document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    activeTab = btn.dataset.tab;
    renderStats();
  });
});

/* ===== HISTORY ===== */
function gigSummaryText(g) {
  const town = (g.town||"").trim() || "(no town)";
  const date = g.date ? formatDateNice(g.date) : "";
  const fuel = g.fuelCost != null ? `Fuel: £${g.fuelCost.toFixed(2)}\n` : "";
  return `🎸 ${date ? date+" — " : ""}${town}\nFee: £${Math.round(g.fee||0)}\nMiles: ${g.totalMiles!=null?g.totalMiles.toFixed(1):"—"} (return)\n${fuel}\n💰 You: £${Math.round(g.you||0)}\n💰 Steve: £${Math.round(g.he||0)}`.trim();
}

function openWhatsapp(g) {
  const settings = loadSettings();
  const text = encodeURIComponent(gigSummaryText(g));
  const num  = (settings.whatsapp || "").trim();
  window.open(num ? `https://wa.me/${num}?text=${text}` : `https://wa.me/?text=${text}`, "_blank");
}

function downloadIcs(g) {
  const town = (g.town||"TBC").trim();
  const date = g.date || todayYMD();
  const [y,m,d] = date.split("-");
  const dt = `${y}${m}${d}`;
  const ics = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//GigSplit//EN","BEGIN:VEVENT",
    `UID:${g.id||makeId()}@gigsplit`,`DTSTAMP:${dt}T120000Z`,
    `DTSTART;VALUE=DATE:${dt}`,`DTEND;VALUE=DATE:${dt}`,
    `SUMMARY:🎸 Gig – ${town}`,
    `DESCRIPTION:Fee: £${Math.round(g.fee||0)}\\nYou: £${Math.round(g.you||0)}\\nSteve: £${Math.round(g.he||0)}`,
    `LOCATION:${town}`,"END:VEVENT","END:VCALENDAR"].join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([ics], { type:"text/calendar" }));
  a.download = `gig-${town.replace(/\s+/g,"-").toLowerCase()}-${date}.ics`;
  document.body.appendChild(a); a.click(); a.remove();
}

async function shareText(text) {
  try { if (navigator.share) { await navigator.share({ text }); return; } } catch {}
  try { await navigator.clipboard.writeText(text); showToast("Copied to clipboard"); }
  catch { alert("Could not share."); }
}

function renderHistory() {
  const histEl = document.getElementById("history");
  if (!histEl) return;
  const gigs = Object.entries(gigsData).sort((a,b) => (b[1].createdAt||0)-(a[1].createdAt||0));

  if (!gigs.length) { histEl.innerHTML = '<div class="history-empty">No gigs saved yet.</div>'; return; }

  histEl.innerHTML = "";
  gigs.forEach(([fbKey, g]) => {
    const row = document.createElement("div"); row.className = "history-row";
    const left = document.createElement("div"); left.className = "history-left";

    const l1 = document.createElement("div"); l1.className = "history-line1";
    l1.textContent = `${g.date ? formatDateNice(g.date)+" — " : ""}${(g.town||"(no town)").trim()}`;

    const l2 = document.createElement("div"); l2.className = "history-line2";
    const tm = g.totalMiles != null ? ` • ${g.totalMiles.toFixed(1)}mi` : "";
    const fc = g.fuelCost   != null ? ` • fuel £${g.fuelCost.toFixed(2)}` : "";
    l2.textContent = `£${Math.round(g.fee||0)} • You £${Math.round(g.you||0)} • SWJ £${Math.round(g.he||0)}${tm}${fc}`;

    left.appendChild(l1); left.appendChild(l2);

    if (g.notes) {
      const ln = document.createElement("div"); ln.className = "history-notes"; ln.textContent = g.notes; left.appendChild(ln);
    }
    if (!g.paid) {
      const up = document.createElement("div"); up.className = "history-unpaid"; up.textContent = "⚠ UNPAID"; left.appendChild(up);
    }

    const actions = document.createElement("div"); actions.className = "history-actions";

    const waBtn = document.createElement("button"); waBtn.className = "small-btn small-btn-whatsapp"; waBtn.textContent = "WA"; waBtn.onclick = () => openWhatsapp(g);
    const icsBtn = document.createElement("button"); icsBtn.className = "small-btn"; icsBtn.textContent = "📅"; icsBtn.onclick = () => downloadIcs(g);

    const paidBtn = document.createElement("button");
    paidBtn.className = g.paid ? "small-btn small-btn-paid" : "small-btn small-btn-unpaid";
    paidBtn.textContent = g.paid ? "✓ Paid" : "Unpaid";
    paidBtn.onclick = () => update(ref(db, `gigs/${fbKey}`), { paid: !g.paid });

    const delBtn = document.createElement("button"); delBtn.className = "small-btn small-btn-danger"; delBtn.textContent = "Del";
    delBtn.onclick = () => { if (confirm(`Delete gig: ${(g.town||"").trim()}?`)) remove(ref(db, `gigs/${fbKey}`)); };

    [waBtn, icsBtn, paidBtn, delBtn].forEach(b => actions.appendChild(b));
    row.appendChild(left); row.appendChild(actions);
    histEl.appendChild(row);
  });
}

/* ===== CALCULATION ===== */
let lastGig = null;

function calcAndRender() {
  const milesOneWay = safeNum(document.getElementById("miles").value, 0);
  const fee         = safeNum(document.getElementById("fee").value, 0);
  if (milesOneWay <= 0 || fee <= 0) { showWarning("Enter a fee and miles first."); return; }

  const s          = loadSettings();
  const fuelCost   = calcFuelCost(milesOneWay * 2, safeNum(s.mpg), safeNum(s.fuelPrice));
  const driverCost = fuelCost !== null ? fuelCost : 0;
  const totalMiles = milesOneWay * 2;

  const remainder  = Math.max(0, fee - driverCost);
  let youCash      = roundTo10((remainder / 2) + driverCost);
  youCash          = Math.max(0, Math.min(fee, youCash));
  const heCash     = fee - youCash;

  const avgSpeed   = safeNum(s.avgSpeed, 40);
  const totalHours = (avgSpeed > 0 ? totalMiles/avgSpeed : 0) + safeNum(s.setupHours,1) + safeNum(s.playHours,2);
  const hourly     = totalHours > 0 ? youCash / totalHours : 0;
  const netYou     = fuelCost !== null ? youCash - fuelCost : null;
  const [band, minFee] = bandFor(milesOneWay);

  document.getElementById("totalMiles").textContent = totalMiles.toFixed(1) + " mi";
  const fuelRow = document.getElementById("fuelCostRow");
  if (fuelCost !== null) { document.getElementById("fuelCost").textContent = money(fuelCost); fuelRow.classList.remove("hidden"); }
  else fuelRow.classList.add("hidden");

  document.getElementById("youGet").textContent   = "£" + Math.round(youCash);
  document.getElementById("heGets").textContent   = "£" + Math.round(heCash);
  document.getElementById("youNet").textContent   = netYou !== null ? `(£${Math.round(netYou)} after fuel)` : "";
  document.getElementById("worthIt").textContent  = worthItLabel(hourly);
  document.getElementById("hourlyRate").textContent = "£" + hourly.toFixed(2) + "/hr";

  if (fee < minFee) showWarning(`⚠️ Below ${band} minimum (£${minFee})`);
  else if (fuelCost === null) showWarning("ℹ️ Set MPG and fuel price in Settings for fuel cost.");
  else hideWarning();

  document.getElementById("resultsBlock").classList.remove("hidden");

  lastGig = {
    id: makeId(), createdAt: Date.now(),
    date:  document.getElementById("date").value.trim(),
    town:  document.getElementById("town").value.trim(),
    notes: document.getElementById("notes").value.trim(),
    fee, milesOneWay, totalMiles, fuelCost, band, minFee,
    you: youCash, he: heCash, hourly, paid: false
  };

  ["saveGigBtn","whatsappBtn","icsBtn","shareBtn"].forEach(id => document.getElementById(id).disabled = false);
}

function showWarning(msg) { const w = document.getElementById("warning"); w.textContent = msg; w.classList.remove("hidden"); }
function hideWarning()    { const w = document.getElementById("warning"); w.textContent = ""; w.classList.add("hidden"); }
function clearResultsUI() {
  ["totalMiles","fuelCost","youGet","heGets","worthIt","hourlyRate"].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = "—"; });
  document.getElementById("youNet").textContent = "";
  document.getElementById("resultsBlock").classList.add("hidden");
}

/* ===== HANDLERS ===== */
document.getElementById("calcBtn").onclick = () => { hideWarning(); clearResultsUI(); calcAndRender(); };

document.getElementById("saveTownBtn").onclick = () => {
  const town = document.getElementById("town").value.trim();
  const miles = safeNum(document.getElementById("miles").value, 0);
  const notes = document.getElementById("notes").value.trim();
  if (!town || miles <= 0) { showToast("Enter a town and miles first."); return; }
  const towns = loadTowns(); towns[town] = { miles, notes }; saveTowns(towns); renderTownList();
  showToast(`"${town}" saved`);
};

document.getElementById("saveGigBtn").onclick = async () => {
  if (!lastGig) return;
  if (!lastGig.date) lastGig.date = todayYMD();
  try {
    await push(ref(db, "gigs"), lastGig);
    showToast("Gig saved & synced ✓");
    ["date","town","fee","miles","notes"].forEach(id => document.getElementById(id).value = "");
    document.getElementById("fee").classList.remove("input-warn");
    document.getElementById("feeHint").classList.add("hidden");
    lastGig = null;
    ["saveGigBtn","whatsappBtn","icsBtn","shareBtn"].forEach(id => document.getElementById(id).disabled = true);
    clearResultsUI(); hideWarning();
  } catch(e) { showToast("Sync error — check connection."); console.error(e); }
};

document.getElementById("whatsappBtn").onclick = () => { if (lastGig) openWhatsapp(lastGig); };
document.getElementById("icsBtn").onclick      = () => { if (lastGig) downloadIcs(lastGig); };
document.getElementById("shareBtn").onclick    = () => { if (lastGig) shareText(gigSummaryText(lastGig)); };

document.getElementById("exportCsvBtn").onclick = () => {
  const gigs = Object.entries(gigsData).sort((a,b) => (b[1].date||"").localeCompare(a[1].date||""));
  if (!gigs.length) { showToast("No history to export."); return; }
  const cols = ["date","town","fee","milesOneWay","totalMiles","fuelCost","band","minFee","you","he","hourly","paid"];
  const lines = [cols.join(","), ...gigs.map(g => cols.map(k => `"${(g[k]??"")}"`).join(","))];
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type:"text/csv" }));
  a.download = "gig-history.csv";
  document.body.appendChild(a); a.click(); a.remove();
};

document.getElementById("clearHistoryBtn").onclick = async () => {
  if (!confirm("Delete ALL gigs from the shared database? This affects both apps.")) return;
  await set(ref(db, "gigs"), null);
  showToast("History cleared.");
};

/* ===== SETTINGS ===== */
document.getElementById("settingsBtn").onclick = () => {
  const s = loadSettings();
  document.getElementById("settingMpg").value        = s.mpg        || "";
  document.getElementById("settingFuelPrice").value  = s.fuelPrice  || "";
  document.getElementById("settingWhatsapp").value   = s.whatsapp   || "";
  document.getElementById("settingAvgSpeed").value   = s.avgSpeed   || "40";
  document.getElementById("settingSetupHours").value = s.setupHours || "1";
  document.getElementById("settingPlayHours").value  = s.playHours  || "2";
  document.getElementById("settingsPanel").classList.remove("hidden");
};
document.getElementById("closeSettingsBtn").onclick = () => document.getElementById("settingsPanel").classList.add("hidden");
document.getElementById("saveSettingsBtn").onclick  = () => {
  saveSettings({
    mpg:        safeNum(document.getElementById("settingMpg").value)        || null,
    fuelPrice:  safeNum(document.getElementById("settingFuelPrice").value)  || null,
    whatsapp:   document.getElementById("settingWhatsapp").value.trim(),
    avgSpeed:   safeNum(document.getElementById("settingAvgSpeed").value, 40),
    setupHours: safeNum(document.getElementById("settingSetupHours").value, 1),
    playHours:  safeNum(document.getElementById("settingPlayHours").value, 2),
  });
  document.getElementById("settingsPanel").classList.add("hidden");
  showToast("Settings saved ✓");
};

/* ===== INIT ===== */
renderTownList();
renderCalendar();
setSyncStatus("off");

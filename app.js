import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, push, onValue, remove, update }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

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

/* ===== SYNC ===== */
function setSyncStatus(status) {
  const dot = document.getElementById("syncIndicator");
  if (!dot) return;
  dot.className = "sync-dot";
  if (status === "on")  dot.classList.add("sync-on");
  if (status === "off") dot.classList.add("sync-off");
  if (status === "err") dot.classList.add("sync-err");
}

/* ===== SETTINGS ===== */
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
function calcSplit(fee, milesOneWay) {
  const s          = loadSettings();
  const totalMiles = milesOneWay * 2;
  const fuelCost   = calcFuelCost(totalMiles, safeNum(s.mpg), safeNum(s.fuelPrice));
  const driverCost = fuelCost !== null ? fuelCost : 0;
  const remainder  = Math.max(0, fee - driverCost);
  let youCash      = roundTo10((remainder / 2) + driverCost);
  youCash          = Math.max(0, Math.min(fee, youCash));
  const heCash     = fee - youCash;
  const avgSpeed   = safeNum(s.avgSpeed, 40);
  const totalHours = (avgSpeed > 0 ? totalMiles/avgSpeed : 0) + safeNum(s.setupHours,1) + safeNum(s.playHours,2);
  const hourly     = totalHours > 0 ? youCash / totalHours : 0;
  return { totalMiles, fuelCost, you: youCash, he: heCash, hourly };
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
function autoSaveTown(town, miles, fee) {
  if (!town || miles <= 0) return;
  const towns = loadTowns();
  const existing = towns[town] || {};
  towns[town] = { miles, lastFee: fee || existing.lastFee || 0 };
  saveTowns(towns);
  renderTownList();
}

document.getElementById("town").addEventListener("change", () => {
  const rec = loadTowns()[document.getElementById("town").value.trim()];
  if (!rec) return;
  if (typeof rec === "number") { document.getElementById("miles").value = rec; }
  else { if (rec.miles) document.getElementById("miles").value = rec.miles; }
  updateFeeHint();
});

/* ===== FEE HINT ===== */
function updateFeeHint() {
  const fee   = safeNum(document.getElementById("fee").value, 0);
  const miles = safeNum(document.getElementById("miles").value, 0);
  const feeEl  = document.getElementById("fee");
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
let gigsData     = {};
let myUnavail    = {};
let steveUnavail = {};

onValue(ref(db, "gigs"), snap => {
  gigsData = snap.val() || {};
  setSyncStatus("on");
  renderHistory();
  renderCalendar();
}, err => { setSyncStatus("err"); console.error(err); });

onValue(ref(db, "unavail/steve1"), snap => {
  myUnavail = snap.val() || {};
  renderCalendar();
});

onValue(ref(db, "unavail/steve2"), snap => {
  steveUnavail = snap.val() || {};
  renderCalendar();
});

/* ===== AVAILABILITY CHECK ===== */
function checkAvailability(ymd) {
  if (!ymd) return { ok: false, msg: "Pick a date first." };
  const meOff    = !!myUnavail[ymd];
  const steveOff = !!steveUnavail[ymd];
  if (meOff && steveOff) return { ok: false, msg: "❌ Both of you are unavailable on this date." };
  if (meOff)             return { ok: false, msg: "❌ You are unavailable on this date." };
  if (steveOff)          return { ok: false, msg: "❌ SWJ is unavailable on this date." };
  return { ok: true, msg: "✅ Both free — good to go." };
}

/* ===== VENUES PANEL ===== */
let selectedVenue = null;

function renderVenuesList() {
  const towns  = loadTowns();
  const listEl = document.getElementById("venuesList");
  const keys   = Object.keys(towns).sort();

  if (!keys.length) {
    listEl.innerHTML = '<div class="history-empty">No saved venues yet.<br>Use the calculator and they\'ll appear here.</div>';
    return;
  }

  listEl.innerHTML = "";
  keys.forEach(name => {
    const rec    = towns[name];
    const miles  = typeof rec === "number" ? rec : rec.miles || 0;
    const lastFee= typeof rec === "object" ? (rec.lastFee || 0) : 0;
    const [band] = bandFor(miles);

    const card = document.createElement("div");
    card.className = "venue-card";
    card.innerHTML = `
      <div class="venue-card-name">${name}</div>
      <div class="venue-card-meta">${miles} mi one-way • ${band}${lastFee ? " • last fee £"+lastFee : ""}</div>
    `;
    card.onclick = () => openVenueDatePicker(name, miles, lastFee);
    listEl.appendChild(card);
  });
}

function openVenueDatePicker(name, miles, lastFee) {
  selectedVenue = { name, miles, lastFee };
  document.getElementById("venueDateName").textContent = name;
  document.getElementById("venueDateMeta").textContent = `${miles} mi one-way • ${miles*2} mi return`;
  document.getElementById("venueDate").value = "";
  document.getElementById("venueFee").value  = lastFee || "";
  document.getElementById("availCheck").classList.add("hidden");
  document.getElementById("availCheck").className = "avail-check hidden";
  document.getElementById("confirmVenueBtn").disabled = true;
  document.getElementById("venuesList").classList.add("hidden");
  document.getElementById("venueDatePicker").classList.remove("hidden");
}

document.getElementById("venueDate").addEventListener("change", () => {
  const ymd    = document.getElementById("venueDate").value;
  const check  = checkAvailability(ymd);
  const el     = document.getElementById("availCheck");
  el.textContent = check.msg;
  el.className = check.ok ? "avail-check avail-ok" : "avail-check avail-no";
  el.classList.remove("hidden");
  document.getElementById("confirmVenueBtn").disabled = !check.ok;
});

document.getElementById("cancelVenueBtn").onclick = () => {
  document.getElementById("venueDatePicker").classList.add("hidden");
  document.getElementById("venuesList").classList.remove("hidden");
  selectedVenue = null;
};

document.getElementById("confirmVenueBtn").onclick = async () => {
  if (!selectedVenue) return;
  const ymd  = document.getElementById("venueDate").value;
  const fee  = safeNum(document.getElementById("venueFee").value, selectedVenue.lastFee || 0);
  if (!ymd)  { showToast("Pick a date first."); return; }

  const check = checkAvailability(ymd);
  if (!check.ok) { showToast(check.msg); return; }

  const { totalMiles, fuelCost, you, he, hourly } = calcSplit(fee, selectedVenue.miles);
  const [band, minFee] = bandFor(selectedVenue.miles);

  const gig = {
    id: makeId(), createdAt: Date.now(),
    date: ymd, town: selectedVenue.name,
    fee, milesOneWay: selectedVenue.miles, totalMiles, fuelCost,
    band, minFee, you, he, hourly, paid: false
  };

  try {
    await push(ref(db, "gigs"), gig);
    autoSaveTown(selectedVenue.name, selectedVenue.miles, fee);
    showToast(`Gig booked: ${selectedVenue.name} on ${formatDateNice(ymd)} ✓`);
    document.getElementById("venuesPanel").classList.add("hidden");
    document.getElementById("venueDatePicker").classList.add("hidden");
    document.getElementById("venuesList").classList.remove("hidden");
    selectedVenue = null;
  } catch(e) { showToast("Save failed — check connection."); console.error(e); }
};

document.getElementById("venuesBtn").onclick = () => {
  renderVenuesList();
  document.getElementById("venueDatePicker").classList.add("hidden");
  document.getElementById("venuesList").classList.remove("hidden");
  document.getElementById("venuesPanel").classList.remove("hidden");
};
document.getElementById("closeVenuesBtn").onclick = () => {
  document.getElementById("venuesPanel").classList.add("hidden");
  selectedVenue = null;
};

/* ===== AVAILABILITY CALENDAR ===== */
let calYear  = new Date().getFullYear();
let calMonth = new Date().getMonth();

function renderCalendar() {
  const container = document.getElementById("availCalendar");
  if (!container) return;
  const todayStr    = todayYMD();
  const gigDates    = new Set(Object.values(gigsData).map(g => g.date).filter(Boolean));
  const monthNames  = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const firstDay    = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth+1, 0).getDate();
  const startOffset = (firstDay === 0 ? 6 : firstDay - 1);

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
    const ymd      = `${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const isPast   = ymd < todayStr;
    const isToday  = ymd === todayStr;
    const meOff    = !!myUnavail[ymd];
    const steveOff = !!steveUnavail[ymd];
    const hasGig   = gigDates.has(ymd);
    let cls = "avail-day";
    if (isPast)            cls += " past";
    else if (isToday)      cls += " today";
    if (meOff && steveOff) cls += " both-off";
    else if (meOff)        cls += " me-off";
    else if (steveOff)     cls += " steve-off";
    if (hasGig)            cls += " has-gig";
    html += `<div class="${cls}" data-date="${ymd}">${d}</div>`;
  }
  html += `</div>
    <div class="avail-legend">
      <div class="legend-item"><div class="legend-dot legend-me"></div> You unavailable</div>
      <div class="legend-item"><div class="legend-dot legend-steve"></div> SWJ unavailable</div>
      <div class="legend-item"><div class="legend-dot legend-gig"></div> Gig booked</div>
    </div>`;

  container.innerHTML = html;
  document.getElementById("calPrev").onclick = () => { calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; } renderCalendar(); };
  document.getElementById("calNext").onclick = () => { calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; } renderCalendar(); };
  container.querySelectorAll(".avail-day[data-date]").forEach(el => {
    if (el.classList.contains("past")) return;
    el.addEventListener("click", () => toggleMyUnavail(el.dataset.date));
  });
}

async function toggleMyUnavail(ymd) {
  const r = ref(db, `unavail/steve1/${ymd}`);
  if (myUnavail[ymd]) { await remove(r); showToast("Available again: " + formatDateNice(ymd)); }
  else { await set(r, true); showToast("Blocked: " + formatDateNice(ymd)); }
}

/* ===== GIG UTILS ===== */
function gigSummaryText(g) {
  const town = (g.town||"").trim() || "(no town)";
  const date = g.date ? formatDateNice(g.date) : "";
  const fuel = g.fuelCost != null ? `Fuel: £${g.fuelCost.toFixed(2)}\n` : "";
  return `🎸 ${date ? date+" — " : ""}${town}\nFee: £${Math.round(g.fee||0)}\nMiles: ${g.totalMiles!=null?g.totalMiles.toFixed(1):"—"} (return)\n${fuel}\n💰 You: £${Math.round(g.you||0)}\n💰 SWJ: £${Math.round(g.he||0)}`.trim();
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
    `DESCRIPTION:Fee: £${Math.round(g.fee||0)}\\nYou: £${Math.round(g.you||0)}\\nSWJ: £${Math.round(g.he||0)}`,
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
function exportGigCsv(g) {
  const cols  = ["date","town","fee","milesOneWay","totalMiles","fuelCost","you","he","paid"];
  const lines = [cols.join(","), cols.map(k => `"${(g[k]??"")}"`).join(",")];
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type:"text/csv" }));
  a.download = `${g.date||"gig"}-${(g.town||"gig").replace(/\s+/g,"-").toLowerCase()}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
}

/* ===== EDIT GIG ===== */
let editingFbKey = null;
function openEditPanel(fbKey, g) {
  editingFbKey = fbKey;
  document.getElementById("editDate").value  = g.date  || "";
  document.getElementById("editTown").value  = g.town  || "";
  document.getElementById("editFee").value   = g.fee   || "";
  document.getElementById("editMiles").value = g.milesOneWay || g.oneWayMiles || "";
  document.getElementById("editPanel").classList.remove("hidden");
}
document.getElementById("closeEditBtn").onclick = () => { document.getElementById("editPanel").classList.add("hidden"); editingFbKey = null; };
document.getElementById("saveEditBtn").onclick = async () => {
  if (!editingFbKey) return;
  const milesOneWay = safeNum(document.getElementById("editMiles").value, 0);
  const fee         = safeNum(document.getElementById("editFee").value, 0);
  const { totalMiles, fuelCost, you, he } = calcSplit(fee, milesOneWay);
  try {
    await update(ref(db, `gigs/${editingFbKey}`), {
      date: document.getElementById("editDate").value.trim(),
      town: document.getElementById("editTown").value.trim(),
      fee, milesOneWay, totalMiles, fuelCost, you, he
    });
    document.getElementById("editPanel").classList.add("hidden");
    editingFbKey = null;
    showToast("Gig updated ✓");
  } catch(e) { showToast("Update failed."); console.error(e); }
};

/* ===== HISTORY ===== */
function makeGigRow(fbKey, g) {
  const row  = document.createElement("div"); row.className = "history-row";
  const left = document.createElement("div"); left.className = "history-left";

  const dateEl = document.createElement("div"); dateEl.className = "history-date";
  dateEl.textContent = g.date ? formatDateNice(g.date) : "No date";

  const venueEl = document.createElement("div"); venueEl.className = "history-line1";
  venueEl.textContent = (g.town||"(no town)").trim();

  const l2 = document.createElement("div"); l2.className = "history-line2";
  const tm = g.totalMiles != null ? ` • ${g.totalMiles.toFixed(1)}mi` : "";
  const fc = g.fuelCost   != null ? ` • fuel £${g.fuelCost.toFixed(2)}` : "";
  l2.textContent = `£${Math.round(g.fee||0)} • You £${Math.round(g.you||0)} • SWJ £${Math.round(g.he||0)}${tm}${fc}`;

  left.appendChild(dateEl); left.appendChild(venueEl); left.appendChild(l2);

  if (!g.paid) {
    const up = document.createElement("div"); up.className = "history-unpaid"; up.textContent = "⚠ UNPAID"; left.appendChild(up);
  }

  const actions = document.createElement("div"); actions.className = "history-actions";

  const waBtn   = document.createElement("button"); waBtn.className = "small-btn small-btn-whatsapp"; waBtn.textContent = "WA"; waBtn.onclick = () => openWhatsapp(g);
  const icsBtn  = document.createElement("button"); icsBtn.className = "small-btn"; icsBtn.textContent = "📅"; icsBtn.onclick = () => downloadIcs(g);
  const paidBtn = document.createElement("button");
  paidBtn.className   = g.paid ? "small-btn small-btn-paid" : "small-btn small-btn-unpaid";
  paidBtn.textContent = g.paid ? "✓ Paid" : "Unpaid";
  paidBtn.onclick = () => update(ref(db, `gigs/${fbKey}`), { paid: !g.paid });
  const editBtn = document.createElement("button"); editBtn.className = "small-btn"; editBtn.textContent = "Edit"; editBtn.onclick = () => openEditPanel(fbKey, g);
  const csvBtn  = document.createElement("button"); csvBtn.className = "small-btn"; csvBtn.textContent = "CSV"; csvBtn.onclick = () => exportGigCsv(g);
  const delBtn  = document.createElement("button"); delBtn.className = "small-btn small-btn-danger"; delBtn.textContent = "Del";
  delBtn.onclick = () => { if (confirm(`Delete gig: ${(g.town||"").trim()}?`)) remove(ref(db, `gigs/${fbKey}`)); };

  [waBtn, icsBtn, paidBtn, editBtn, csvBtn, delBtn].forEach(b => actions.appendChild(b));
  row.appendChild(left); row.appendChild(actions);
  return row;
}

function renderHistory() {
  const histEl = document.getElementById("history");
  if (!histEl) return;
  const today = todayYMD();
  const all   = Object.entries(gigsData).sort((a,b) => (a[1].date||"").localeCompare(b[1].date||""));
  if (!all.length) { histEl.innerHTML = '<div class="history-empty">No gigs saved yet.</div>'; return; }

  const upcoming = all.filter(([,g]) => (g.date||"") >= today);
  const past     = all.filter(([,g]) => (g.date||"")  < today);

  histEl.innerHTML = "";
  if (upcoming.length) {
    upcoming.forEach(([fbKey, g]) => histEl.appendChild(makeGigRow(fbKey, g)));
  } else {
    const empty = document.createElement("div"); empty.className = "history-empty"; empty.textContent = "No upcoming gigs.";
    histEl.appendChild(empty);
  }

  if (past.length) {
    const byYear = {};
    past.forEach(([fbKey, g]) => {
      const year = (g.date||"").slice(0,4) || "Unknown";
      if (!byYear[year]) byYear[year] = [];
      byYear[year].push([fbKey, g]);
    });
    Object.keys(byYear).sort((a,b) => b-a).forEach(year => {
      const gigs   = byYear[year].sort((a,b) => (b[1].date||"").localeCompare(a[1].date||""));
      const folder = document.createElement("div"); folder.className = "year-folder";
      const header = document.createElement("div"); header.className = "year-folder-header";
      header.innerHTML = `<span class="year-folder-label">📁 ${year}</span><span class="year-folder-count">${gigs.length} gig${gigs.length!==1?"s":""}</span><span class="year-folder-chevron">▸</span>`;
      const body = document.createElement("div"); body.className = "year-folder-body hidden";
      gigs.forEach(([fbKey, g]) => body.appendChild(makeGigRow(fbKey, g)));
      header.onclick = () => {
        const isOpen = !body.classList.contains("hidden");
        body.classList.toggle("hidden");
        header.querySelector(".year-folder-chevron").textContent = isOpen ? "▸" : "▾";
      };
      folder.appendChild(header); folder.appendChild(body);
      histEl.appendChild(folder);
    });
  }
}

/* ===== CALCULATION ===== */
let lastGig = null;

function calcAndRender() {
  const milesOneWay = safeNum(document.getElementById("miles").value, 0);
  const fee         = safeNum(document.getElementById("fee").value, 0);
  if (milesOneWay <= 0 || fee <= 0) { showWarning("Enter a fee and miles first."); return; }

  const town = document.getElementById("town").value.trim();
  autoSaveTown(town, milesOneWay, fee);

  const { totalMiles, fuelCost, you: youCash, he: heCash, hourly } = calcSplit(fee, milesOneWay);
  const netYou = fuelCost !== null ? youCash - fuelCost : null;
  const [band, minFee] = bandFor(milesOneWay);

  document.getElementById("totalMiles").textContent = totalMiles.toFixed(1) + " mi";
  const fuelRow = document.getElementById("fuelCostRow");
  if (fuelCost !== null) { document.getElementById("fuelCost").textContent = money(fuelCost); fuelRow.classList.remove("hidden"); }
  else fuelRow.classList.add("hidden");

  document.getElementById("youGet").textContent     = "£" + Math.round(youCash);
  document.getElementById("heGets").textContent     = "£" + Math.round(heCash);
  document.getElementById("youNet").textContent     = netYou !== null ? `(£${Math.round(netYou)} after fuel)` : "";
  document.getElementById("worthIt").textContent    = worthItLabel(hourly);
  document.getElementById("hourlyRate").textContent = "£" + hourly.toFixed(2) + "/hr";

  if (fee < minFee) showWarning(`⚠️ Below ${band} minimum (£${minFee})`);
  else if (fuelCost === null) showWarning("ℹ️ Set MPG and fuel price in Settings for fuel cost.");
  else hideWarning();

  document.getElementById("resultsBlock").classList.remove("hidden");

  lastGig = {
    id: makeId(), createdAt: Date.now(),
    date: document.getElementById("date").value.trim(),
    town, fee, milesOneWay, totalMiles, fuelCost, band, minFee,
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

document.getElementById("saveGigBtn").onclick = async () => {
  if (!lastGig) return;
  if (!lastGig.date) lastGig.date = todayYMD();
  try {
    await push(ref(db, "gigs"), lastGig);
    showToast("Gig saved & synced ✓");
    ["date","town","fee","miles"].forEach(id => document.getElementById(id).value = "");
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

document.getElementById("shareGigsBtn").onclick = async () => {
  const today    = todayYMD();
  const upcoming = Object.values(gigsData)
    .filter(g => (g.date||"") >= today)
    .sort((a,b) => (a.date||"").localeCompare(b.date||""));
  if (!upcoming.length) { showToast("No upcoming gigs to share."); return; }
  const lines = ["🎸 Two Sick Steves Upcoming Gigs\n", ...upcoming.map(g => `${formatDateNice(g.date)} — ${(g.town||"").trim()}`)];
  await shareText(lines.join("\n"));
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
    mpg:        safeNum(document.getElementById("settingMpg").value)       || null,
    fuelPrice:  safeNum(document.getElementById("settingFuelPrice").value) || null,
    whatsapp:   document.getElementById("settingWhatsapp").value.trim(),
    avgSpeed:   safeNum(document.getElementById("settingAvgSpeed").value, 40),
    setupHours: safeNum(document.getElementById("settingSetupHours").value, 1),
    playHours:  safeNum(document.getElementById("settingPlayHours").value, 2),
  });
  document.getElementById("settingsPanel").classList.add("hidden");
  showToast("Settings saved ✓");
};

/* ===== INSTALL ===== */
let deferredPrompt = null;
window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault(); deferredPrompt = e;
  const btn = document.getElementById("installBtn");
  if (btn) btn.style.display = "inline-block";
});
document.getElementById("installBtn").onclick = async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  try { const c = await deferredPrompt.userChoice; if (c?.outcome === "accepted") document.getElementById("installBtn").style.display = "none"; } catch {}
  deferredPrompt = null;
};

/* ===== INIT ===== */
renderTownList();
renderCalendar();
setSyncStatus("off");

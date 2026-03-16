import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, onValue, remove }
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

/* ===== HELPERS ===== */
function safeNum(v, fb = 0) { const n = Number(v); return Number.isFinite(n) ? n : fb; }
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

/* ===== SYNC ===== */
function setSyncStatus(status) {
  const dot = document.getElementById("syncIndicator");
  if (!dot) return;
  dot.className = "sync-dot";
  if (status === "on")  dot.classList.add("sync-on");
  if (status === "off") dot.classList.add("sync-off");
  if (status === "err") dot.classList.add("sync-err");
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

/* ===== DATA ===== */
let gigsData     = {};
let myUnavail    = {};   // steve2
let steve1Unavail= {};   // steve1 (other Steve)

onValue(ref(db, "gigs"), snap => {
  gigsData = snap.val() || {};
  setSyncStatus("on");
  renderGigs();
  renderCalendar();
}, () => setSyncStatus("err"));

onValue(ref(db, "unavail/steve2"), snap => {
  myUnavail = snap.val() || {};
  renderCalendar();
});

onValue(ref(db, "unavail/steve1"), snap => {
  steve1Unavail = snap.val() || {};
  renderCalendar();
  renderSteve1UnavailList();
});

/* ===== GIGS RENDER ===== */
function downloadIcs(g) {
  const town = (g.town||"TBC").trim();
  const date = g.date || todayYMD();
  const [y,m,d] = date.split("-");
  const dt = `${y}${m}${d}`;
  const ics = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//GigSplit//EN","BEGIN:VEVENT",
    `UID:${g.id||Date.now()}@gigsplit`,`DTSTAMP:${dt}T120000Z`,
    `DTSTART;VALUE=DATE:${dt}`,`DTEND;VALUE=DATE:${dt}`,
    `SUMMARY:🎸 Gig – ${town}`,
    `DESCRIPTION:Your share: £${Math.round(g.he||0)}`,
    `LOCATION:${town}`,"END:VEVENT","END:VCALENDAR"].join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([ics], { type:"text/calendar" }));
  a.download = `gig-${town.replace(/\s+/g,"-").toLowerCase()}-${date}.ics`;
  document.body.appendChild(a); a.click(); a.remove();
}

function renderGigs() {
  const today = todayYMD();
  const all   = Object.values(gigsData).sort((a,b) => (a.date||"").localeCompare(b.date||""));
  const upcoming = all.filter(g => (g.date || "") >= today);
  const past     = all.filter(g => (g.date || "")  < today).reverse();

  function buildGigCard(g) {
    const card = document.createElement("div");
    card.className = "gig-card";

    const dateDiv  = document.createElement("div"); dateDiv.className = "gig-card-date";
    dateDiv.textContent = g.date ? formatDateNice(g.date) : "Date TBC";

    const venueDiv = document.createElement("div"); venueDiv.className = "gig-card-venue";
    venueDiv.textContent = (g.town||"").trim() || "(no venue)";

    const labelDiv = document.createElement("div"); labelDiv.className = "gig-card-share-label";
    labelDiv.textContent = "Your share";

    const shareDiv = document.createElement("div"); shareDiv.className = "gig-card-share";
    shareDiv.textContent = "£" + Math.round(g.he || 0);

    card.appendChild(dateDiv);
    card.appendChild(venueDiv);
    card.appendChild(labelDiv);
    card.appendChild(shareDiv);

    if (!g.paid) {
      const up = document.createElement("div"); up.className = "gig-card-unpaid"; up.textContent = "⚠ UNPAID";
      card.appendChild(up);
    }

    if (g.notes) {
      const n = document.createElement("div"); n.className = "history-notes"; n.style.marginTop = "6px"; n.textContent = g.notes;
      card.appendChild(n);
    }

    const actDiv = document.createElement("div"); actDiv.className = "gig-card-actions";
    const icsBtn = document.createElement("button"); icsBtn.className = "btn btn-ghost"; icsBtn.style.fontSize = "13px"; icsBtn.style.padding = "6px 10px";
    icsBtn.textContent = "↓ Add to calendar"; icsBtn.onclick = () => downloadIcs(g);
    actDiv.appendChild(icsBtn);
    card.appendChild(actDiv);

    return card;
  }

  const upcomingEl = document.getElementById("upcomingGigs");
  upcomingEl.innerHTML = "";
  if (!upcoming.length) { upcomingEl.innerHTML = '<div class="history-empty">No upcoming gigs.</div>'; }
  else upcoming.forEach(g => upcomingEl.appendChild(buildGigCard(g)));

  const pastEl = document.getElementById("pastGigs");
  pastEl.innerHTML = "";
  if (!past.length) { pastEl.innerHTML = '<div class="history-empty">No past gigs.</div>'; }
  else past.forEach(g => pastEl.appendChild(buildGigCard(g)));
}

/* ===== AVAILABILITY CALENDAR ===== */
let calYear  = new Date().getFullYear();
let calMonth = new Date().getMonth();

function renderCalendar() {
  const container = document.getElementById("availCalendar");
  if (!container) return;

  const todayStr = todayYMD();
  const gigDates = new Set(Object.values(gigsData).map(g => g.date).filter(Boolean));
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const firstDay   = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth= new Date(calYear, calMonth+1, 0).getDate();
  const startOffset= (firstDay === 0 ? 6 : firstDay - 1);

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
    const isPast   = ymd < todayStr;
    const isToday  = ymd === todayStr;
    const meOff    = !!myUnavail[ymd];
    const steveOff = !!steve1Unavail[ymd];
    const hasGig   = gigDates.has(ymd);

    let cls = "avail-day";
    if (isPast)              cls += " past";
    else if (isToday)        cls += " today";
    if (meOff && steveOff)   cls += " both-off";
    else if (meOff)          cls += " me-off";
    else if (steveOff)       cls += " steve-off";
    if (hasGig)              cls += " has-gig";

    html += `<div class="${cls}" data-date="${ymd}">${d}</div>`;
  }

  html += `</div>
    <div class="avail-legend">
      <div class="legend-item"><div class="legend-dot legend-me"></div> You unavailable</div>
      <div class="legend-item"><div class="legend-dot legend-steve"></div> Steve White unavailable</div>
      <div class="legend-item"><div class="legend-dot legend-gig"></div> Gig booked</div>
    </div>`;

  container.innerHTML = html;

  document.getElementById("calPrev").onclick = () => {
    calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; } renderCalendar();
  };
  document.getElementById("calNext").onclick = () => {
    calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; } renderCalendar();
  };

  container.querySelectorAll(".avail-day[data-date]").forEach(el => {
    if (el.classList.contains("past")) return;
    el.addEventListener("click", () => toggleMyUnavail(el.dataset.date));
  });
}

async function toggleMyUnavail(ymd) {
  const r = ref(db, `unavail/steve2/${ymd}`);
  if (myUnavail[ymd]) {
    await remove(r);
    showToast("Available again: " + formatDateNice(ymd));
  } else {
    await set(r, true);
    showToast("Blocked: " + formatDateNice(ymd));
  }
}

function renderSteve1UnavailList() {
  const el = document.getElementById("steveOneUnavail");
  if (!el) return;
  const dates = Object.keys(steve1Unavail).filter(d => d >= todayYMD()).sort();
  if (!dates.length) { el.innerHTML = ""; return; }
  el.innerHTML = `<div class="unavail-title">Steve White unavailable</div>` +
    dates.map(d => `<div class="unavail-item">⚠ ${formatDateNice(d)}</div>`).join("");
}

/* ===== INIT ===== */
setSyncStatus("off");
renderCalendar();

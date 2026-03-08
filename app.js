import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getDatabase, ref, onValue, query, limitToLast } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAT6VhvQggviNUxDhL8KQKcyCi_Q1S6gjU",
  authDomain: "capstone3-bc2c3.firebaseapp.com",
  databaseURL: "https://capstone3-bc2c3-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "capstone3-bc2c3",
  storageBucket: "capstone3-bc2c3.firebasestorage.app",
  messagingSenderId: "948536456584",
  appId: "1:948536456584:web:2e47332cbd2729b2c1363d"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

const statusEl = document.getElementById("status");
const lastEventTimeEl = document.getElementById("lastEventTime");
const logBody = document.getElementById("logBody");
const searchEl = document.getElementById("search");
const activeTagsBody = document.getElementById("activeTagsBody");

const ACTIVE_WINDOW_MS = 60 * 1000;

let eventsArr = []; // [{id, uidKey, name, status, inspector, inspectedAt}]
let latestByUid = {}; // { uidKey: latestRecord }

function fmtTime(ms) {
  if (!ms) return "-";
  return new Date(ms).toLocaleString();
}

function getRemainingMs(inspectedAt) {
  if (!inspectedAt) return 0;
  return Math.max(0, ACTIVE_WINDOW_MS - (Date.now() - inspectedAt));
}

function formatCountdown(ms) {
  const sec = Math.ceil(ms / 1000);
  const mm = String(Math.floor(sec / 60)).padStart(2, "0");
  const ss = String(sec % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function renderActiveTags() {
  const q = (searchEl.value || "").trim().toLowerCase();
  activeTagsBody.innerHTML = "";

  const rows = Object.values(latestByUid).sort((a, b) => (b.inspectedAt || 0) - (a.inspectedAt || 0));

  for (const r of rows) {
    const hay = `${r.uidKey || ""} ${r.name || ""} ${r.inspector || ""} ${r.status || ""}`.toLowerCase();
    if (q && !hay.includes(q)) continue;

    const remainingMs = getRemainingMs(r.inspectedAt);
    const state = remainingMs > 0 ? `ACTIVE (${formatCountdown(remainingMs)})` : "EXPIRED";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.uidKey || ""}</td>
      <td>${r.name || ""}</td>
      <td>${state}</td>
      <td>${fmtTime(r.inspectedAt)}</td>
      <td>${r.status || ""}</td>
      <td>${r.inspector || ""}</td>
    `;
    activeTagsBody.appendChild(tr);
  }
}

function renderLog() {
  const q = (searchEl.value || "").trim().toLowerCase();
  logBody.innerHTML = "";

  const rows = [...eventsArr].sort((a, b) => (b.inspectedAt || 0) - (a.inspectedAt || 0));

  for (const r of rows) {
    const hay = `${r.uidKey || ""} ${r.name || ""} ${r.inspector || ""} ${r.status || ""}`.toLowerCase();
    if (q && !hay.includes(q)) continue;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${fmtTime(r.inspectedAt)}</td>
      <td>${r.uidKey || ""}</td>
      <td>${r.name || ""}</td>
      <td>${r.status || ""}</td>
      <td>${r.inspector || ""}</td>
    `;
    logBody.appendChild(tr);
  }
}

function rebuildLatestByUid() {
  latestByUid = {};

  for (const e of eventsArr) {
    if (!e.uidKey) continue;

    if (!latestByUid[e.uidKey] || (e.inspectedAt || 0) > (latestByUid[e.uidKey].inspectedAt || 0)) {
      latestByUid[e.uidKey] = e;
    }
  }
}

searchEl.addEventListener("input", () => {
  renderActiveTags();
  renderLog();
});

async function start() {
  try {
    statusEl.textContent = "Signing in (anonymous)...";
    await signInAnonymously(auth);

    statusEl.textContent = "Connected. Listening to inspectionEvents...";
    const evRef = query(ref(db, "inspectionEvents"), limitToLast(500));

    onValue(evRef, (snap) => {
      const obj = snap.val() || {};

      eventsArr = Object.entries(obj).map(([id, rec]) => ({
        id,
        uidKey: rec?.uidKey || "",
        name: rec?.name || "",
        status: rec?.status || "",
        inspector: rec?.inspector || "",
        inspectedAt: rec?.inspectedAt || 0
      }));

      const latestEventMs = eventsArr.reduce((mx, e) => Math.max(mx, e.inspectedAt || 0), 0);
      lastEventTimeEl.textContent = fmtTime(latestEventMs);

      rebuildLatestByUid();
      renderActiveTags();
      renderLog();
    });

    setInterval(() => {
      renderActiveTags();
    }, 250);

  } catch (e) {
    console.error(e);
    statusEl.textContent = "Error: " + (e?.message || e);
  }
}

start();

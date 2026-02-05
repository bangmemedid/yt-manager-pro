/* =========================
    CONFIG (DIPERBAIKI)
========================= */
// Pastikan Client ID ini sama persis dengan yang ada di Google Cloud Console Anda
const CLIENT_ID = "262964938761-4e11cgkbud489toac5midmamoecb3jrq.apps.googleusercontent.com";
const API_KEY   = "AIzaSyDNT_iVn2c9kY3M6DQOcODBFNwAs-e_qA4";

const STORE_KEY = "ytmpro_accounts_merge_v1";
let tokenClient; // Untuk library GIS baru
let gapiInited = false;
let gisInited = false;

/* =========================
    DOM HELPERS
========================= */
const $ = (id) => document.getElementById(id);

function pickEl(...ids) {
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) return el;
  }
  return null;
}

function setStatus(msg) {
  const el = pickEl("statusText", "status", "statusLabel");
  if (el) el.textContent = "Status: " + msg;
  console.log("[STATUS]", msg);
}

function formatNumber(n) {
  if (n === null || n === undefined) return "0";
  const x = Number(n);
  return Number.isNaN(x) ? String(n) : x.toLocaleString("id-ID");
}

/* =========================
    STORAGE
========================= */
function loadAccounts() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
  } catch { return []; }
}
function saveAccounts(arr) {
  localStorage.setItem(STORE_KEY, JSON.stringify(arr));
}

/* =========================
    GOOGLE INIT (GIS + GAPI)
========================= */

// 1. Inisialisasi GAPI (untuk data YouTube)
async function initGapi() {
  return new Promise((resolve) => {
    gapi.load('client', async () => {
      await gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest"],
      });
      gapiInited = true;
      resolve();
    });
  });
}

// 2. Inisialisasi GIS (untuk Login/Auth)
function initGis() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: "https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly",
    callback: async (resp) => {
      if (resp.error) return;
      
      // Simpan token baru
      const accounts = loadAccounts();
      // Karena library baru tidak memberi email langsung di response token, 
      // kita set email sebagai "Account " + index atau ambil dari profil nanti
      const payload = { 
        email: "Google Account", 
        access_token: resp.access_token, 
        expires_at: Date.now() + (resp.expires_in * 1000), 
        added_at: Date.now() 
      };
      
      accounts.push(payload);
      saveAccounts(accounts);
      await refreshAllData();
    },
  });
  gisInited = true;
}

/* =========================
    FETCH DATA (YouTube API)
========================= */
async function fetchMyChannelUsingToken(access_token) {
  gapi.client.setToken({ access_token });
  const res = await gapi.client.youtube.channels.list({
    part: "snippet,statistics",
    mine: true
  });
  const item = res?.result?.items?.[0];
  if (!item) return null;

  return {
    title: item.snippet.title,
    thumb: item.snippet.thumbnails.default.url,
    subs: Number(item.statistics.subscriberCount),
    videos: Number(item.statistics.videoCount),
    views: Number(item.statistics.viewCount),
  };
}

/* =========================
    RENDER LOGIC
========================= */
function renderTable(rows) {
  const tbody = pickEl("channelBody");
  if (!tbody) return;

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty">Belum ada data.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>—</td>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <img src="${r.thumb}" style="width:34px;border-radius:50%" />
          <div><b>${r.title}</b></div>
        </div>
      </td>
      <td>${formatNumber(r.subs)}</td>
      <td>${formatNumber(r.videos)}</td>
      <td>${formatNumber(r.views)}</td>
      <td>—</td>
      <td><span class="badge-ok" style="color:#10b981">OK</span></td>
    </tr>
  `).join("");
}

async function refreshAllData() {
  const accounts = loadAccounts();
  if (accounts.length === 0) return renderTable([]);
  
  setStatus("Sync data...");
  const rows = [];
  for (const acc of accounts) {
    try {
      const data = await fetchMyChannelUsingToken(acc.access_token);
      if (data) rows.push(data);
    } catch (e) { console.error(e); }
  }
  renderTable(rows);
  setStatus("Selesai.");
}

/* =========================
    EVENTS & BOOT
========================= */
function bindUI() {
  const btnAdd = pickEl("btnAddGmail", "btnGoogleLogin");
  if (btnAdd) {
    btnAdd.onclick = () => {
      // Minta izin akses (Popup Google)
      tokenClient.requestAccessToken({ prompt: 'select_account' });
    };
  }

  const btnLogout = pickEl("btnOwnerLogout");
  if (btnLogout) {
    btnLogout.onclick = () => {
      localStorage.removeItem("owner_logged_in");
      window.location.href = "login.html";
    };
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  bindUI();
  await initGapi();
  initGis();
  await refreshAllData();
});

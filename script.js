/* =========================
    CONFIG (Sesuai Client ID Anda)
========================= */
const CLIENT_ID = "262964938761-4e41cgkbud489toac5midmamoecb3jrq.apps.googleusercontent.com";
const API_KEY   = "AIzaSyDNT_iVn2c9kY3M6DQOcODBFNwAs-e_qA4";

const STORE_KEY = "ytmpro_accounts_merge_v1";

let tokenClient; // Untuk library GIS Baru
let gapiInited = false;
let gisInited = false;

/* =========================
    DOM HELPERS
========================= */
const pickEl = (...ids) => {
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) return el;
  }
  return null;
};

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

// 1. Inisialisasi GAPI (YouTube Data API)
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

// 2. Inisialisasi GIS (Login/Auth)
function initGis() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: "https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly",
    callback: async (resp) => {
      if (resp.error) {
        setStatus("Login dibatalkan/error.");
        return;
      }
      
      // Simpan token baru ke storage
      const accounts = loadAccounts();
      const payload = { 
        email: "Account " + (accounts.length + 1), // GIS tidak memberi email langsung
        access_token: resp.access_token, 
        expires_at: Date.now() + (resp.expires_in * 1000), 
        added_at: Date.now() 
      };
      
      accounts.push(payload);
      saveAccounts(accounts);
      setStatus("Berhasil menambah akun!");
      await refreshAllData();
    },
  });
  gisInited = true;
}

/* =========================
    FETCH CHANNEL (YouTube Data API)
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
    RENDER TABLE + STATS
========================= */
function renderTable(rows) {
  const tbody = pickEl("channelBody");
  if (!tbody) return;

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty">Belum ada data. Klik <b>+ Tambah Gmail</b>.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>—</td>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <img src="${r.thumb}" style="width:34px;height:34px;border-radius:10px;border:1px solid rgba(255,255,255,.12)" />
          <div>
            <div style="font-weight:800">${r.title}</div>
          </div>
        </div>
      </td>
      <td>${formatNumber(r.subs)}</td>
      <td>${formatNumber(r.videos)}</td>
      <td>${formatNumber(r.views)}</td>
      <td style="opacity:.7">—</td>
      <td><span class="badge-ok" style="color:#10b981">OK</span></td>
    </tr>
  `).join("");
}

function renderStats(rows) {
  const elTotalChannel = pickEl("totalChannel");
  const elTotalSubs = pickEl("totalSubs");
  const elView48h = pickEl("view48h");

  if (elTotalChannel) elTotalChannel.textContent = formatNumber(rows.length);
  if (elTotalSubs) elTotalSubs.textContent = formatNumber(rows.reduce((a, b) => a + b.subs, 0));
  if (elView48h) elView48h.textContent = formatNumber(rows.reduce((a, b) => a + b.views, 0));
}

async function refreshAllData() {
  const accounts = loadAccounts();
  if (accounts.length === 0) {
    renderTable([]);
    return;
  }
  
  setStatus("Mengambil data...");
  const rows = [];
  for (const acc of accounts) {
    try {
      if (Date.now() > acc.expires_at) continue; // Skip expired
      const data = await fetchMyChannelUsingToken(acc.access_token);
      if (data) rows.push(data);
    } catch (e) { console.error(e); }
  }
  renderTable(rows);
  renderStats(rows);
  setStatus("Selesai.");
}

/* =========================
    EVENTS (TOMBOL)
========================= */
function bindUI() {
  const btnAdd = pickEl("btnAddGmail", "btnGoogleLogin");
  if (btnAdd) {
    btnAdd.onclick = () => {
      console.log("Membuka login Google...");
      if (gisInited) {
        tokenClient.requestAccessToken({ prompt: 'select_account' });
      } else {
        alert("Library Google belum siap, mohon refresh.");
      }
    };
  }

  const btnLogout = pickEl("btnOwnerLogout");
  if (btnLogout) {
    btnLogout.onclick = () => {
      localStorage.removeItem("owner_logged_in");
      window.location.href = "login.html";
    };
  }
  
  const btnLocalLogout = pickEl("btnLocalLogout");
  if (btnLocalLogout) {
    btnLocalLogout.onclick = () => {
      localStorage.removeItem(STORE_KEY);
      location.reload();
    };
  }
}

/* =========================
    BOOT
========================= */
document.addEventListener("DOMContentLoaded", async () => {
  bindUI();
  await initGapi();
  initGis();
  await refreshAllData();
});


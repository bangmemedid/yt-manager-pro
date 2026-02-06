/* YouTube Manager Pro - Core Engine
   Author: bangmemed.id | Version 2.0 (Premium)
*/

// =========================
// CONFIGURATION
// =========================
const CLIENT_ID = "262964938761-4e41cgkbud489toac5midmamoecb3jrq.apps.googleusercontent.com";
const API_KEY   = "AIzaSyDNT_iVn2c9kY3M6DQOcODBFNwAs-e_qA4";

const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/youtube.readonly"
].join(" ");

const STORE_KEY = "ytmpro_accounts_merge_v1";

// =========================
// SELECTORS & HELPERS
// =========================
const $ = (id) => document.getElementById(id);

function setStatus(msg, isOnline = false) {
  const el = $("statusText");
  const indicator = $("statusIndicator");
  if (el) el.textContent = msg;
  if (indicator) {
    if (isOnline) indicator.classList.add("status-online");
    else indicator.classList.remove("status-online");
  }
}

function formatNumber(n) {
  return Number(n || 0).toLocaleString("id-ID");
}

function loadAccounts() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || "[]"); }
  catch { return []; }
}

function saveAccounts(arr) {
  localStorage.setItem(STORE_KEY, JSON.stringify(arr));
}

// =========================
// GOOGLE API INITIALIZATION
// =========================
let gApiInited = false;
let tokenClient = null;

async function initGsiAndGapi() {
  setStatus("Menginisialisasi Google SDK...");
  
  // 1. Init GAPI Client
  await new Promise((resolve) => gapi.load("client", resolve));
  await gapi.client.init({
    apiKey: API_KEY,
    discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest"]
  });
  gApiInited = true;

  // 2. Init GIS Token Client
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: "", // Diisi nanti saat request
  });

  setStatus("Sistem Siap", true);
  refreshAllData(); // Otomatis muat data jika ada token tersimpan
}

// =========================
// AUTHENTICATION LOGIC
// =========================
async function googleSignIn() {
  if (!gApiInited) await initGsiAndGapi();

  return new Promise((resolve, reject) => {
    tokenClient.callback = async (resp) => {
      if (resp.error) return reject(resp);
      
      const email = await getUserEmail(resp.access_token);
      const payload = {
        email,
        access_token: resp.access_token,
        expires_at: Date.now() + (resp.expires_in * 1000)
      };

      let accounts = loadAccounts();
      const idx = accounts.findIndex(a => a.email === email);
      if (idx >= 0) accounts[idx] = payload;
      else accounts.push(payload);

      saveAccounts(accounts);
      resolve(payload);
    };
    tokenClient.requestAccessToken({ prompt: "select_account" });
  });
}

async function getUserEmail(token) {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  return data.email;
}

// =========================
// DATA FETCHING (YOUTUBE API)
// =========================
async function fetchAccountData(token) {
  try {
    gapi.client.setToken({ access_token: token });
    const res = await gapi.client.youtube.channels.list({
      part: "snippet,statistics",
      mine: true
    });
    return res.result.items || [];
  } catch (e) {
    console.error("Token expired or invalid", e);
    return [];
  }
}

async function refreshAllData() {
  const accounts = loadAccounts();
  if (accounts.length === 0) {
    setStatus("Belum ada akun terhubung", false);
    return;
  }

  setStatus("Sinkronisasi data...", true);
  let allChannels = [];
  
  for (const acc of accounts) {
    // Cek jika token expired (kurang dari 1 menit tersisa)
    if (Date.now() > acc.expires_at - 60000) continue;

    const data = await fetchAccountData(acc.access_token);
    allChannels = allChannels.concat(data);
  }

  renderDashboard(allChannels);
}

// =========================
// UI RENDERING
// =========================
function renderDashboard(channels) {
  const tbody = $("channelBody");
  const searchVal = $("searchInput").value.toLowerCase();
  
  // Reset Stats
  let totalSubs = 0, totalViews = 0, totalVideos = 0;
  tbody.innerHTML = "";

  const filtered = channels.filter(c => 
    c.snippet.title.toLowerCase().includes(searchVal)
  );

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty">Tidak ada channel ditemukan.</td></tr>`;
  }

  filtered.forEach(ch => {
    const s = ch.statistics;
    totalSubs += Number(s.subscriberCount);
    totalViews += Number(s.viewCount);
    
    tbody.innerHTML += `
      <tr>
        <td>
          <div style="display:flex; align-items:center; gap:10px;">
            <img src="${ch.snippet.thumbnails.default.url}" style="width:35px; border-radius:50%;">
            <b>${ch.snippet.title}</b>
          </div>
        </td>
        <td>${formatNumber(s.subscriberCount)}</td>
        <td>${formatNumber(s.videoCount)}</td>
        <td>${formatNumber(s.viewCount)}</td>
        <td><span class="badge-ok">ACTIVE</span></td>
      </tr>
    `;
  });

  // Update Global Stats
  $("totalChannel").textContent = filtered.length;
  $("totalSubs").textContent = formatNumber(totalSubs);
  $("totalViews").textContent = formatNumber(totalViews);
  $("connectionStatus").textContent = "Connected";
  $("lastUpdated").textContent = "Update: " + new Date().toLocaleTimeString();
  
  setStatus("Data Terkini", true);
}

// =========================
// EVENT LISTENERS (AKTIF SEMUA)
// =========================
document.addEventListener("DOMContentLoaded", () => {
  initGsiAndGapi();

  // Tombol Tambah Gmail
  [$("btnAddGmail"), $("btnAddGmailTop")].forEach(btn => {
    if(btn) btn.onclick = async () => {
      await googleSignIn();
      refreshAllData();
    };
  });

  // Tombol Refresh Manual
  if($("btnRefreshData")) {
    $("btnRefreshData").onclick = () => refreshAllData();
  }

  // Search Logic
  if($("searchInput")) {
    $("searchInput").oninput = () => refreshAllData();
  }

  // Logout Owner
  if($("btnOwnerLogout")) {
    $("btnOwnerLogout").onclick = () => {
      localStorage.removeItem("owner_logged_in");
      window.location.href = "login.html";
    };
  }

  // Logout Lokal (Hapus Data)
  if($("btnLocalLogout")) {
    $("btnLocalLogout").onclick = () => {
      if(confirm("Hapus semua data akun Gmail yang tersimpan?")) {
        localStorage.removeItem(STORE_KEY);
        refreshAllData();
        location.reload();
      }
    };
  }
});

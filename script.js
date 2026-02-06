/* =========================
   CONFIG & GLOBAL VARIABLES
========================= */
const CLIENT_ID = "262964938761-4e41cgkbud489toac5midmamoecb3jrq.apps.googleusercontent.com";
const API_KEY   = "AIzaSyDNT_iVn2c9kY3M6DQOcODBFNwAs-e_qA4";

const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly" // SCOPE UNTUK REALTIME
].join(" ");

const STORE_KEY = "ytmpro_accounts_merge_v1";
let gApiInited = false;
let tokenClient = null;
let allCachedChannels = []; 

/* =========================
   HELPERS (Gaya Penulisan Asli)
========================= */
const $ = (id) => document.getElementById(id);

function setStatus(msg, isOnline = false){
  const el = $("statusText");
  const dot = document.querySelector(".status-dot");
  if(el) el.textContent = "Status: " + msg;
  if(dot) dot.style.background = isOnline ? "#22d3ee" : "#ef4444";
}

function loadAccounts(){
  try{ return JSON.parse(localStorage.getItem(STORE_KEY) || "[]"); }
  catch{ return []; }
}

function saveAccounts(arr){
  localStorage.setItem(STORE_KEY, JSON.stringify(arr));
}

function formatNumber(n){
  const x = Number(n || 0);
  return x.toLocaleString("id-ID");
}

/* =========================
   GOOGLE INIT
========================= */
function initGapi(){
  return new Promise((resolve, reject) => {
    gapi.load("client", async () => {
      try{
        await gapi.client.init({
          apiKey: API_KEY,
          discoveryDocs: [
            "https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest",
            "https://youtubeanalytics.googleapis.com/$discovery/rest?version=v2"
          ]
        });
        gApiInited = true;

        if(!tokenClient){
          tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: () => {}
          });
        }
        resolve();
      }catch(e){ reject(e); }
    });
  });
}

/* =========================
   DATA FETCHING ENGINE
========================= */
async function getUserEmail(access_token){
  try{
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    const data = await res.json();
    return data?.email || "(unknown)";
  }catch{ return "(unknown)"; }
}

async function fetchAllChannelsData() {
  const accounts = loadAccounts();
  if(accounts.length === 0) {
    setStatus("Belum ada akun terhubung.", false);
    return;
  }

  setStatus("Menarik data YouTube & Analytics...", true);
  let mergedData = [];

  for (const acc of accounts) {
    if (Date.now() > acc.expires_at - 60000) continue;

    try {
      gapi.client.setToken({ access_token: acc.access_token });
      
      // 1. Ambil Data Channel Dasar
      const res = await gapi.client.youtube.channels.list({
        part: "snippet,statistics",
        mine: true,
        maxResults: 50
      });

      if(res.result.items) {
          // 2. Ambil Data Analytics Realtime untuk setiap channel
          for(let item of res.result.items) {
              const analytics = await fetchRealtimeStats(item.id);
              item.realtime = analytics; // Simpan data realtime ke objek channel
          }
          mergedData = mergedData.concat(res.result.items);
      }
    } catch (err) {
      console.error("Gagal tarik data: " + acc.email, err);
    }
  }

  allCachedChannels = mergedData;
  renderChannelTable(mergedData);
}

// Fungsi Baru untuk Analytics 60m & 48h
async function fetchRealtimeStats(channelId) {
    try {
        // Karena YouTube Analytics API biasanya delay beberapa jam/hari, 
        // kita ambil data aggregat hari ini dan kemarin sebagai estimasi 48 jam.
        const end = new Date().toISOString().split('T')[0];
        const start = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const res = await gapi.client.youtubeAnalytics.reports.query({
            ids: `channel==${channelId}`,
            startDate: start,
            endDate: end,
            metrics: "views",
            dimensions: "day"
        });

        const rows = res.result.rows || [];
        const total48h = rows.reduce((acc, row) => acc + row[1], 0);
        const est60m = Math.floor(total48h / 48); // Estimasi rata-rata per jam

        return { m60: est60m, h48: total48h };
    } catch (e) {
        return { m60: 0, h48: 0 };
    }
}

/* =========================
   UI RENDERING
========================= */
function renderChannelTable(data) {
  const tbody = $("channelBody");
  const search = $("searchInput").value.toLowerCase();
  tbody.innerHTML = "";

  let totalSubs = 0;
  let totalViews = 0;
  let totalReal48 = 0;

  const filtered = data.filter(item => 
    item.snippet.title.toLowerCase().includes(search)
  );

  if(filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty">Data tidak ditemukan.</td></tr>`;
  }

  filtered.forEach((item, index) => {
    const s = item.statistics;
    const r = item.realtime || { m60: 0, h48: 0 };
    totalSubs += Number(s.subscriberCount);
    totalViews += Number(s.viewCount);
    totalReal48 += r.h48;

    tbody.innerHTML += `
      <tr onclick="openDetail(${index})" style="cursor:pointer">
        <td>
          <div style="display:flex;align-items:center;gap:10px;">
            <img src="${item.snippet.thumbnails.default.url}" style="width:30px;border-radius:50%">
            <b>${item.snippet.title}</b>
          </div>
        </td>
        <td>${formatNumber(s.subscriberCount)}</td>
        <td>${formatNumber(s.viewCount)}</td>
        <td style="color:#22d3ee; font-weight:700;">${formatNumber(r.m60)}</td>
        <td style="color:#fbbf24; font-weight:700;">${formatNumber(r.h48)}</td>
        <td><span class="badge-ok">LIVE</span></td>
      </tr>
    `;
  });

  $("totalChannel").textContent = filtered.length;
  $("totalSubs").textContent = formatNumber(totalSubs);
  $("totalViews").textContent = formatNumber(totalViews);
  $("totalRealtime").textContent = formatNumber(totalReal48);
  $("lastUpdate").textContent = new Date().toLocaleTimeString();
  setStatus("Data Terkini", true);
}

/* =========================
   EXPORT & MODAL FEATURES
========================= */
function exportToExcel() {
  const table = document.querySelector(".channel-table");
  const wb = XLSX.utils.table_to_book(table, { sheet: "Dashboard_Report" });
  XLSX.writeFile(wb, `YT_Manager_Pro_${new Date().toLocaleDateString()}.xlsx`);
}

function openDetail(idx) {
  const ch = allCachedChannels[idx];
  const s = ch.statistics;
  const r = ch.realtime || { m60: 0, h48: 0 };
  $("modalBodyContent").innerHTML = `
    <div style="text-align:center;">
      <img src="${ch.snippet.thumbnails.medium.url}" style="width:110px; border-radius:50%; border:3px solid #22d3ee; margin-bottom:10px;">
      <h2 style="margin:0;">${ch.snippet.title}</h2>
      <p style="opacity:0.6; font-size:12px; margin-bottom:15px;">${ch.snippet.description.substring(0, 100)}...</p>
      
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:15px;">
        <div class="stat-card" style="padding:10px; background:rgba(255,255,255,0.05);">
            <small>60 Menit</small><br><b style="color:#22d3ee">${formatNumber(r.m60)}</b>
        </div>
        <div class="stat-card" style="padding:10px; background:rgba(255,255,255,0.05);">
            <small>48 Jam</small><br><b style="color:#fbbf24">${formatNumber(r.h48)}</b>
        </div>
      </div>
      
      <a href="https://youtube.com/channel/${ch.id}" target="_blank" class="btn primary" style="text-decoration:none; display:block;">Lihat Channel</a>
    </div>
  `;
  $("detailModal").style.display = "flex";
}

function closeModal() { $("detailModal").style.display = "none"; }

/* =========================
   LOGIN GOOGLE (GIS)
========================= */
async function googleSignInSelectAccount(){
  if(!gApiInited) await initGapi();
  const tokenResp = await new Promise((resolve, reject) => {
    tokenClient.callback = (resp) => { if(resp?.error) reject(resp); else resolve(resp); };
    tokenClient.requestAccessToken({ prompt: "consent select_account" });
  });

  const access_token = tokenResp.access_token;
  const expires_at = Date.now() + (Number(tokenResp.expires_in || 3600) * 1000);
  const email = await getUserEmail(access_token);

  let accounts = loadAccounts();
  const payload = { email, access_token, expires_at, added_at: Date.now() };
  const idx = accounts.findIndex(a => a.email === email);
  if(idx >= 0) accounts[idx] = payload; else accounts.push(payload);

  saveAccounts(accounts);
  await fetchAllChannelsData();
}

/* =========================
   DOM LOAD & EVENTS
========================= */
document.addEventListener("DOMContentLoaded", async () => {
  await initGapi();
  await fetchAllChannelsData();

  $("btnAddGmail").onclick = googleSignInSelectAccount;
  $("btnAddGmailTop").onclick = googleSignInSelectAccount;
  $("btnRefreshData").onclick = fetchAllChannelsData;
  $("btnExportData").onclick = exportToExcel;
  
  $("btnOwnerLogout").onclick = () => {
    localStorage.removeItem("owner_logged_in");
    window.location.href = "login.html";
  };
  
  $("btnLocalLogout").onclick = () => {
    if(confirm("Hapus semua data login?")) {
      localStorage.removeItem(STORE_KEY);
      location.reload();
    }
  };

  $("searchInput").oninput = () => renderChannelTable(allCachedChannels);
});

window.onclick = (e) => { if(e.target == $("detailModal")) closeModal(); };

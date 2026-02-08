/* =========================
    CONFIG & GLOBAL VARIABLES
========================= */
const CLIENT_ID = "262964938761-4e41cgkbud489toac5midmamoecb3jrq.apps.googleusercontent.com";
const REDIRECT_URI = "https://yt-manager-pro.vercel.app/api/auth";
const API_KEY   = "AIzaSyDNT_iVn2c9kY3M6DQOcODBFNwAs-e_qA4";
const SCOPES    = "openid email profile https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly https://www.googleapis.com/auth/youtube.upload";
const STORE_KEY = "ytmpro_accounts_merge_v1";

let gApiInited = false;
let tokenClient = null;
let allCachedChannels = [];

const $ = (id) => document.getElementById(id);

/* =========================
    HELPERS
========================= */
function setStatus(msg, isOnline = false){
  const el = $("statusText");
  const dot = document.querySelector(".status-dot");
  if(el) el.textContent = "Status: " + msg;
  if(dot) dot.style.background = isOnline ? "#22d3ee" : "#ef4444";
}

function loadAccounts(){
  try{ return JSON.parse(localStorage.getItem(STORE_KEY) || "[]"); }
  catch(e){ return []; }
}

function saveAccounts(arr){
  localStorage.setItem(STORE_KEY, JSON.stringify(arr));
}

function formatNumber(n){
  return Number(n || 0).toLocaleString("id-ID");
}

/* =========================
    GOOGLE INIT
========================= */
function initGapi(){
  return new Promise((resolve) => {
    gapi.load("client", async () => {
      await gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: [
            "https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest",
            "https://youtubeanalytics.googleapis.com/$discovery/rest?version=v2"
        ]
      });
      gApiInited = true;
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID, scope: SCOPES, callback: () => {}
      });
      resolve();
    });
  });
}

/* =========================
    ANALYTICS ENGINE
========================= */
async function fetchRealtimeStats(channelId) {
    try {
        const now = new Date();
        const start = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const end = now.toISOString().split('T')[0];

        let res = await gapi.client.youtubeAnalytics.reports.query({
            ids: `channel==${channelId}`,
            startDate: start, endDate: end,
            metrics: "views", dimensions: "hour", sort: "-hour"
        });

        let rows = res.result.rows || [];
        if (rows.length > 0) {
            const last24hRows = rows.slice(0, 24);
            const total24h = last24hRows.reduce((acc, row) => acc + row[1], 0);
            return { m60: Math.floor(total24h / 24), h48: total24h };
        } 
        
        res = await gapi.client.youtubeAnalytics.reports.query({
            ids: `channel==${channelId}`,
            startDate: start, endDate: end,
            metrics: "views"
        });
        
        let totalFallback = (res.result.rows && res.result.rows[0]) ? res.result.rows[0][0] : 0;
        return { m60: Math.floor(totalFallback / 72), h48: Math.floor(totalFallback / 3) };
    } catch (e) { 
        return { m60: 0, h48: 0 }; 
    }
}

/* =========================
    CORE DATA FETCHING (SYNC DATABASE)
========================= */
async function fetchAllChannelsData() {
  setStatus("Syncing with Database...", true);
  
  try {
    const response = await fetch('/api/get-stats');
    const dbAccounts = await response.json();

    if (dbAccounts.error) throw new Error(dbAccounts.error);

    // DISESUAIKAN DENGAN NAMA KOLOM 'gmail' DI SUPABASE ABANG
    const syncLocal = dbAccounts.map(acc => ({
        email: acc.gmail, 
        access_token: acc.access_token,
        expires_at: acc.expires_at
    }));
    saveAccounts(syncLocal);

    if(dbAccounts.length === 0) { 
        setStatus("Belum ada akun di Database.", false); 
        if($("channelBody")) $("channelBody").innerHTML = '<tr><td colspan="7" class="empty">Klik + Tambah Gmail untuk memulai</td></tr>';
        return; 
    }

    let mergedData = [];
    for (const acc of dbAccounts) {
        try {
          // GUNAKAN BENSIN TERBARU DARI DATABASE
          gapi.client.setToken({ access_token: acc.access_token });
          const res = await gapi.client.youtube.channels.list({ part: "snippet,statistics", mine: true });
          
          if(res.result.items) {
              for(let item of res.result.items) {
                  item.realtime = await fetchRealtimeStats(item.id);
                  item.isExpired = false;
                  item.emailSource = acc.gmail; 
                  mergedData.push(item);
              }
          }
        } catch (err) { console.error("GAPI Error for " + acc.gmail, err); }
    }
    
    allCachedChannels = mergedData;
    renderTable(mergedData);

  } catch (err) {
    console.error("Sync Error:", err);
    setStatus("Database Offline. Re-logging...", false);
    const localData = loadAccounts();
    if (localData.length > 0) renderTable(allCachedChannels);
  }
}

/* =========================
    UI RENDERING (FINAL CLOUD SYNC)
========================= */
function renderTable(data) {
  const tbody = $("channelBody");
  if (!tbody) return;
  const searchInput = $("searchInput");
  const search = searchInput ? searchInput.value.toLowerCase() : "";
  
  tbody.innerHTML = "";
  let tSubs = 0, tViews = 0, tReal = 0;

  // Filter berdasarkan nama channel dari database (item.name)
  const filtered = data.filter(i => (i.name || "").toLowerCase().includes(search));
  
  filtered.forEach((item, index) => {
    // Sesuaikan data dari Supabase agar bisa dibaca fungsi render
    const s = { 
        subscriberCount: item.subs || "0", 
        viewCount: item.views || "0" 
    };
    const r = item.realtime || { m60: 0, h48: 0 };
    const isExpired = false; // Akun dari DB selalu kita anggap aktif (auto-refresh)
    
    // Hitung Total Statistik
    tSubs += Number(s.subscriberCount); 
    tViews += Number(s.viewCount); 
    tReal += Number(r.h48 || 0);

    const statusBtn = `<button onclick="goToManager(${index})" style="background:rgba(34,211,238,0.1); color:#22d3ee; padding:6px 12px; border-radius:6px; font-size:10px; font-weight:bold; border:1px solid #22d3ee; cursor:pointer;">UPLOAD</button>`;

    tbody.innerHTML += `
      <tr>
        <td>
            <div style="display:flex;align-items:center;gap:10px;">
                <img src="${item.thumbnail || ''}" style="width:24px;border-radius:50%">
                <b>${item.name}</b>
            </div>
        </td>
        <td>${formatNumber(s.subscriberCount)}</td>
        <td>${formatNumber(s.viewCount)}</td>
        <td style="color:#22d3ee;font-weight:700">${formatNumber(r.m60)}</td>
        <td style="color:#fbbf24;font-weight:700">${formatNumber(r.h48)}</td>
        <td>${statusBtn}</td>
        <td style="text-align:center;">
            <button onclick="hapusChannelSatu('${item.gmail}')" style="background:transparent; border:none; color:#ef4444; cursor:pointer;">
                <i class="fas fa-trash-alt"></i>
            </button>
        </td>
      </tr>`;
  });

  if($("totalChannel")) $("totalChannel").textContent = filtered.length;
  if($("totalSubs")) $("totalSubs").textContent = formatNumber(tSubs);
  if($("totalViews")) $("totalViews").textContent = formatNumber(tViews);
  if($("totalRealtime")) $("totalRealtime").textContent = formatNumber(tReal);
  if($("lastUpdate")) $("lastUpdate").textContent = new Date().toLocaleTimeString() + " (Cloud Sync)";
  setStatus("Dashboard Aktif", true);
}

/* =========================
    FITUR GABUNGAN
========================= */
function hapusChannelSatu(email) {
    if (confirm("Hapus akun " + email + " dari database?")) {
        let accounts = loadAccounts();
        const updated = accounts.filter(acc => acc.email !== email);
        saveAccounts(updated);
        fetchAllChannelsData();
    }
}

function exportData() {
    const data = localStorage.getItem(STORE_KEY);
    if (!data) return;
    const tempInput = document.createElement("textarea");
    tempInput.value = data; document.body.appendChild(tempInput);
    tempInput.select(); document.execCommand('copy'); document.body.removeChild(tempInput);
    alert("KODE DATA BERHASIL DISALIN!");
}

function importData() {
    const code = prompt("Tempelkan Kode Data:");
    if (code) {
        try {
            const newData = JSON.parse(code);
            if (Array.isArray(newData)) {
                saveAccounts(newData);
                location.reload();
            }
        } catch (e) { alert("Gagal membaca kode."); }
    }
}

/* =========================
    AUTH & NAV
========================= */
async function googleSignIn(){
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + 
      `client_id=${CLIENT_ID}&` +
      `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent(SCOPES)}&` +
      `access_type=offline&` + 
      `prompt=consent`; 

  window.location.href = authUrl;
}

function goToManager(idx) {
    const ch = allCachedChannels[idx];
    if (!ch || ch.isExpired) return;
    const accounts = loadAccounts();
    const targetAcc = accounts.find(a => a.email === ch.emailSource) || accounts[0];
    const sessionData = { 
        channelId: ch.id, 
        title: ch.snippet.title, 
        img: ch.snippet.thumbnails.default.url, 
        token: targetAcc.access_token 
    };
    sessionStorage.setItem("active_manager_data", JSON.stringify(sessionData));
    window.open('manager.html', '_blank');
}

/* =========================
    INIT
========================= */
document.addEventListener("DOMContentLoaded", async () => {
  await initGapi();
  fetchAllChannelsData();
  if($("btnAddGmailTop")) $("btnAddGmailTop").onclick = googleSignIn;
  if($("btnRefreshData")) $("btnRefreshData").onclick = fetchAllChannelsData;
  if($("btnExportData")) $("btnExportData").onclick = exportData;
  if($("btnImportData")) $("btnImportData").onclick = importData;
  if($("btnOwnerLogout")) $("btnOwnerLogout").onclick = () => { window.location.href="login.html"; };
  if($("btnLocalLogout")) $("btnLocalLogout").onclick = () => { if(confirm("Hapus akun?")){ localStorage.removeItem(STORE_KEY); location.reload(); } };
  if($("searchInput")) $("searchInput").oninput = () => renderTable(allCachedChannels);
  
  // AUTO SYNC TIAP 5 MENIT AGAR TETAP ABADI
  setInterval(() => { fetchAllChannelsData(); }, 300000);
});


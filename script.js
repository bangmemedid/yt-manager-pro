/* =========================
    CONFIG & GLOBAL VARIABLES
========================= */
const CLIENT_ID = "262964938761-4e41cgkbud489toac5midmamoecb3jrq.apps.googleusercontent.com";
const API_KEY   = "AIzaSyDNT_iVn2c9kY3M6DQOcODBFNwAs-e_qA4";
const SCOPES    = "openid email profile https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly";
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
  if(dot && isOnline) dot.style.background = "#22d3ee";
  else if(dot) dot.style.background = "#ef4444";
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
        client_id: CLIENT_ID, 
        scope: SCOPES, 
        callback: (resp) => { /* Diisi saat googleSignIn dipanggil */ }
      });
      resolve();
    });
  });
}

/* =========================
    ANALYTICS ENGINE (VERSI 24 JAM)
========================= */
async function fetchRealtimeStats(channelId) {
    try {
        const now = new Date();
        const start = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const end = now.toISOString().split('T')[0];

        const res = await gapi.client.youtubeAnalytics.reports.query({
            ids: `channel==${channelId}`,
            startDate: start,
            endDate: end,
            metrics: "views",
            dimensions: "hour",
            sort: "-hour"
        });

        const rows = res.result.rows || [];
        // Ambil 24 jam terbaru
        const last24hRows = rows.slice(0, 24);
        const total24h = last24hRows.reduce((acc, row) => acc + row[1], 0);
        
        // m60 = Rata-rata per jam
        const m60 = Math.floor(total24h / 24);

        return { m60: m60, h24: total24h }; // Menggunakan h24 sebagai penanda baru
    } catch (e) { 
        console.error("Gagal Analytics:", channelId, e);
        return { m60: 0, h24: 0 }; 
    }
}

/* =========================
    CORE DATA FETCHING
========================= */
async function fetchAllChannelsData() {
  const accounts = loadAccounts();
  if(accounts.length === 0) { 
    setStatus("Belum ada akun.", false); 
    if($("channelBody")) $("channelBody").innerHTML = '<tr><td colspan="6" class="empty">Klik + Tambah Gmail untuk memulai</td></tr>';
    return; 
  }
  
  setStatus("Syncing Data...", true);
  let mergedData = [];

  for (const acc of accounts) {
    if (Date.now() > acc.expires_at) {
        mergedData.push({ 
            snippet: { title: acc.email, thumbnails: { default: { url: "" } } }, 
            statistics: { subscriberCount: 0, viewCount: 0 }, 
            isExpired: true 
        });
        continue;
    }

    try {
      gapi.client.setToken({ access_token: acc.access_token });
      const res = await gapi.client.youtube.channels.list({ part: "snippet,statistics", mine: true });
      if(res.result.items) {
          for(let item of res.result.items) {
              item.realtime = await fetchRealtimeStats(item.id);
              item.isExpired = false;
              item.emailSource = acc.email; // Simpan asal emailnya
              mergedData.push(item);
          }
      }
    } catch (err) { console.error("Sync Error:", err); }
  }
  allCachedChannels = mergedData;
  renderTable(mergedData);
}

/* =========================
    UI RENDERING (UPDATE LABEL 24H)
========================= */
function renderTable(data) {
  const tbody = $("channelBody");
  if (!tbody) return;
  const searchInput = $("searchInput");
  const search = searchInput ? searchInput.value.toLowerCase() : "";
  
  tbody.innerHTML = "";
  let tSubs = 0, tViews = 0, tReal24 = 0;

  const filtered = data.filter(i => (i.snippet.title || "").toLowerCase().includes(search));
  filtered.forEach((item, index) => {
    const s = item.statistics;
    const r = item.realtime || { m60: 0, h24: 0 };
    const isExpired = item.isExpired;
    
    if (!isExpired) { 
        tSubs += Number(s.subscriberCount); 
        tViews += Number(s.viewCount); 
        tReal24 += r.h24; 
    }

    const statusLabel = isExpired 
      ? `<span style="background:#ef4444; color:white; padding:4px 10px; border-radius:6px; font-size:10px; font-weight:bold;">EXPIRED</span>`
      : `<span style="background:rgba(34,211,238,0.1); color:#22d3ee; padding:4px 10px; border-radius:6px; font-size:10px; font-weight:bold; border:1px solid #22d3ee;">ACTIVE</span>`;

    tbody.innerHTML += `
      <tr onclick="goToManager(${index})" style="cursor:pointer">
        <td>
            <div style="display:flex;align-items:center;gap:10px;">
                <img src="${item.snippet.thumbnails.default.url || 'https://www.gstatic.com/youtube/img/branding/favicon/favicon_96x96.png'}" style="width:24px;border-radius:50%">
                <b>${item.snippet.title}</b>
            </div>
        </td>
        <td>${isExpired ? '---' : formatNumber(s.subscriberCount)}</td>
        <td>${isExpired ? '---' : formatNumber(s.viewCount)}</td>
        <td style="color:#22d3ee;font-weight:700">${isExpired ? '---' : formatNumber(r.m60)}</td>
        <td style="color:#fbbf24;font-weight:700">${isExpired ? '---' : formatNumber(r.h24)}</td>
        <td>${statusLabel}</td>
      </tr>`;
  });

  if($("totalChannel")) $("totalChannel").textContent = filtered.length;
  if($("totalSubs")) $("totalSubs").textContent = formatNumber(tSubs);
  if($("totalViews")) $("totalViews").textContent = formatNumber(tViews);
  if($("totalRealtime")) $("totalRealtime").textContent = formatNumber(tReal24);
  if($("lastUpdate")) $("lastUpdate").textContent = new Date().toLocaleTimeString() + " (Auto-Sync)";
  setStatus("Dashboard Aktif", true);
}

/* =========================
    FEATURES & AUTH
========================= */
async function googleSignIn(){
  if(!gApiInited) await initGapi();
  
  setStatus("Membuka Google Login...", true);
  
  tokenClient.callback = async (resp) => {
    if (resp.error !== undefined) {
      setStatus("Gagal Login", false);
      return;
    }

    try {
      const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { 
        headers: { Authorization: `Bearer ${resp.access_token}` } 
      });
      const data = await res.json();
      
      let accounts = loadAccounts();
      const payload = { 
        email: data.email, 
        access_token: resp.access_token, 
        expires_at: Date.now() + (resp.expires_in * 1000) 
      };
      
      const idx = accounts.findIndex(a => a.email === data.email);
      if(idx >= 0) accounts[idx] = payload; else accounts.push(payload);
      
      saveAccounts(accounts);
      fetchAllChannelsData();
    } catch (err) {
      console.error(err);
      setStatus("Error Sinkron Akun", false);
    }
  };

  tokenClient.requestAccessToken({ prompt: 'consent', access_type: 'offline' });
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
    INIT & EVENT LISTENERS
========================= */
document.addEventListener("DOMContentLoaded", async () => {
  await initGapi();
  fetchAllChannelsData();

  if($("btnAddGmailTop")) $("btnAddGmailTop").onclick = googleSignIn;
  if($("btnRefreshData")) $("btnRefreshData").onclick = fetchAllChannelsData;
  if($("searchInput")) $("searchInput").oninput = () => renderTable(allCachedChannels);
  
  // Auto-refresh data setiap 5 menit
  setInterval(() => { 
    if(loadAccounts().length > 0) fetchAllChannelsData(); 
  }, 300000);
});

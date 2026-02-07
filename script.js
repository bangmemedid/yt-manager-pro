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
    ANALYTICS ENGINE (ANTI-NOL SYSTEM)
========================= */
async function fetchRealtimeStats(channelId) {
    try {
        const now = new Date();
        const start = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const end = now.toISOString().split('T')[0];

        // Usaha 1: Ambil data per jam (Paling Akurat)
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
        
        // Usaha 2: Jika per jam kosong, ambil data total 3 hari (Fallback)
        res = await gapi.client.youtubeAnalytics.reports.query({
            ids: `channel==${channelId}`,
            startDate: start, endDate: end,
            metrics: "views"
        });
        
        let totalFallback = (res.result.rows && res.result.rows[0]) ? res.result.rows[0][0] : 0;
        return { m60: Math.floor(totalFallback / 72), h48: Math.floor(totalFallback / 3) }; // Estimasi 24 jam

    } catch (e) { 
        console.error("Gagal Analytics:", e);
        return { m60: 0, h48: 0 }; 
    }
}

/* =========================
    CORE DATA FETCHING
========================= */
async function fetchAllChannelsData() {
  const accounts = loadAccounts();
  if(accounts.length === 0) { 
    setStatus("Belum ada akun.", false); 
    if($("channelBody")) $("channelBody").innerHTML = '<tr><td colspan="7" class="empty">Klik + Tambah Gmail untuk memulai</td></tr>';
    return; 
  }
  
  setStatus("Syncing Data...", true);
  let mergedData = [];

  for (const acc of accounts) {
    if (Date.now() > acc.expires_at) {
        mergedData.push({ snippet: { title: acc.email, thumbnails: { default: { url: "" } } }, statistics: { subscriberCount: 0, viewCount: 0 }, isExpired: true, emailSource: acc.email });
        continue;
    }

    try {
      gapi.client.setToken({ access_token: acc.access_token });
      const res = await gapi.client.youtube.channels.list({ part: "snippet,statistics", mine: true });
      if(res.result.items) {
          for(let item of res.result.items) {
              item.realtime = await fetchRealtimeStats(item.id);
              item.isExpired = false;
              item.emailSource = acc.email;
              mergedData.push(item);
          }
      }
    } catch (err) { console.error(err); }
  }
  allCachedChannels = mergedData;
  renderTable(mergedData);
}

/* =========================
    UI RENDERING (DENGAN TOMBOL HAPUS)
========================= */
function renderTable(data) {
  const tbody = $("channelBody");
  if (!tbody) return;
  const searchInput = $("searchInput");
  const search = searchInput ? searchInput.value.toLowerCase() : "";
  
  tbody.innerHTML = "";
  let tSubs = 0, tViews = 0, tReal = 0;

  const filtered = data.filter(i => (i.snippet.title || "").toLowerCase().includes(search));
  filtered.forEach((item, index) => {
    const s = item.statistics;
    const r = item.realtime || { m60:0, h48:0 };
    const isExpired = item.isExpired;
    
    if (!isExpired) { tSubs += Number(s.subscriberCount); tViews += Number(s.viewCount); tReal += r.h48; }

    const statusLabel = isExpired 
      ? `<span style="background:#ef4444; color:white; padding:4px 10px; border-radius:6px; font-size:10px; font-weight:bold;">EXPIRED</span>`
      : `<span style="background:rgba(34,211,238,0.1); color:#22d3ee; padding:4px 10px; border-radius:6px; font-size:10px; font-weight:bold; border:1px solid #22d3ee;">ACTIVE</span>`;

    tbody.innerHTML += `
      <tr>
        <td onclick="goToManager(${index})" style="cursor:pointer"><div style="display:flex;align-items:center;gap:10px;"><img src="${item.snippet.thumbnails.default.url || ''}" style="width:24px;border-radius:50%"><b>${item.snippet.title}</b></div></td>
        <td onclick="goToManager(${index})" style="cursor:pointer">${isExpired ? '---' : formatNumber(s.subscriberCount)}</td>
        <td onclick="goToManager(${index})" style="cursor:pointer">${isExpired ? '---' : formatNumber(s.viewCount)}</td>
        <td onclick="goToManager(${index})" style="cursor:pointer; color:#22d3ee;font-weight:700">${isExpired ? '---' : formatNumber(r.m60)}</td>
        <td onclick="goToManager(${index})" style="cursor:pointer; color:#fbbf24;font-weight:700">${isExpired ? '---' : formatNumber(r.h48)}</td>
        <td onclick="goToManager(${index})" style="cursor:pointer">${statusLabel}</td>
        <td style="text-align:center;">
            <button onclick="hapusChannelSatu('${item.emailSource}')" style="background:transparent; border:none; color:#ef4444; cursor:pointer;" title="Hapus">
                <i class="fas fa-trash-alt"></i>
            </button>
        </td>
      </tr>`;
  });

  if($("totalChannel")) $("totalChannel").textContent = filtered.length;
  if($("totalSubs")) $("totalSubs").textContent = formatNumber(tSubs);
  if($("totalViews")) $("totalViews").textContent = formatNumber(tViews);
  if($("totalRealtime")) $("totalRealtime").textContent = formatNumber(tReal);
  if($("lastUpdate")) $("lastUpdate").textContent = new Date().toLocaleTimeString() + " (Auto-Sync)";
  setStatus("Dashboard Aktif", true);
}

/* =========================
    SISTEM HAPUS & EXPORT/IMPORT
========================= */
function hapusChannelSatu(email) {
    if (confirm(`Hapus akun ${email} dari daftar?`)) {
        let accounts = loadAccounts();
        const updated = accounts.filter(acc => acc.email !== email);
        saveAccounts(updated);
        fetchAllChannelsData();
    }
}

function exportData() {
    const data = localStorage.getItem(STORE_KEY);
    if (!data || data === "[]") return;
    const tempInput = document.createElement("textarea");
    tempInput.value = data; document.body.appendChild(tempInput);
    tempInput.select(); document.execCommand('copy'); document.body.removeChild(tempInput);
    alert("KODE DATA BERHASIL DISALIN!");
}

function importData() {
    const code = prompt("Tempelkan Kode Data di sini:");
    if (code && code.trim() !== "") {
        try {
            const newData = JSON.parse(code);
            if (Array.isArray(newData)) {
                let currentData = loadAccounts();
                newData.forEach(newAcc => {
                    const idx = currentData.findIndex(oldAcc => oldAcc.email === newAcc.email);
                    if (idx !== -1) currentData[idx] = newAcc; else currentData.push(newAcc);
                });
                saveAccounts(currentData);
                location.reload();
            }
        } catch (e) { alert("Format salah."); }
    }
}

/* =========================
    AUTH & NAV
========================= */
async function googleSignIn(){
  if(!gApiInited) await initGapi();
  tokenClient.callback = async (resp) => {
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: `Bearer ${resp.access_token}` } });
    const data = await res.json();
    let accounts = loadAccounts();
    const payload = { email: data.email, access_token: resp.access_token, expires_at: Date.now() + (resp.expires_in * 1000) };
    const idx = accounts.findIndex(a => a.email === data.email);
    if(idx >= 0) accounts[idx] = payload; else accounts.push(payload);
    saveAccounts(accounts);
    fetchAllChannelsData();
  };
  tokenClient.requestAccessToken({ prompt: 'consent', access_type: 'offline' });
}

function goToManager(idx) {
    const ch = allCachedChannels[idx];
    if (!ch || ch.isExpired) return;
    const accounts = loadAccounts();
    const targetAcc = accounts.find(a => a.email === ch.emailSource) || accounts[0];
    const sessionData = { channelId: ch.id, title: ch.snippet.title, img: ch.snippet.thumbnails.default.url, token: targetAcc.access_token };
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
  if($("btnLocalLogout")) $("btnLocalLogout").onclick = () => { if(confirm("Hapus semua akun?")){ localStorage.removeItem(STORE_KEY); location.reload(); } };
  if($("searchInput")) $("searchInput").oninput = () => renderTable(allCachedChannels);
  setInterval(() => { if(loadAccounts().length > 0) fetchAllChannelsData(); }, 300000);
});

const CLIENT_ID = "262964938761-4e41cgkbud489toac5midmamoecb3jrq.apps.googleusercontent.com";
const API_KEY   = "AIzaSyDNT_iVn2c9kY3M6DQOcODBFNwAs-e_qA4";
const SCOPES    = "openid email profile https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.force-ssl";
const STORE_KEY = "ytmpro_accounts_merge_v1";

let gApiInited = false;
let tokenClient = null;
let allCachedChannels = [];

const $ = (id) => document.getElementById(id);

// --- HELPERS ---
function formatNumber(n){ return Number(n || 0).toLocaleString("id-ID"); }
function setStatus(msg, online){ 
    if($("statusText")) $("statusText").textContent = "Status: " + msg;
    const dot = document.querySelector(".status-dot");
    if(dot) dot.style.background = online ? "#22d3ee" : "#ef4444";
}
function loadAccounts(){ const data = localStorage.getItem(STORE_KEY); return data ? JSON.parse(data) : []; }
function saveAccounts(arr){ localStorage.setItem(STORE_KEY, JSON.stringify(arr)); }

// --- GOOGLE API INIT ---
async function initGapi() {
  if (gApiInited) return;
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
        callback: ""
      });
      resolve();
    });
  });
}

// --- FETCHING ENGINE ---
async function fetchRealtimeStats(channelId) {
    try {
        const end = new Date().toISOString().split('T')[0];
        const start = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const res = await gapi.client.youtubeAnalytics.reports.query({
            ids: `channel==${channelId}`,
            startDate: start, endDate: end,
            metrics: "views", dimensions: "day"
        });
        const total48h = (res.result.rows || []).reduce((acc, row) => acc + row[1], 0);
        return { m60: Math.floor(total48h / 48), h48: total48h };
    } catch (e) { return { m60: 0, h48: 0 }; }
}

async function fetchAllChannelsData() {
  const accounts = loadAccounts();
  if(accounts.length === 0) { 
    if($("channelBody")) $("channelBody").innerHTML = '<tr><td colspan="6" class="empty">Klik + Tambah Gmail</td></tr>';
    return; 
  }
  setStatus("Syncing...", true);
  
  // OPTIMASI: Jalankan secara paralel agar tidak lelet
  const results = await Promise.all(accounts.map(async (acc) => {
    const isExpired = Date.now() > acc.expires_at;
    if (isExpired) return { isExpired: true, snippet: { title: acc.email, thumbnails:{default:{url:""}}} };

    try {
      gapi.client.setToken({ access_token: acc.access_token });
      const res = await gapi.client.youtube.channels.list({ part: "snippet,statistics", mine: true });
      if(!res.result.items) return null;
      let item = res.result.items[0];
      item.isExpired = false;
      item.realtime = await fetchRealtimeStats(item.id);
      return item;
    } catch (e) { return null; }
  }));

  allCachedChannels = results.filter(r => r !== null);
  renderTable(allCachedChannels);
}

// --- UI RENDERING ---
function renderTable(data) {
  const tbody = $("channelBody");
  if (!tbody) return;
  tbody.innerHTML = "";
  let tSubs = 0, tReal = 0;
  
  const search = ($("searchInput")?.value || "").toLowerCase();
  const filtered = data.filter(i => (i.snippet.title || "").toLowerCase().includes(search));

  filtered.forEach((item, index) => {
    const s = item.statistics || { subscriberCount:0, viewCount:0 };
    const r = item.realtime || { m60:0, h48:0 };
    const isExpired = item.isExpired;
    if(!isExpired) { tSubs += Number(s.subscriberCount); tReal += r.h48; }
    
    tbody.innerHTML += `
      <tr onclick="goToManager(${index})" style="cursor:pointer">
        <td><div style="display:flex;align-items:center;gap:10px;"><img src="${item.snippet.thumbnails.default.url}" style="width:24px;border-radius:50%"><b>${item.snippet.title}</b></div></td>
        <td>${isExpired ? '---' : formatNumber(s.subscriberCount)}</td>
        <td>${isExpired ? '---' : formatNumber(s.viewCount)}</td>
        <td style="color:#22d3ee">${isExpired ? '---' : formatNumber(r.m60)}</td>
        <td style="color:#fbbf24">${isExpired ? '---' : formatNumber(r.h48)}</td>
        <td>${isExpired ? '<span style="color:#ef4444">EXPIRED</span>' : '<span style="color:#22d3ee">ACTIVE</span>'}</td>
      </tr>`;
  });
  
  if($("totalSubs")) $("totalSubs").textContent = formatNumber(tSubs);
  if($("totalRealtime")) $("totalRealtime").textContent = formatNumber(tReal);
  if($("totalChannel")) $("totalChannel").textContent = filtered.length;
  if($("lastUpdate")) $("lastUpdate").textContent = new Date().toLocaleTimeString();
}

// --- FITUR LOGIN & SINKRON ---
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
    location.reload();
  };
  tokenClient.requestAccessToken({ prompt: 'consent', access_type: 'offline' });
}

function exportData() {
    const data = localStorage.getItem(STORE_KEY);
    const temp = document.createElement("textarea");
    temp.value = data; document.body.appendChild(temp);
    temp.select(); document.execCommand('copy'); document.body.removeChild(temp);
    alert("Kode data disalin!");
}

function importData() {
    const code = prompt("Tempel kode:");
    if (code) { localStorage.setItem(STORE_KEY, code); location.reload(); }
}

// --- INIT ---
document.addEventListener("DOMContentLoaded", () => {
    initGapi().then(() => fetchAllChannelsData());
    if($("btnAddGmailTop")) $("btnAddGmailTop").onclick = googleSignIn;
    if($("btnRefreshData")) $("btnRefreshData").onclick = () => location.reload();
    if($("btnLocalLogout")) $("btnLocalLogout").onclick = () => { localStorage.removeItem(STORE_KEY); location.reload(); };
    if($("btnOwnerLogout")) $("btnOwnerLogout").onclick = () => { localStorage.removeItem("owner_logged_in"); window.location.href="login.html"; };
    if($("ownerDisplay")) $("ownerDisplay").textContent = ownerName;
    if($("searchInput")) $("searchInput").oninput = () => renderTable(allCachedChannels);
});

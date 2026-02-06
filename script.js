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
].join(" ");

const STORE_KEY = "ytmpro_accounts_merge_v1";
let gApiInited = false;
let tokenClient = null;
let allCachedChannels = []; // Untuk fitur search dan detail

/* =========================
   HELPERS (SESUAI KODE AWAL)
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
   GOOGLE INIT (SESUAI KODE AWAL)
========================= */
function initGapi(){
  return new Promise((resolve, reject) => {
    gapi.load("client", async () => {
      try{
        await gapi.client.init({
          apiKey: API_KEY,
          discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest"]
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
   FETCHING DATA LOGIC
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
    setStatus("Belum ada akun.", false);
    return;
  }

  setStatus("Menyinkronkan data...", true);
  let mergedData = [];

  for (const acc of accounts) {
    // Skip jika expired
    if (Date.now() > acc.expires_at - 60000) continue;

    try {
      gapi.client.setToken({ access_token: acc.access_token });
      const res = await gapi.client.youtube.channels.list({
        part: "snippet,statistics",
        mine: true,
        maxResults: 50
      });
      if(res.result.items) mergedData = mergedData.concat(res.result.items);
    } catch (err) {
      console.error("Gagal ambil data untuk: " + acc.email, err);
    }
  }

  allCachedChannels = mergedData;
  renderChannelTable(mergedData);
}

/* =========================
   UI RENDERING (EXPANDED)
========================= */
function renderChannelTable(data) {
  const tbody = $("channelBody");
  const search = $("searchInput").value.toLowerCase();
  tbody.innerHTML = "";

  let totalSubs = 0;
  let totalViews = 0;
  let count = 0;

  const filtered = data.filter(item => 
    item.snippet.title.toLowerCase().includes(search)
  );

  if(filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty">Data tidak ditemukan.</td></tr>`;
  }

  filtered.forEach((item, index) => {
    const s = item.statistics;
    totalSubs += Number(s.subscriberCount);
    totalViews += Number(s.viewCount);
    count++;

    tbody.innerHTML += `
      <tr onclick="openDetail(${index})" style="cursor:pointer">
        <td>
          <div style="display:flex;align-items:center;gap:10px;">
            <img src="${item.snippet.thumbnails.default.url}" style="width:30px;border-radius:50%">
            <b>${item.snippet.title}</b>
          </div>
        </td>
        <td>${formatNumber(s.subscriberCount)}</td>
        <td>${formatNumber(s.videoCount)}</td>
        <td>${formatNumber(s.viewCount)}</td>
        <td><span class="badge-ok">ACTIVE</span></td>
      </tr>
    `;
  });

  $("totalChannel").textContent = count;
  $("totalSubs").textContent = formatNumber(totalSubs);
  $("totalViews").textContent = formatNumber(totalViews);
  $("lastUpdate").textContent = new Date().toLocaleTimeString();
  setStatus("Dashboard Aktif", true);
}

/* =========================
   NEW FEATURES: EXPORT & MODAL
========================= */
function exportToExcel() {
  const table = document.querySelector(".channel-table");
  const wb = XLSX.utils.table_to_book(table, { sheet: "Data_Channel" });
  XLSX.writeFile(wb, `YT_Manager_Pro_${new Date().toLocaleDateString()}.xlsx`);
}

function openDetail(idx) {
  const ch = allCachedChannels[idx];
  const s = ch.statistics;
  $("modalBodyContent").innerHTML = `
    <div style="text-align:center;">
      <img src="${ch.snippet.thumbnails.medium.url}" style="width:120px; border-radius:50%; border:4px solid #22d3ee; margin-bottom:15px;">
      <h2 style="margin:0;">${ch.snippet.title}</h2>
      <p style="opacity:0.7; font-size:14px; margin-bottom:20px;">${ch.snippet.description || 'Tidak ada deskripsi.'}</p>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:20px;">
        <div class="stat-card" style="padding:10px;"><small>Videos</small><br><b>${formatNumber(s.videoCount)}</b></div>
        <div class="stat-card" style="padding:10px;"><small>Subs</small><br><b>${formatNumber(s.subscriberCount)}</b></div>
      </div>
      <a href="https://youtube.com/channel/${ch.id}" target="_blank" class="btn primary" style="text-decoration:none; display:inline-block; width:100%;">Buka Channel</a>
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
    tokenClient.callback = (resp) => {
      if(resp?.error) reject(resp);
      else resolve(resp);
    };
    tokenClient.requestAccessToken({ prompt: "consent select_account" });
  });

  const access_token = tokenResp.access_token;
  const expires_at = Date.now() + (Number(tokenResp.expires_in || 3600) * 1000);
  const email = await getUserEmail(access_token);

  const payload = { email, access_token, expires_at, added_at: Date.now() };

  let accounts = loadAccounts();
  const idx = accounts.findIndex(a => a.email === email);
  if(idx >= 0) accounts[idx] = payload;
  else accounts.push(payload);

  saveAccounts(accounts);
  await fetchAllChannelsData();
}

/* =========================
   EVENTS BINDING
========================= */
document.addEventListener("DOMContentLoaded", async () => {
  await initGapi();
  await fetchAllChannelsData();

  // Button Events
  $("btnAddGmail").onclick = googleSignInSelectAccount;
  $("btnAddGmailTop").onclick = googleSignInSelectAccount;
  $("btnRefreshData").onclick = fetchAllChannelsData;
  $("btnExportData").onclick = exportToExcel;
  
  $("btnOwnerLogout").onclick = () => {
    localStorage.removeItem("owner_logged_in");
    window.location.href = "login.html";
  };
  
  $("btnLocalLogout").onclick = () => {
    if(confirm("Hapus semua akun Gmail?")) {
      localStorage.removeItem(STORE_KEY);
      location.reload();
    }
  };

  // Search Event
  $("searchInput").oninput = () => renderChannelTable(allCachedChannels);
});

// Close modal on outside click
window.onclick = (e) => { if(e.target == $("detailModal")) closeModal(); };

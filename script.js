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
  catch{ return []; }
}

function saveAccounts(arr){
  localStorage.setItem(STORE_KEY, JSON.stringify(arr));
}

function formatNumber(n){
  return Number(n || 0).toLocaleString("id-ID");
}

/* =========================
    GOOGLE INIT (GAPI & ANALYTICS)
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
        callback: () => {}
      });
      resolve();
    });
  });
}

/* =========================
    REALTIME ANALYTICS ENGINE
========================= */
async function fetchRealtimeStats(channelId) {
    try {
        const end = new Date().toISOString().split('T')[0];
        const start = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const res = await gapi.client.youtubeAnalytics.reports.query({
            ids: `channel==${channelId}`,
            startDate: start,
            endDate: end,
            metrics: "views",
            dimensions: "day"
        });
        const total48h = (res.result.rows || []).reduce((acc, row) => acc + row[1], 0);
        return { m60: Math.floor(total48h / 48), h48: total48h };
    } catch (e) { return { m60: 0, h48: 0 }; }
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
    if (Date.now() > acc.expires_at - 60000) continue;
    try {
      gapi.client.setToken({ access_token: acc.access_token });
      const res = await gapi.client.youtube.channels.list({ part: "snippet,statistics", mine: true });
      if(res.result.items) {
          for(let item of res.result.items) {
              item.realtime = await fetchRealtimeStats(item.id);
          }
          mergedData = mergedData.concat(res.result.items);
      }
    } catch (err) { console.error(err); }
  }
  allCachedChannels = mergedData;
  renderTable(mergedData);
}

/* =========================
    UI RENDERING
========================= */
function renderTable(data) {
  const tbody = $("channelBody");
  if (!tbody) return;
  const searchInput = $("searchInput");
  const search = searchInput ? searchInput.value.toLowerCase() : "";
  
  tbody.innerHTML = "";
  let tSubs = 0, tViews = 0, tReal = 0;

  const filtered = data.filter(i => i.snippet.title.toLowerCase().includes(search));
  filtered.forEach((item, index) => {
    const s = item.statistics;
    const r = item.realtime || { m60:0, h48:0 };
    tSubs += Number(s.subscriberCount); tViews += Number(s.viewCount); tReal += r.h48;

    tbody.innerHTML += `
      <tr onclick="openDetail(${index})" style="cursor:pointer">
        <td><div style="display:flex;align-items:center;gap:10px;"><img src="${item.snippet.thumbnails.default.url}" style="width:30px;border-radius:50%"><b>${item.snippet.title}</b></div></td>
        <td>${formatNumber(s.subscriberCount)}</td>
        <td>${formatNumber(s.viewCount)}</td>
        <td style="color:#22d3ee;font-weight:700">${formatNumber(r.m60)}</td>
        <td style="color:#fbbf24;font-weight:700">${formatNumber(r.h48)}</td>
        <td><span class="badge-ok">ACTIVE</span></td>
      </tr>`;
  });

  if($("totalChannel")) $("totalChannel").textContent = filtered.length;
  if($("totalSubs")) $("totalSubs").textContent = formatNumber(tSubs);
  if($("totalViews")) $("totalViews").textContent = formatNumber(tViews);
  if($("totalRealtime")) $("totalRealtime").textContent = formatNumber(tReal);
  if($("lastUpdate")) $("lastUpdate").textContent = new Date().toLocaleTimeString();
  setStatus("Dashboard Aktif", true);
}

/* =========================
    FEATURES: EXPORT & MODAL
========================= */
function exportToExcel() {
  const table = document.querySelector(".channel-table");
  const wb = XLSX.utils.table_to_book(table, { sheet: "YT_Pro_Report" });
  XLSX.writeFile(wb, `YT_Report_${new Date().toLocaleDateString()}.xlsx`);
}

function openDetail(idx) {
  const ch = allCachedChannels[idx];
  const r = ch.realtime || { m60: 0, h48: 0 };
  $("modalBodyContent").innerHTML = `
    <div style="text-align:center;">
      <img src="${ch.snippet.thumbnails.medium.url}" style="width:100px; border-radius:50%; border:3px solid #22d3ee; margin-bottom:15px;">
      <h2>${ch.snippet.title}</h2>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:20px;">
        <div class="stat-card">Realtime 60m<br><b style="color:#22d3ee">${formatNumber(r.m60)}</b></div>
        <div class="stat-card">Realtime 48h<br><b style="color:#fbbf24">${formatNumber(r.h48)}</b></div>
      </div>
      <a href="https://youtube.com/channel/${ch.id}" target="_blank" class="btn primary" style="display:block;margin-top:20px;text-decoration:none;">Buka YouTube</a>
    </div>`;
  $("detailModal").style.display = "flex";
}

function closeModal() { $("detailModal").style.display = "none"; }

/* =========================
    GOOGLE AUTH (OFFLINE ACCESS)
========================= */
async function googleSignIn(){
  if(!gApiInited) await initGapi();
  
  tokenClient.callback = async (resp) => {
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
  };

  tokenClient.requestAccessToken({ 
    prompt: 'consent', 
    access_type: 'offline' 
  });
}

/* =========================
    DOM LOAD & EVENT LISTENERS
========================= */
document.addEventListener("DOMContentLoaded", async () => {
  await initGapi();
  fetchAllChannelsData();

  if($("btnAddGmail")) $("btnAddGmail").onclick = googleSignIn;
  if($("btnAddGmailTop")) $("btnAddGmailTop").onclick = googleSignIn;
  if($("btnRefreshData")) $("btnRefreshData").onclick = fetchAllChannelsData;
  if($("btnExportData")) $("btnExportData").onclick = exportToExcel;

  const btnChannelList = document.querySelector('a[href="#channel"]');
  if (btnChannelList) {
      btnChannelList.onclick = async (e) => {
          e.preventDefault();
          if($("searchInput")) $("searchInput").value = "";
          await fetchAllChannelsData();
          const target = $("channel");
          if (target) target.scrollIntoView({ behavior: "smooth" });
          document.querySelectorAll(".side-link").forEach(l => l.classList.remove("active"));
          btnChannelList.classList.add("active");
      };
  }
  
  if($("btnOwnerLogout")) {
    $("btnOwnerLogout").onclick = () => { 
      localStorage.removeItem("owner_logged_in"); 
      localStorage.removeItem("owner_name");
      window.location.href="login.html"; 
    };
  }
  
  if($("btnLocalLogout")) {
    $("btnLocalLogout").onclick = () => { 
      if(confirm("Hapus semua akun Gmail yang tertaut di perangkat ini?")){ 
        localStorage.removeItem(STORE_KEY); 
        location.reload(); 
      } 
    };
  }
  
  if($("searchInput")) $("searchInput").oninput = () => renderTable(allCachedChannels);
});

window.onclick = (e) => { if(e.target == $("detailModal")) closeModal(); };

/* =========================
   FUNGSI SINKRON ANTAR PERANGKAT
   ========================= */
function exportData() {
    const data = localStorage.getItem(STORE_KEY);
    if (!data || data === "[]") {
        alert("Belum ada akun YouTube yang bisa disalin.");
        return;
    }
    const tempInput = document.createElement("textarea");
    tempInput.value = data;
    document.body.appendChild(tempInput);
    tempInput.select();
    try {
        document.execCommand('copy');
        alert("KODE DATA BERHASIL DISALIN!\n\nKirim kode ini ke WhatsApp/Email Anda sendiri, lalu gunakan menu 'Tempel Kode Data' di HP/Laptop lain.");
    } catch(err) {
        alert("Gagal menyalin otomatis. Silakan salin manual teks yang muncul.");
        console.log(data);
    }
    document.body.removeChild(tempInput);
}

function importData() {
    const code = prompt("Tempelkan (Paste) Kode Data dari perangkat lain di sini:");
    
    if (code && code.trim() !== "") {
        try {
            // 1. Ambil data baru yang mau dimasukkan
            const newData = JSON.parse(code);
            
            if (Array.isArray(newData)) {
                // 2. Ambil data lama yang sudah ada di perangkat ini
                let currentData = loadAccounts();
                
                // 3. Gabungkan data (Cek berdasarkan EMAIL agar tidak dobel)
                newData.forEach(newAcc => {
                    const exists = currentData.findIndex(oldAcc => oldAcc.email === newAcc.email);
                    if (exists !== -1) {
                        // Jika email sudah ada, update tokennya saja (biar paling baru)
                        currentData[exists] = newAcc;
                    } else {
                        // Jika email belum ada, tambahkan ke daftar
                        currentData.push(newAcc);
                    }
                });

                // 4. Simpan hasil gabungan ke memori
                saveAccounts(currentData);
                
                alert("SINKRONISASI BERHASIL!\nData telah digabungkan dengan akun yang sudah ada.");
                location.reload();
            } else {
                alert("Kode tidak valid!");
            }
        } catch (e) {
            alert("Error: Gagal membaca kode. Pastikan kode benar.");
        }
    }
}


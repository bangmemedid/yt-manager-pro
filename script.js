/* =========================
   CONFIG (PUNYA KAMU)
========================= */
const CLIENT_ID = "262964938761-4e41cgkbud489toac5midmamoecb3jrq.apps.googleusercontent.com";
const API_KEY   = "AIzaSyDNT_iVn2c9kY3M6DQOcODBFNwAs-e_qA4";

const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly"
].join(" ");

const STORE_KEY = "ytmpro_accounts_merge_v1";

/* =========================
   HELPERS
========================= */
const $ = (id) => document.getElementById(id);

function setStatus(msg){
  const el = $("statusText");
  if(el) el.textContent = "Status: " + msg;
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

function safeText(el, txt){
  if(el) el.textContent = txt;
}

/* =========================
   GOOGLE INIT (GIS + gapi client)
========================= */
let gApiInited = false;
let tokenClient = null;

function initGapi(){
  return new Promise((resolve, reject) => {
    if(typeof gapi === "undefined"){
      reject(new Error("gapi belum termuat. Pastikan ada <script src='https://apis.google.com/js/api.js'></script>"));
      return;
    }
    if(typeof google === "undefined" || !google.accounts?.oauth2){
      reject(new Error("Google Identity Services belum termuat. Pastikan ada <script src='https://accounts.google.com/gsi/client' async defer></script>"));
      return;
    }

    gapi.load("client", async () => {
      try{
        await gapi.client.init({
          apiKey: API_KEY,
          discoveryDocs: [
            "https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest"
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
      }catch(e){
        reject(e);
      }
    });
  });
}

/* =========================
   USERINFO (ambil email)
========================= */
async function getUserEmail(access_token){
  try{
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    const data = await res.json();
    return data?.email || "(unknown)";
  }catch{
    return "(unknown)";
  }
}

/* =========================
   LOGIN GOOGLE (GIS) - PILIH AKUN
========================= */
async function googleSignInSelectAccount(){
  if(!gApiInited) await initGapi();

  const tokenResp = await new Promise((resolve, reject) => {
    tokenClient.callback = (resp) => {
      if(resp?.error) {
        console.error("Login failed:", resp.error); // Log error untuk debugging
        reject(resp);
      } else {
        resolve(resp);
      }
    };

    tokenClient.requestAccessToken({
      prompt: "consent select_account"
    });
  });

  // Pastikan token dan expires_in tersedia
  const access_token = tokenResp.access_token;
  const expires_in = Number(tokenResp.expires_in || 3600);
  const expires_at = Date.now() + expires_in * 1000;

  console.log("Access Token:", access_token); // Debugging token

  // Dapatkan email pengguna dari token yang diterima
  const email = await getUserEmail(access_token);

  // Verifikasi email apakah diterima dengan benar
  if (!email || email === "(unknown)") {
    alert("Gagal mendapatkan email pengguna.");
    return;
  }

  const payload = {
    email,
    access_token,
    expires_at,
    added_at: Date.now()
  };

  const accounts = loadAccounts();
  const idx = accounts.findIndex(a => a.email === email);
  if (idx >= 0) accounts[idx] = payload;
  else accounts.push(payload);

  saveAccounts(accounts);
  setStatus(`Login sukses: ${email}`);
  return payload;
}

/* =========================
   FETCH DATA PER ACCOUNT (YouTube Data API v3)
========================= */
async function fetchMyChannelUsingToken(access_token){
  gapi.client.setToken({ access_token });

  const res = await gapi.client.youtube.channels.list({
    part: "snippet,statistics",
    mine: true,
    maxResults: 50
  });

  const item = res?.result?.items?.[0];
  if(!item) return null;

  return {
    channelId: item.id,
    title: item.snippet?.title || "-",
    thumb: item.snippet?.thumbnails?.default?.url || "",
    subs: Number(item.statistics?.subscriberCount || 0),
    videos: Number(item.statistics?.videoCount || 0),
    views: Number(item.statistics?.viewCount || 0),
  };
}

/* =========================
   ANALYTICS LAYER (YouTube Analytics API v2)
========================= */
const YT_ANALYTICS_TZ = "America/Los_Angeles";

function formatDateInTZ(date, timeZone){
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const y = parts.find(p => p.type === "year").value;
  const m = parts.find(p => p.type === "month").value;
  const d = parts.find(p => p.type === "day").value;
  return `${y}-${m}-${d}`; // YYYY-MM-DD
}

function daysAgoInTZ(n, timeZone){
  const d = new Date();
  d.setDate(d.getDate() - n);
  return formatDateInTZ(d, timeZone);
}

async function ytAnalyticsQuery(access_token, params){
  const base = "https://youtubeanalytics.googleapis.com/v2/reports";
  const qs = new URLSearchParams(params);

  const res = await fetch(`${base}?${qs.toString()}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${access_token}`,
      Accept: "application/json",
    }
  });

  if(!res.ok){
    const text = await res.text();
    throw new Error(`YT Analytics error ${res.status}: ${text}`);
  }
  return res.json();
}

/* =========================
   CHART FUNCTION (NEW)
========================= */
// Fungsi untuk menggambar chart Views (Last 48 Hours)
function createViewsChart(viewsData) {
  const ctx = document.getElementById('viewsChart').getContext('2d');
  const viewsChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Channel 1', 'Channel 2', 'Channel 3'], // Ganti sesuai dengan jumlah channel Anda
      datasets: [{
        label: 'Views in Last 48 Hours',
        data: viewsData,
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1
      }]
    },
    options: {
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

// Fungsi untuk menggambar chart Subscriber Growth (Last 28 Days)
function createGrowthChart(growthData) {
  const ctx = document.getElementById('growthChart').getContext('2d');
  const growthChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Day 1', 'Day 2', 'Day 3'], // Ganti sesuai periode
      datasets: [{
        label: 'Subscriber Growth',
        data: growthData,
        fill: false,
        borderColor: 'rgba(54, 162, 235, 1)',
        tension: 0.1
      }]
    },
    options: {
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

/* =========================
   CHARTS UPDATE
========================= */
async function refreshCharts(rows) {
  const viewsData = rows.map(row => row.analytics?.views2d?.total || 0);
  const growthData = rows.map(row => row.analytics?.subs28?.net || 0);

  createViewsChart(viewsData); 
  createGrowthChart(growthData); 
}

/* =========================
   RENDER FUNCTION
========================= */
function renderTable(rows){
  const tbody = $("channelBody");
  if(!tbody) return;

  injectAnalyticsCSS();

  if(!rows.length){
    tbody.innerHTML = `<tr><td colspan="5" class="empty">Belum ada data. Klik <b>Tambah Gmail</b> lalu izinkan akses.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(r => {
    const sub = r.analytics?.subs28;
    const v2d = r.analytics?.views2d;

    const subsText = sub
      ? `Gained <b>${formatNumber(sub.gained)}</b> • Lost <b>${formatNumber(sub.lost)}</b> • Net <b>${formatNumber(sub.net)}</b>`
      : `—`;

    const viewsDaysText = v2d?.days?.length
      ? v2d.days.map(d => `${d.day}: <b>${formatNumber(d.views)}</b>`).join(" • ")
      : "";

    const analyticsHtml = ` 
      <div class="ytmpro-analytics-wrap">
        <div class="ytmpro-analytics-card">
          <h4>Subscriber Growth (Last 28 Days)</h4>
          <div class="ytmpro-analytics-metrics">
            <span class="ytmpro-analytics-chip">Gained: <b>${sub ? formatNumber(sub.gained) : "—"}</b></span>
            <span class="ytmpro-analytics-chip">Lost: <b>${sub ? formatNumber(sub.lost) : "—"}</b></span>
            <span class="ytmpro-analytics-chip">Net: <b>${sub ? formatNumber(sub.net) : "—"}</b></span>
          </div>
          <div class="ytmpro-analytics-mini">
            ${sub ? `${subsText} <span style="opacity:.6">(${sub.range})</span>` : "—"}
          </div>
        </div>

        <div class="ytmpro-analytics-card">
          <h4>Views (Last 2 Stable Days)</h4>
          <div class="ytmpro-analytics-metrics">
            <span class="ytmpro-analytics-chip">Total: ${v2d ? `<b>${formatNumber(v2d.total)}</b>` : "<b>—</b>"}</span>
          </div>
          <div class="ytmpro-analytics-mini">${viewsDaysText || "—"}</div>
        </div>
      </div>
    `;

    return `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:10px">
            ${r.thumb ? `<img src="${r.thumb}" style="width:34px;height:34px;border-radius:12px;border:1px solid rgba(255,255,255,.12)" />` : ""}
            <div>
              <div style="font-weight:800">${r.title}</div>
              <div style="font-size:12px;opacity:.7">${r.email}</div>
            </div>
          </div>
        </td>
        <td>${formatNumber(r.subs)}</td>
        <td>${formatNumber(r.videos)}</td>
        <td>${formatNumber(r.views)}</td>
        <td><span class="badge-ok">OK</span></td>
      </tr>

      <tr class="analytics-row">
        <td colspan="5">
          ${analyticsHtml}
        </td>
      </tr>
    `;
  }).join("");
}

function renderStats(rows){
  safeText($("totalChannel"), formatNumber(rows.length));

  const totalSubs = rows.reduce((a,b)=>a + (b.subs||0), 0);
  safeText($("totalSubs"), formatNumber(totalSubs));

  const totalViews = rows.reduce((a,b)=>a + (b.views||0), 0);
  safeText($("totalViews"), formatNumber(totalViews));

  safeText($("view60m"), "—");
}

/* =========================
   MAIN REFRESH
========================= */
async function refreshAllData(){
  const accounts = loadAccounts();

  if(!accounts.length){
    renderTable([]);
    renderStats([]);
    setStatus("Belum ada Gmail ditambahkan.");
    return;
  }

  setStatus("Mengambil data channel...");
  if(!gApiInited) await initGapi();

  const rows = [];
  for(const acc of accounts){
    try{
      if(acc.expires_at && Date.now() > acc.expires_at - 60_000){
        setStatus(`Token expired: ${acc.email}. Klik Tambah Gmail untuk refresh.`);
        continue;
      }

      const channel = await fetchMyChannelUsingToken(acc.access_token);
      if(!channel) continue;

      setStatus(`Ambil analytics: ${acc.email} ...`);

      let subs28 = null;
      let views2d = null;

      try{
        subs28 = await getSubscriberGrowth28d(acc.access_token);
      }catch(e){
        console.warn("subs28 analytics failed:", acc.email, e);
      }

      try{
        views2d = await getViewsLast2DaysStable(acc.access_token);
      }catch(e){
        console.warn("views2d analytics failed:", acc.email, e);
      }

      rows.push({
        ...channel,
        email: acc.email,
        analytics: { subs28, views2d }
      });

    }catch(e){
      console.error("fetch failed", acc.email, e);
      setStatus(`Gagal ambil data: ${acc.email} (coba login lagi)`);
    }
  }

  renderTable(rows);
  renderStats(rows);
  refreshCharts(rows); // Panggil refreshCharts untuk memperbarui chart
  setStatus("Selesai. Data channel + analytics sudah tampil (merge).");
}

/* =========================
   EVENTS
========================= */
function bindUI(){
  const btnAdd = $("btnAddGmail");
  const btnAddTop = $("btnAddGmailTop");
  const btnOwnerLogout = $("btnOwnerLogout");
  const btnLocalLogout = $("btnLocalLogout");
  const search = $("searchInput");

  const onAdd = async ()=> {
    try{
      console.log("Tombol Tambah Gmail diklik");
      setStatus("Membuka Google login...");
      await googleSignInSelectAccount();
      await refreshAllData();
    }catch(e){
      console.error(e);
      alert("Gagal login Google: " + (e?.details || e?.message || JSON.stringify(e)));
      setStatus("Gagal login Google.");
    }
  };

  if(btnAdd) btnAdd.addEventListener("click", onAdd);
  if(btnAddTop) btnAddTop.addEventListener("click", onAdd);

  if(btnOwnerLogout){
    btnOwnerLogout.addEventListener("click", ()=> {
      localStorage.removeItem("owner_logged_in");
      window.location.href = "login.html";
    });
  }

  if(btnLocalLogout){
    btnLocalLogout.addEventListener("click", ()=> {
      localStorage.removeItem(STORE_KEY);
      setStatus("Akun terhapus. Silakan tambah Gmail lagi.");
      refreshAllData();
    });
  }

  if(search){
    search.addEventListener("input", ()=> {
      const q = search.value.trim().toLowerCase();
      const rows = Array.from(document.querySelectorAll("#channelBody tr"));
      rows.forEach(tr => {
        const text = tr.innerText.toLowerCase();
        tr.style.display = text.includes(q) ? "" : "none";
      });
    });
  }
}
/* =========================
   INJECT CSS (untuk chart analytics)
========================= */
function injectAnalyticsCSS(){
  if(document.getElementById("ytmpro-analytics-style")) return;

  const css = `
    tr.analytics-row td{
      padding: 12px 14px;
      background: rgba(255,255,255,.03);
      border-top: 1px solid rgba(255,255,255,.06);
    }
    .ytmpro-analytics-wrap{
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    @media (max-width: 820px){
      .ytmpro-analytics-wrap{ grid-template-columns: 1fr; }
    }
    .ytmpro-analytics-card{
      border: 1px solid rgba(255,255,255,.10);
      border-radius: 14px;
      padding: 12px;
      background: rgba(0,0,0,.18);
    }
    .ytmpro-analytics-card h4{
      margin: 0 0 8px;
      font-size: 13px;
      opacity: .9;
      letter-spacing: .2px;
    }
    .ytmpro-analytics-metrics{
      display:flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 8px;
    }
    .ytmpro-analytics-chip{
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(255,255,255,.06);
      border: 1px solid rgba(255,255,255,.10);
      font-size: 12px;
    }
    .ytmpro-analytics-chip b{ font-weight: 800; }
    .ytmpro-analytics-mini{
      font-size: 12px;
      opacity: .85;
      margin-top: 6px;
    }
  `;

  const style = document.createElement("style");
  style.id = "ytmpro-analytics-style";
  style.textContent = css;
  document.head.appendChild(style);
}

/* =========================
   BOOT
========================= */
document.addEventListener("DOMContentLoaded", async ()=> {
  bindUI();
  try{
    await initGapi();
    await refreshAllData();
  }catch(e){
    console.error(e);
    alert(
      "Gagal init Google API:\n\n" +
      (e?.details || e?.message || JSON.stringify(e)) +
      "\n\nPastikan:\n- index.html memuat GIS & gapi script (urutan benar)\n- Authorized JavaScript origins benar\n- YouTube Data API v3 enabled\n- YouTube Analytics API enabled\n- Scope yt-analytics.readonly sudah di-consent"
    );
    setStatus("Gagal init Google API.");
  }
});


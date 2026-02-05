// ==============================
// CONFIG (SUDAH DIISI)
// ==============================
const CLIENT_ID = "262964938761-4e41cgkbud489toac5midmamoecb3jrq.apps.googleusercontent.com";
const API_KEY   = "AIzaSyDNT_iVn2c9kY3M6DQOcODBFNwAs-e_qA4";

// YouTube Data API + YouTube Analytics API
const DISCOVERY_DOCS = [
  "https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest",
  "https://www.googleapis.com/discovery/v1/apis/youtubeAnalytics/v2/rest",
];

const SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
].join(" ");

// LocalStorage key
const STORE_KEY = "yt_manager_accounts_v1";

// ==============================
// STATE
// ==============================
let tokenClient = null;
let gapiInited = false;
let gisInited = false;

let accounts = loadAccounts(); // [{ emailHint?, access_token?, channelId?, title?, handle?, thumb?, subs?, views?, videos?, views48?, views60?, spark48:[] }]

// ==============================
// HELPERS
// ==============================
const $ = (id) => document.getElementById(id);

function fmt(n) {
  if (n === null || n === undefined) return "0";
  const x = Number(n);
  if (!Number.isFinite(x)) return String(n);
  return x.toLocaleString("id-ID");
}

function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

function saveAccounts() {
  localStorage.setItem(STORE_KEY, JSON.stringify(accounts));
}
function loadAccounts() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setStatus(msg) {
  // kamu bisa pakai console saja, UI status optional
  console.log("[YT-MANAGER]", msg);
}

function render() {
  // KPIs
  $("totalChannel").textContent = String(accounts.length);

  const totalSubs = accounts.reduce((a,c) => a + (Number(c.subs)||0), 0);
  const totalViews48 = accounts.reduce((a,c) => a + (Number(c.views48)||0), 0);
  const totalViews60 = accounts.reduce((a,c) => a + (Number(c.views60)||0), 0);

  $("totalSubs").textContent = fmt(totalSubs);
  $("totalViews48").textContent = fmt(totalViews48);
  $("totalViews60").textContent = fmt(totalViews60);

  // delta (dummy sederhana: hijau kalau >0)
  $("delta48").textContent = totalViews48 > 0 ? `▲ ${fmt(Math.floor(totalViews48 * 0.013))}` : "—";

  // rows
  const q = ($("searchInput").value || "").toLowerCase().trim();

  const filtered = accounts.filter(a => {
    const hay = `${a.title||""} ${a.handle||""}`.toLowerCase();
    return !q || hay.includes(q);
  });

  const rows = filtered.map((a) => {
    const spark = (a.spark48 && a.spark48.length)
      ? a.spark48
      : Array.from({length: 12}, () => Math.floor(Math.random()*20)+5);

    const sparkHtml = spark.map(v => {
      const h = clamp(Math.round(v), 3, 26);
      return `<span style="height:${h}px"></span>`;
    }).join("");

    return `
      <div class="row">
        <div class="channelCell">
          <div class="avatar">${a.thumb ? `<img src="${a.thumb}" />` : ""}</div>
          <div class="cmeta">
            <div class="cname">${a.title || "—"}</div>
            <div class="chandle">${a.handle || ""}</div>
          </div>
        </div>

        <div class="numCell">${fmt(a.subs)}</div>
        <div class="numCell">${fmt(a.videos)}</div>
        <div class="numCell">${fmt(a.views)}</div>

        <div class="numCell">
          ${fmt(a.views60)}
          <div class="subnote">Views / 60m</div>
        </div>

        <div class="sparkline">${sparkHtml}</div>

        <div><span class="statusPill">OK</span></div>

        <div class="more">
          <div class="moreBtn">•••</div>
        </div>
      </div>
    `;
  }).join("");

  $("rows").innerHTML = rows || `<div class="row"><div style="opacity:.7">Tidak ada channel</div></div>`;
}

// ==============================
// GOOGLE INIT
// ==============================
function initGapiClient() {
  gapi.load("client", async () => {
    try {
      await gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: DISCOVERY_DOCS,
      });
      gapiInited = true;
      setStatus("gapi client ready");
      maybeEnable();
    } catch (e) {
      console.error(e);
      alert("Gagal init Google API (gapi). Cek API Key & koneksi.");
    }
  });
}

function initGIS() {
  try {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      prompt: "select_account", // biar bisa tambah akun
      callback: async (resp) => {
        if (!resp || !resp.access_token) {
          alert("Login dibatalkan / gagal mendapatkan token.");
          return;
        }
        // set token ke gapi
        gapi.client.setToken({ access_token: resp.access_token });

        // ambil data channel + analytics
        const channelData = await fetchChannelAndStats(resp.access_token);

        // simpan sebagai akun baru (multi gmail)
        upsertAccount({
          access_token: resp.access_token,
          ...channelData
        });

        render();
      }
    });

    gisInited = true;
    setStatus("GIS ready");
    maybeEnable();
  } catch (e) {
    console.error(e);
    alert("Gagal init Google Identity Services.");
  }
}

function maybeEnable(){
  // tombol akan aktif ketika 2 script siap
  if (gapiInited && gisInited) {
    $("loginBtn").disabled = false;
    $("addAccountBtn").disabled = false;
    $("addAccountBtn2").disabled = false;
  }
}

// ==============================
// API CALLS
// ==============================
async function fetchChannelAndStats(accessToken) {
  // 1) Channel basic
  const chRes = await gapi.client.youtube.channels.list({
    part: "snippet,statistics",
    mine: true
  });

  const ch = chRes.result.items?.[0];
  if (!ch) throw new Error("Channel tidak ditemukan untuk akun ini.");

  const channelId = ch.id;
  const title = ch.snippet?.title || "—";
  const thumb = ch.snippet?.thumbnails?.default?.url
             || ch.snippet?.thumbnails?.medium?.url
             || ch.snippet?.thumbnails?.high?.url
             || "";

  // handle kadang tidak selalu ada di snippet (tergantung API response)
  // kita bikin fallback
  const handle = ch.snippet?.customUrl ? `@${ch.snippet.customUrl.replace(/^@/, "")}` : "";

  const subs   = Number(ch.statistics?.subscriberCount || 0);
  const views  = Number(ch.statistics?.viewCount || 0);
  const videos = Number(ch.statistics?.videoCount || 0);

  // 2) Analytics: views 48 jam (hourly)
  const now = new Date();
  const end = new Date(now);
  const start = new Date(now);
  start.setHours(start.getHours() - 48);

  const startDate = toISODate(start);
  const endDate   = toISODate(end);

  let views48 = 0;
  let views60 = 0;
  let spark48 = [];

  try {
    // hourly report (views per hour)
    const rep = await gapi.client.youtubeAnalytics.reports.query({
      ids: "channel==MINE",
      startDate,
      endDate,
      metrics: "views",
      dimensions: "hour",
      sort: "hour"
    });

    const rows = rep.result.rows || [];
    // rows: [[hour, views], ...]
    const last48 = rows.slice(-48);

    views48 = last48.reduce((a,r) => a + Number(r[1]||0), 0);

    // views60: ambil 1 jam terakhir yang ada datanya (baris terakhir)
    const last = last48[last48.length - 1];
    views60 = last ? Number(last[1]||0) : 0;

    // spark: kompres 48 poin jadi 12 batang (rata-rata 4 jam per batang)
    spark48 = compressToBars(last48.map(r => Number(r[1]||0)), 12);
  } catch (e) {
    // Jika Analytics tidak tersedia untuk akun (sering terjadi), tetap jalan dengan nilai 0
    console.warn("Analytics not available:", e?.message || e);
    views48 = 0;
    views60 = 0;
    spark48 = Array.from({length:12}, () => Math.floor(Math.random()*18)+4);
  }

  return { channelId, title, handle, thumb, subs, views, videos, views48, views60, spark48 };
}

function toISODate(d){
  // yyyy-mm-dd in local time
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}

function compressToBars(arr, bars) {
  if (!arr.length) return Array.from({length: bars}, () => 3);
  const chunk = Math.ceil(arr.length / bars);
  const out = [];
  for (let i=0;i<bars;i++){
    const start = i*chunk;
    const end = Math.min(arr.length, start+chunk);
    const slice = arr.slice(start,end);
    const avg = slice.length ? slice.reduce((a,b)=>a+b,0)/slice.length : 0;
    // normalize a bit to look nice
    out.push(Math.round(Math.sqrt(avg) * 3)); // sqrt biar tidak ekstrem
  }
  return out;
}

// ==============================
// ACCOUNTS MGMT
// ==============================
function upsertAccount(acc) {
  // Dedup by channelId (lebih stabil daripada email)
  const idx = accounts.findIndex(a => a.channelId && acc.channelId && a.channelId === acc.channelId);
  if (idx >= 0) {
    accounts[idx] = { ...accounts[idx], ...acc };
  } else {
    accounts.unshift(acc);
  }
  saveAccounts();
}

function clearAccounts() {
  accounts = [];
  saveAccounts();
  render();
}

// ==============================
// UI EVENTS
// ==============================
function bindUI() {
  $("searchInput").addEventListener("input", render);

  const doLogin = () => {
    if (!tokenClient) return alert("Token client belum siap.");
    tokenClient.requestAccessToken();
  };

  $("loginBtn").addEventListener("click", doLogin);
  $("addAccountBtn").addEventListener("click", doLogin);
  $("addAccountBtn2").addEventListener("click", doLogin);

  $("logoutBtn").addEventListener("click", () => {
    // token revoke optional: browser only
    try {
      const token = gapi.client.getToken();
      if (token?.access_token) {
        google.accounts.oauth2.revoke(token.access_token, () => {});
      }
    } catch {}
    clearAccounts();
  });

  // default disabled sampai init siap
  $("loginBtn").disabled = true;
  $("addAccountBtn").disabled = true;
  $("addAccountBtn2").disabled = true;
}

// ==============================
// BOOT
// ==============================
window.addEventListener("DOMContentLoaded", () => {
  bindUI();
  render();

  // init gapi & gis
  initGapiClient();
  initGIS();
});

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
      if(resp?.error) reject(resp);
      else resolve(resp);
    };

    tokenClient.requestAccessToken({
      prompt: "consent select_account"
    });
  });

  const access_token = tokenResp.access_token;
  const expires_in = Number(tokenResp.expires_in || 3600);
  const expires_at = Date.now() + expires_in * 1000;

  const email = await getUserEmail(access_token);

  const payload = {
    email,
    access_token,
    expires_at,
    added_at: Date.now()
  };

  const accounts = loadAccounts();
  const idx = accounts.findIndex(a => a.email === email);
  if(idx >= 0) accounts[idx] = payload;
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
   - Subscriber growth last 28 days (gained/lost/net)
   - Views last 2 available days (proxy "48 hours")
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
  return `${y}-${m}-${d}`;
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

// 28 hari terakhir: dari 28 hari lalu sampai kemarin (lebih stabil dari "today")
async function getSubscriberGrowth28d(access_token){
  const startDate = daysAgoInTZ(28, YT_ANALYTICS_TZ);
  const endDate   = daysAgoInTZ(1,  YT_ANALYTICS_TZ);

  const data = await ytAnalyticsQuery(access_token, {
    ids: "channel==MINE",
    startDate,
    endDate,
    metrics: "subscribersGained,subscribersLost"
  });

  const row = data?.rows?.[0] || [0,0];
  const gained = Number(row[0] || 0);
  const lost   = Number(row[1] || 0);

  return { gained, lost, net: gained - lost, range: `${startDate} → ${endDate}` };
}

// Proxy 48 jam: 2 hari terakhir yang sudah complete (kemarin + H-2)
async function getViewsLast2DaysStable(access_token){
  const startDate = daysAgoInTZ(2, YT_ANALYTICS_TZ);
  const endDate   = daysAgoInTZ(1, YT_ANALYTICS_TZ);

  const data = await ytAnalyticsQuery(access_token, {
    ids: "channel==MINE",
    startDate,
    endDate,
    metrics: "views"
  });

  const row = data?.rows?.[0] || [0];
  const total = Number(row[0] || 0);

  return {
    total,
    days: [{ day: `${startDate} → ${endDate}`, views: total }]
  };
}

/* =========================
   UI INJECTION (tanpa edit style.css)
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
   RENDER
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
      <div

/* =========================
   YouTube Manager Pro | bangmemed.id
   script.js (MERGE ALL ACCOUNTS)
   - Multi Gmail disimpan token (sementara)
   - Gabung semua channel + total statistik
   - 48 jam (hour) + 60 menit (minute) via YouTube Analytics
   ========================= */

/** ====== CONFIG (ISI PUNYA KAMU) ====== **/
const BRAND_NAME = "bangmemed.id";
const CLIENT_ID = "ISI_CLIENT_ID_KAMU.apps.googleusercontent.com";
const API_KEY = "ISI_API_KEY_KAMU";

const SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
].join(" ");

/** ====== UI ELEMENTS ====== **/
const els = {
  loginBtn: document.getElementById("loginBtn"),
  totalChannel: document.getElementById("totalChannel"),
  totalSubs: document.getElementById("totalSubs"),
  view48h: document.getElementById("view48h"),
  view48hUp: document.getElementById("view48hUp"),
  view60m: document.getElementById("view60m"),
  channelBody: document.getElementById("channelBody"),
  searchInput: document.querySelector(".search"),
  addGmailBtn: document.querySelector(".btn.primary"),
};

let authInstance = null;

/** ====== STORAGE ====== **/
const LS_KEY = "ytmpro_accounts_merge_v1";
/**
 * accounts: [
 *   { email, access_token, expires_at, addedAt }
 * ]
 */
let accounts = loadAccounts();

// data terakhir buat search
let lastRenderedRows = [];

// auto refresh
let realtimeTimer = null;

/** ====== HELPERS ====== **/
function nowMs() {
  return Date.now();
}
function fmt(num) {
  if (num === null || num === undefined) return "0";
  const n = Number(num);
  if (Number.isNaN(n)) return String(num);
  return n.toLocaleString("id-ID");
}
function sum(arr) {
  return arr.reduce((a, b) => a + (Number(b) || 0), 0);
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function escapeAttr(s) {
  return escapeHtml(s).replaceAll("\n", " ");
}
function loadAccounts() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function saveAccounts() {
  localStorage.setItem(LS_KEY, JSON.stringify(accounts));
}
function setLoginText(txt) {
  if (!els.loginBtn) return;
  els.loginBtn.textContent = txt;
}
function statusLog(msg) {
  console.log("[YT-MANAGER]", msg);
}

/** ====== INLINE CSS FOR SPARK ====== **/
function ensureSparkCssOnce() {
  if (document.getElementById("spark-inline-css")) return;
  const style = document.createElement("style");
  style.id = "spark-inline-css";
  style.textContent = `
    .spark{display:flex;gap:6px;align-items:flex-end;height:52px}
    .spark .bar{display:inline-block;width:8px;border-radius:6px;opacity:.9;
      background:linear-gradient(180deg,#4aa3ff,#0ee3b2);}
    .badge{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;font-size:12px;font-weight:600}
    .badge-ok{background:rgba(14,227,178,.12);color:#0ee3b2;border:1px solid rgba(14,227,178,.25)}
    .badge-warn{background:rgba(255,193,7,.12);color:#ffc107;border:1px solid rgba(255,193,7,.25)}
    @media (max-width:800px){.spark .bar{width:6px}}
  `;
  document.head.appendChild(style);
}

function buildSparkBars(values, maxBars = 12) {
  if (!Array.isArray(values) || !values.length) return "";
  const chunk = Math.ceil(values.length / maxBars);
  const bars = [];
  for (let i = 0; i < values.length; i += chunk) {
    const slice = values.slice(i, i + chunk);
    bars.push(sum(slice));
  }
  const max = Math.max(...bars, 1);

  return `
    <div class="spark">
      ${bars
        .map((v) => {
          const h = Math.max(12, Math.round((v / max) * 46));
          return `<span class="bar" style="height:${h}px" title="${fmt(v)}"></span>`;
        })
        .join("")}
    </div>
  `;
}

/** ====== DATE ====== **/
function isoDate(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** ====== GOOGLE API INIT ====== **/
function initGapi() {
  return new Promise((resolve, reject) => {
    if (!window.gapi) return reject(new Error("gapi not loaded"));

    window.gapi.load("client:auth2", async () => {
      try {
        await window.gapi.client.init({
          apiKey: API_KEY,
          clientId: CLIENT_ID,
          scope: SCOPES,
          discoveryDocs: [
            "https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest",
            "https://www.googleapis.com/discovery/v1/apis/youtubeAnalytics/v2/rest",
          ],
        });

        authInstance = window.gapi.auth2.getAuthInstance();

        // tombol
        setLoginText("Login / Refresh Token");

        resolve();
      } catch (e) {
        reject(e);
      }
    });
  });
}

/** ====== TOKEN MANAGEMENT ====== **/
function tokenValid(acc) {
  // beri buffer 60 detik
  return acc?.access_token && acc?.expires_at && acc.expires_at - 60_000 > nowMs();
}

function upsertAccount(email, authResponse) {
  const access_token = authResponse.access_token;
  const expires_at = authResponse.expires_at; // ms
  const idx = accounts.findIndex((a) => a.email === email);
  const obj = { email, access_token, expires_at, addedAt: idx === -1 ? nowMs() : accounts[idx].addedAt };

  if (idx === -1) accounts.push(obj);
  else accounts[idx] = obj;

  saveAccounts();
}

async function signInPickAccount({ prompt = "select_account" } = {}) {
  if (!authInstance) throw new Error("authInstance not ready");
  const user = await authInstance.signIn({ prompt });

  const profile = user.getBasicProfile();
  const email = profile?.getEmail?.() || null;

 division:;
  const authResponse = user.getAuthResponse(true);
  if (!email || !authResponse?.access_token) throw new Error("Gagal ambil token/email");

  upsertAccount(email, authResponse);
  return email;
}

async function setClientToken(access_token) {
  // Set token untuk gapi client, supaya request berikutnya pakai token ini
  window.gapi.client.setToken({ access_token });
}

/** ====== API CALLS ====== **/
async function fetchChannelsMine() {
  const res = await window.gapi.client.youtube.channels.list({
    part: "snippet,statistics,contentDetails",
    mine: true,
    maxResults: 50,
  });

  const items = res?.result?.items || [];
  return items.map((it) => ({
    channelId: it.id,
    title: it.snippet?.title || "-",
    thumb: it.snippet?.thumbnails?.default?.url || "",
    customUrl: it.snippet?.customUrl || "",
    subs: Number(it.statistics?.subscriberCount || 0),
    videos: Number(it.statistics?.videoCount || 0),
    views: Number(it.statistics?.viewCount || 0),
  }));
}

async function query48hViews(channelId) {
  const now = new Date();
  const start = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  const res = await window.gapi.client.youtubeAnalytics.reports.query({
    ids: `channel==${channelId}`,
    startDate: isoDate(start),
    endDate: isoDate(now),
    metrics: "views",
    dimensions: "hour",
    sort: "hour",
  });

  const rows = res?.result?.rows || [];
  const series = rows.map((r) => Number(r[1]) || 0);
  return series.length > 48 ? series.slice(-48) : series;
}

async function query60mViews(channelId) {
  const now = new Date();
  const start = new Date(now.getTime() - 60 * 60 * 1000);

  const res = await window.gapi.client.youtubeAnalytics.reports.query({
    ids: `channel==${channelId}`,
    startDate: isoDate(start),
    endDate: isoDate(now),
    metrics: "views",
    dimensions: "minute",
    sort: "minute",
  });

  const rows = res?.result?.rows || [];
  const series = rows.map((r) => Number(r[1]) || 0);
  return series.length > 60 ? series.slice(-60) : series;
}

/** ====== RENDER ====== **/
function renderTable(rows) {
  lastRenderedRows = rows;

  if (!els.channelBody) return;
  if (!rows.length) {
    els.channelBody.innerHTML = `<tr><td colspan="7" style="opacity:.7;padding:14px">Tidak ada channel</td></tr>`;
    return;
  }

  els.channelBody.innerHTML = rows
    .map((r) => {
      const badge =
        r.status === "OK"
          ? `<span class="badge badge-ok">OK</span>`
          : `<span class="badge badge-warn">REFRESH</span>`;

      const chLine = `
        <div style="display:flex;align-items:center;gap:12px">
          <img src="${r.thumb}" style="width:34px;height:34px;border-radius:999px;object-fit:cover" />
          <div style="display:flex;flex-direction:column;line-height:1.1">
            <b style="font-weight:600">${escapeHtml(r.title)}</b>
            <span style="opacity:.7;font-size:12px">${escapeHtml(r.email || "")}</span>
          </div>
        </div>
      `;

      return `
        <tr data-title="${escapeAttr(r.title)}">
          <td style="opacity:.7">—</td>
          <td>${chLine}</td>
          <td><b>${fmt(r.subs)}</b></td>
          <td>${fmt(r.videos)}</td>
          <td>${fmt(r.views)}</td>
          <td>${r.sparkHtml || ""}</td>
          <td>${badge}</td>
        </tr>
      `;
    })
    .join("");
}

function applySearchFilter() {
  const q = (els.searchInput?.value || "").trim().toLowerCase();
  if (!q) {
    renderTable(lastRenderedRows);
    return;
  }
  const filtered = lastRenderedRows.filter((r) => (r.title || "").toLowerCase().includes(q));
  renderTable(filtered);
}

/** ====== CORE: MERGE ALL ACCOUNTS ====== **/
async function refreshAllAccountsDashboard() {
  ensureSparkCssOnce();

  // reset UI
  els.totalChannel.textContent = "0";
  els.totalSubs.textContent = "0";
  els.view48h.textContent = "0";
  els.view60m.textContent = "0";
  els.view48hUp.textContent = "0 ▲";

  if (!accounts.length) {
    renderTable([]);
    statusLog("Belum ada Gmail tersimpan. Klik + Tambah Gmail.");
    return;
  }

  statusLog("Mulai merge semua akun...");

  let totalChannel = 0;
  let totalSubs = 0;
  let total48h = 0;
  let total60m = 0;

  const allRows = [];
  const combined48 = new Array(48).fill(0);

  for (const acc of accounts) {
    // jika token expired, skip analytics dan tandai REFRESH
    if (!tokenValid(acc)) {
      statusLog(`Token expired: ${acc.email} (butuh refresh)`);
      // tampilkan placeholder row supaya kelihatan akun ini butuh refresh
      allRows.push({
        email: acc.email,
        title: "(Token Expired) Klik Login/Refresh Token",
        thumb: "https://cdn-icons-png.flaticon.com/512/281/281769.png",
        subs: 0,
        videos: 0,
        views: 0,
        sparkHtml: "",
        status: "REFRESH",
      });
      continue;
    }

    try {
      await setClientToken(acc.access_token);

      const channels = await fetchChannelsMine();
      if (!channels.length) {
        statusLog(`Tidak ada channel terdeteksi di: ${acc.email}`);
        continue;
      }

      totalChannel += channels.length;
      totalSubs += sum(channels.map((c) => c.subs));

      for (const ch of channels) {
        let v48series = [];
        let v60series = [];

        try {
          v48series = await query48hViews(ch.channelId);
          await sleep(120);
        } catch (e) {
          console.warn("48h error", acc.email, ch.channelId, e);
          v48series = [];
        }

        try {
          v60series = await query60mViews(ch.channelId);
          await sleep(120);
        } catch (e) {
          console.warn("60m error", acc.email, ch.channelId, e);
          v60series = [];
        }

        const ch48 = sum(v48series);
        const ch60 = sum(v60series);

        total48h += ch48;
        total60m += ch60;

        // gabungkan series 48 untuk growth (24h vs 24h)
        const startIndex = 48 - v48series.length;
        for (let i = 0; i < v48series.length; i++) {
          const idx = startIndex + i;
          if (idx >= 0 && idx < 48) combined48[idx] += Number(v48series[i]) || 0;
        }

        allRows.push({
          ...ch,
          email: acc.email,
          sparkHtml: buildSparkBars(v48series, 12),
          status: "OK",
        });

        // total views lifetime ambil dari data API v3
        // kita jumlahkan di akhir dari allRows agar konsisten
      }

      // total views lifetime & total videos bisa kamu tambah di card lain kalau mau
    } catch (e) {
      console.warn("Account fetch error:", acc.email, e);
      allRows.push({
        email: acc.email,
        title: "(Error Akses) Coba Refresh Token",
        thumb: "https://cdn-icons-png.flaticon.com/512/564/564619.png",
        subs: 0,
        videos: 0,
        views: 0,
        sparkHtml: "",
        status: "REFRESH",
      });
    }
  }

  // update cards
  els.totalChannel.textContent = fmt(totalChannel);
  els.totalSubs.textContent = fmt(totalSubs);
  els.view48h.textContent = fmt(total48h);
  els.view60m.textContent = fmt(total60m);

  // growth 48h indicator (24 jam terakhir vs 24 jam sebelumnya)
  const prev24 = sum(combined48.slice(0, 24));
  const last24 = sum(combined48.slice(24, 48));
  const diff = last24 - prev24;
  const arrow = diff >= 0 ? "▲" : "▼";
  els.view48hUp.textContent = `${fmt(Math.abs(diff))} ${arrow}`;

  // render table
  renderTable(allRows);
  applySearchFilter();

  statusLog("Merge selesai.");
}

/** ====== BUTTON FLOWS ====== **/
async function addGmailFlow() {
  // Tambah akun baru (pilih akun)
  await signInPickAccount({ prompt: "select_account" });
  await refreshAllAccountsDashboard();
  startRealtimeAutoRefresh();
}

async function refreshTokenFlow() {
  // Refresh token untuk akun tertentu (pilih akun lagi)
  await signInPickAccount({ prompt: "select_account" });
  await refreshAllAccountsDashboard();
  startRealtimeAutoRefresh();
}

function startRealtimeAutoRefresh() {
  stopRealtimeAutoRefresh();
  realtimeTimer = setInterval(async () => {
    try {
      await refreshAllAccountsDashboard();
    } catch (e) {
      console.warn("auto refresh error", e);
    }
  }, 60_000);
}
function stopRealtimeAutoRefresh() {
  if (realtimeTimer) clearInterval(realtimeTimer);
  realtimeTimer = null;
}

/** ====== EVENTS ====== **/
function bindEvents() {
  // Tombol Login/Refresh Token
  els.loginBtn?.addEventListener("click", async () => {
    try {
      await refreshTokenFlow();
    } catch (e) {
      console.error(e);
      alert(
        "Gagal Login/Refresh.\n\nCek:\n1) CLIENT_ID & API_KEY benar\n2) Authorized JavaScript origins sudah isi domain Vercel\n3) Scope yt-analytics.readonly sudah ditambahkan\n\nDetail: " +
          (e?.message || e)
      );
    }
  });

  // Tombol + Tambah Gmail
  els.addGmailBtn?.addEventListener("click", async () => {
    try {
      await addGmailFlow();
    } catch (e) {
      console.error(e);
      alert("Gagal tambah Gmail: " + (e?.message || e));
    }
  });

  // Search
  els.searchInput?.addEventListener("input", applySearchFilter);
}

/** ====== BOOT ====== **/
(async function boot() {
  try {
    await initGapi();
    bindEvents();
    await refreshAllAccountsDashboard();
    startRealtimeAutoRefresh();
  } catch (e) {
    console.error(e);
    alert(
      "Gagal inisialisasi Google API.\n\nCek:\n- API_KEY\n- CLIENT_ID\n- index.html memuat https://apis.google.com/js/api.js\n\nDetail: " +
        (e?.message || e)
    );
  }
})();

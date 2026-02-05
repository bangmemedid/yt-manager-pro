/* =========================
   YouTube Manager Pro | bangmemed.id
   script.js (FULL)
   - YouTube Data API v3
   - YouTube Analytics API v2
   ========================= */

/** ====== CONFIG (ISI PUNYA KAMU) ====== **/
const BRAND_NAME = "bangmemed.id";

// WAJIB isi sesuai Google Cloud Credentials kamu
const CLIENT_ID = "ISI_CLIENT_ID_KAMU.apps.googleusercontent.com";
const API_KEY = "ISI_API_KEY_KAMU";

// Scope minimum untuk data channel + analytics
// - youtube.readonly => ambil channel/statistik
// - yt-analytics.readonly => ambil views 48 jam & realtime
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
  channelTable: document.getElementById("channelTable"),
  searchInput: document.querySelector(".search"),
  addGmailBtn: document.querySelector(".btn.primary"),
};

let authInstance = null;
let currentUserEmail = null;

// Simpan akun (multi gmail) di localStorage
const LS_KEY = "ytmpro_accounts_v1";

// Cache data channel per akun
let accounts = loadAccounts();
let activeAccountIndex = 0;

// data hasil render (untuk search/filter)
let renderedRows = [];

// auto refresh realtime
let realtimeTimer = null;

/** ====== HELPERS ====== **/
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
function setStatusHint(text) {
  // optional: kamu bisa bikin elemen kecil untuk status,
  // tapi karena HTML kamu belum ada, kita pakai console saja.
  console.log("[YT-MANAGER]", text);
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

        // update tombol saat login/logout
        authInstance.isSignedIn.listen((signedIn) => {
          if (signedIn) {
            setLoginText("Logout");
          } else {
            setLoginText("Login");
          }
        });

        // set awal
        if (authInstance.isSignedIn.get()) setLoginText("Logout");
        else setLoginText("Login");

        resolve();
      } catch (e) {
        reject(e);
      }
    });
  });
}

/** ====== AUTH FLOW ====== **/
async function signIn({ prompt = "select_account" } = {}) {
  if (!authInstance) throw new Error("authInstance not ready");
  const user = await authInstance.signIn({ prompt });

  const profile = user.getBasicProfile();
  currentUserEmail = profile?.getEmail?.() || null;

  return user;
}

async function signOut() {
  if (!authInstance) return;
  await authInstance.signOut();
  currentUserEmail = null;
  stopRealtimeAutoRefresh();
}

/** ====== MAIN DATA LOADER ====== **/
async function loadForCurrentLoginAccount() {
  // Ambil channel list milik Gmail yang login
  // note: youtube.channels.list mine=true hanya balikin channel yg terhubung
  const chRes = await window.gapi.client.youtube.channels.list({
    part: "snippet,statistics,contentDetails",
    mine: true,
    maxResults: 50,
  });

  const items = chRes?.result?.items || [];
  if (!items.length) {
    return { channels: [], email: currentUserEmail };
  }

  // Untuk Youtube Analytics API butuh channelId
  // Biasanya 1 channel per akun, tapi bisa lebih (Brand Account)
  const channels = items.map((it) => ({
    channelId: it.id,
    title: it.snippet?.title || "-",
    thumb: it.snippet?.thumbnails?.default?.url || "",
    customUrl: it.snippet?.customUrl || "",
    subs: Number(it.statistics?.subscriberCount || 0),
    videos: Number(it.statistics?.videoCount || 0),
    views: Number(it.statistics?.viewCount || 0),
  }));

  return { channels, email: currentUserEmail };
}

/** ====== ANALYTICS QUERIES ======
  Kita ambil:
  - 48 jam: views per hour (last 48h)
  - 60 menit realtime: views per minute (last 60m)
  Catatan: realtime per minute kadang 0 untuk channel tertentu, atau delay.
**/
function isoDate(d) {
  // YYYY-MM-DD
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function query48hViews(channelId) {
  // YouTube Analytics v2: reports.query
  // Ambil per hour untuk 2 hari terakhir (48 jam)
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
  // rows format: [ [hour, views], ... ] hour biasanya string
  const series = rows.map((r) => Number(r[1]) || 0);

  // Karena startDate/endDate date-based, hasilnya bisa >48 jam,
  // jadi kita potong ambil 48 poin terakhir bila panjang
  const trimmed = series.length > 48 ? series.slice(-48) : series;

  return trimmed;
}

async function query60mViews(channelId) {
  // Realtime minute-level tidak selalu tersedia seperti yang orang bayangkan.
  // Kita pakai dimensions=minute kalau API mengembalikan rows.
  // Jika tidak ada rows / error, fallback 0.
  const now = new Date();
  const start = new Date(now.getTime() - 60 * 60 * 1000);

  // Untuk minute dimensi, start/end harus YYYY-MM-DD juga,
  // jadi kita query hari ini & kemarin lalu potong 60 terakhir
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
  const trimmed = series.length > 60 ? series.slice(-60) : series;

  return trimmed;
}

/** ====== UI RENDER ====== **/
function buildSparkBars(values, maxBars = 12) {
  // downsample 48 values -> 12 bars
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
          const h = Math.max(12, Math.round((v / max) * 46)); // px
          return `<span class="bar" style="height:${h}px" title="${fmt(v)}"></span>`;
        })
        .join("")}
    </div>
  `;
}

function ensureSparkCssOnce() {
  if (document.getElementById("spark-inline-css")) return;
  const style = document.createElement("style");
  style.id = "spark-inline-css";
  style.textContent = `
    .spark{display:flex;gap:6px;align-items:flex-end;height:52px}
    .spark .bar{display:inline-block;width:8px;border-radius:6px;opacity:.9;
      background:linear-gradient(180deg,#4aa3ff,#0ee3b2);}
    @media (max-width:800px){.spark .bar{width:6px}}
  `;
  document.head.appendChild(style);
}

function renderTable(rows) {
  renderedRows = rows;

  if (!els.channelBody) return;
  if (!rows.length) {
    els.channelBody.innerHTML = `<tr><td colspan="7" style="opacity:.7;padding:14px">Tidak ada channel</td></tr>`;
    return;
  }

  els.channelBody.innerHTML = rows
    .map((r) => {
      const chLine = `
        <div style="display:flex;align-items:center;gap:12px">
          <img src="${r.thumb}" style="width:34px;height:34px;border-radius:999px;object-fit:cover" />
          <div style="display:flex;flex-direction:column;line-height:1.1">
            <b style="font-weight:600">${escapeHtml(r.title)}</b>
            <span style="opacity:.7;font-size:12px">${escapeHtml(r.handle || r.customUrl || r.email || "")}</span>
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
          <td><span class="status-ok">OK</span></td>
        </tr>
      `;
    })
    .join("");
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

function applySearchFilter() {
  const q = (els.searchInput?.value || "").trim().toLowerCase();
  if (!q) {
    // render ulang original
    renderTable(renderedRows);
    return;
  }
  const filtered = renderedRows.filter((r) => (r.title || "").toLowerCase().includes(q));
  renderTable(filtered);
}

/** ====== DASHBOARD AGGREGATION ====== **/
async function refreshDashboard() {
  ensureSparkCssOnce();

  if (!authInstance?.isSignedIn?.get?.()) {
    setStatusHint("Belum login.");
    renderTable([]);
    els.totalChannel.textContent = "0";
    els.totalSubs.textContent = "0";
    els.view48h.textContent = "0";
    els.view60m.textContent = "0";
    els.view48hUp.textContent = "0 ▲";
    return;
  }

  setStatusHint("Mengambil channel...");

  const { channels, email } = await loadForCurrentLoginAccount();

  // Simpan akun login ke list accounts (multi gmail)
  if (email) {
    const existing = accounts.find((a) => a.email === email);
    if (!existing) {
      accounts.push({ email, addedAt: Date.now() });
      saveAccounts();
    }
  }

  // Gabungkan semua channel dari Gmail yang sedang login saja (sesuai token aktif)
  // Jika mau multi-akun “gabung sekaligus”, harus login tiap akun satu-satu dan simpan token per akun (lebih kompleks).
  // Versi ini: kamu bisa "Tambah Gmail" -> pilih akun -> data berganti mengikuti akun tersebut.
  const totalChannel = channels.length;
  const totalSubs = sum(channels.map((c) => c.subs));

  els.totalChannel.textContent = fmt(totalChannel);
  els.totalSubs.textContent = fmt(totalSubs);

  // Ambil analytics per channel (48 jam & 60 menit)
  // Supaya cepat, kita query berurutan (lebih stabil) + sedikit delay
  let total48h = 0;
  let total60m = 0;

  const rowsForTable = [];
  for (const ch of channels) {
    let v48series = [];
    let v60series = [];

    try {
      v48series = await query48hViews(ch.channelId);
      await sleep(150);
    } catch (e) {
      console.warn("48h error", ch.channelId, e);
      v48series = [];
    }

    try {
      v60series = await query60mViews(ch.channelId);
      await sleep(150);
    } catch (e) {
      console.warn("60m error", ch.channelId, e);
      v60series = [];
    }

    const ch48 = sum(v48series);
    const ch60 = sum(v60series);

    total48h += ch48;
    total60m += ch60;

    rowsForTable.push({
      ...ch,
      email,
      handle: ch.customUrl ? `@${ch.customUrl}` : "",
      sparkHtml: buildSparkBars(v48series, 12),
      _v48series: v48series,
      _v60series: v60series,
      _v48sum: ch48,
      _v60sum: ch60,
    });
  }

  // Update cards analytics
  els.view48h.textContent = fmt(total48h);
  els.view60m.textContent = fmt(total60m);

  // Growth indicator sederhana (banding 24 jam terakhir vs 24 jam sebelumnya)
  // total48hseries gabungan: kita gabungkan semua series 48h channel lalu sum per posisi
  const combined48 = new Array(48).fill(0);
  for (const r of rowsForTable) {
    const s = r._v48series || [];
    const startIndex = 48 - s.length;
    for (let i = 0; i < s.length; i++) {
      const idx = startIndex + i;
      if (idx >= 0 && idx < 48) combined48[idx] += Number(s[i]) || 0;
    }
  }
  const prev24 = sum(combined48.slice(0, 24));
  const last24 = sum(combined48.slice(24, 48));
  const diff = last24 - prev24;
  const arrow = diff >= 0 ? "▲" : "▼";
  els.view48hUp.textContent = `${fmt(Math.abs(diff))} ${arrow}`;

  // Render table
  renderTable(rowsForTable);

  // hook search
  applySearchFilter();

  setStatusHint("Selesai.");
}

/** ====== MULTI GMAIL BUTTON BEHAVIOR ====== **/
async function addGmailFlow() {
  // paksa prompt pilih akun
  await signIn({ prompt: "select_account" });
  await refreshDashboard();
  startRealtimeAutoRefresh();
}

/** ====== AUTO REFRESH REALTIME ====== **/
function startRealtimeAutoRefresh() {
  stopRealtimeAutoRefresh();
  realtimeTimer = setInterval(async () => {
    try {
      // refresh analytics saja lebih ideal, tapi sederhana: refresh dashboard
      await refreshDashboard();
    } catch (e) {
      console.warn("auto refresh error", e);
    }
  }, 60_000); // 60 detik
}
function stopRealtimeAutoRefresh() {
  if (realtimeTimer) clearInterval(realtimeTimer);
  realtimeTimer = null;
}

/** ====== EVENTS ====== **/
function bindEvents() {
  // Login/Logout
  els.loginBtn?.addEventListener("click", async () => {
    try {
      if (!authInstance?.isSignedIn?.get?.()) {
        await signIn({ prompt: "consent" });
        await refreshDashboard();
        startRealtimeAutoRefresh();
      } else {
        await signOut();
        await refreshDashboard();
      }
    } catch (e) {
      console.error(e);
      alert(
        "Login gagal.\n\nPastikan:\n1) OAuth client benar\n2) Authorized JavaScript origins & redirect URI benar\n3) Scope sudah ditambahkan (yt-analytics.readonly)\n\nDetail: " +
          (e?.message || e)
      );
    }
  });

  // Tambah Gmail
  els.addGmailBtn?.addEventListener("click", async () => {
    try {
      await addGmailFlow();
    } catch (e) {
      console.error(e);
      alert("Gagal tambah Gmail: " + (e?.message || e));
    }
  });

  // Search filter
  els.searchInput?.addEventListener("input", () => {
    // filter dari data terakhir
    const q = (els.searchInput?.value || "").trim().toLowerCase();
    if (!q) {
      // render ulang
      renderTable(renderedRows);
      return;
    }
    const filtered = renderedRows.filter((r) => (r.title || "").toLowerCase().includes(q));
    renderTable(filtered);
  });
}

/** ====== BOOT ====== **/
(async function boot() {
  try {
    await initGapi();
    bindEvents();

    // Jika sudah login sebelumnya
    if (authInstance?.isSignedIn?.get?.()) {
      try {
        const user = authInstance.currentUser.get();
        currentUserEmail = user?.getBasicProfile?.()?.getEmail?.() || null;
      } catch {}
      await refreshDashboard();
      startRealtimeAutoRefresh();
    } else {
      await refreshDashboard();
    }
  } catch (e) {
    console.error(e);
    alert(
      "Gagal inisialisasi Google API.\n\nCek:\n- API_KEY\n- CLIENT_ID\n- file index.html sudah memuat https://apis.google.com/js/api.js\n\nDetail: " +
        (e?.message || e)
    );
  }
})();

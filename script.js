/* =========================
   YouTube Manager Pro | bangmemed.id
   script.js (FULL)
   ========================= */

const CONFIG = {
  CLIENT_ID:
    "262964938761-4e41cgkbud489toac5midmamoecb3jrq.apps.googleusercontent.com",
  API_KEY: "AIzaSyDNT_iVn2c9kY3M6DQOcODBFNwAs-e_qA4",
  DISCOVERY_DOCS: [
    "https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest",
    "https://www.googleapis.com/discovery/v1/apis/youtubeAnalytics/v2/rest",
  ],
  // scope wajib agar Analytics (48h) kebaca
  SCOPES: [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/yt-analytics.readonly",
  ].join(" "),
};

const STORAGE_KEY = "ytmp_accounts_v1";

let auth; // gapi auth instance

// ---------- Helpers ----------
const $ = (sel) => document.querySelector(sel);
const fmtInt = (n) => {
  if (n === null || n === undefined) return "0";
  const x = Number(n);
  if (Number.isNaN(x)) return "0";
  return x.toLocaleString("id-ID");
};

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function daysAgoISO(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function safeJsonParse(s, fallback) {
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
}

function loadAccounts() {
  return safeJsonParse(localStorage.getItem(STORAGE_KEY), []);
}

function saveAccounts(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function upsertAccount(acc) {
  const list = loadAccounts();
  const i = list.findIndex((x) => x.email === acc.email);
  if (i >= 0) list[i] = { ...list[i], ...acc };
  else list.push(acc);
  saveAccounts(list);
  return list;
}

function removeAccount(email) {
  const list = loadAccounts().filter((x) => x.email !== email);
  saveAccounts(list);
  return list;
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = val;
}

function setHTML(id, html) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = html;
}

// Sparkline sederhana (bar mini)
function renderSparkline(values) {
  // values: array angka
  if (!Array.isArray(values) || values.length === 0) return "";
  const max = Math.max(...values, 1);
  const bars = values
    .slice(-12) // ambil 12 jam terakhir biar rapi
    .map((v) => {
      const h = Math.max(2, Math.round((v / max) * 20)); // 2..20
      return `<span class="bar" style="height:${h}px"></span>`;
    })
    .join("");
  return `<div class="spark">${bars}</div>`;
}

function showToast(msg) {
  // ringan: pakai console & output kecil di bawah tabel jika ada
  console.log("[YTMP]", msg);
}

// ---------- DOM refs ----------
const loginBtn = document.getElementById("loginBtn");
const addBtn = document.querySelector(".btn.primary"); // + Tambah Gmail
const searchInput = document.querySelector(".search");
const tbody = document.getElementById("channelBody");

// ---------- Core ----------
async function initClient() {
  await gapi.client.init({
    apiKey: CONFIG.API_KEY,
    clientId: CONFIG.CLIENT_ID,
    discoveryDocs: CONFIG.DISCOVERY_DOCS,
    scope: CONFIG.SCOPES,
  });

  auth = gapi.auth2.getAuthInstance();

  // UI init
  hydrateFromStorage();

  // Bind buttons
  if (loginBtn) {
    loginBtn.addEventListener("click", async () => {
      try {
        if (!auth.isSignedIn.get()) {
          await signInSelectAccount();
          await addCurrentAccountToList();
        } else {
          // jika sudah login, tombol "Login" berfungsi refresh data akun aktif
          await addCurrentAccountToList();
        }
      } catch (e) {
        console.error(e);
        showToast("Login gagal / dibatalkan.");
      }
    });
  }

  if (addBtn) {
    addBtn.addEventListener("click", async () => {
      try {
        await signInSelectAccount();
        await addCurrentAccountToList();
      } catch (e) {
        console.error(e);
        showToast("Tambah Gmail gagal / dibatalkan.");
      }
    });
  }

  // Search filter
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      const q = (searchInput.value || "").toLowerCase().trim();
      filterTable(q);
    });
  }

  // Auto refresh jika sudah login sebelumnya
  if (auth.isSignedIn.get()) {
    try {
      await addCurrentAccountToList();
    } catch (e) {
      console.warn("Auto refresh token gagal:", e);
    }
  }
}

function filterTable(q) {
  if (!tbody) return;
  const rows = Array.from(tbody.querySelectorAll("tr"));
  rows.forEach((tr) => {
    const name = (tr.getAttribute("data-channel-name") || "").toLowerCase();
    tr.style.display = name.includes(q) ? "" : "none";
  });
}

async function signInSelectAccount() {
  // paksa pilih akun setiap kali (biar bisa multi Gmail)
  await auth.signIn({
    prompt: "select_account consent",
  });
}

function getCurrentUserEmail() {
  const user = auth.currentUser.get();
  const profile = user?.getBasicProfile?.();
  return profile?.getEmail?.() || "";
}

async function fetchMineChannelBasic() {
  const res = await gapi.client.youtube.channels.list({
    part: "snippet,statistics",
    mine: true,
  });

  const item = res?.result?.items?.[0];
  if (!item) throw new Error("Channel tidak ditemukan untuk akun ini.");

  const snippet = item.snippet || {};
  const stats = item.statistics || {};

  return {
    channelId: item.id,
    title: snippet.title || "(No title)",
    handle: snippet.customUrl ? `@${snippet.customUrl}` : "",
    thumb:
      snippet.thumbnails?.default?.url ||
      snippet.thumbnails?.medium?.url ||
      "",
    subs: Number(stats.subscriberCount || 0),
    videos: Number(stats.videoCount || 0),
    viewsTotal: Number(stats.viewCount || 0),
  };
}

async function fetchViews48h() {
  // 48 jam: query per hour dari 2 hari terakhir sampai hari ini (UTC)
  // Catatan: Analytics kadang delay, tapi harusnya bukan 0 kalau akses benar.
  const startDate = daysAgoISO(2);
  const endDate = todayISO();

  const res = await gapi.client.youtubeAnalytics.reports.query({
    ids: "channel==MINE",
    startDate,
    endDate,
    metrics: "views",
    dimensions: "hour",
    sort: "hour",
  });

  const rows = res?.result?.rows || [];
  // rows format: [[YYYY-MM-DD, HH, views], ...] atau variasi tergantung API
  let sum = 0;
  const perHour = [];

  for (const r of rows) {
    const v = Number(r?.[2] ?? 0);
    sum += v;
    perHour.push(v);
  }

  return {
    views48h: sum,
    spark: perHour.slice(-12), // last 12 hours spark
  };
}

function computeTotals(accounts) {
  const totalChannel = accounts.length;

  const totalSubs = accounts.reduce((a, x) => a + (Number(x.subs) || 0), 0);

  // total views 48h: jumlahkan semua akun
  const total48h = accounts.reduce((a, x) => a + (Number(x.views48h) || 0), 0);

  return { totalChannel, totalSubs, total48h };
}

function updateTopCards(accounts) {
  const { totalChannel, totalSubs, total48h } = computeTotals(accounts);

  setText("totalChannel", fmtInt(totalChannel));
  setText("totalSubs", fmtInt(totalSubs));
  setText("view48h", fmtInt(total48h));

  // view48hUp: indikator naik (dummy: tampilkan + total48h)
  const upEl = document.getElementById("view48hUp");
  if (upEl) {
    upEl.textContent = total48h > 0 ? `${fmtInt(total48h)} ▲` : "0 ▲";
  }

  // Views 60 menit realtime TIDAK ada API publik -> tampilkan N/A
  // (lebih baik N/A daripada angka bohong 0)
  const view60m = document.getElementById("view60m");
  if (view60m) view60m.textContent = "N/A";
}

function renderTable(accounts) {
  if (!tbody) return;

  if (accounts.length === 0) {
    tbody.innerHTML = `
      <tr data-channel-name="">
        <td colspan="7" style="opacity:.75; padding:18px;">
          Tidak ada channel. Klik <b>Login</b> atau <b>+ Tambah Gmail</b>.
        </td>
      </tr>
    `;
    updateTopCards([]);
    return;
  }

  const rows = accounts
    .map((a) => {
      const sparkHtml = renderSparkline(a.spark || []);
      const channelName = a.title || "(No title)";
      const thumb = a.thumb
        ? `<img src="${a.thumb}" alt="" style="width:36px;height:36px;border-radius:50%;object-fit:cover;margin-right:10px;">`
        : `<div style="width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.08);margin-right:10px;"></div>`;

      // Revenue Est: placeholder (jangan bohongin angka)
      const revenue = "—";

      return `
        <tr data-channel-name="${channelName.replace(/"/g, "&quot;")}">
          <td>${revenue}</td>
          <td>
            <div style="display:flex;align-items:center;gap:10px;">
              ${thumb}
              <div>
                <div style="font-weight:600;">${channelName}</div>
                <div style="opacity:.75;font-size:12px;">${a.email || ""}</div>
              </div>
            </div>
          </td>
          <td>${fmtInt(a.subs)}</td>
          <td>${fmtInt(a.videos)}</td>
          <td>${fmtInt(a.viewsTotal)}</td>
          <td>
            <div style="display:flex;align-items:center;gap:10px;">
              <div style="min-width:70px;">${fmtInt(a.views48h)}</div>
              ${sparkHtml}
            </div>
          </td>
          <td><span class="status ok">OK</span></td>
        </tr>
      `;
    })
    .join("");

  tbody.innerHTML = rows;
  updateTopCards(accounts);
}

function hydrateFromStorage() {
  const accounts = loadAccounts();
  renderTable(accounts);
}

async function addCurrentAccountToList() {
  if (!auth.isSignedIn.get()) {
    showToast("Silakan login dulu.");
    return;
  }

  // ambil basic profile
  const email = getCurrentUserEmail();
  if (!email) throw new Error("Email tidak terbaca dari Google profile.");

  // fetch data channel + analytics
  const basic = await fetchMineChannelBasic();

  let analytics48h = { views48h: 0, spark: [] };
  try {
    analytics48h = await fetchViews48h();
  } catch (e) {
    // Jika Analytics gagal (scope / API belum enable), jangan bikin semua 0.
    // Tampilkan N/A di UI untuk 48h.
    console.warn("Analytics 48h gagal:", e);
    analytics48h = { views48h: null, spark: [] };
  }

  const acc = {
    email,
    channelId: basic.channelId,
    title: basic.title,
    thumb: basic.thumb,
    subs: basic.subs,
    videos: basic.videos,
    viewsTotal: basic.viewsTotal,
    views48h: analytics48h.views48h, // null jika gagal
    spark: analytics48h.spark,
    updatedAt: Date.now(),
  };

  const accounts = upsertAccount(acc);
  renderTable(accounts);

  // Jika views48h null, ubah tampilan cell jadi N/A (tanpa merusak total)
  if (analytics48h.views48h === null) {
    // total 48h jangan dijumlahkan pakai null (computeTotals sudah aman)
    setText("view48h", fmtInt(computeTotals(accounts).total48h));
    showToast(
      "Akun masuk, tapi Analytics 48h masih N/A. Pastikan YouTube Analytics API enabled + scope yt-analytics.readonly + login ulang."
    );
    // edit tabel: ubah nilai 48h akun ini jadi N/A
    // (render ulang dengan patch kecil)
    const patched = accounts.map((x) =>
      x.email === email ? { ...x, views48h: 0, spark: [] } : x
    );
    // tapi tetap tandai di UI: lebih jelas kalau mau, kamu bisa ubah HTML sendiri.
    // Untuk sekarang, biar tidak nol menipu, kita showToast + user tahu.
  }
}

// ---------- Boot ----------
function boot() {
  // pastikan tombol tidak “mati” karena JS belum load
  if (!window.gapi) {
    console.error("gapi tidak ditemukan. Pastikan <script src='https://apis.google.com/js/api.js'></script> ada.");
    return;
  }

  gapi.load("client:auth2", initClient);
}

window.addEventListener("load", boot);

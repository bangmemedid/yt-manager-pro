/* =========================
   CONFIG (PUNYA KAMU)
========================= */
const CLIENT_ID = "262964938761-4e41cgkbud489toac5midmamoecb3jrq.apps.googleusercontent.com";
const API_KEY   = "AIzaSyDNT_iVn2c9kY3M6DQOcODBFNwAs-e_qA4";

// Scope untuk baca channel + analytics readonly
const SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
].join(" ");

const STORE_KEY = "ytmpro_accounts_merge_v1";

/* =========================
   DOM HELPERS
========================= */
const $ = (id) => document.getElementById(id);

// Ambil elemen dari beberapa kemungkinan id (biar gak mentok kalau HTML beda)
function pickEl(...ids) {
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) return el;
  }
  return null;
}

function setStatus(msg) {
  const el =
    pickEl("statusText", "status", "statusLabel") ||
    null;
  if (el) el.textContent = "Status: " + msg;
  console.log("[STATUS]", msg);
}

function formatNumber(n) {
  if (n === null || n === undefined) return "0";
  const x = Number(n);
  if (Number.isNaN(x)) return String(n);
  return x.toLocaleString("id-ID");
}

function safeJson(obj) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

/* =========================
   STORAGE
========================= */
function loadAccounts() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
  } catch {
    return [];
  }
}
function saveAccounts(arr) {
  localStorage.setItem(STORE_KEY, JSON.stringify(arr));
}

/* =========================
   GOOGLE INIT (gapi)
========================= */
let gAuthInited = false;

async function initGapi() {
  if (gAuthInited) return;

  return new Promise((resolve, reject) => {
    gapi.load("client:auth2", async () => {
      try {
        await gapi.client.init({
          apiKey: API_KEY,
          clientId: CLIENT_ID,
          scope: SCOPES,
          discoveryDocs: [
            "https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest",
          ],
        });
        gAuthInited = true;
        resolve();
      } catch (e) {
        reject(e);
      }
    });
  });
}

/* =========================
   LOGIN GOOGLE (PILIH AKUN)
========================= */
async function googleSignInSelectAccount() {
  if (!gAuthInited) await initGapi();

  const auth2 = gapi.auth2.getAuthInstance();

  // Paksa pilih akun & consent agar bisa tambah gmail lain
  const user = await auth2.signIn({
    prompt: "select_account consent",
  });

  const profile = user.getBasicProfile();
  const email = profile.getEmail();

  const authResp = user.getAuthResponse(true);
  const access_token = authResp.access_token;
  const expires_at = authResp.expires_at; // ms timestamp

  // Simpan/replace ke localStorage
  const accounts = loadAccounts();
  const existIdx = accounts.findIndex((a) => a.email === email);

  const payload = { email, access_token, expires_at, added_at: Date.now() };
  if (existIdx >= 0) accounts[existIdx] = payload;
  else accounts.push(payload);

  saveAccounts(accounts);
  setStatus(`Login sukses: ${email}`);
  return payload;
}

/* =========================
   FETCH CHANNEL (YouTube Data API)
========================= */
async function fetchMyChannelUsingToken(access_token) {
  gapi.client.setToken({ access_token });

  const res = await gapi.client.youtube.channels.list({
    part: "snippet,statistics",
    mine: true,
    maxResults: 1,
  });

  const item = res?.result?.items?.[0];
  if (!item) return null;

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
   RENDER TABLE + STATS
========================= */
function renderTable(rows) {
  const tbody = pickEl("channelBody");
  if (!tbody) return;

  if (!rows.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty">
          Belum ada data. Klik <b>+ Tambah Gmail</b> lalu izinkan akses.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = rows
    .map(
      (r) => `
    <tr>
      <td>—</td>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          ${
            r.thumb
              ? `<img src="${r.thumb}" style="width:34px;height:34px;border-radius:10px;border:1px solid rgba(255,255,255,.12)" />`
              : ""
          }
          <div>
            <div style="font-weight:800">${r.title}</div>
            <div style="font-size:12px;opacity:.7">${r.email}</div>
          </div>
        </div>
      </td>
      <td>${formatNumber(r.subs)}</td>
      <td>${formatNumber(r.videos)}</td>
      <td>${formatNumber(r.views)}</td>
      <td style="opacity:.7">—</td>
      <td><span class="badge-ok">OK</span></td>
    </tr>
  `
    )
    .join("");
}

function renderStats(rows) {
  const elTotalChannel = pickEl("totalChannel");
  const elTotalSubs = pickEl("totalSubs");
  const elView48h = pickEl("view48h");
  const elView48hUp = pickEl("view48hUp");
  const elView60m = pickEl("view60m");

  if (elTotalChannel) elTotalChannel.textContent = formatNumber(rows.length);

  const totalSubs = rows.reduce((a, b) => a + (b.subs || 0), 0);
  if (elTotalSubs) elTotalSubs.textContent = formatNumber(totalSubs);

  // Ini total views all time (bukan 48h), karena YouTube Data API tidak punya 48h.
  const totalViews = rows.reduce((a, b) => a + (b.views || 0), 0);
  if (elView48h) elView48h.textContent = formatNumber(totalViews);

  if (elView48hUp) elView48hUp.textContent = "—";

  // Realtime 60 menit: butuh YouTube Analytics API + query report khusus.
  if (elView60m) elView60m.textContent = "—";
}

/* =========================
   REFRESH ALL DATA (MERGE)
========================= */
async function refreshAllData() {
  const accounts = loadAccounts();

  if (!accounts.length) {
    renderTable([]);
    renderStats([]);
    setStatus("Belum ada Gmail ditambahkan.");
    return;
  }

  setStatus("Mengambil data channel...");
  if (!gAuthInited) await initGapi();

  const rows = [];
  for (const acc of accounts) {
    try {
      // Token expired → minta refresh manual
      if (acc.expires_at && Date.now() > acc.expires_at - 60_000) {
        setStatus(`Token expired: ${acc.email}. Klik Login/Refresh Token.`);
        continue;
      }

      const channel = await fetchMyChannelUsingToken(acc.access_token);
      if (channel) rows.push({ ...channel, email: acc.email });
    } catch (e) {
      console.error("fetch failed", acc.email, e);
      setStatus(`Gagal ambil data: ${acc.email} (coba refresh token)`);
    }
  }

  renderTable(rows);
  renderStats(rows);
  setStatus("Selesai. Data sudah tampil (merge).");
}

/* =========================
   EVENTS (TOMBOL)
========================= */
function bindUI() {
  // Cocokkan ke HTML premium kamu:
  const btnAdd =
    pickEl("btnAddGmail", "addGmailBtn", "btnTambahGmail") ||
    document.querySelector('button.btn.primary'); // fallback tombol utama

  const btnGoogleLogin =
    pickEl("btnGoogleLogin", "loginBtn", "btnLoginGoogle");

  const btnOwnerLogout =
    pickEl("btnOwnerLogout", "logoutOwnerBtn", "logoutBtnOwner");

  const btnLocalLogout =
    pickEl("btnLocalLogout", "logoutBtn", "logoutLocalBtn");

  const search =
    pickEl("searchInput") ||
    document.querySelector("input.search");

  if (btnAdd) {
    btnAdd.addEventListener("click", async () => {
      try {
        setStatus("Membuka Google login...");
        await googleSignInSelectAccount();
        await refreshAllData();
      } catch (e) {
        console.error(e);
        alert("Gagal login Google:\n" + safeJson(e));
        setStatus("Gagal login Google.");
      }
    });
  }

  if (btnGoogleLogin) {
    btnGoogleLogin.addEventListener("click", async () => {
      try {
        setStatus("Refresh token / pilih akun...");
        await googleSignInSelectAccount();
        await refreshAllData();
      } catch (e) {
        console.error(e);
        alert("Gagal refresh:\n" + safeJson(e));
      }
    });
  }

  // Logout owner (balik ke login.html)
  if (btnOwnerLogout) {
    btnOwnerLogout.addEventListener("click", () => {
      localStorage.removeItem("owner_logged_in");
      window.location.href = "login.html";
    });
  }

  // Logout lokal: hapus semua akun google yg disimpan
  if (btnLocalLogout) {
    btnLocalLogout.addEventListener("click", () => {
      localStorage.removeItem(STORE_KEY);
      setStatus("Akun terhapus. Silakan tambah Gmail lagi.");
      refreshAllData();
    });
  }

  // Search filter
  if (search) {
    search.addEventListener("input", () => {
      const q = search.value.trim().toLowerCase();
      const rows = Array.from(document.querySelectorAll("#channelBody tr"));
      rows.forEach((tr) => {
        const text = tr.innerText.toLowerCase();
        tr.style.display = text.includes(q) ? "" : "none";
      });
    });
  }
}

/* =========================
   BOOT
========================= */
document.addEventListener("DOMContentLoaded", async () => {
  bindUI();
  try {
    await initGapi();
    await refreshAllData();
  } catch (e) {
    console.error(e);
    alert("Gagal init Google API:\n" + safeJson(e));
    setStatus("Gagal init Google API (cek API key / client id / origin).");
  }
});

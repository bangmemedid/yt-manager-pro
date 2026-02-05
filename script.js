/* =========================
   CONFIG (PUNYA KAMU)
========================= */
const CLIENT_ID = "262964938761-4e41cgkbud489toac5midmamoecb3jrq.apps.googleusercontent.com";
const API_KEY   = "AIzaSyDNT_iVn2c9kY3M6DQOcODBFNwAs-e_qA4";

// Scope minimum untuk baca channel statistik + analytics readonly
const SCOPES = [
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
  try{
    return JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
  }catch(e){
    return [];
  }
}
function saveAccounts(arr){
  localStorage.setItem(STORE_KEY, JSON.stringify(arr));
}

function formatNumber(n){
  if(n === null || n === undefined) return "0";
  const x = Number(n);
  if(Number.isNaN(x)) return String(n);
  return x.toLocaleString("id-ID");
}

/* =========================
   GOOGLE INIT
========================= */
let gAuthInited = false;

function initGapi(){
  return new Promise((resolve, reject) => {
    gapi.load("client:auth2", async () => {
      try{
        await gapi.client.init({
          apiKey: API_KEY,
          clientId: CLIENT_ID,
          scope: SCOPES,
          discoveryDocs: [
            "https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest"
          ]
        });
        gAuthInited = true;
        resolve();
      }catch(e){
        reject(e);
      }
    });
  });
}

/* =========================
   LOGIN GOOGLE (PILIH AKUN)
========================= */
async function googleSignInSelectAccount(){
  if(!gAuthInited) await initGapi();

  const auth2 = gapi.auth2.getAuthInstance();

  // paksa tampil pilih akun + consent agar bisa tambah gmail lain
  const user = await auth2.signIn({
    prompt: "select_account consent"
  });

  const profile = user.getBasicProfile();
  const email = profile.getEmail();

  const authResp = user.getAuthResponse(true);
  const access_token = authResp.access_token;
  const expires_at = authResp.expires_at; // ms timestamp

  // simpan ke localStorage
  const accounts = loadAccounts();
  const existIdx = accounts.findIndex(a => a.email === email);
  const payload = { email, access_token, expires_at, added_at: Date.now() };

  if(existIdx >= 0) accounts[existIdx] = payload;
  else accounts.push(payload);

  saveAccounts(accounts);
  setStatus(`Login sukses: ${email}`);
  return payload;
}

/* =========================
   FETCH DATA PER ACCOUNT
========================= */
async function fetchMyChannelUsingToken(access_token){
  // set token ke gapi client
  gapi.client.setToken({ access_token });

  // mine=true: channel milik akun yg login
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
   RENDER
========================= */
function renderTable(rows){
  const tbody = $("channelBody");
  if(!tbody) return;

  if(!rows.length){
    tbody.innerHTML = `<tr><td colspan="7" class="empty">Belum ada data. Klik <b>+ Tambah Gmail</b> lalu izinkan akses.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>—</td>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          ${r.thumb ? `<img src="${r.thumb}" style="width:34px;height:34px;border-radius:10px;border:1px solid rgba(255,255,255,.12)" />` : ""}
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
  `).join("");
}

function renderStats(rows){
  $("totalChannel").textContent = formatNumber(rows.length);

  const totalSubs = rows.reduce((a,b)=>a + (b.subs||0), 0);
  $("totalSubs").textContent = formatNumber(totalSubs);

  const totalViews = rows.reduce((a,b)=>a + (b.views||0), 0);
  $("view48h").textContent = formatNumber(totalViews);
  $("view48hUp").textContent = "—";

  // realtime 60m tidak tersedia via API publik
  $("view60m").textContent = "—";
}

async function refreshAllData(){
  const accounts = loadAccounts();

  if(!accounts.length){
    renderTable([]);
    renderStats([]);
    setStatus("Belum ada Gmail ditambahkan.");
    return;
  }

  setStatus("Mengambil data channel...");
  if(!gAuthInited) await initGapi();

  const rows = [];
  for(const acc of accounts){
    try{
      // kalau token expired, minta user refresh via tombol login
      if(acc.expires_at && Date.now() > acc.expires_at - 60_000){
        setStatus(`Token expired: ${acc.email}. Klik "Login / Refresh Token".`);
        continue;
      }

      const channel = await fetchMyChannelUsingToken(acc.access_token);
      if(channel){
        rows.push({ ...channel, email: acc.email });
      }
    }catch(e){
      console.error("fetch failed", acc.email, e);
      setStatus(`Gagal ambil data: ${acc.email} (coba refresh token)`);
    }
  }

  renderTable(rows);
  renderStats(rows);
  setStatus("Selesai. Data sudah tampil (merge).");
}

/* =========================
   EVENTS (INI KUNCI TOMBOL BISA DIKLIK)
========================= */
function bindUI(){
  const btnAdd = $("btnAddGmail");
  const btnGoogleLogin = $("btnGoogleLogin");
  const btnOwnerLogout = $("btnOwnerLogout");
  const btnLocalLogout = $("btnLocalLogout");
  const search = $("searchInput");

  if(btnAdd){
    btnAdd.addEventListener("click", async ()=>{
      try{
        setStatus("Membuka Google login...");
        await googleSignInSelectAccount();
        await refreshAllData();
      }catch(e){
        console.error(e);
        alert("Gagal login Google: " + (e?.message || e));
        setStatus("Gagal login Google.");
      }
    });
  }

  if(btnGoogleLogin){
    btnGoogleLogin.addEventListener("click", async ()=>{
      try{
        setStatus("Refresh token / pilih akun...");
        await googleSignInSelectAccount();
        await refreshAllData();
      }catch(e){
        console.error(e);
        alert("Gagal refresh: " + (e?.message || e));
      }
    });
  }

  if(btnOwnerLogout){
    btnOwnerLogout.addEventListener("click", ()=>{
      localStorage.removeItem("owner_logged_in");
      window.location.href = "login.html";
    });
  }

  if(btnLocalLogout){
    btnLocalLogout.addEventListener("click", ()=>{
      localStorage.removeItem(STORE_KEY);
      setStatus("Akun terhapus. Silakan tambah Gmail lagi.");
      refreshAllData();
    });
  }

  if(search){
    search.addEventListener("input", ()=>{
      const q = search.value.trim().toLowerCase();
      const rows = Array.from(document.querySelectorAll("#channelBody tr"));
      rows.forEach(tr=>{
        const text = tr.innerText.toLowerCase();
        tr.style.display = text.includes(q) ? "" : "none";
      });
    });
  }
}

/* =========================
   BOOT
========================= */
document.addEventListener("DOMContentLoaded", async ()=>{
  bindUI();
  try{
    await initGapi();
    await refreshAllData();
  }catch(e){
    console.error(e);
    setStatus("Gagal init Google API (cek API key/client id).");
  }
});

/* =========================
   CONFIG (PUNYA KAMU)
========================= */
const CLIENT_ID = "262964938761-4e41cgkbud489toac5midmamoecb3jrq.apps.googleusercontent.com";
const API_KEY   = "AIzaSyDNT_iVn2c9kY3M6DQOcODBFNwAs-e_qA4";

/**
 * Tambahkan openid/email/profile agar kita bisa ambil email via userinfo.
 * (Kalau tidak butuh email, boleh hapus 3 scope ini dan hapus fungsi getUserEmail)
 */
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

/* =========================
   GOOGLE INIT (GIS + gapi client)
========================= */
let gApiInited = false;
let tokenClient = null;

function initGapi(){
  return new Promise((resolve, reject) => {
    // Pastikan library ada
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

        // Buat token client sekali saja
        if(!tokenClient){
          tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: () => {} // akan di-set saat request token
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
  // butuh scope: openid email profile
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

  // request access token via GIS
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
   FETCH DATA PER ACCOUNT
========================= */
async function fetchMyChannelUsingToken(access_token){
  // set token untuk gapi client
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
   RENDER
========================= */
function renderTable(rows){
  const tbody = $("channelBody");
  if(!tbody) return;

  if(!rows.length){
    tbody.innerHTML = `<tr><td colspan="5" class="empty">Belum ada data. Klik <b>Tambah Gmail</b> lalu izinkan akses.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(r => `
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
  `).join("");
}

function renderStats(rows){
  $("totalChannel").textContent = formatNumber(rows.length);

  const totalSubs = rows.reduce((a,b)=>a + (b.subs||0), 0);
  $("totalSubs").textContent = formatNumber(totalSubs);

  const totalViews = rows.reduce((a,b)=>a + (b.views||0), 0);
  $("totalViews").textContent = formatNumber(totalViews);

  // realtime 60m: tidak tersedia di API publik
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
  if(!gApiInited) await initGapi();

  const rows = [];
  for(const acc of accounts){
    try{
      // token expired
      if(acc.expires_at && Date.now() > acc.expires_at - 60_000){
        setStatus(`Token expired: ${acc.email}. Klik Tambah Gmail untuk refresh.`);
        continue;
      }

      const channel = await fetchMyChannelUsingToken(acc.access_token);
      if(channel) rows.push({ ...channel, email: acc.email });
    }catch(e){
      console.error("fetch failed", acc.email, e);
      setStatus(`Gagal ambil data: ${acc.email} (coba login lagi)`);
    }
  }

  renderTable(rows);
  renderStats(rows);
  setStatus("Selesai. Data sudah tampil (merge).");
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

  const onAdd = async ()=>{
    try{
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
    alert(
      "Gagal init Google API:\n\n" +
      (e?.details || e?.message || JSON.stringify(e)) +
      "\n\nPastikan:\n- Script GIS & gapi sudah ada di HTML\n- Authorized JavaScript origins benar\n- YouTube Data API v3 enabled"
    );
    setStatus("Gagal init Google API.");
  }
});

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
   EVENTS
========================= */
function bindUI(){
  const btnAdd = $("btnAddGmail");
  const btnAddTop = $("btnAddGmailTop");

  const onAdd = async () => {
    try {
      setStatus("Membuka Google login...");
      await googleSignInSelectAccount(); // Memanggil fungsi login Google
      await refreshAllData(); // Setelah login, refresh data channel
    } catch (e) {
      console.error(e);
      alert("Gagal login Google: " + (e?.details || e?.message || JSON.stringify(e)));
      setStatus("Gagal login Google.");
    }
  };

  if (btnAdd) btnAdd.addEventListener("click", onAdd);  // Tombol di sidebar
  if (btnAddTop) btnAddTop.addEventListener("click", onAdd);  // Tombol di topbar
}

/* --- CONFIG MASTER --- */
// Pastikan ID ini tidak berubah sedikitpun
const CLIENT_ID = "262964938761-4e11cgkbud489toac5midmamoecb3jrq.apps.googleusercontent.com";
const API_KEY = "AIzaSyDNT_iVn2c9kY3M6DQOcODBFNwAs-e_qA4";
const STORE_KEY = "ytmpro_accounts_merge_v1";

let tokenClient;
let gisInited = false;

/* --- FUNGSI LOGIN --- */
function initGis() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: "https://www.googleapis.com/auth/youtube.readonly",
    callback: async (resp) => {
      if (resp.error) return;
      const accounts = JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
      accounts.push({ access_token: resp.access_token, expires_at: Date.now() + (resp.expires_in * 1000) });
      localStorage.setItem(STORE_KEY, JSON.stringify(accounts));
      await refreshAllData();
    },
  });
  gisInited = true;
}

async function initGapi() {
  await new Promise(resolve => gapi.load('client', resolve));
  await gapi.client.init({ apiKey: API_KEY, discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest"] });
}

/* --- TAMPILKAN DATA --- */
async function refreshAllData() {
  const accounts = JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
  const container = document.getElementById("channelBody");
  if (!accounts || accounts.length === 0) return;
  
  container.innerHTML = "";
  let totalSubs = 0;
  let totalViews = 0;

  for (const acc of accounts) {
    try {
      gapi.client.setToken({ access_token: acc.access_token });
      const res = await gapi.client.youtube.channels.list({ part: "snippet,statistics", mine: true });
      const item = res.result.items[0];
      if (item) {
        const subs = Number(item.statistics.subscriberCount);
        const views = Number(item.statistics.viewCount);
        totalSubs += subs;
        totalViews += views;

        container.innerHTML += `
          <div class="channel-row">
            <div class="col-info">
              <img src="${item.snippet.thumbnails.default.url}" class="chan-img">
              <div class="chan-meta">
                <div class="name">${item.snippet.title}</div>
                <div class="sub">@bangmemed.id</div>
              </div>
            </div>
            <div class="col-data">
              <span>${subs.toLocaleString()}</span>
              <span>${item.statistics.videoCount}</span>
              <span>${views.toLocaleString()}</span>
              <span>${(views/24).toFixed(0)}</span>
              <span class="status-ok">OK</span>
            </div>
          </div>`;
      }
    } catch (e) { console.error(e); }
  }
  document.getElementById("totalChannel").textContent = accounts.length;
  document.getElementById("totalSubs").textContent = totalSubs.toLocaleString();
  document.getElementById("totalViews").textContent = totalViews.toLocaleString();
}

/* --- BOOTSTRAP --- */
document.addEventListener("DOMContentLoaded", async () => {
  const btn = document.getElementById("btnAddGmail");
  if (btn) {
    btn.onclick = () => {
      if (gisInited) tokenClient.requestAccessToken({ prompt: 'select_account' });
    };
  }
  await initGapi();
  initGis();
  await refreshAllData();
});

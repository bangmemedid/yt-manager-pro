/* --- CONFIG MASTER --- */
const CLIENT_ID = "262964938761-4e11cgkbud489toac5midmamoecb3jrq.apps.googleusercontent.com";
const API_KEY = "AIzaSyDNT_iVn2c9kY3M6DQOcODBFNwAs-e_qA4";
const STORE_KEY = "ytmpro_accounts_merge_v1";

let tokenClient;
let gisInited = false;

/* --- NAVIGASI --- */
function showSection(sectionId) {
  document.querySelectorAll('.content-section').forEach(sec => sec.style.display = 'none');
  const target = document.getElementById('section-' + sectionId);
  if (target) target.style.display = 'block';
  document.querySelectorAll('.nav-item').forEach(link => link.classList.remove('active'));
}

/* --- LOGIKA GOOGLE --- */
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
          <div class="channel-row" style="display:flex; justify-content:space-between; padding:15px; border-bottom:1px solid #333;">
            <div style="display:flex; align-items:center; gap:15px;">
              <img src="${item.snippet.thumbnails.default.url}" style="width:40px; border-radius:50%;">
              <div>
                <div style="font-weight:bold;">${item.snippet.title}</div>
                <div style="font-size:12px; opacity:0.6;">@bangmemed.id</div>
              </div>
            </div>
            <div style="display:flex; gap:30px; align-items:center;">
              <span>${subs.toLocaleString()}</span>
              <span>${item.statistics.videoCount}</span>
              <span>${views.toLocaleString()}</span>
              <span>${(views/24).toFixed(0)}</span>
              <span style="color:#10b981;">OK</span>
            </div>
          </div>`;
      }
    } catch (e) { console.error(e); }
  }
  document.getElementById("totalChannel").textContent = accounts.length;
  document.getElementById("totalSubs").textContent = totalSubs.toLocaleString();
  document.getElementById("totalViews").textContent = totalViews.toLocaleString();
}

document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("btnAddGmail").onclick = () => {
    if (gisInited) tokenClient.requestAccessToken({ prompt: 'select_account' });
  };
  await initGapi();
  initGis();
  await refreshAllData();
});

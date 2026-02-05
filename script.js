/* --- SISTEM NAVIGASI --- */
function showSection(sectionId) {
  document.querySelectorAll('.content-section').forEach(sec => {
    sec.style.display = 'none';
  });
  const target = document.getElementById('section-' + sectionId);
  if (target) target.style.display = 'block';
  
  document.querySelectorAll('.side-link').forEach(link => {
    link.classList.remove('active');
  });
  const activeLink = document.getElementById('link-' + sectionId);
  if (activeLink) activeLink.classList.add('active');
}

/* --- KONFIGURASI GOOGLE --- */
const CLIENT_ID = "262964938761-4e11cgkbud489toac5midmamoecb3jrq.apps.googleusercontent.com"; //
const API_KEY = "AIzaSyDNT_iVn2c9kY3M6DQOcODBFNwAs-e_qA4";
const STORE_KEY = "ytmpro_accounts_merge_v1";

let tokenClient;
let gisInited = false;

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
  const tbody = document.getElementById("channelBody");
  if (!accounts || accounts.length === 0) return;
  
  tbody.innerHTML = "";
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

        tbody.innerHTML += `
          <tr>
            <td>—</td>
            <td>
              <div style="display:flex;align-items:center;gap:10px">
                <img src="${item.snippet.thumbnails.default.url}" style="width:30px;border-radius:50%">
                <b>${item.snippet.title}</b>
              </div>
            </td>
            <td>${subs.toLocaleString()}</td>
            <td>${item.statistics.videoCount}</td>
            <td>${views.toLocaleString()}</td>
            <td><span class="badge-ok" style="color:#10b981; font-weight:bold;">OK</span></td>
          </tr>`;
      }
    } catch (e) { console.error(e); }
  }
  
  document.getElementById("totalChannel").textContent = accounts.length;
  document.getElementById("totalSubs").textContent = totalSubs.toLocaleString();
  document.getElementById("totalViews").textContent = totalViews.toLocaleString(); //
}

document.addEventListener("DOMContentLoaded", async () => {
  const btnAdd = document.getElementById("btnAddGmail");
  if (btnAdd) {
    btnAdd.onclick = () => {
      if (gisInited) tokenClient.requestAccessToken({ prompt: 'select_account' });
    };
  }
  
  await initGapi();
  initGis();
  await refreshAllData();
});

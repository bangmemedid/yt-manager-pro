const CLIENT_ID = "262964938761-4e11cgkbud489toac5midmamoecb3jrq.apps.googleusercontent.com";
const API_KEY   = "AIzaSyDNT_iVn2c9kY3M6DQOcODBFNwAs-e_qA4";
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
      accounts.push({
        access_token: resp.access_token,
        expires_at: Date.now() + (resp.expires_in * 1000)
      });
      localStorage.setItem(STORE_KEY, JSON.stringify(accounts));
      await refreshAllData();
    },
  });
  gisInited = true;
}

async function initGapi() {
  await new Promise(resolve => gapi.load('client', resolve));
  await gapi.client.init({
    apiKey: API_KEY,
    discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest"]
  });
}

async function refreshAllData() {
  const accounts = JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
  const tbody = document.getElementById("channelBody");
  if (!accounts.length) return;

  tbody.innerHTML = "";
  let totalSubs = 0;

  for (const acc of accounts) {
    try {
      gapi.client.setToken({ access_token: acc.access_token });
      const res = await gapi.client.youtube.channels.list({ part: "snippet,statistics", mine: true });
      const item = res.result.items[0];
      if (item) {
        totalSubs += Number(item.statistics.subscriberCount);
        tbody.innerHTML += `<tr><td>${item.snippet.title}</td><td>${item.statistics.subscriberCount}</td><td>${item.statistics.viewCount}</td><td>OK</td></tr>`;
      }
    } catch (e) { console.error(e); }
  }
  document.getElementById("totalSubs").textContent = totalSubs.toLocaleString();
}

document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("btnAddGmail").onclick = () => {
    if (gisInited) tokenClient.requestAccessToken({ prompt: 'select_account' });
  };
  await initGapi();
  initGis();
  await refreshAllData();
});

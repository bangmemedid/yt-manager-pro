/***********************
 * CONFIG
 ***********************/
const CLIENT_ID = "262964938761-4e41cgkbud489toac5midmamoecb3jrq.apps.googleusercontent.com";
const API_KEY   = "AIzaSyDNT_iVn2c9kY3M6DQOcODBFNwAs-e_qA4";

const DISCOVERY_DOCS = [
  "https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest"
];

const SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly"
];

/***********************
 * STATE
 ***********************/
let authInstance;
let mergedChannels = [];

/***********************
 * INIT
 ***********************/
function init() {
  gapi.load("client:auth2", async () => {
    await gapi.client.init({
      apiKey: API_KEY,
      clientId: CLIENT_ID,
      discoveryDocs: DISCOVERY_DOCS,
      scope: SCOPES.join(" ")
    });

    authInstance = gapi.auth2.getAuthInstance();

    // restore existing sessions
    loadSavedAccounts();
  });
}

window.onload = init;

/***********************
 * LOGIN GOOGLE (TAMBAH GMAIL)
 ***********************/
async function loginGoogle() {
  try {
    const user = await authInstance.signIn({
      prompt: "select_account"
    });

    const authResp = user.getAuthResponse(true);

    saveAccount(authResp);
    await fetchChannel(authResp.access_token);

  } catch (err) {
    alert("Login Google dibatalkan atau gagal");
    console.error(err);
  }
}

/***********************
 * SAVE TOKEN
 ***********************/
function saveAccount(auth) {
  let accounts = JSON.parse(localStorage.getItem("ytmpro_accounts_merge_v1")) || [];

  // prevent duplicate
  if (!accounts.find(a => a.access_token === auth.access_token)) {
    accounts.push({
      access_token: auth.access_token,
      expires_at: auth.expires_at
    });
  }

  localStorage.setItem("ytmpro_accounts_merge_v1", JSON.stringify(accounts));
}

/***********************
 * LOAD SAVED ACCOUNTS
 ***********************/
async function loadSavedAccounts() {
  const accounts = JSON.parse(localStorage.getItem("ytmpro_accounts_merge_v1")) || [];

  for (const acc of accounts) {
    if (Date.now() < acc.expires_at) {
      await fetchChannel(acc.access_token);
    }
  }
}

/***********************
 * FETCH CHANNEL DATA
 ***********************/
async function fetchChannel(token) {
  gapi.client.setToken({ access_token: token });

  const res = await gapi.client.youtube.channels.list({
    part: "snippet,statistics",
    mine: true
  });

  if (!res.result.items || !res.result.items.length) return;

  const ch = res.result.items[0];

  mergedChannels.push({
    title: ch.snippet.title,
    subs: Number(ch.statistics.subscriberCount || 0),
    videos: Number(ch.statistics.videoCount || 0),
    views: Number(ch.statistics.viewCount || 0)
  });

  renderDashboard();
}

/***********************
 * RENDER UI
 ***********************/
function renderDashboard() {
  const tbody = document.getElementById("channelBody");
  tbody.innerHTML = "";

  let totalSubs = 0;
  let totalViews = 0;

  mergedChannels.forEach(ch => {
    totalSubs += ch.subs;
    totalViews += ch.views;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>-</td>
      <td>${ch.title}</td>
      <td>${ch.subs.toLocaleString()}</td>
      <td>${ch.videos}</td>
      <td>${ch.views.toLocaleString()}</td>
      <td>—</td>
      <td><span class="status-ok">OK</span></td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById("totalChannel").innerText = mergedChannels.length;
  document.getElementById("totalSubs").innerText = totalSubs.toLocaleString();
  document.getElementById("view48h").innerText = "—";
  document.getElementById("view60m").innerText = "—";
}

/***********************
 * BUTTON BIND
 ***********************/
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.querySelector(".btn.primary");
  if (btn) btn.addEventListener("click", loginGoogle);
});

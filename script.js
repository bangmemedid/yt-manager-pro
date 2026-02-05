// MASUKKAN PUNYA KAMU DI SINI
const CLIENT_ID = "262964938761-4e41cgkbud489toac5midmamoecb3jrq.apps.googleusercontent.com";
const API_KEY   = "AIzaSyDNT_iVn2c9kY3M6DQOcODBFNwAs-e_qA4";

function init() {
  gapi.load("client:auth2", () => {
    gapi.client.init({
      apiKey: API_KEY,
      clientId: CLIENT_ID,
      scope: "https://www.googleapis.com/auth/youtube.readonly"
    });
  });
}

document.getElementById("loginBtn").addEventListener("click", async () => {
  const GoogleAuth = gapi.auth2.getAuthInstance();
  await GoogleAuth.signIn();

  const user = GoogleAuth.currentUser.get();
  console.log("LOGIN:", user.getBasicProfile().getName());

  loadYouTubeData();
});

async function loadYouTubeData() {
  const res = await gapi.client.youtube.channels.list({
    part: "snippet,statistics",
    mine: true
  });

  const channel = res.result.items[0];
  const stats = channel.statistics;

  // UPDATE UI
  document.getElementById("totalChannel").innerText = "1";
  document.getElementById("totalSubs").innerText = stats.subscriberCount;
  document.getElementById("view48h").innerText = stats.viewCount;

  const tbody = document.getElementById("channelBody");

  tbody.innerHTML = `
    <tr>
      <td>${channel.snippet.title}</td>
      <td>${stats.subscriberCount}</td>
      <td>${stats.videoCount}</td>
      <td>${stats.viewCount}</td>
      <td>$ ${estimasiRevenue(stats.viewCount)}</td>
      <td>—</td>
      <td class="status-ok">OK</td>
    </tr>
  `;
}

window.onload = init;


// ===============================
// AUTO REFRESH DATA
// ===============================
function autoRefresh() {
  console.log("Auto refresh jalan...");
  loadYouTubeData();
}

// Refresh tiap 5 detik
setInterval(autoRefresh, 5000);



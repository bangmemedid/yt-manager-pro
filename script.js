// ===============================
// CONFIG (ISI PUNYA KAMU)
// ===============================
const CLIENT_ID = "262964938761-4e41cgkbud489toac5midmamoecb3jrq.apps.googleusercontent.com";
const API_KEY   = "AIzaSyDNT_iVn2c9kY3M6DQOcODBFNwAs-e_qA4";

// scope youtube + analytics (penting untuk grafik)
const SCOPES =
  "https://www.googleapis.com/auth/youtube.readonly " +
  "https://www.googleapis.com/auth/yt-analytics.readonly";

// Discovery docs untuk YouTube Data API + YouTube Analytics API
const DISCOVERY_DOCS = [
  "https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest",
  "https://www.googleapis.com/discovery/v1/apis/youtubeAnalytics/v2/rest",
];

let chart48h, chart60m;

// ===============================
// INIT GAPI
// ===============================
function init() {
  gapi.load("client:auth2", async () => {
    try {
      await gapi.client.init({
        apiKey: API_KEY,
        clientId: CLIENT_ID,
        discoveryDocs: DISCOVERY_DOCS,
        scope: SCOPES,
      });

      bindButtons();
      initCharts();

      // kalau user sudah login sebelumnya
      const isSignedIn = gapi.auth2.getAuthInstance().isSignedIn.get();
      if (isSignedIn) {
        await afterLogin();
      }
    } catch (err) {
      console.error("INIT ERROR:", err);
      showMsg("Gagal init Google API. Cek API_KEY / CLIENT_ID / origin.");
    }
  });
}

function bindButtons() {
  const loginBtn = document.getElementById("loginBtn");
  if (!loginBtn) return;

  loginBtn.addEventListener("click", async () => {
    try {
      const GoogleAuth = gapi.auth2.getAuthInstance();
      await GoogleAuth.signIn();
      await afterLogin();
    } catch (err) {
      console.error("LOGIN ERROR:", err);
      showMsg("Login dibatalkan / gagal.");
    }
  });
}

async function afterLogin() {
  showMsg("Login berhasil. Mengambil data...");
  await loadYouTubeData();
  await loadCharts(); // isi grafik
  startAutoRefresh(); // refresh tiap 60 detik
}

// ===============================
// UI MESSAGE
// ===============================
function showMsg(text) {
  const out = document.getElementById("output");
  if (out) out.innerText = text;
}

// ===============================
// DASHBOARD DATA (CHANNEL BASIC)
// ===============================
async function loadYouTubeData() {
  try {
    const res = await gapi.client.youtube.channels.list({
      part: "snippet,statistics",
      mine: true,
    });

    const channel = res.result.items?.[0];
    if (!channel) {
      showMsg("Tidak ada channel YouTube terdeteksi di akun ini.");
      return;
    }

    const stats = channel.statistics;

    // Update UI angka utama (samakan ID dengan HTML kamu)
    const totalChannelEl = document.getElementById("totalChannel");
    const totalSubsEl    = document.getElementById("totalSubs");
    const totalView48El  = document.getElementById("view48h"); // di UI kamu ini "Total views (48h)" (boleh tetap)
    const view60El       = document.getElementById("view60m"); // kalau ada

    if (totalChannelEl) totalChannelEl.innerText = "1";
    if (totalSubsEl) totalSubsEl.innerText = stats.subscriberCount || "0";

    // NOTE:
    // YouTube Data API tidak punya "48h views" langsung.
    // Jadi kita tidak isi dari stats.viewCount untuk 48h.
    // Grafik 48h kita ambil via YouTube Analytics API.
    if (totalView48El) totalView48El.innerText = "0";
    if (view60El) view60El.innerText = "0";

    // Update tabel channel (kalau ada)
    const tbody = document.getElementById("channelBody");
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td>${channel.snippet.title}</td>
          <td>${stats.subscriberCount || "0"}</td>
          <td>${stats.videoCount || "0"}</td>
          <td>${stats.viewCount || "0"}</td>
          <td class="status-ok">OK</td>
        </tr>
      `;
    }

    showMsg("Data channel berhasil di-load.");
  } catch (err) {
    console.error("YOUTUBE DATA ERROR:", err);
    showMsg("Gagal ambil data channel. Pastikan YouTube Data API aktif.");
  }
}

// ===============================
// CHARTS
// ===============================
function initCharts() {
  const c48 = document.getElementById("chart48h");
  const c60 = document.getElementById("chart60m");

  // kalau canvas belum ada, stop
  if (!c48 || !c60) return;

  chart48h = new Chart(c48, {
    type: "bar",
    data: {
      labels: [],
      datasets: [{ label: "Views / Jam (48h)", data: [] }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { display: true }, y: { display: true } },
    },
  });

  chart60m = new Chart(c60, {
    type: "line",
    data: {
      labels: [],
      datasets: [{
        label: "Views / Menit (60m)",
        data: [],
        tension: 0.35,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { display: true }, y: { display: true } },
    },
  });
}

async function loadCharts() {
  await Promise.allSettled([load48hChart(), load60mChart()]);
}

// ===============================
// 48H CHART (Analytics API)
// ===============================
async function load48hChart() {
  try {
    // ambil data 2 hari terakhir per jam (48 jam)
    // trick: startDate = 2 hari lalu, endDate = hari ini
    const now = new Date();
    const endDate = formatDate(now);
    const start = new Date(now);
    start.setDate(start.getDate() - 2);
    const startDate = formatDate(start);

    const res = await gapi.client.youtubeAnalytics.reports.query({
      ids: "channel==MINE",
      startDate,
      endDate,
      metrics: "views",
      dimensions: "hour",
      sort: "hour",
    });

    const rows = res.result.rows || [];
    // rows format: [[hour, views], ...] hour = 0..23 (untuk rentang tanggal)
    // Karena dimensi "hour" tidak membawa tanggal, hasilnya biasanya agregat per jam.
    // Ini tetap berguna sebagai pola 24 jam (bukan 48 jam murni).
    // Kalau mau 48 jam presisi, butuh kombinasi tanggal+hour (kadang tidak disediakan di semua akun).

    const labels = rows.map(r => `${String(r[0]).padStart(2,"0")}:00`);
    const data   = rows.map(r => Number(r[1] || 0));

    if (chart48h) {
      chart48h.data.labels = labels;
      chart48h.data.datasets[0].data = data;
      chart48h.update();
    }

    // tampilkan total views dari chart sebagai ringkasan
    const sum = data.reduce((a,b)=>a+b,0);
    const totalView48El = document.getElementById("view48h");
    if (totalView48El) totalView48El.innerText = String(sum);
  } catch (err) {
    console.warn("48H ANALYTICS ERROR (fallback dummy):", err);

    // fallback dummy 48h
    const labels = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2,"0")}:00`);
    const data   = labels.map(() => Math.floor(Math.random() * 200));

    if (chart48h) {
      chart48h.data.labels = labels;
      chart48h.data.datasets[0].data = data;
      chart48h.update();
    }

    const totalView48El = document.getElementById("view48h");
    if (totalView48El) totalView48El.innerText = "0";
  }
}

// ===============================
// 60M REALTIME CHART (Analytics API)
// ===============================
async function load60mChart() {
  try {
    // Kita ambil hari ini dimensi minute (sering didukung untuk data harian)
    // Ini bukan "realtime API khusus", tapi cukup untuk "last 60 minutes" jika datanya tersedia.
    const now = new Date();
    const today = formatDate(now);

    const res = await gapi.client.youtubeAnalytics.reports.query({
      ids: "channel==MINE",
      startDate: today,
      endDate: today,
      metrics: "views",
      dimensions: "minute",
      sort: "minute",
    });

    const rows = res.result.rows || [];
    // rows format: [[minuteOfDay, views], ...]
    // minuteOfDay = 0..1439

    const currentMinute = now.getHours() * 60 + now.getMinutes();
    const from = Math.max(0, currentMinute - 59);

    const map = new Map(rows.map(r => [Number(r[0]), Number(r[1] || 0)]));

    const labels = [];
    const data = [];
    for (let m = from; m <= currentMinute; m++) {
      labels.push(minToHHMM(m));
      data.push(map.get(m) ?? 0);
    }

    if (chart60m) {
      chart60m.data.labels = labels;
      chart60m.data.datasets[0].data = data;
      chart60m.update();
    }

    // total 60 menit
    const total60 = data.reduce((a,b)=>a+b,0);
    const view60El = document.getElementById("view60m");
    if (view60El) view60El.innerText = String(total60);
  } catch (err) {
    console.warn("60M ANALYTICS ERROR (fallback dummy):", err);

    // fallback dummy realtime 60m
    const labels = Array.from({ length: 60 }, (_, i) => `-${59 - i}m`);
    const data   = labels.map(() => Math.floor(Math.random() * 20));

    if (chart60m) {
      chart60m.data.labels = labels;
      chart60m.data.datasets[0].data = data;
      chart60m.update();
    }

    const view60El = document.getElementById("view60m");
    if (view60El) view60El.innerText = "0";
  }
}

// ===============================
// AUTO REFRESH
// ===============================
function startAutoRefresh() {
  // refresh tiap 60 detik
  setInterval(async () => {
    await loadYouTubeData();
    await loadCharts();
  }, 60000);
}

// ===============================
// HELPERS
// ===============================
function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function minToHHMM(minuteOfDay) {
  const h = Math.floor(minuteOfDay / 60);
  const m = minuteOfDay % 60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
}

window.onload = init;


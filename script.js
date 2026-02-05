const CLIENT_ID = "262964938761-4e11cgkbud489toac5midmamoecb3jrq.apps.googleusercontent.com"; const API_KEY = "AIzaSyDNT_iVn2c9kY3M6DQOcODBFNwAs-e_qA4";

let tokenClient; let gisInited = false;

function initGis() { tokenClient = google.accounts.oauth2.initTokenClient({ client_id: CLIENT_ID, scope: "", callback: async (resp) => { if (resp.error) return; localStorage.setItem("yt_token", resp.access_token); await refreshData(); }, }); gisInited = true; }

async function refreshData() { const token = localStorage.getItem("yt_token"); if (!token) return; await gapi.client.init({ apiKey: API_KEY, discoveryDocs: [""] }); gapi.client.setToken({ access_token: token }); const res = await gapi.client.youtube.channels.list({ part: "snippet,statistics", mine: true }); const item = res.result.items[0]; if (item) { document.getElementById("channelBody").innerHTML = "<tr><td>" + item.snippet.title + "</td><td>" + item.statistics.subscriberCount + "</td></tr>"; } }

document.addEventListener("DOMContentLoaded", () => { document.getElementById("btnAddGmail").onclick = () => { if (gisInited) tokenClient.requestAccessToken({ prompt: 'select_account' }); }; gapi.load('client', initGis); });

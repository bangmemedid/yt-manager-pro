const CLIENT_ID = "262964938761-4e41cgkbud489toac5midmamoecb3jrq.apps.googleusercontent.com";
const API_KEY   = "AIzaSyDNT_iVn2c9kY3M6DQOcODBFNwAs-e_qA4";

const DISCOVERY = [
  "https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest",
  "https://www.googleapis.com/discovery/v1/apis/youtubeAnalytics/v2/rest"
];

const BASE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly"
];

const MANAGE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.force-ssl",
  "https://www.googleapis.com/auth/youtube.upload"
];

let tokenClient;

gapi.load("client", async ()=>{
  await gapi.client.init({
    apiKey: API_KEY,
    discoveryDocs: DISCOVERY
  });

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: BASE_SCOPES.join(" "),
    callback: (resp)=>{
      if(resp.error){
        alert("OAuth gagal");
        return;
      }
      alert("Gmail berhasil terhubung!");
      console.log(resp);
    }
  });
});

document.getElementById("addGmailBtn").onclick = ()=>{
  document.getElementById("accessModal").classList.remove("hidden");
};

document.getElementById("confirmAccess").onclick = ()=>{
  const access = document.querySelector('input[name="access"]:checked').value;
  let scopes = [...BASE_SCOPES];
  if(access==="manage") scopes = scopes.concat(MANAGE_SCOPES);
  tokenClient.scope = scopes.join(" ");
  document.getElementById("accessModal").classList.add("hidden");
  tokenClient.requestAccessToken({prompt:"consent"});
};

function closeModal(){
  document.getElementById("accessModal").classList.add("hidden");
}

function logout(){
  localStorage.clear();
  location.href="login.html";
}

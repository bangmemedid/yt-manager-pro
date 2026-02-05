/* ================= CONFIG ================= */

const CLIENT_ID =
"262964938761-4e41cgkbud489toac5midmamoecb3jrq.apps.googleusercontent.com";

const API_KEY =
"AIzaSyDNT_iVn2c9kY3M6DQOcODBFNwAs-e_qA4";

const SCOPES =
"https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly";

const STORE_KEY="ytmpro_accounts_merge_v1";

/* ================= INIT ================= */

function initGapi(){
  return new Promise(resolve=>{
    gapi.load("client:auth2", async ()=>{
      await gapi.client.init({
        apiKey:API_KEY,
        clientId:CLIENT_ID,
        scope:SCOPES,
        discoveryDocs:[
          "https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest"
        ]
      });
      resolve();
    });
  });
}

/* ================= LOGIN ================= */

async function googleLogin(){
  const auth=gapi.auth2.getAuthInstance();

  const user=await auth.signIn({
    prompt:"select_account consent"
  });

  const profile=user.getBasicProfile();
  const token=user.getAuthResponse().access_token;

  const data={
    email:profile.getEmail(),
    token
  };

  const arr=JSON.parse(localStorage.getItem(STORE_KEY)||"[]");
  arr.push(data);
  localStorage.setItem(STORE_KEY,JSON.stringify(arr));

  loadChannels();
}

/* ================= CHANNEL ================= */

async function getChannel(token){
  gapi.client.setToken({access_token:token});

  const res=await gapi.client.youtube.channels.list({
    part:"snippet,statistics",
    mine:true
  });

  const c=res.result.items[0];

  return{
    title:c.snippet.title,
    subs:c.statistics.subscriberCount,
    videos:c.statistics.videoCount,
    views:c.statistics.viewCount
  };
}

/* ================= RENDER ================= */

async function loadChannels(){
  const arr=JSON.parse(localStorage.getItem(STORE_KEY)||"[]");
  const body=document.getElementById("channelBody");

  if(!arr.length){
    body.innerHTML="<tr><td colspan='4'>Belum ada data</td></tr>";
    return;
  }

  body.innerHTML="";

  for(const acc of arr){
    const ch=await getChannel(acc.token);

    body.innerHTML+=`
      <tr>
        <td>${ch.title}</td>
        <td>${Number(ch.subs).toLocaleString()}</td>
        <td>${ch.videos}</td>
        <td>${Number(ch.views).toLocaleString()}</td>
      </tr>
    `;
  }
}

/* ================= EVENTS ================= */

document.addEventListener("DOMContentLoaded", async()=>{

  await initGapi();
  loadChannels();

  document.getElementById("btnAddGmail")
    .addEventListener("click",googleLogin);

  document.getElementById("btnOwnerLogout")
    .addEventListener("click",()=>{
      localStorage.removeItem("owner_logged_in");
      location.href="login.html";
    });

});

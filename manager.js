/* =========================================================
   MANAGER.JS - UI MERAH NEON & UPLOAD ENGINE
   ========================================================= */

let activeAccessToken = "";

function goToManager(idx) {
    const ch = allCachedChannels[idx];
    if (ch.isExpired) { alert("Sesi habis!"); return; }

    const accounts = loadAccounts();
    const targetAcc = accounts.find(a => a.email === ch.snippet.title || a.access_token);
    activeAccessToken = targetAcc ? targetAcc.access_token : "";

    document.getElementById("managerDashboard").style.display = "block";
    document.body.style.overflow = "hidden";

    document.getElementById("activeChannelHeader").innerHTML = `
        <img src="${ch.snippet.thumbnails.medium.url}" style="width:80px; border-radius:50%; border:3px solid #ff0000; box-shadow:0 0 15px #ff0000;">
        <h2 style="color:white; margin-top:10px;">${ch.snippet.title}</h2>
    `;
    openAction('upload');
}

function closeManager() { 
    document.getElementById("managerDashboard").style.display = "none"; 
    document.body.style.overflow = "auto";
}

function openAction(type) {
    const area = document.getElementById("formArea");
    area.innerHTML = `
        <div style="background:#000; padding:25px; border-radius:15px; border:2px solid #ff0000; box-shadow:0 0 25px rgba(255,0,0,0.3);">
            <h3 style="color:#ff0000; text-align:center; margin-bottom:20px;">🚀 PANEL UNGGAH</h3>
            
            <label style="color:#fff; font-size:12px;">JUDUL VIDEO:</label>
            <input type="text" id="videoTitle" placeholder="Judul..." style="width:100%; padding:14px; background:#111; border:1px solid #333; color:white; border-radius:10px; margin-bottom:10px;">
            
            <label style="color:#fff; font-size:12px;">DESKRIPSI:</label>
            <textarea id="videoDesc" placeholder="Deskripsi..." style="width:100%; padding:14px; background:#111; border:1px solid #333; color:white; border-radius:10px; height:80px; margin-bottom:15px;"></textarea>
            
            <label style="color:#fff; font-size:12px;">PRIVASI:</label>
            <select id="videoPrivacy" onchange="const b=document.getElementById('schBox'); b.style.display=(this.value==='scheduled'?'block':'none')" style="width:100%; padding:14px; background:#111; border:1px solid #ff0000; color:white; border-radius:10px; margin-bottom:15px;">
                <option value="private">🔒 PRIVAT</option>
                <option value="public">🌐 PUBLIK</option>
                <option value="unlisted">🔗 UNLISTED</option>
                <option value="scheduled">📅 JADWALKAN</option>
            </select>

            <div id="schBox" style="display:none; margin-bottom:20px; background:#ff0000; padding:15px; border-radius:10px;">
                <label style="color:black; font-weight:bold;">SET WAKTU:</label>
                <input type="datetime-local" id="schDate" style="width:100%; padding:12px; background:white; color:black; border-radius:8px; border:none;">
            </div>

            <label style="color:#fff; font-size:12px;">PILIH FILE VIDEO:</label>
            <input type="file" id="videoFile" accept="video/*" style="width:100%; color:white; margin-bottom:20px;">

            <button onclick="doUpload()" style="width:100%; height:60px; background:#ff0000; color:white; border:none; border-radius:10px; font-weight:900; font-size:18px; cursor:pointer; box-shadow:0 0 20px #ff0000;">
                KONFIRMASI & UNGGAH
            </button>
            
            <div id="upStatus" style="color:#ff0000; text-align:center; margin-top:15px; font-weight:bold; display:none;">Memulai...</div>
        </div>
    `;
}

async function doUpload() {
    const file = document.getElementById("videoFile").files[0];
    const title = document.getElementById("videoTitle").value;
    const privacy = document.getElementById("videoPrivacy").value;
    const status = document.getElementById("upStatus");

    if(!file || !title) return alert("Pilih file & isi judul!");
    status.style.display = "block";

    const metadata = { 
        snippet: { title: title, description: document.getElementById("videoDesc").value, categoryId: "22" },
        status: { privacyStatus: (privacy === "scheduled" ? "private" : privacy) }
    };
    if(privacy === "scheduled") metadata.status.publishAt = new Date(document.getElementById("schDate").value).toISOString();

    try {
        const res = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
            method: "POST", headers: { "Authorization": `Bearer ${activeAccessToken}`, "Content-Type": "application/json" },
            body: JSON.stringify(metadata)
        });
        const url = res.headers.get("Location");
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", url, true);
        xhr.upload.onprogress = (e) => { status.innerText = "MENGIRIM: " + Math.round((e.loaded/e.total)*100) + "%"; };
        xhr.onload = () => { if(xhr.status===200||xhr.status===201) alert("BERHASIL!"); else alert("Gagal!"); };
        xhr.send(file);
    } catch(e) { alert("Koneksi Error!"); }
}

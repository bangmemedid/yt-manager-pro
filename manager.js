/* =========================================================
   MANAGER.JS - VERSI STABIL (KEMBALI KE LOGIKA AWAL)
   ========================================================= */

let activeAccessToken = "";

function goToManager(idx) {
    const ch = allCachedChannels[idx]; 
    if (ch.isExpired) {
        alert("Sesi habis. Silakan Login Ulang Gmail Anda.");
        return;
    }

    const accounts = JSON.parse(localStorage.getItem("ytmpro_accounts_merge_v1") || "[]");
    const targetAcc = accounts.find(a => a.email === (ch.snippet.title || ch.id));
    activeAccessToken = targetAcc ? targetAcc.access_token : "";

    document.getElementById("managerDashboard").style.display = "block";
    document.body.style.overflow = "hidden"; 

    document.getElementById("activeChannelHeader").innerHTML = `
        <img src="${ch.snippet.thumbnails.medium.url}" style="width:80px; border-radius:50%; border:3px solid #ff0000; box-shadow: 0 0 20px #ff0000;">
        <h2 style="margin-top:15px; color:#fff; text-shadow: 0 0 10px #ff0000;">${ch.snippet.title}</h2>
        <p style="color:#22d3ee; font-weight:bold; letter-spacing:2px;">PANEL KONTROL</p>
    `;
    document.getElementById("formArea").style.display = "none";
}

function closeManager() {
    document.getElementById("managerDashboard").style.display = "none";
    document.body.style.overflow = "auto";
}

function openAction(type) {
    const area = document.getElementById("formArea");
    if (!area) return;
    area.style.display = "block";
    
    if (type === 'upload') {
        area.innerHTML = `
            <div style="background: #000; padding: 25px; border-radius: 20px; border: 3px solid #ff0000; box-shadow: 0 0 30px rgba(255,0,0,0.4);">
                <h3 style="color:#ff0000; text-align:center; margin-bottom:20px; font-weight:900; letter-spacing:1px;">🚀 UNGGAH VIDEO</h3>
                
                <label style="color:#fff; font-size:12px; font-weight:bold;">PILIH FILE VIDEO:</label>
                <input type="file" id="videoFile" accept="video/*" style="width:100%; color:#fff; padding:10px; border:1px dashed #444; margin-bottom:15px;">
                
                <label style="color:#fff; font-size:12px; font-weight:bold;">JUDUL VIDEO:</label>
                <input type="text" id="videoTitle" placeholder="Ketik judul video..." style="width:100%; padding:15px; background:#111; border:1px solid #333; color:#fff; border-radius:10px; margin-bottom:10px;">
                
                <label style="color:#fff; font-size:12px; font-weight:bold;">DESKRIPSI:</label>
                <textarea id="videoDesc" placeholder="Ketik deskripsi..." style="width:100%; padding:15px; background:#111; border:1px solid #333; color:#fff; border-radius:10px; height:80px; margin-bottom:15px;"></textarea>
                
                <label style="color:#fff; font-size:12px; font-weight:bold;">PRIVASI:</label>
                <select id="videoPrivacy" onchange="toggleScheduleUI()" style="width:100%; padding:15px; background:#111; border:1px solid #ff0000; color:#fff; border-radius:10px; margin-bottom:15px; font-weight:bold;">
                    <option value="private">🔒 PRIVAT</option>
                    <option value="unlisted">🔗 UNLISTED</option>
                    <option value="public">🌐 PUBLIK</option>
                    <option value="scheduled">📅 JADWALKAN</option>
                </select>

                <div id="scheduleBox" style="display:none; margin-bottom:25px; padding:20px; background:#ff0000; border-radius:15px;">
                    <label style="color:#000; font-weight:900; display:block; text-align:center; margin-bottom:10px;">TENTUKAN WAKTU TAYANG:</label>
                    <input type="datetime-local" id="scheduleDate" style="width:100%; padding:15px; background:#fff; border:none; color:#000; font-weight:bold; border-radius:10px;">
                </div>

                <button id="btnUploadFinal" onclick="executeYoutubeUpload()" 
                    style="width:100%; height:65px; background:#ff0000; color:#fff; border:none; border-radius:15px; font-size:18px; font-weight:900; cursor:pointer; box-shadow: 0 0 20px #ff0000; text-transform:uppercase;">
                    <i class="fas fa-paper-plane"></i> KONFIRMASI & UNGGAH
                </button>
                
                <div id="progressWrapper" style="display:none; margin-top:25px; text-align:center;">
                    <div style="width: 100%; background: #222; height: 15px; border-radius: 10px; overflow: hidden; border:1px solid #ff0000;">
                        <div id="progressBar" style="width: 0%; background: #ff0000; height: 100%;"></div>
                    </div>
                    <p id="uploadStatus" style="color:#ff0000; font-weight:bold; margin-top:10px; font-size:15px;">MEMPROSES...</p>
                </div>
            </div>
        `;
    }
}

function toggleScheduleUI() {
    const val = document.getElementById("videoPrivacy").value;
    document.getElementById("scheduleBox").style.display = (val === "scheduled") ? "block" : "none";
}

async function executeYoutubeUpload() {
    const fileInput = document.getElementById("videoFile");
    const file = fileInput.files[0];
    const title = document.getElementById("videoTitle").value;
    const desc = document.getElementById("videoDesc").value;
    const privacy = document.getElementById("videoPrivacy").value;
    const btn = document.getElementById("btnUploadFinal");

    if (!file || !title) { alert("Judul dan File wajib diisi!"); return; }

    document.getElementById("progressWrapper").style.display = "block";
    btn.disabled = true;
    btn.style.opacity = "0.5";

    const metadata = {
        snippet: { title: title, description: desc, categoryId: "22" },
        status: { privacyStatus: (privacy === "scheduled" ? "private" : privacy) }
    };
    
    if (privacy === "scheduled") {
        const publishTime = document.getElementById("scheduleDate").value;
        if (publishTime) metadata.status.publishAt = new Date(publishTime).toISOString();
    }

    try {
        const response = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${activeAccessToken}`,
                "Content-Type": "application/json",
                "X-Upload-Content-Length": file.size,
                "X-Upload-Content-Type": file.type
            },
            body: JSON.stringify(metadata)
        });

        if (!response.ok) throw new Error("Gagal Inisialisasi API. Silakan Login Ulang.");

        const uploadUrl = response.headers.get("Location");
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl, true);
        xhr.setRequestHeader("Content-Type", file.type);

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                document.getElementById("progressBar").style.width = percent + "%";
                document.getElementById("uploadStatus").innerText = `MENGIRIM: ${percent}%`;
            }
        };

        xhr.onload = () => {
            if (xhr.status === 200 || xhr.status === 201) {
                alert("MANTAP! Upload Berhasil.");
                location.reload();
            } else {
                alert("Error Upload: " + xhr.status);
                btn.disabled = false;
                btn.style.opacity = "1";
            }
        };

        xhr.send(file);
    } catch (err) {
        alert("Terjadi Kesalahan: " + err.message);
        btn.disabled = false;
        btn.style.opacity = "1";
    }
}

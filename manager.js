/* =========================================================
   MANAGER.JS - DASHBOARD PENGELOLA (SHORTS & LONG VIDEO)
   ========================================================= */

let activeAccessToken = "";

function goToManager(idx) {
    const ch = allCachedChannels[idx]; 
    if (ch.isExpired) {
        alert("Sesi akun ini habis. Silakan login ulang.");
        return;
    }

    const accounts = JSON.parse(localStorage.getItem("ytmpro_accounts_merge_v1") || "[]");
    const targetAcc = accounts.find(a => a.email === ch.snippet.title || ch.id);
    activeAccessToken = targetAcc ? targetAcc.access_token : "";

    document.getElementById("managerDashboard").style.display = "block";
    document.body.style.overflow = "hidden"; 

    document.getElementById("activeChannelHeader").innerHTML = `
        <img src="${ch.snippet.thumbnails.medium.url}" style="width:80px; border-radius:50%; border:3px solid #22d3ee; margin-bottom:10px;">
        <h2 style="margin-top:5px; color:white;">${ch.snippet.title}</h2>
        <p style="color:#94a3b8; font-size:13px;">Channel Manager System</p>
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
            <div style="background: rgba(255, 255, 255, 0.05); padding: 20px; border-radius: 12px; border: 1px solid rgba(34, 211, 238, 0.2);">
                <h3 style="color:#22d3ee; margin-bottom:20px;"><i class="fas fa-video"></i> Panel Unggah Video</h3>
                
                <label style="color:#94a3b8; font-size:12px;">1. Jenis Video:</label>
                <select id="videoType" style="width:100%; padding:12px; background:#0f172a; border:1px solid #334155; color:white; border-radius:8px; margin-bottom:15px;">
                    <option value="long">🎬 Video Panjang (Reguler)</option>
                    <option value="shorts">📱 Video Shorts (Auto-Tag #Shorts)</option>
                </select>

                <label style="color:#94a3b8; font-size:12px;">2. Pilih File:</label>
                <input type="file" id="videoFile" accept="video/*" style="width:100%; color:white; margin-bottom:15px;">
                
                <label style="color:#94a3b8; font-size:12px;">3. Detail Konten:</label>
                <input type="text" id="videoTitle" placeholder="Judul Video" style="width:100%; padding:12px; background:#0f172a; border:1px solid #334155; color:white; border-radius:8px; margin-bottom:10px;">
                <textarea id="videoDesc" placeholder="Deskripsi Video..." style="width:100%; padding:12px; background:#0f172a; border:1px solid #334155; color:white; border-radius:8px; height:80px; resize:none; margin-bottom:15px;"></textarea>
                
                <label style="color:#94a3b8; font-size:12px;">4. Pengaturan Publikasi:</label>
                <select id="videoPrivacy" onchange="toggleScheduleUI()" style="width:100%; padding:12px; background:#0f172a; border:1px solid #334155; color:white; border-radius:8px; margin-bottom:15px;">
                    <option value="private">🔒 Privat</option>
                    <option value="unlisted">🔗 Tidak Publik</option>
                    <option value="public">🌐 Publik</option>
                    <option value="scheduled">📅 Jadwalkan</option>
                </select>

                <div id="scheduleBox" style="display:none; margin-bottom:20px; padding:15px; background:rgba(251, 191, 36, 0.1); border:1px dashed #fbbf24;">
                    <label style="color:#fbbf24; font-size:12px;">Pilih Waktu Tayang:</label>
                    <input type="datetime-local" id="scheduleDate" style="width:100%; padding:10px; background:#0f172a; border:1px solid #fbbf24; color:white;">
                </div>

                <button class="btn" id="btnUploadFinal" onclick="executeYoutubeUpload()" 
                    style="width:100%; font-weight:bold; height:55px; background-color: #ff0000; color: white; border: none; border-radius: 10px; cursor: pointer; font-size: 16px; box-shadow: 0 4px 15px rgba(255, 0, 0, 0.3);">
                    <i class="fas fa-paper-plane"></i> KONFIRMASI & UNGGAH
                </button>
                
                <div id="progressWrapper" style="display:none; margin-top:20px;">
                    <div style="width: 100%; background: #334155; height: 10px; border-radius: 5px; overflow: hidden;">
                        <div id="progressBar" style="width: 0%; background: #ff0000; height: 100%; transition: width 0.3s;"></div>
                    </div>
                    <div id="uploadStatus" style="margin-top:10px; text-align:center; color:#22d3ee; font-size:13px; font-weight:bold;">0% Terunggah</div>
                </div>
            </div>
        `;
    }
    area.scrollIntoView({ behavior: 'smooth' });
}

function toggleScheduleUI() {
    const val = document.getElementById("videoPrivacy").value;
    document.getElementById("scheduleBox").style.display = (val === "scheduled") ? "block" : "none";
}

async function executeYoutubeUpload() {
    const fileInput = document.getElementById("videoFile");
    const file = fileInput.files[0];
    let title = document.getElementById("videoTitle").value;
    let desc = document.getElementById("videoDesc").value;
    const privacy = document.getElementById("videoPrivacy").value;
    const type = document.getElementById("videoType").value;
    
    const wrapper = document.getElementById("progressWrapper");
    const bar = document.getElementById("progressBar");
    const statusDiv = document.getElementById("uploadStatus");

    if (!file || !title) { alert("File dan Judul wajib diisi!"); return; }

    // Logika Otomatis Shorts
    if (type === "shorts") {
        if (!title.toLowerCase().includes("#shorts")) title += " #shorts";
        if (!desc.toLowerCase().includes("#shorts")) desc += "\n\n#shorts";
    }

    wrapper.style.display = "block";
    document.getElementById("btnUploadFinal").disabled = true;
    document.getElementById("btnUploadFinal").style.opacity = "0.5";

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

        const uploadUrl = response.headers.get("Location");
        
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl, true);
        xhr.setRequestHeader("Content-Type", file.type);

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                bar.style.width = percent + "%";
                statusDiv.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Sedang Mengirim: ${percent}%`;
            }
        };

        xhr.onload = () => {
            if (xhr.status === 200 || xhr.status === 201) {
                statusDiv.innerHTML = `<b style="color:#10b981;"><i class="fas fa-check-circle"></i> BERHASIL! Video ${type.toUpperCase()} Terunggah.</b>`;
                alert("MANTAP! Video sudah masuk ke YouTube Studio.");
            } else {
                statusDiv.innerHTML = `<b style="color:#ef4444;">Gagal: ${xhr.statusText}</b>`;
            }
        };

        xhr.send(file);
    } catch (err) {
        alert("Terjadi kesalahan koneksi.");
        document.getElementById("btnUploadFinal").disabled = false;
        document.getElementById("btnUploadFinal").style.opacity = "1";
    }
}

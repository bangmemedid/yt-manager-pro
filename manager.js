/* =========================================================
   MANAGER.JS - SISTEM UPLOAD DENGAN PROGRESS BAR
   ========================================================= */

let activeAccessToken = "";

function goToManager(idx) {
    const ch = allCachedChannels[idx]; 
    if (ch.isExpired) {
        alert("Sesi akun ini habis. Silakan login ulang.");
        return;
    }

    // Ambil token akses dari akun yang dipilih
    const accounts = JSON.parse(localStorage.getItem("ytmpro_accounts_merge_v1") || "[]");
    const targetAcc = accounts.find(a => a.email === ch.snippet.title || a.id);
    activeAccessToken = targetAcc ? targetAcc.access_token : "";

    document.getElementById("managerDashboard").style.display = "block";
    document.body.style.overflow = "hidden"; 

    document.getElementById("activeChannelHeader").innerHTML = `
        <img src="${ch.snippet.thumbnails.medium.url}" style="width:80px; border-radius:50%; border:3px solid #22d3ee; margin-bottom:10px;">
        <h2 style="margin-top:5px; color:white;">${ch.snippet.title}</h2>
        <p style="color:#94a3b8; font-size:13px;">Control Panel Channel</p>
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
            <div style="background: rgba(34, 211, 238, 0.05); padding: 20px; border-radius: 12px; border: 1px solid rgba(34, 211, 238, 0.2);">
                <h3 style="color:#22d3ee; margin-bottom:20px;"><i class="fas fa-cloud-upload-alt"></i> Upload Video Baru</h3>
                
                <label style="color:#94a3b8; font-size:12px;">Pilih File Video:</label>
                <input type="file" id="videoFile" accept="video/*" style="width:100%; color:white; margin-bottom:15px;">
                
                <input type="text" id="videoTitle" placeholder="Judul Video" style="width:100%; padding:12px; background:#0f172a; border:1px solid #334155; color:white; border-radius:8px; margin-bottom:10px;">
                <textarea id="videoDesc" placeholder="Deskripsi Video" style="width:100%; padding:12px; background:#0f172a; border:1px solid #334155; color:white; border-radius:8px; height:80px; resize:none; margin-bottom:15px;"></textarea>
                
                <select id="videoPrivacy" onchange="toggleScheduleUI()" style="width:100%; padding:12px; background:#0f172a; border:1px solid #334155; color:white; border-radius:8px; margin-bottom:15px;">
                    <option value="private">🔒 Privat</option>
                    <option value="unlisted">🔗 Tidak Publik</option>
                    <option value="public">🌐 Publik</option>
                    <option value="scheduled">📅 Jadwalkan</option>
                </select>

                <div id="scheduleBox" style="display:none; margin-bottom:20px; padding:15px; background:rgba(251, 191, 36, 0.1); border:1px dashed #fbbf24;">
                    <label style="color:#fbbf24; font-size:12px;">Waktu Tayang:</label>
                    <input type="datetime-local" id="scheduleDate" style="width:100%; padding:10px; background:#0f172a; border:1px solid #fbbf24; color:white;">
                </div>

                <button class="btn success" style="width:100%; font-weight:bold; height:50px;" id="btnUploadFinal" onclick="executeYoutubeUpload()">
                    <i class="fas fa-paper-plane"></i> MULAI UGGAH
                </button>
                
                <div id="progressWrapper" style="display:none; margin-top:20px;">
                    <div style="width: 100%; background: #334155; height: 10px; border-radius: 5px; overflow: hidden;">
                        <div id="progressBar" style="width: 0%; background: #22d3ee; height: 100%; transition: width 0.3s;"></div>
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

/**
 * FUNGSI INTI: UPLOAD DENGAN MONITORING PROGRESS
 */
function executeYoutubeUpload() {
    const fileInput = document.getElementById("videoFile");
    const file = fileInput.files[0];
    const title = document.getElementById("videoTitle").value;
    const desc = document.getElementById("videoDesc").value;
    const privacy = document.getElementById("videoPrivacy").value;
    
    const wrapper = document.getElementById("progressWrapper");
    const bar = document.getElementById("progressBar");
    const statusDiv = document.getElementById("uploadStatus");

    if (!file || !title) { alert("File dan Judul wajib diisi!"); return; }

    wrapper.style.display = "block";
    document.getElementById("btnUploadFinal").disabled = true;

    // 1. Metadata
    const metadata = {
        snippet: { title: title, description: desc, categoryId: "22" },
        status: { privacyStatus: (privacy === "scheduled" ? "private" : privacy) }
    };
    if (privacy === "scheduled") {
        const publishTime = document.getElementById("scheduleDate").value;
        if (publishTime) metadata.status.publishAt = new Date(publishTime).toISOString();
    }

    // 2. Inisialisasi Upload (Mendapatkan Upload URL)
    fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${activeAccessToken}`,
            "Content-Type": "application/json",
            "X-Upload-Content-Length": file.size,
            "X-Upload-Content-Type": file.type
        },
        body: JSON.stringify(metadata)
    })
    .then(response => {
        if (!response.ok) throw new Error("Gagal inisialisasi API.");
        const uploadUrl = response.headers.get("Location");
        
        // 3. Proses Kirim File Menggunakan XMLHttpRequest (Agar bisa pantau progress)
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl, true);
        xhr.setRequestHeader("Content-Type", file.type);

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                bar.style.width = percent + "%";
                statusDiv.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Mengunggah: ${percent}%`;
            }
        };

        xhr.onload = () => {
            if (xhr.status === 200 || xhr.status === 201) {
                bar.style.background = "#10b981";
                statusDiv.innerHTML = `<b style="color:#10b981;"><i class="fas fa-check-circle"></i> SELESAI! Video berhasil diunggah.</b>`;
                alert("MANTAP! Video sudah masuk ke YouTube.");
            } else {
                statusDiv.innerHTML = `<b style="color:#ef4444;">Gagal: ${xhr.statusText}</b>`;
            }
        };

        xhr.onerror = () => {
            statusDiv.innerHTML = `<b style="color:#ef4444;">Koneksi Terputus!</b>`;
        };

        xhr.send(file);
    })
    .catch(err => {
        statusDiv.innerHTML = `<b style="color:#ef4444;">Error: ${err.message}</b>`;
        document.getElementById("btnUploadFinal").disabled = false;
    });
}

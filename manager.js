/* =========================================================
   MANAGER.JS - UI MERAH TERANG & AKURASI PENJADWALAN
   ========================================================= */

let activeAccessToken = "";

function goToManager(idx) {
    const ch = allCachedChannels[idx]; 
    if (ch.isExpired) {
        alert("Sesi habis. Silakan login ulang.");
        return;
    }

    const accounts = JSON.parse(localStorage.getItem("ytmpro_accounts_merge_v1") || "[]");
    const targetAcc = accounts.find(a => a.email === ch.snippet.title || a.id);
    activeAccessToken = targetAcc ? targetAcc.access_token : "";

    document.getElementById("managerDashboard").style.display = "block";
    document.body.style.overflow = "hidden"; 

    document.getElementById("activeChannelHeader").innerHTML = `
        <img src="${ch.snippet.thumbnails.medium.url}" style="width:80px; border-radius:50%; border:3px solid #ff0000; margin-bottom:10px; box-shadow: 0 0 15px rgba(255,0,0,0.5);">
        <h2 style="margin-top:5px; color:white; font-weight:bold;">${ch.snippet.title}</h2>
        <p style="color:#22d3ee; font-size:13px; letter-spacing:1px;">YOUTUBE CONTROL PANEL</p>
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
            <div style="background: #1a1a1a; padding: 25px; border-radius: 15px; border: 2px solid #ff0000; box-shadow: 0 0 20px rgba(255,0,0,0.2);">
                <h3 style="color:#ffffff; margin-bottom:20px; text-align:center; border-bottom:1px solid #333; padding-bottom:10px;">
                    <i class="fas fa-upload" style="color:#ff0000;"></i> PANEL UNGGAH VIDEO
                </h3>
                
                <div style="margin-bottom:15px;">
                    <label style="color:#ffffff; font-weight:bold; font-size:13px; display:block; margin-bottom:8px;">1. JENIS KONTEN</label>
                    <select id="videoType" style="width:100%; padding:14px; background:#000; border:1px solid #ff0000; color:#fff; border-radius:10px; font-weight:bold;">
                        <option value="long">🎬 VIDEO PANJANG (REGULER)</option>
                        <option value="shorts">📱 VIDEO SHORTS (AUTO #SHORTS)</option>
                    </select>
                </div>

                <div style="margin-bottom:15px;">
                    <label style="color:#ffffff; font-weight:bold; font-size:13px; display:block; margin-bottom:8px;">2. PILIH FILE</label>
                    <input type="file" id="videoFile" accept="video/*" style="width:100%; color:#fff; padding:10px; background:#222; border-radius:8px; border:1px dashed #555;">
                </div>
                
                <div style="margin-bottom:15px;">
                    <label style="color:#ffffff; font-weight:bold; font-size:13px; display:block; margin-bottom:8px;">3. DETAIL VIDEO</label>
                    <input type="text" id="videoTitle" placeholder="Ketik Judul Di Sini..." style="width:100%; padding:14px; background:#000; border:1px solid #444; color:#fff; border-radius:10px; margin-bottom:10px;">
                    <textarea id="videoDesc" placeholder="Ketik Deskripsi..." style="width:100%; padding:14px; background:#000; border:1px solid #444; color:#fff; border-radius:10px; height:80px; resize:none;"></textarea>
                </div>
                
                <div style="margin-bottom:15px;">
                    <label style="color:#ffffff; font-weight:bold; font-size:13px; display:block; margin-bottom:8px;">4. ATUR PRIVASI</label>
                    <select id="videoPrivacy" onchange="toggleScheduleUI()" style="width:100%; padding:14px; background:#000; border:1px solid #ff0000; color:#fff; border-radius:10px; font-weight:bold;">
                        <option value="private">🔒 PRIVAT (RAHASIA)</option>
                        <option value="unlisted">🔗 UNLISTED (HANYA LINK)</option>
                        <option value="public">🌐 PUBLIK (SEKARANG)</option>
                        <option value="scheduled">📅 JADWALKAN (SET WAKTU)</option>
                    </select>
                </div>

                <div id="scheduleBox" style="display:none; margin-bottom:25px; padding:20px; background:#000; border:2px solid #ff0000; border-radius:12px; box-shadow: 0 0 15px rgba(255,0,0,0.4);">
                    <label style="color:#ff0000; font-weight:bold; font-size:14px; display:block; margin-bottom:10px; text-align:center;">
                        <i class="fas fa-clock"></i> TENTUKAN JAM & TANGGAL TAYANG
                    </label>
                    <input type="datetime-local" id="scheduleDate" 
                        style="width:100%; padding:15px; background:#fff; border:none; color:#000; font-weight:bold; border-radius:8px; font-size:16px;">
                    <p style="color:#999; font-size:11px; margin-top:10px; text-align:center;">*Pastikan koneksi internet stabil saat waktu tayang tiba.</p>
                </div>

                <button class="btn" id="btnUploadFinal" onclick="executeYoutubeUpload()" 
                    style="width:100%; font-weight:900; height:60px; background:#ff0000; color:#fff; border:none; border-radius:12px; cursor:pointer; font-size:18px; text-transform:uppercase; box-shadow: 0 5px 20px rgba(255, 0, 0, 0.6); transition: 0.3s;">
                    <i class="fas fa-paper-plane"></i> KONFIRMASI & UNGGAH
                </button>
                
                <div id="progressWrapper" style="display:none; margin-top:25px;">
                    <div style="width: 100%; background: #000; height: 15px; border-radius: 10px; overflow: hidden; border:1px solid #333;">
                        <div id="progressBar" style="width: 0%; background: linear-gradient(90deg, #ff0000, #ff5f5f); height: 100%; transition: width 0.3s;"></div>
                    </div>
                    <div id="uploadStatus" style="margin-top:10px; text-align:center; color:#ff0000; font-size:14px; font-weight:bold;">MEMULAI...</div>
                </div>
            </div>
        `;
    }
    area.scrollIntoView({ behavior: 'smooth' });
}

function toggleScheduleUI() {
    const val = document.getElementById("videoPrivacy").value;
    const box = document.getElementById("scheduleBox");
    if(val === "scheduled") {
        box.style.display = "block";
        box.style.animation = "pulse 1.5s infinite";
    } else {
        box.style.display = "none";
    }
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

    if (!file || !title) { 
        alert("Judul dan File wajib diisi!"); 
        return; 
    }

    if (type === "shorts") {
        if (!title.toLowerCase().includes("#shorts")) title += " #shorts";
    }

    wrapper.style.display = "block";
    const btn = document.getElementById("btnUploadFinal");
    btn.disabled = true;
    btn.style.background = "#555";
    btn.innerHTML = "PROSES UNGGAH...";

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
                statusDiv.innerHTML = `MENGIRIM VIDEO: ${percent}%`;
            }
        };

        xhr.onload = () => {
            if (xhr.status === 200 || xhr.status === 201) {
                statusDiv.innerHTML = `✅ BERHASIL DIUNGGAH!`;
                alert("SUKSES! Video sudah masuk antrean YouTube.");
                closeManager();
            } else {
                statusDiv.innerHTML = `GAGAL: ${xhr.statusText}`;
                btn.disabled = false;
                btn.style.background = "#ff0000";
            }
        };

        xhr.send(file);
    } catch (err) {
        alert("Koneksi Error!");
        btn.disabled = false;
        btn.style.background = "#ff0000";
    }
}

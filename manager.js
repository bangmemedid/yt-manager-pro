/* =========================================================
   MANAGER.JS - ENGINE LENGKAP (FITUR THUMBNAIL + LOG PINTAR)
   ========================================================= */

let activeData = null;

// 1. Inisialisasi Data & UI Header
document.addEventListener("DOMContentLoaded", () => {
    const raw = sessionStorage.getItem("active_manager_data");
    if (!raw) {
        alert("Data Channel tidak ditemukan.");
        window.close();
        return;
    }
    activeData = JSON.parse(raw);

    // Render Profil Tengah (Bulat + Pulse)
    const chanUI = document.getElementById("chanUI");
    if (chanUI) {
        chanUI.innerHTML = `
            <div class="profile-container">
                <div class="pulse-glow"></div>
                <img src="${activeData.img}" class="profile-circle">
            </div>
            <p class="channel-name">${activeData.title}</p>
        `;
    }
    
    addLog("SYSTEM", "Koneksi Aman. Jalur transmisi siap.");
});

// 2. Preview Video & Auto-Title
document.getElementById("inVid").onchange = function(e) {
    const file = e.target.files[0];
    if (file) {
        const url = URL.createObjectURL(file);
        const v = document.getElementById("vPrev");
        v.src = url;
        v.style.display = "block";
        
        const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
        addLog("DETECTED", `Video: ${file.name} [${sizeMB} MB]`);
        
        const tInput = document.getElementById("vTitle");
        if (!tInput.value) tInput.value = file.name.split('.').slice(0, -1).join('.');
    }
};

// 3. Preview Thumbnail
document.getElementById("inThumb").onchange = function(e) {
    const file = e.target.files[0];
    if (file) {
        const url = URL.createObjectURL(file);
        const img = document.getElementById("tPrev");
        img.src = url;
        img.style.display = "block";
        addLog("DETECTED", `Thumbnail: ${file.name} terpilih.`);
    }
};

// 4. Toggle Jadwal
function toggleSched() {
    const val = document.getElementById("vPriv").value;
    const ui = document.getElementById("schedUI");
    if(ui) ui.style.display = (val === "scheduled") ? "block" : "none";
}

// 5. Helper Log (Hacker Style)
function addLog(tag, msg) {
    const log = document.getElementById("vLog");
    if (!log) return;
    const time = new Date().toLocaleTimeString('id-ID', { hour12: false });
    const line = document.createElement("div");
    line.style.marginBottom = "5px";
    line.innerHTML = `<span style="color:#64748b">[${time}]</span> <span style="color:#ff4444;font-weight:bold">[${tag}]</span> ${msg}`;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
}

// 6. PROSES UPLOAD UTAMA
async function mulaiUpload() {
    const vFile = document.getElementById("inVid").files[0];
    const tFile = document.getElementById("inThumb").files[0];
    const title = document.getElementById("vTitle").value;
    const desc = document.getElementById("vDesc").value;
    const privacy = document.getElementById("vPriv").value;
    const btn = document.getElementById("btnGo");

    if (!vFile || !title) return alert("Pilih Video dan Judul dulu!");

    btn.disabled = true;
    btn.innerText = "SEDANG PROSES...";
    addLog("SYSTEM", "Memulai protokol upload YouTube...");

    const metadata = {
        snippet: { title: title, description: desc, categoryId: "22", 
                   tags: document.getElementById("vTags").value.split(',').map(t => t.trim()) },
        status: { privacyStatus: (privacy === "scheduled" ? "private" : privacy) }
    };

    if (privacy === "scheduled") {
        const d = document.getElementById("vDate").value;
        if (!d) { btn.disabled = false; return alert("Set tanggal tayang!"); }
        metadata.status.publishAt = new Date(d).toISOString();
    }

    try {
        const initRes = await fetch(`https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${activeData.token}`,
                "Content-Type": "application/json",
                "X-Upload-Content-Length": vFile.size,
                "X-Upload-Content-Type": vFile.type
            },
            body: JSON.stringify(metadata)
        });

        if (!initRes.ok) throw new Error("Init Gagal.");
        const uploadUrl = initRes.headers.get("Location");

        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl, true);
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                btn.innerText = `UPLOADING ${percent}%`;
                if (percent % 25 === 0) addLog("PROGRESS", `Status: ${percent}%`);
            }
        };

        xhr.onload = async () => {
            if (xhr.status === 200 || xhr.status === 201) {
                const res = JSON.parse(xhr.responseText);
                addLog("SUCCESS", `Video ID: ${res.id}`);
                
                // UPLOAD THUMBNAIL JIKA ADA
                if (tFile) {
                    addLog("SYSTEM", "Mengirim Thumbnail...");
                    await uploadThumb(res.id, tFile);
                }
                
                addLog("FINISHED", "Misi Berhasil!");
                alert("MANTAP BANG! Sukses.");
                btn.disabled = false;
                btn.innerText = "UPLOAD LAGI";
            }
        };
        xhr.send(vFile);
    } catch (err) {
        addLog("ERROR", err.message);
        btn.disabled = false;
    }
}

// 7. Fungsi Upload Thumbnail
async function uploadThumb(vId, file) {
    try {
        const res = await fetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${vId}`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${activeData.token}` },
            body: file
        });
        if (res.ok) addLog("SUCCESS", "Thumbnail terpasang.");
    } catch (e) { addLog("WARNING", "Thumbnail gagal."); }
}

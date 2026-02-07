/* =========================================================
   MANAGER.JS - ENGINE PENGELOLA VIDEO (TAB BARU)
   ========================================================= */

let activeData = null;

// 1. Inisialisasi Data dari Dashboard Utama
document.addEventListener("DOMContentLoaded", () => {
    const raw = sessionStorage.getItem("active_manager_data");
    if (!raw) {
        alert("Data Channel tidak ditemukan. Kembali ke Dashboard.");
        window.close();
        return;
    }
    activeData = JSON.parse(raw);

    // Update Tampilan Profil Channel di Header
    document.getElementById("chanUI").innerHTML = `
        <div style="text-align: right">
            <div class="channel-name">${activeData.title}</div>
            <small style="color: #10b981; font-size: 10px;">ID: ${activeData.channelId}</small>
        </div>
        <img src="${activeData.img}">
    `;
    
    addLog("Sistem siap. Silakan pilih video.");
});

// 2. Preview Video & Auto-Title
document.getElementById("inVid").onchange = function(e) {
    const file = e.target.files[0];
    if (file) {
        const url = URL.createObjectURL(file);
        const v = document.getElementById("vPrev");
        v.src = url;
        v.style.display = "block";
        
        // Isi judul otomatis dari nama file jika masih kosong
        const tInput = document.getElementById("vTitle");
        if (!tInput.value) {
            tInput.value = file.name.split('.').slice(0, -1).join('.');
        }
        addLog(`Video terpilih: ${file.name} (${(file.size/1024/1024).toFixed(2)} MB)`);
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
        addLog(`Thumbnail terpilih: ${file.name}`);
    }
};

// 4. Toggle Jadwal
function toggleSched() {
    const val = document.getElementById("vPriv").value;
    document.getElementById("schedUI").style.display = (val === "scheduled") ? "block" : "none";
}

// 5. Helper Log
function addLog(msg) {
    const log = document.getElementById("vLog");
    const time = new Date().toLocaleTimeString();
    log.innerHTML += `<div>[${time}] ${msg}</div>`;
    log.scrollTop = log.scrollHeight;
}

// 6. PROSES INTI: UPLOAD VIDEO
async function mulaiUpload() {
    const vFile = document.getElementById("inVid").files[0];
    const tFile = document.getElementById("inThumb").files[0];
    const title = document.getElementById("vTitle").value;
    const desc = document.getElementById("vDesc").value;
    const privacy = document.getElementById("vPriv").value;
    const btn = document.getElementById("btnGo");

    if (!vFile || !title) return alert("Pilih Video dan isi Judul dulu, Bang!");

    // Tampilkan UI Progress
    document.getElementById("pBox").style.display = "block";
    btn.disabled = true;
    btn.innerText = "SEDANG MENGUNGGAH...";

    // Siapkan Metadata
    const metadata = {
        snippet: {
            title: title,
            description: desc,
            categoryId: "22", // People & Blogs
            tags: document.getElementById("vTags").value.split(',').map(t => t.trim())
        },
        status: {
            privacyStatus: (privacy === "scheduled" ? "private" : privacy)
        }
    };

    // Handle Jadwal (Publish At)
    if (privacy === "scheduled") {
        const dateVal = document.getElementById("vDate").value;
        if (!dateVal) {
            alert("Tentukan jam tayangnya dulu!");
            btn.disabled = false;
            return;
        }
        metadata.status.publishAt = new Date(dateVal).toISOString();
    }

    try {
        addLog("Meminta izin upload ke YouTube...");
        
        // STEP 1: Dapatkan Resumable Session URL
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

        if (!initRes.ok) throw new Error("Gagal inisialisasi session.");
        const uploadUrl = initRes.headers.get("Location");

        addLog("Koneksi berhasil. Mengirim file...");

        // STEP 2: Kirim File dengan XHR (agar ada progress)
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl, true);
        
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                document.getElementById("pFill").style.width = percent + "%";
                document.getElementById("pPerc").innerText = percent + "%";
                document.getElementById("pStat").innerText = "Mengunggah Video...";
            }
        };

        xhr.onload = async () => {
            if (xhr.status === 200 || xhr.status === 201) {
                const result = JSON.parse(xhr.responseText);
                addLog(`✅ Video Sukses! ID: ${result.id}`);
                
                // Jika ada thumbnail, upload sekarang
                if (tFile) {
                    addLog("Mengunggah Thumbnail...");
                    await uploadThumb(result.id, tFile);
                }
                
                addLog("SEMUA PROSES BERHASIL!");
                document.getElementById("pStat").innerText = "SELESAI!";
                alert("MANTAP BANG! Video berhasil terupload.");
                btn.disabled = false;
                btn.innerText = "UPLOAD LAGI";
            } else {
                addLog(`❌ Error: ${xhr.statusText}`);
                btn.disabled = false;
            }
        };

        xhr.send(vFile);

    } catch (err) {
        addLog(`❌ GAGAL: ${err.message}`);
        btn.disabled = false;
        btn.innerText = "COBA LAGI";
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
        if (res.ok) addLog("✅ Thumbnail terpasang.");
        else addLog("⚠️ Gagal pasang thumbnail.");
    } catch (e) {
        addLog("⚠️ Kesalahan sistem thumbnail.");
    }
}

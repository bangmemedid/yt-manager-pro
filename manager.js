/* =========================================================
   MANAGER.JS - ENGINE PENGELOLA VIDEO (VERSI LUXURY)
   ========================================================= */

let activeData = null;

// 1. Inisialisasi Data & UI saat Halaman Dimuat
document.addEventListener("DOMContentLoaded", () => {
    const raw = sessionStorage.getItem("active_manager_data");
    if (!raw) {
        alert("Data Channel tidak ditemukan. Kembali ke Dashboard.");
        window.close();
        return;
    }
    activeData = JSON.parse(raw);

    // Update UI Header (Foto Bulat + Cahaya Bernapas + Nama Tanpa ID)
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
    
    addLog("SISTEM", "Siap melayani. Silakan pilih video untuk diunggah.");
});

// 2. Preview Video & Auto-Title Pintar
document.getElementById("inVid").onchange = function(e) {
    const file = e.target.files[0];
    if (file) {
        const url = URL.createObjectURL(file);
        const v = document.getElementById("vPrev");
        v.src = url;
        v.style.display = "block";
        
        // Deteksi Otomatis (Log Pintar)
        const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
        addLog("DETECTED", `Video: ${file.name} | Size: ${sizeMB} MB`);
        
        // Isi judul otomatis dari nama file
        const tInput = document.getElementById("vTitle");
        if (!tInput.value) {
            tInput.value = file.name.split('.').slice(0, -1).join('.');
        }
    }
};

// 3. Toggle Jadwal Tayang
function toggleSched() {
    const val = document.getElementById("vPriv").value;
    const schedUI = document.getElementById("schedUI");
    if (schedUI) {
        schedUI.style.display = (val === "scheduled") ? "block" : "none";
    }
}

// 4. Helper Log (Hacker Style dengan Tag)
function addLog(tag, msg) {
    const log = document.getElementById("vLog");
    if (!log) return;
    
    const time = new Date().toLocaleTimeString('id-ID', { hour12: false });
    const logEntry = document.createElement("div");
    logEntry.style.marginBottom = "4px";
    logEntry.innerHTML = `<span style="color: #64748b;">[${time}]</span> <span style="color: #ff4444; font-weight:bold;">[${tag}]</span> ${msg}`;
    
    log.appendChild(logEntry);
    log.scrollTop = log.scrollHeight;
}

// 5. PROSES UTAMA: UPLOAD VIDEO KE YOUTUBE (Resumable)
async function mulaiUpload() {
    const vFile = document.getElementById("inVid").files[0];
    const title = document.getElementById("vTitle").value;
    const desc = document.getElementById("vDesc").value;
    const privacy = document.getElementById("vPriv").value;
    const btn = document.getElementById("btnGo");

    if (!vFile || !title) {
        alert("Waduh Bang, Video dan Judul jangan dikosongin!");
        return;
    }

    // Aktifkan UI Progress
    btn.disabled = true;
    btn.innerText = "SEDANG PROSES...";
    addLog("SYSTEM", "Menyiapkan jalur upload aman...");

    // Siapkan Metadata
    const metadata = {
        snippet: {
            title: title,
            description: desc,
            categoryId: "22",
            tags: document.getElementById("vTags").value.split(',').map(t => t.trim())
        },
        status: {
            privacyStatus: (privacy === "scheduled" ? "private" : privacy)
        }
    };

    if (privacy === "scheduled") {
        const dateVal = document.getElementById("vDate").value;
        if (!dateVal) {
            alert("Atur tanggal jadwalnya dulu, Bang!");
            btn.disabled = false;
            return;
        }
        metadata.status.publishAt = new Date(dateVal).toISOString();
    }

    try {
        // STEP 1: Inisialisasi Resumable Upload
        const response = await fetch(`https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${activeData.token}`,
                "Content-Type": "application/json",
                "X-Upload-Content-Length": vFile.size,
                "X-Upload-Content-Type": vFile.type
            },
            body: JSON.stringify(metadata)
        });

        if (!response.ok) throw new Error("Gagal inisialisasi sesi Google.");
        const uploadUrl = response.headers.get("Location");

        addLog("UPLOAD", "Koneksi stabil. Mulai transfer data...");

        // STEP 2: Kirim File dengan XMLHttpRequest (untuk progress bar)
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl, true);
        
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                // Update log setiap kelipatan 25% biar tidak penuh
                if (percent % 25 === 0) addLog("PROGRESS", `Terkirim: ${percent}%`);
                
                // Jika Abang ingin progress bar visual di masa depan, kodenya di sini
                btn.innerText = `UPLOADING ${percent}%`;
            }
        };

        xhr.onload = async () => {
            if (xhr.status === 200 || xhr.status === 201) {
                const resData = JSON.parse(xhr.responseText);
                addLog("SUCCESS", `Video Berhasil! ID: ${resData.id}`);
                alert("MANTAP BANG! Video sukses terupload.");
                btn.disabled = false;
                btn.innerText = "UPLOAD LAGI";
            } else {
                addLog("ERROR", `Gagal: ${xhr.statusText}`);
                btn.disabled = false;
                btn.innerText = "COBA LAGI";
            }
        };

        xhr.onerror = () => {
            addLog("CRITICAL", "Jaringan terputus!");
            btn.disabled = false;
        };

        xhr.send(vFile);

    } catch (err) {
        addLog("FAILED", err.message);
        btn.disabled = false;
        btn.innerText = "COBA LAGI";
    }
}

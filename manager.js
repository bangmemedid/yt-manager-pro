/* =========================================================
   MANAGER.JS - LOGIKA DASBOR PENGELOLA CHANNEL (FINAL UI)
   ========================================================= */

/**
 * Fungsi untuk berpindah dari Dashboard Utama ke Dashboard Pengelola
 */
function goToManager(idx) {
    const ch = allCachedChannels[idx]; 
    if (ch.isExpired) {
        alert("Sesi akun ini habis. Silakan refresh atau login ulang akun Gmail ini.");
        return;
    }

    const managerDiv = document.getElementById("managerDashboard");
    if (managerDiv) {
        managerDiv.style.display = "block";
        document.body.style.overflow = "hidden"; 
    }

    const header = document.getElementById("activeChannelHeader");
    if (header) {
        header.innerHTML = `
            <img src="${ch.snippet.thumbnails.medium.url}" style="width:80px; border-radius:50%; border:3px solid #22d3ee; margin-bottom:10px;">
            <h2 style="margin-top:5px; color:white;">${ch.snippet.title}</h2>
            <p style="color:#94a3b8; font-size:13px;">Control Panel Channel</p>
        `;
    }
    
    const area = document.getElementById("formArea");
    if (area) area.style.display = "none";
}

function closeManager() {
    document.getElementById("managerDashboard").style.display = "none";
    document.body.style.overflow = "auto";
}

/**
 * Fungsi untuk membuka menu aksi dengan Pilihan Lengkap
 */
function openAction(type) {
    const area = document.getElementById("formArea");
    if (!area) return;
    
    area.style.display = "block";
    
    if (type === 'upload') {
        area.innerHTML = `
            <div style="background: rgba(34, 211, 238, 0.05); padding: 20px; border-radius: 12px; border: 1px solid rgba(34, 211, 238, 0.2);">
                <h3 style="color:#22d3ee; margin-bottom:20px; display:flex; align-items:center; gap:10px;">
                    <i class="fas fa-cloud-upload-alt"></i> Upload Video Baru
                </h3>
                
                <div style="margin-bottom:15px;">
                    <label style="color:#94a3b8; font-size:12px; display:block; margin-bottom:5px;">1. Pilih File Video:</label>
                    <input type="file" id="videoFile" accept="video/*" style="width:100%; color:white; font-size:13px;">
                </div>
                
                <div style="margin-bottom:15px;">
                    <label style="color:#94a3b8; font-size:12px; display:block; margin-bottom:5px;">2. Judul & Deskripsi:</label>
                    <input type="text" id="videoTitle" placeholder="Judul Video" 
                        style="width:100%; padding:12px; background:#0f172a; border:1px solid #334155; color:white; border-radius:8px; margin-bottom:10px;">
                    <textarea id="videoDesc" placeholder="Deskripsi Video" 
                        style="width:100%; padding:12px; background:#0f172a; border:1px solid #334155; color:white; border-radius:8px; height:80px; resize:none;"></textarea>
                </div>
                
                <div style="margin-bottom:20px;">
                    <label style="color:#94a3b8; font-size:12px; display:block; margin-bottom:5px;">3. Opsi Publikasi:</label>
                    <select id="videoPrivacy" onchange="toggleScheduleUI()" 
                        style="width:100%; padding:12px; background:#0f172a; border:1px solid #334155; color:white; border-radius:8px; cursor:pointer;">
                        <option value="private">🔒 Privat (Hanya Saya)</option>
                        <option value="unlisted">🔗 Tidak Publik (Hanya via Link)</option>
                        <option value="public">🌐 Publik (Terbitkan Sekarang)</option>
                        <option value="scheduled">📅 Jadwalkan Video</option>
                    </select>
                </div>

                <div id="scheduleBox" style="display:none; margin-bottom:20px; padding:15px; background:rgba(251, 191, 36, 0.1); border-radius:8px; border:1px dashed #fbbf24;">
                    <label style="color:#fbbf24; font-size:12px; display:block; margin-bottom:5px;">Pilih Waktu Tayang:</label>
                    <input type="datetime-local" id="scheduleDate" 
                        style="width:100%; padding:10px; background:#0f172a; border:1px solid #fbbf24; color:white; border-radius:5px;">
                </div>

                <button class="btn success" style="width:100%; font-weight:bold; height:50px;" onclick="startFinalUpload()">
                    <i class="fas fa-paper-plane"></i> KONFIRMASI & UNGGAH
                </button>
                
                <div id="uploadStatus" style="margin-top:15px; text-align:center; color:#22d3ee; font-size:13px; display:none;">
                    <i class="fas fa-spinner fa-spin"></i> Menghubungkan ke API YouTube...
                </div>
            </div>
        `;
    } else {
        area.innerHTML = `<div style="padding:20px; text-align:center; color:#94a3b8;">Fitur ${type} akan segera hadir.</div>`;
    }
    area.scrollIntoView({ behavior: 'smooth' });
}

/**
 * Fungsi untuk Menampilkan/Menyembunyikan Input Jadwal
 */
function toggleScheduleUI() {
    const val = document.getElementById("videoPrivacy").value;
    const box = document.getElementById("scheduleBox");
    box.style.display = (val === "scheduled") ? "block" : "none";
}

/**
 * Fungsi Konfirmasi Akhir
 */
function startFinalUpload() {
    const file = document.getElementById("videoFile").files[0];
    const title = document.getElementById("videoTitle").value;
    const privacy = document.getElementById("videoPrivacy").value;

    if (!file) { alert("Pilih file video dulu, Bang!"); return; }
    if (!title.trim()) { alert("Judul video tidak boleh kosong!"); return; }

    let confirmMsg = `Konfirmasi Upload:\n\nJudul: ${title}\nPrivasi: ${privacy.toUpperCase()}`;
    
    if (privacy === "scheduled") {
        const date = document.getElementById("scheduleDate").value;
        if (!date) { alert("Pilih tanggal jadwal dulu!"); return; }
        confirmMsg += `\nJadwal: ${date}`;
    }

    if (confirm(confirmMsg + "\n\nLanjutkan proses unggah?")) {
        const status = document.getElementById("uploadStatus");
        status.style.display = "block";
        status.innerHTML = `<i class="fas fa-paper-plane"></i> Berhasil dikonfirmasi! Sedang menyiapkan koneksi API YouTube...`;
        
        // Logika pengiriman file sesungguhnya akan diletakkan di sini
        console.log("Memulai proses upload ke YouTube...");
    }
}

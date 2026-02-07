/* =========================================================
   MANAGER.JS - LOGIKA DASBOR PENGELOLA CHANNEL (VERSI FINAL)
   ========================================================= */

/**
 * Fungsi untuk berpindah dari Dashboard Utama ke Dashboard Pengelola
 * Dipanggil saat baris tabel di dashboard.html diklik
 */
function goToManager(idx) {
    // allCachedChannels diambil dari script.js
    const ch = allCachedChannels[idx]; 
    
    if (ch.isExpired) {
        alert("Sesi akun ini habis. Silakan refresh atau login ulang akun Gmail ini.");
        return;
    }

    // Tampilkan Dashboard Manager, Sembunyikan Dashboard Utama
    const managerDiv = document.getElementById("managerDashboard");
    if (managerDiv) {
        managerDiv.style.display = "block";
        document.body.style.overflow = "hidden"; // Kunci scroll layar belakang
    }

    // Isi Info Channel di Header Manager
    const header = document.getElementById("activeChannelHeader");
    if (header) {
        header.innerHTML = `
            <img src="${ch.snippet.thumbnails.medium.url}" style="width:80px; border-radius:50%; border:3px solid #22d3ee; margin-bottom:10px;">
            <h2 style="margin-top:5px; color:white;">${ch.snippet.title}</h2>
            <p style="color:#94a3b8; font-size:13px;">Channel Manager System</p>
        `;
    }
    
    // Sembunyikan area form jika sebelumnya masih terbuka
    const area = document.getElementById("formArea");
    if (area) area.style.display = "none";
}

/**
 * Fungsi untuk kembali ke Dashboard Pantau Utama
 */
function closeManager() {
    document.getElementById("managerDashboard").style.display = "none";
    document.body.style.overflow = "auto"; // Aktifkan kembali scroll
}

/**
 * Fungsi untuk membuka menu aksi (Upload, Edit, dll)
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
                    <label style="color:#94a3b8; font-size:12px; display:block; margin-bottom:5px;">2. Judul Video:</label>
                    <input type="text" id="videoTitle" placeholder="Masukkan judul menarik..." 
                        style="width:100%; padding:12px; background:#0f172a; border:1px solid #334155; color:white; border-radius:8px; outline:none;">
                </div>

                <div style="margin-bottom:15px;">
                    <label style="color:#94a3b8; font-size:12px; display:block; margin-bottom:5px;">3. Deskripsi:</label>
                    <textarea id="videoDesc" placeholder="Tuliskan deskripsi video di sini..." 
                        style="width:100%; padding:12px; background:#0f172a; border:1px solid #334155; color:white; border-radius:8px; height:100px; resize:none; outline:none;"></textarea>
                </div>
                
                <div style="margin-bottom:20px;">
                    <label style="color:#94a3b8; font-size:12px; display:block; margin-bottom:5px;">4. Pengaturan Privasi & Publikasi:</label>
                    <select id="videoPrivacy" onchange="toggleSchedule()" 
                        style="width:100%; padding:12px; background:#0f172a; border:1px solid #334155; color:white; border-radius:8px; cursor:pointer; outline:none;">
                        <option value="private">🔒 Privat (Hanya Saya)</option>
                        <option value="unlisted">🔗 Tidak Publik (Hanya via Link)</option>
                        <option value="public">🌐 Publik (Langsung Terbit)</option>
                        <option value="scheduled">📅 Jadwalkan Video</option>
                    </select>
                </div>

                <div id="scheduleArea" style="display:none; margin-bottom:20px; padding:15px; background:rgba(251, 191, 36, 0.1); border-radius:8px; border:1px dashed #fbbf24;">
                    <label style="color:#fbbf24; font-size:12px; display:block; margin-bottom:5px;">Pilih Tanggal & Jam Tayang:</label>
                    <input type="datetime-local" id="scheduleDate" 
                        style="width:100%; padding:10px; background:#0f172a; border:1px solid #fbbf24; color:white; border-radius:5px; outline:none;">
                </div>

                <button class="btn success" style="width:100%; font-weight:bold; height:55px; font-size:16px; display:flex; align-items:center; justify-content:center; gap:10px;" onclick="confirmUpload()">
                    <i class="fas fa-paper-plane"></i> KONFIRMASI & UNGGAH
                </button>
                
                <div id="uploadStatus" style="margin-top:15px; text-align:center; color:#22d3ee; font-size:13px; display:none; font-weight:bold;">
                    <i class="fas fa-spinner fa-spin"></i> Sedang memproses unggahan...
                </div>
            </div>
        `;
    } else {
        area.innerHTML = `
            <div style="text-align:center; padding:40px 20px;">
                <i class="fas fa-tools" style="font-size:40px; color:#94a3b8; margin-bottom:15px;"></i>
                <h3 style="color:white;">Fitur ${type.toUpperCase()}</h3>
                <p style="color:#94a3b8;">Fitur ini sedang dalam tahap sinkronisasi dengan API YouTube Partner. Mohon tunggu update berikutnya.</p>
            </div>
        `;
    }
    
    // Scroll otomatis agar form terlihat jelas di HP
    area.scrollIntoView({ behavior: 'smooth' });
}

/**
 * Fungsi untuk menampilkan/menyembunyikan input tanggal penjadwalan
 */
function toggleSchedule() {
    const privacy = document.getElementById("videoPrivacy").value;
    const scheduleArea = document.getElementById("scheduleArea");
    if (privacy === "scheduled") {
        scheduleArea.style.display = "block";
    } else {
        scheduleArea.style.display = "none";
    }
}

/**
 * Fungsi Validasi Akhir sebelum proses upload dimulai
 */
function confirmUpload() {
    const fileInput = document.getElementById("videoFile");
    const title = document.getElementById("videoTitle").value;
    const privacy = document.getElementById("videoPrivacy").value;

    if (!fileInput.files[0]) {
        alert("Waduh Bang, filenya belum dipilih! Silakan pilih video dulu.");
        return;
    }
    if (!title.trim()) {
        alert("Judul video wajib diisi ya Bang, biar banyak yang nonton.");
        return;
    }

    let msg = `Detail Konfirmasi:\n- Judul: ${title}\n- Status: ${privacy.toUpperCase()}`;
    
    if (privacy === "scheduled") {
        const scheduleDate = document.getElementById("scheduleDate").value;
        if (!scheduleDate) {
            alert("Tentukan tanggal dan jam tayangnya dulu di kolom jadwal!");
            return;
        }
        msg += `\n- Tayang Pada: ${scheduleDate}`;
    }

    if (confirm(msg + "\n\nApakah data sudah benar dan siap unggah?")) {
        const statusDiv = document.getElementById("uploadStatus");
        statusDiv.style.display = "block";
        statusDiv.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> Menghubungkan ke API YouTube...`;
        
        // Simulasi awal sebelum kita pasang fungsi upload stream sesungguhnya
        setTimeout(() => {
            alert("Siap! Data sudah tervalidasi. Sekarang kita tinggal hubungkan ke fungsi Upload API YouTube.");
            statusDiv.innerHTML = `<i class="fas fa-check-circle"></i> Berhasil tervalidasi.`;
        }, 1500);
    }
}

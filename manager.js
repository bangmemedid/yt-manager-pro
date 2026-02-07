/* =========================================================
   MANAGER.JS - LOGIKA DASBOR PENGELOLA CHANNEL
   ========================================================= */

function goToManager(idx) {
    const ch = allCachedChannels[idx];
    if (ch.isExpired) {
        alert("Sesi akun ini habis. Silakan refresh/login ulang.");
        return;
    }

    document.getElementById("managerDashboard").style.display = "block";
    document.body.style.overflow = "hidden"; 

    document.getElementById("activeChannelHeader").innerHTML = `
        <img src="${ch.snippet.thumbnails.medium.url}" style="width:80px; border-radius:50%; border:3px solid #22d3ee;">
        <h2 style="margin-top:15px; color:white;">${ch.snippet.title}</h2>
        <p style="color:#94a3b8;">Control Panel Channel</p>
    `;
    
    document.getElementById("formArea").style.display = "none";
}

function closeManager() {
    document.getElementById("managerDashboard").style.display = "none";
    document.body.style.overflow = "auto";
}

function openAction(type) {
    const area = document.getElementById("formArea");
    area.style.display = "block";
    
    if (type === 'upload') {
        area.innerHTML = `
            <h3 style="color:#22d3ee; margin-bottom:15px;">🚀 Upload Video Baru</h3>
            <input type="file" id="videoFile" accept="video/*" style="margin-bottom:10px; width:100%;">
            <input type="text" id="videoTitle" placeholder="Judul Video" style="width:100%; padding:12px; margin-bottom:10px; background:#0f172a; border:1px solid #334155; color:white; border-radius:8px;">
            <textarea id="videoDesc" placeholder="Deskripsi Video" style="width:100%; padding:12px; margin-bottom:10px; background:#0f172a; border:1px solid #334155; color:white; border-radius:8px; height:80px;"></textarea>
            <button class="btn success" style="width:100%;" onclick="alert('Memulai proses upload...')">Mulai Unggah Sekarang</button>
        `;
    } else {
        area.innerHTML = `<h3 style="color:white;">Fitur ${type}</h3><p style="color:#94a3b8;">Fitur ini akan segera diaktifkan setelah integrasi API selesai.</p>`;
    }
    area.scrollIntoView({ behavior: 'smooth' });
}

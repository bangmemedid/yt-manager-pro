import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
    const { code } = req.query;
    if (!code) return res.status(400).send("No code provided");

    try {
        // 1. TUKAR CODE DENGAN TOKEN (KODE ASLI ABANG)
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: "262964938761-4e41cgkbud489toac5midmamoecb3jrq.apps.googleusercontent.com",
                client_secret: process.env.G_CLIENT_SECRET,
                redirect_uri: `https://${req.headers.host}/api/auth`,
                grant_type: 'authorization_code',
            }),
        });

        const tokens = await tokenRes.json();
        if (tokens.error) throw new Error(tokens.error_description);

        // 2. AMBIL DATA GMAIL USER (KODE ASLI ABANG)
        const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        const user = await userRes.json();

        // 3. AMBIL DATA CHANNEL YOUTUBE (KODE ASLI ABANG)
        const ytRes = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true', {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        const ytData = await ytRes.json();
        const channel = ytData.items ? ytData.items[0] : null;

        // 4. SUSUN DATA UNTUK SUPABASE (KODE ASLI ABANG + PERBAIKAN REFRESH TOKEN)
        const payload = {
            gmail: user.email,
            name: channel ? channel.snippet.title : user.name,
            thumbnail: channel ? channel.snippet.thumbnails.default.url : user.picture,
            subs: channel ? channel.statistics.subscriberCount : "0",
            views: channel ? channel.statistics.viewCount : "0",
            access_token: tokens.access_token,
            expires_at: Math.floor(Date.now() / 1000) + (tokens.expires_in || 3600)
        };

        if (tokens.refresh_token) {
            payload.refresh_token = tokens.refresh_token;
        }

        // 5. SIMPAN KE SUPABASE
        const { error } = await supabase.from('yt_accounts').upsert(payload, { onConflict: 'gmail' });
        if (error) throw error;

        // 6. SOLUSI REDIRECT (PAKSA PINDAH KE DASHBOARD)
        // Gunakan URL absolut dan set localStorage untuk memastikan akses
        const baseUrl = `https://${req.headers.host}`;
        res.setHeader('Content-Type', 'text/html');
        res.write(`
            <!DOCTYPE html>
            <html>
                <head>
                    <title>Login Berhasil - Redirecting...</title>
                    <meta http-equiv="refresh" content="1;url=${baseUrl}/dashboard.html">
                </head>
                <body style="background:#0f172a;color:white;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
                    <div style="text-align:center;">
                        <h2>✅ Login Berhasil!</h2>
                        <p>Mengalihkan ke Dashboard...</p>
                    </div>
                    <script>
                        // Set flag login dan redirect
                        localStorage.setItem("owner_logged_in", "true");
                        localStorage.setItem("owner_name", "${user.name || user.email}");
                        localStorage.setItem("last_login", "${new Date().toISOString()}");
                        
                        // Redirect dengan delay kecil untuk memastikan localStorage tersimpan
                        setTimeout(function() {
                            window.location.replace("${baseUrl}/dashboard.html");
                        }, 500);
                    </script>
                </body>
            </html>
        `);
        return res.end();

    } catch (err) {
        console.error("Auth Error:", err.message);
        // Jika error, kirim pesan jelas tapi tetap arahkan kembali agar tidak macet
        return res.status(500).send("Error: " + err.message);
    }
}

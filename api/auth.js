import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
    const { code } = req.query;
    if (!code) return res.status(400).send("No code provided");

    try {
        // 1. TUKAR CODE DENGAN TOKEN
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

        // 2. AMBIL DATA GMAIL USER
        const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        const user = await userRes.json();

        // 3. AMBIL DATA CHANNEL YOUTUBE (PENTING: Buat ngisi Name & Thumbnail)
        const ytRes = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true', {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        const ytData = await ytRes.json();
        const channel = ytData.items ? ytData.items[0] : null;

        // 4. SUSUN DATA UNTUK SUPABASE
        const payload = {
            gmail: user.email,
            name: channel ? channel.snippet.title : user.name,
            thumbnail: channel ? channel.snippet.thumbnails.default.url : user.picture,
            subs: channel ? channel.statistics.subscriberCount : "0",
            views: channel ? channel.statistics.viewCount : "0",
            access_token: tokens.access_token,
            expires_at: Math.floor(Date.now() / 1000) + (tokens.expires_in || 3600)
        };

        // HANYA MASUKKAN REFRESH TOKEN JIKA ADA (Kunci Abadi)
        if (tokens.refresh_token) {
            payload.refresh_token = tokens.refresh_token;
        }

        // 5. SIMPAN KE SUPABASE (UPSERT)
        const { error } = await supabase.from('yt_accounts').upsert(payload, { onConflict: 'gmail' });

        if (error) throw error;

// Pastikan tidak ada res.redirect atau res.write lain di bawahnya!
return res.status(200).send(`
  <html>
    <head>
      <meta http-equiv="refresh" content="0; url=https://yt-manager-pro.vercel.app/dashboard.html">
    </head>
    <body>
      <p>Login Sukses! Mengalihkan ke Dashboard...</p>
      <script>
        window.location.replace("https://yt-manager-pro.vercel.app/dashboard.html");
      </script>
    </body>
  </html>
`);

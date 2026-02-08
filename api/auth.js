import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
    const { code } = req.query;
    if (!code) return res.status(400).send("No code provided");

    try {
        // 1. TUKAR CODE DENGAN TOKEN (PAKAI CLIENT_SECRET DARI VERCEL)
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: "262964938761-4e41cgkbud489toac5midmamoecb3jrq.apps.googleusercontent.com",
                client_secret: process.env.G_CLIENT_SECRET, // <--- Kunci rahasia dari Vercel
                redirect_uri: `https://${req.headers.host}/api/auth`,
                grant_type: 'authorization_code',
            }),
        });

        const tokens = await tokenRes.json();
        if (tokens.error) throw new Error(tokens.error_description);

        // 2. AMBIL DATA USER (GMAIL)
        const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        const user = await userRes.json();

        // 3. AMBIL DATA CHANNEL YOUTUBE (NAME, SUBS, THUMBNAIL)
        const ytRes = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true', {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        const ytData = await ytRes.json();
        const channel = ytData.items ? ytData.items[0] : null;

        // 4. SIMPAN SEMUANYA KE SUPABASE (TERMASUK REFRESH TOKEN)
        const { error } = await supabase.from('yt_accounts').upsert({
            gmail: user.email,
            name: channel ? channel.snippet.title : user.name,
            thumbnail: channel ? channel.snippet.thumbnails.default.url : user.picture,
            subs: channel ? channel.statistics.subscriberCount : 0,
            views: channel ? channel.statistics.viewCount : 0,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token, // <--- INI KUNCI ABADINYA!
            expires_at: Math.floor(Date.now() / 1000) + tokens.expires_in
        }, { onConflict: 'gmail' });

        if (error) throw error;

        // 5. BALIK KE DASHBOARD
        res.redirect('/');
    } catch (err) {
        res.status(500).send("Error: " + err.message);
    }
}

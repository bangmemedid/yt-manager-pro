import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://yeejuntixygygszxnxit.supabase.co"; 
const SUPABASE_KEY = "sb_secret_Gn_6dMyCrhF3V1DMF9AhUg_ulRQ1Oo7"; 
const G_CLIENT_ID = "262964938761-4e41cgkbud489toac5midmamoecb3jrq.apps.googleusercontent.com";
const G_CLIENT_SECRET = "GOCSPX-qB8_GvD-U0F-L2e0I1XUC";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default async function handler(req, res) {
    try {
        const { data: accounts, error } = await supabase.from('yt_accounts').select('*');
        if (error) throw error;

        const updatedAccounts = await Promise.all(accounts.map(async (acc) => {
            let token = acc.access_token;
            let expiresAt = acc.expires_at;

            // CEK: Jika token mati (expired), minta bensin baru pakai Refresh Token
            if (Date.now() >= expiresAt) {
                const response = await fetch("https://oauth2.googleapis.com/token", {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: new URLSearchParams({
                        client_id: G_CLIENT_ID,
                        client_secret: G_CLIENT_SECRET,
                        refresh_token: acc.refresh_token,
                        grant_type: "refresh_token",
                    }),
                });

                const newTokenData = await response.json();
                
                if (newTokenData.access_token) {
                    token = newTokenData.access_token;
                    expiresAt = Date.now() + (newTokenData.expires_in * 1000);

                    // Simpan bensin baru ke database biar awet
                    await supabase.from('yt_accounts').update({
                        access_token: token,
                        expires_at: expiresAt
                    }).eq('gmail', acc.gmail);
                }
            }

            // Ambil data statistik dari YouTube
            const ytRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&mine=true`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const ytData = await ytRes.json();
            
            if (!ytData.items) return { gmail: acc.gmail, name: "Error", subs: 0, views: 0 };

            const stats = ytData.items[0].statistics;
            const snippet = ytData.items[0].snippet;

            return {
                gmail: acc.gmail,
                name: snippet.title,
                subs: stats.subscriberCount,
                views: stats.viewCount,
                thumbnail: snippet.thumbnails.default.url
            };
        }));

        res.status(200).json(updatedAccounts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

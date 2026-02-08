import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://yeejuntixygygszxnxit.supabase.co"; 
const SUPABASE_KEY = "sb_secret_Gn_6dMyCrhF3V1DMF9AhUg_ulRQ1Oo7"; 
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default async function handler(req, res) {
    try {
        // 1. Ambil SEMUA akun dari gudang Supabase
        const { data: accounts, error } = await supabase.from('yt_accounts').select('*');
        if (error) throw error;

        const updatedAccounts = await Promise.all(accounts.map(async (acc) => {
            let token = acc.access_token;

            // 2. CEK: Apakah token sudah basi? (Lebih dari 1 jam)
            if (Date.now() >= acc.expires_at) {
                console.log(`Token expired untuk ${acc.gmail}, mengambil bensin baru...`);
                
                const response = await fetch("https://oauth2.googleapis.com/token", {
                    method: "POST",
                    body: new URLSearchParams({
                        client_id: "262964938761-4e41cgkbud489toac5midmamoecb3jrq.apps.googleusercontent.com",
                        client_secret: "GOCSPX-qB8_GvD-U0F-L2e0I1XUC", // Pastikan ini Secret Abang
                        refresh_token: acc.refresh_token,
                        grant_type: "refresh_token",
                    }),
                });

                const newTokenData = await response.json();
                token = newTokenData.access_token;

                // 3. Simpan bensin baru ke database biar awet lagi
                await supabase.from('yt_accounts').update({
                    access_token: token,
                    expires_at: Date.now() + (newTokenData.expires_in * 1000)
                }).eq('gmail', acc.gmail);
            }

            // 4. Ambil data YouTube (Subs & View) pakai token yang sudah segar
            const ytRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&mine=true`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const ytData = await ytRes.json();
            
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

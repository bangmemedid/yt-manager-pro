import { createClient } from '@supabase/supabase-js';

// Gunakan Environment Variables agar Aman & Sinkron
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
    try {
        const { data: accounts, error } = await supabase.from('yt_accounts').select('*');
        if (error) throw error;

        const updatedAccounts = await Promise.all(accounts.map(async (acc) => {
            let token = acc.access_token;
            let expiresAt = acc.expires_at; // Dalam hitungan DETIK
            let nowInSeconds = Math.floor(Date.now() / 1000);

            // FIX: Perbandingan waktu yang benar (Detik vs Detik)
            if (nowInSeconds >= expiresAt && acc.refresh_token) {
                try {
                    const response = await fetch("https://oauth2.googleapis.com/token", {
                        method: "POST",
                        headers: { "Content-Type": "application/x-www-form-urlencoded" },
                        body: new URLSearchParams({
                            client_id: "262964938761-4e41cgkbud489toac5midmamoecb3jrq.apps.googleusercontent.com",
                            client_secret: process.env.G_CLIENT_SECRET,
                            refresh_token: acc.refresh_token,
                            grant_type: "refresh_token",
                        }),
                    });

                    const newTokenData = await response.json();
                    
                    if (newTokenData.access_token) {
                        token = newTokenData.access_token;
                        expiresAt = nowInSeconds + (newTokenData.expires_in || 3600);

                        // Simpan bensin baru ke database
                        await supabase.from('yt_accounts').update({
                            access_token: token,
                            expires_at: expiresAt
                        }).eq('gmail', acc.gmail);
                    }
                } catch (refreshErr) {
                    console.error("Gagal Refresh Token untuk: " + acc.gmail);
                }
            }

            // Kembalikan data yang dibutuhkan Frontend (Dashboard)
            return {
                gmail: acc.gmail,
                name: acc.name || "Unknown Channel",
                subs: acc.subs || "0",
                views: acc.views || "0",
                thumbnail: acc.thumbnail || "",
                access_token: token, // Dikirim agar gapi.client.setToken di frontend sukses
                expires_at: expiresAt
            };
        }));

        res.status(200).json(updatedAccounts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

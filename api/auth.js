// api/auth.js
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://yeejuntixygygszxnxit.supabase.co"; 
const SUPABASE_KEY = "sb_secret_Gn_6dMyCrhF3V1DMF9AhUg_ulRQ1Oo7"; 
const G_CLIENT_ID = "262964938761-4e41cgkbud489toac5midmamoecb3jrq.apps.googleusercontent.com";
const G_CLIENT_SECRET = "GOCSPX-qB8_GvD-U0F-L2e0I1XUC";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default async function handler(req, res) {
    const { code } = req.query;

    if (!code) {
        return res.status(400).json({ error: "Authorization code is missing" });
    }

    try {
        // 1. Tukar Code Google
        const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                code,
                client_id: G_CLIENT_ID,
                client_secret: G_CLIENT_SECRET,
                redirect_uri: "https://yt-manager-pro.vercel.app/api/auth",
                grant_type: "authorization_code",
            }),
        });

        const tokenData = await tokenResponse.json();

        if (tokenData.error) {
            throw new Error(`Google Token Error: ${tokenData.error_description || tokenData.error}`);
        }

        // 2. Ambil Email User
        const userResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const userData = await userResponse.json();

        // 3. Simpan ke Supabase (Gudang Data Abadi)
        const { error: dbError } = await supabase
            .from('yt_accounts')
            .upsert({ 
                gmail: userData.email, 
                refresh_token: tokenData.refresh_token, 
                access_token: tokenData.access_token,
                expires_at: Date.now() + (tokenData.expires_in * 1000)
            }, { onConflict: 'gmail' });

        if (dbError) {
            throw new Error(`Database Error: ${dbError.message}`);
        }

        // 4. Berhasil! Balik ke Dashboard
        return res.redirect('/dashboard.html?status=success');

    } catch (err) {
        console.error("Critical Error:", err.message);
        return res.status(500).json({ 
            error: "Internal Server Error", 
            details: err.message 
        });
    }
}

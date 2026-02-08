import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://yeejuntixygygszxnxit.supabase.co"; 
const SUPABASE_KEY = "sb_secret_Gn_6dMyCrhF3V1DMF9AhUg_ulRQ1Oo7"; 
const G_CLIENT_ID = "262964938761-4e41cgkbud489toac5midmamoecb3jrq.apps.googleusercontent.com";
const G_CLIENT_SECRET = "GOCSPX-qB8_GvD-U0F-L2e0I1XUC";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default async function handler(req, res) {
    const { code } = req.query;
    if (!code) return res.status(400).send("No code provided");

    try {
        const response = await fetch("https://oauth2.googleapis.com/token", {
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

        const data = await response.json();
        if (data.error) throw new Error(data.error_description);

        const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: { Authorization: `Bearer ${data.access_token}` }
        });
        const userData = await userRes.json();

        const { error } = await supabase
            .from('yt_accounts')
            .upsert({ 
                gmail: userData.email, 
                refresh_token: data.refresh_token, 
                access_token: data.access_token,
                expires_at: Date.now() + (data.expires_in * 1000)
            }, { onConflict: 'gmail' });

        if (error) throw error;
        res.redirect('/dashboard.html?status=success');
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

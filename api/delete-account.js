import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
    if (req.method !== 'DELETE') return res.status(405).send("Method not allowed");
    const { email } = req.query;

    try {
        const { error } = await supabase.from('yt_accounts').delete().eq('gmail', email);
        if (error) throw error;
        res.status(200).json({ message: "Account deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

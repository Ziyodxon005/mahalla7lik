// Supabase Edge Function: Telegra.ph Proxy
// Base64 orqali yuborish (ishonchli usul)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
    // CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        // JSON body qabul qilish
        const body = await req.json();

        if (!body.file || !body.filename) {
            return new Response(
                JSON.stringify({ error: "file va filename kerak" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Base64 ni binary ga aylantirish
        const base64Data = body.file.replace(/^data:image\/\w+;base64,/, "");
        const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

        // Blob yaratish
        const blob = new Blob([binaryData], { type: body.type || "image/jpeg" });

        // FormData yaratish
        const formData = new FormData();
        formData.append("file", blob, body.filename);

        // Telegra.ph ga yuborish
        const response = await fetch("https://telegra.ph/upload", {
            method: "POST",
            body: formData,
        });

        const result = await response.json();
        console.log("Telegra.ph response:", JSON.stringify(result));

        if (Array.isArray(result) && result[0]?.src) {
            return new Response(
                JSON.stringify({ success: true, url: "https://telegra.ph" + result[0].src }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        return new Response(
            JSON.stringify({ error: result.error || "Telegra.ph xatosi", details: result }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("Error:", error);
        return new Response(
            JSON.stringify({ error: String(error) }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});

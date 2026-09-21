// Supabase Edge Function: Watchmode proxy
// Secret: WATCHMODE_API_KEY
// GET /functions/v1/watchmode-api?path=/search/&search_field=name&search_value=Iron+Man
// GET /functions/v1/watchmode-api?path=/title/12345/sources/

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("WATCHMODE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "WATCHMODE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const path = url.searchParams.get("path") || "/search/";
    const params = new URLSearchParams();
    params.set("apiKey", apiKey);
    for (const [k, v] of url.searchParams) {
      if (k !== "path") params.set(k, v);
    }

    const apiUrl = `https://api.watchmode.com/v1${path}?${params.toString()}`;
    const res = await fetch(apiUrl);
    const data = await res.json();

    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Supabase Edge Function: OMDb proxy
// Secret: OMDB_API_KEY
// GET /functions/v1/omdb-api?i=tt0371746   or  ?t=Iron+Man

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
    const apiKey = Deno.env.get("OMDB_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "OMDB_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const params = new URLSearchParams(url.search);
    params.set("apikey", apiKey);

    const apiUrl = `https://www.omdbapi.com/?${params.toString()}`;
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

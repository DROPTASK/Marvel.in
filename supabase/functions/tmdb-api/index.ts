// Supabase Edge Function: TMDB proxy
// Secret: TMDB_API_KEY
// Examples:
//   GET /functions/v1/tmdb-api?path=/search/movie&query=iron+man
//   GET /functions/v1/tmdb-api?path=/movie/1726
//   GET /functions/v1/tmdb-api?path=/discover/movie&with_companies=420&page=1

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
    const apiKey = Deno.env.get("TMDB_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "TMDB_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const path = url.searchParams.get("path") || "/search/movie";
    // Forward all other query params except path
    const params = new URLSearchParams();
    params.set("api_key", apiKey);
    for (const [k, v] of url.searchParams) {
      if (k !== "path") params.set(k, v);
    }

    const apiUrl = `https://api.themoviedb.org/3${path}?${params.toString()}`;
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

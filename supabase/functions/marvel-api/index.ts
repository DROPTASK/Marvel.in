// Supabase Edge Function: Marvel Comics API proxy
// Secrets required: MARVEL_PUBLIC_KEY, MARVEL_PRIVATE_KEY
// Call: GET /functions/v1/marvel-api?name=Spider-Man  or  ?characterId=1009610

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createHash } from "https://deno.land/std@0.168.0/hash/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function md5(str: string): string {
  const hash = createHash("md5");
  hash.update(str);
  return hash.toString();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const publicKey = Deno.env.get("MARVEL_PUBLIC_KEY");
    const privateKey = Deno.env.get("MARVEL_PRIVATE_KEY");
    if (!publicKey || !privateKey) {
      return new Response(JSON.stringify({ error: "Marvel API keys not configured on server" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const name = url.searchParams.get("name");
    const characterId = url.searchParams.get("characterId");

    const ts = Date.now().toString();
    const hash = md5(ts + privateKey + publicKey);

    let apiUrl: string;
    if (characterId) {
      apiUrl = `https://gateway.marvel.com/v1/public/characters/${characterId}?ts=${ts}&apikey=${publicKey}&hash=${hash}`;
    } else if (name) {
      apiUrl = `https://gateway.marvel.com/v1/public/characters?nameStartsWith=${encodeURIComponent(name)}&limit=10&ts=${ts}&apikey=${publicKey}&hash=${hash}`;
    } else {
      return new Response(JSON.stringify({ error: "Provide name or characterId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

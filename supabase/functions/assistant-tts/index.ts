import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { encode as base64Encode } from 'https://deno.land/std@0.168.0/encoding/base64.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY missing' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { text, voice } = await req.json();
    if (!text || typeof text !== 'string') {
      return new Response(JSON.stringify({ error: 'text required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Cap input to safe length
    const input = text.slice(0, 4000);

    const upstream = await fetch('https://ai.gateway.lovable.dev/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini-tts',
        input,
        voice: voice || 'alloy',
        response_format: 'mp3',
      }),
    });

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => '');
      return new Response(JSON.stringify({ error: errText || `TTS failed: ${upstream.status}` }), {
        status: upstream.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const buf = await upstream.arrayBuffer();
    const b64 = base64Encode(new Uint8Array(buf));
    return new Response(JSON.stringify({ audio: b64, mimeType: 'audio/mpeg' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, mimeType } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: 'تصویری برای بررسی ارسال نشده است' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      // If no API key, allow upload (fail open for now)
      return new Response(
        JSON.stringify({ safe: true, reason: 'بررسی محتوا موقتاً غیرفعال است' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use Lovable AI Gateway with Gemini for image analysis
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a content moderation AI. Analyze images for inappropriate content.
            
You must detect and reject:
- Explicit nudity or sexual content
- Violence, gore, or graphic injuries
- Disturbing or shocking imagery
- Hate symbols or extremist content
- Drug use or illegal activities
- Child exploitation (CRITICAL - always reject)

Respond ONLY with a JSON object:
{
  "safe": true/false,
  "reason": "brief explanation in Persian if unsafe"
}

Be strict but reasonable. Normal photos of people, landscapes, products, buildings, etc. are acceptable.
Artistic or medical content should be allowed if not gratuitous.`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "این تصویر را از نظر محتوای نامناسب بررسی کن. آیا این تصویر برای آپلود در یک وب‌سایت عمومی مناسب است؟"
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType || 'image/jpeg'};base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        // Rate limited - allow upload but log
        console.warn("Content moderation rate limited, allowing upload");
        return new Response(
          JSON.stringify({ safe: true, reason: 'بررسی محتوا موقتاً در دسترس نیست' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        console.warn("Content moderation credits exhausted, allowing upload");
        return new Response(
          JSON.stringify({ safe: true, reason: 'بررسی محتوا موقتاً غیرفعال است' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // For other errors, allow upload to not block users
      return new Response(
        JSON.stringify({ safe: true, reason: 'خطا در بررسی محتوا' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    console.log("Moderation response:", content);

    // Parse the JSON response
    try {
      // Extract JSON from response (might be wrapped in markdown code blocks)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return new Response(
          JSON.stringify({
            safe: result.safe === true,
            reason: result.reason || (result.safe ? 'تصویر مناسب است' : 'محتوای نامناسب تشخیص داده شد')
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (parseError) {
      console.error("Error parsing moderation response:", parseError);
    }

    // If parsing fails, check for keywords
    const lowerContent = content.toLowerCase();
    const isSafe = !lowerContent.includes('"safe": false') && 
                   !lowerContent.includes('"safe":false') &&
                   !lowerContent.includes('نامناسب') &&
                   !lowerContent.includes('غیراخلاقی') &&
                   !lowerContent.includes('خشونت');

    return new Response(
      JSON.stringify({
        safe: isSafe,
        reason: isSafe ? 'تصویر مناسب است' : 'محتوای نامناسب تشخیص داده شد'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Moderation error:", error);
    // On error, allow upload to not block users
    return new Response(
      JSON.stringify({ safe: true, reason: 'خطا در بررسی' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

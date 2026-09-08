import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const METRICS = [
  'length', 'width', 'height', 'area', 'total_length', 'pipe_length',
  'platform_height', 'scaffold_height', 'vehicle_distance', 'distance_km',
  'months', 'base_price',
];

const SYSTEM = `You convert a Persian free-text scaffolding pricing condition (written by a company CEO) into STRUCTURED machine-executable pricing rules.

Available metrics (left side / comparison side):
length = طول داربست (متر)
width = عرض داربست (متر)
height = ارتفاع داربست (متر)
area = متراژ/حجم محاسبه‌شده
total_length = مجموع طول‌ها (متر)
pipe_length = طول لوله مصرفی (متر)
platform_height = ارتفاع پای کار (متر)
scaffold_height = ارتفاع داربست از پای کار (متر)
vehicle_distance = فاصله خودرو تا محل اجرا (متر)
distance_km = فاصله از مرکز شهر (کیلومتر)
months = تعداد ماه اجاره
base_price = قیمت پایه محاسبه‌شده (تومان)

Operators: ">", ">=", "<", "<=", "=", "!="

Action types:
increase_percent (افزایش درصدی قیمت)
decrease_percent (تخفیف درصدی)
add_amount (افزودن مبلغ ثابت تومان)
min_price (حداقل قیمت تومان)
set_price (قیمت ثابت نهایی تومان)

Rules for your output:
1. Convert Persian/Arabic digits to English digits.
2. Each returned rule = a set of conditions combined with AND + one action.
3. If the text expresses several independent effects (e.g. "40 درصد اضافه شود و حداقل قیمت 5 میلیون"), return several rules.
4. Comparison against a multiple of another metric uses rightKind "metric" with "factor" (e.g. "ارتفاع بیش از دو برابر طول" => {left:"height",operator:">",rightKind:"metric",metric:"length",factor:2}).
5. Comparison against a fixed number uses rightKind "number" with "number".
6. Amounts written like "5 میلیون" => 5000000, "500 هزار" => 500000.
7. title: a very short Persian label (max 6 words) summarising the rule.
8. If the text is only a note and contains no measurable condition or numeric effect, return {"rules": []}.

Return ONLY JSON: {"rules":[{"title":string,"conditions":[{"left":metric,"operator":op,"rightKind":"number"|"metric","number"?:number,"metric"?:metric,"factor"?:number}],"action_type":action,"action_value":number}]}`;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { text, categoryLabel } = await req.json();
    if (!text || !String(text).trim()) {
      return new Response(JSON.stringify({ rules: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'AI key missing', rules: [] }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: SYSTEM },
          {
            role: 'user',
            content: `بخش قیمت‌گذاری: ${categoryLabel || '-'}\nمتن شرط:\n${text}`,
          },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error('AI gateway error', res.status, body);
      return new Response(JSON.stringify({ error: 'AI request failed', rules: [] }), {
        status: res.status === 429 ? 429 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content ?? '{}';
    let parsed: any = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = String(raw).match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : {};
    }

    const num = (v: any) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };

    const rules = (Array.isArray(parsed?.rules) ? parsed.rules : [])
      .map((r: any) => {
        const conditions = (Array.isArray(r?.conditions) ? r.conditions : [])
          .filter((c: any) => METRICS.includes(c?.left))
          .map((c: any) => {
            const isMetric = c.rightKind === 'metric' && METRICS.includes(c.metric);
            return isMetric
              ? {
                  left: c.left,
                  operator: c.operator,
                  rightKind: 'metric',
                  metric: c.metric,
                  factor: num(c.factor) || 1,
                }
              : {
                  left: c.left,
                  operator: c.operator,
                  rightKind: 'number',
                  number: num(c.number),
                };
          })
          .filter((c: any) => ['>', '>=', '<', '<=', '=', '!='].includes(c.operator));

        return {
          title: String(r?.title || '').slice(0, 120) || 'شرط قیمت‌گذاری',
          conditions,
          action_type: [
            'increase_percent', 'decrease_percent', 'add_amount', 'min_price', 'set_price',
          ].includes(r?.action_type) ? r.action_type : 'increase_percent',
          action_value: num(r?.action_value),
        };
      })
      .filter((r: any) => r.conditions.length > 0 && r.action_value !== 0);

    return new Response(JSON.stringify({ rules }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('parse-pricing-condition error', e);
    return new Response(JSON.stringify({ error: String(e), rules: [] }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

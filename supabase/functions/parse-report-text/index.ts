import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StaffDirectoryItem {
  code: string;
  name: string;
}

interface OrderDirectoryItem {
  id: string;
  code: string;
  customer_name?: string | null;
  address?: string | null;
  subcategory_name?: string | null;
}

const buildSystemPrompt = (staff: StaffDirectoryItem[], orders: OrderDirectoryItem[], extra?: string) => {
  const staffList = staff.slice(0, 400).map((s) => `- code: ${s.code} | name: ${s.name}`).join('\n');
  const orderList = orders.slice(0, 400)
    .map((o) => `- id: ${o.id} | code: ${o.code} | customer: ${o.customer_name || ''} | address: ${o.address || ''} | service: ${o.subcategory_name || ''}`)
    .join('\n');

  return `You are an expert assistant that converts a free-form Persian daily field report (written by a scaffolding company executive) into structured rows for two tables: staff rows and order (project) rows.

KNOWN STAFF DIRECTORY (match names to these; use the exact code):
${staffList || '(empty)'}

KNOWN ORDERS DIRECTORY (match project/customer names to these; use the exact id):
${orderList || '(empty)'}

RULES:
1. Persian/Arabic digits must be converted to English digits.
2. Amounts are in Toman and often abbreviated: "1" or "1 یک میلیون" = 1000000, "1500" or "یک میلیون و پانصد" = 1500000, "500" = 500000, "50ت" written next to a million-scale context = judge from words. Prefer the spelled-out Persian words when both a number and words are given (e.g. "1500 یک میلیون و پانصد" => 1500000).
3. Money direction: when the text says "X به Y زد" (X paid to Y) => the payer X gets amount_spent with spending_notes describing to whom, and the receiver Y gets amount_received with receiving_notes describing from whom. If the payer is the company/cash box, only create the receiver row.
4. work_status is either "کارکرده" (worked / present, e.g. words like کارکرد، حاضر، کار کرد) or "غایب" (absent). Anyone appearing in an اکیپ (team) line or receiving/paying money that day worked => "کارکرده".
5. overtime_hours: numeric hours only if explicitly mentioned (اضافه کاری), else 0.
6. Team lines ("اکیپ : ...") list the staff working that day, separated by ، or ,, or ،،. Extract each person (strip amounts) as a staff row, and put the whole team member name list (comma separated, without amounts) into the order rows' team_name for the projects mentioned in the same text.
7. Project lines ("پروژه: ...") become order rows. Match the project/customer name to the orders directory (fuzzy match on customer name or address, ignoring spelling variations) and return its exact id in order_id. If no confident match exists, return order_id as "" and keep the raw name in matched_label.
8. activity_description = what was done today (e.g. "باز شد", "بسته شد", "زیر پودر و جنس دسته شد"). service_details = any counts/dimensions/metrage if mentioned, else "". notes = anything else relevant.
9. Never invent staff or projects that are not in the text. Do not duplicate the same staff twice - merge amounts and notes into one row.
10. Output MUST be valid minified JSON only, no markdown, matching:
{"staffRows":[{"staff_code":"","staff_name":"","work_status":"کارکرده","overtime_hours":0,"amount_received":0,"receiving_notes":"","amount_spent":0,"spending_notes":"","notes":""}],"orderRows":[{"order_id":"","matched_label":"","activity_description":"","service_details":"","team_name":"","notes":""}],"summary":""}
staff_code must be a code from the directory when matched, otherwise "" and staff_name holds the raw name.
summary: one short Persian sentence about what was extracted.
${extra ? `\nEXTRA USER INSTRUCTIONS (highest priority):\n${extra}\n` : ''}`;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, staffDirectory, ordersDirectory, extraInstructions } = await req.json();

    if (!text || typeof text !== 'string' || !text.trim()) {
      return new Response(JSON.stringify({ success: false, error: 'متن گزارش ارسال نشده است' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ success: false, error: 'کلید هوش مصنوعی پیکربندی نشده است' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = buildSystemPrompt(
      Array.isArray(staffDirectory) ? staffDirectory : [],
      Array.isArray(ordersDirectory) ? ordersDirectory : [],
      typeof extraInstructions === 'string' ? extraInstructions : undefined,
    );

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `متن گزارش روزانه:\n\n${text}\n\nفقط JSON معتبر برگردان.` },
        ],
      }),
    });

    if (aiRes.status === 429) {
      return new Response(JSON.stringify({ success: false, error: 'محدودیت درخواست هوش مصنوعی؛ کمی بعد تلاش کنید' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (aiRes.status === 402) {
      return new Response(JSON.stringify({ success: false, error: 'اعتبار هوش مصنوعی کافی نیست' }), {
        status: 402,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error('AI error', aiRes.status, errText);
      return new Response(JSON.stringify({ success: false, error: 'خطا در پردازش هوش مصنوعی' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await aiRes.json();
    const content: string = aiData.choices?.[0]?.message?.content ?? '';

    let parsed: any = null;
    try {
      const match = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/);
      const jsonStr = (match ? match[1] : content).trim();
      parsed = JSON.parse(jsonStr);
    } catch (_e) {
      const start = content.indexOf('{');
      const end = content.lastIndexOf('}');
      if (start >= 0 && end > start) {
        try {
          parsed = JSON.parse(content.slice(start, end + 1));
        } catch (_e2) {
          parsed = null;
        }
      }
    }

    if (!parsed) {
      console.error('Unparsable AI content:', content.slice(0, 500));
      return new Response(JSON.stringify({ success: false, error: 'پاسخ هوش مصنوعی قابل تحلیل نبود' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        staffRows: Array.isArray(parsed.staffRows) ? parsed.staffRows : [],
        orderRows: Array.isArray(parsed.orderRows) ? parsed.orderRows : [],
        summary: typeof parsed.summary === 'string' ? parsed.summary : '',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('parse-report-text error:', error);
    return new Response(JSON.stringify({ success: false, error: 'خطای غیرمنتظره در ربات پرکردن گزارش' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

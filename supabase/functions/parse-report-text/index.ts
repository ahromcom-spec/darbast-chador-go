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

interface BankCardDirectoryItem {
  id: string;
  card_name: string;
  bank_name?: string | null;
}

const buildSystemPrompt = (
  staff: StaffDirectoryItem[],
  orders: OrderDirectoryItem[],
  cards: BankCardDirectoryItem[],
  extra?: string,
) => {
  const staffList = staff.slice(0, 400).map((s) => `- code: ${s.code} | name: ${s.name}`).join('\n');
  const orderList = orders.slice(0, 400)
    .map((o) => `- id: ${o.id} | code: ${o.code} | customer: ${o.customer_name || ''} | address: ${o.address || ''} | service: ${o.subcategory_name || ''}`)
    .join('\n');
  const cardList = cards.slice(0, 60)
    .map((c) => `- id: ${c.id} | card: ${c.card_name}${c.bank_name ? ` (${c.bank_name})` : ''}`)
    .join('\n');

  return `You are an expert assistant that converts a free-form Persian daily field report (written by a scaffolding company executive) into structured rows for two tables: staff rows and order (project) rows.

KNOWN STAFF DIRECTORY (match names to these; use the exact code):
${staffList || '(empty)'}

KNOWN ORDERS DIRECTORY (match project/customer names to these; use the exact id):
${orderList || '(empty)'}

KNOWN BANK CARDS (company cards, e.g. کارت ملت اجرایی / پشتیبانی / مدیریت):
${cardList || '(empty)'}

RULES:
1. Persian/Arabic digits must be converted to English digits.
2. Amounts are in Toman and often abbreviated: "1" or "1 یک میلیون" = 1000000, "1500" or "یک میلیون و پانصد" = 1500000, "500" = 500000. Prefer the spelled-out Persian words when both a number and words are given (e.g. "1500 یک میلیون و پانصد" => 1500000).
3. COMPLETENESS IS CRITICAL: every human mentioned anywhere in the text (team/اکیپ lines, payers, receivers, absentees, drivers, anyone named) MUST get exactly one staff row. Never drop a person just because they have no amount. The number of staff rows must equal the number of distinct people in the text.
4. MONEY MIRRORING (very important): every payment has two sides and BOTH sides must be reflected.
   - "X به Y زد/داد/واریز کرد/پرداخت کرد" => Y gets amount_received = amount with receiving_notes "از X" (name of X), AND X gets amount_spent += amount with spending_notes listing each receiver and their amount (e.g. "به حسین محمدی 1,000,000 - به حسین ساریجالو 1,500,000").
   - If one person pays several people, sum all of them into that payer's single amount_spent row and keep the breakdown in spending_notes.
   - If the money came from a company bank card (words like کارت ملت اجرایی، کارت ملت پشتیبانی، کارت ملت مدیریت، کارت شرکت), do NOT create a payer person row: instead set bank_card_name on the receiver row to the matched card from the directory and set bank_card_id to its exact id, and receiving_notes to "از کارت ..." with the card name.
   - If the money came from the cash box (صندوق/تنخواه شرکت) with no named payer and no card, only create the receiver row and mention the source in receiving_notes.
5. work_status is "کارکرده" (worked/present) or "غایب" (absent). Anyone in an اکیپ line, or receiving/paying money that day, worked => "کارکرده". Only mark "غایب" when the text says so.
6. overtime_hours: numeric hours only if explicitly mentioned (اضافه کاری), else 0.
7. Team lines ("اکیپ : ...") list the staff working that day, separated by ، or , or ،،. Extract each person (strip amounts) as a staff row, and put the whole team member name list (comma separated, without amounts) into the order rows' team_name for the projects mentioned in the same text.
8. Project lines ("پروژه: ...") become order rows. Match the project/customer name to the orders directory (fuzzy match on customer name or address, ignoring spelling variations) and return its exact id in order_id. If no confident match exists, return order_id as "" and keep the raw name in matched_label.
9. activity_description = what was done today (e.g. "باز شد", "بسته شد", "زیر پودر و جنس دسته شد"). service_details = any counts/dimensions/metrage if mentioned, else "". notes = anything else relevant.
10. Never invent staff or projects that are not in the text. Do not duplicate the same person in two rows - merge all their amounts and notes into one row.
11. Before answering, re-read the text and verify: (a) every named person has a row, (b) for every payment the payer row's amount_spent equals the total they paid, (c) totals of amount_received from named payers equal those payers' amount_spent.
12. Output MUST be valid minified JSON only, no markdown, matching:
{"staffRows":[{"staff_code":"","staff_name":"","work_status":"کارکرده","overtime_hours":0,"amount_received":0,"receiving_notes":"","amount_spent":0,"spending_notes":"","bank_card_id":"","bank_card_name":"","notes":""}],"orderRows":[{"order_id":"","matched_label":"","activity_description":"","service_details":"","team_name":"","notes":""}],"summary":""}
staff_code must be a code from the directory when matched, otherwise "" and staff_name holds the raw name.
summary: one short Persian sentence about what was extracted, including how many people and projects.
${extra ? `\nEXTRA USER INSTRUCTIONS (highest priority):\n${extra}\n` : ''}`;
};


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, staffDirectory, ordersDirectory, bankCardsDirectory, extraInstructions } = await req.json();

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
      Array.isArray(bankCardsDirectory) ? bankCardsDirectory : [],
      typeof extraInstructions === 'string' ? extraInstructions : undefined,
    );

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3.6-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `متن گزارش روزانه:\n\n${text}\n\nفقط JSON معتبر برگردان. مطمئن شو همه اشخاص ذکرشده ردیف دارند و پرداخت‌ها دوطرفه ثبت شده است.` },
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

    const staffRows: any[] = Array.isArray(parsed.staffRows) ? parsed.staffRows : [];

    // Safety net: mirror payments. If a receiver's notes say "از <someone>" and that
    // someone is another row, make sure the payer's amount_spent reflects the payment.
    const norm = (s: string) =>
      String(s || '')
        .replace(/[\u200c\u200f\u200e]/g, '')
        .replace(/[ىي]/g, 'ی')
        .replace(/ك/g, 'ک')
        .replace(/\s+/g, ' ')
        .trim();

    for (const receiver of staffRows) {
      const amount = Number(receiver.amount_received) || 0;
      const note = norm(receiver.receiving_notes);
      if (amount <= 0 || !note || note.includes('کارت') || note.includes('صندوق') || note.includes('تنخواه')) continue;

      const payer = staffRows.find((p) => {
        if (p === receiver) return false;
        const name = norm(p.staff_name);
        if (!name) return false;
        const first = name.split(' ')[0];
        return note.includes(name) || (first.length > 2 && note.includes(first));
      });
      if (!payer) continue;

      const paidTo = norm(payer.spending_notes);
      const receiverName = norm(receiver.staff_name);
      const receiverFirst = receiverName.split(' ')[0];
      const alreadyLogged = paidTo.includes(receiverName) || (receiverFirst.length > 2 && paidTo.includes(receiverFirst));
      if (alreadyLogged) continue;

      payer.amount_spent = (Number(payer.amount_spent) || 0) + amount;
      payer.spending_notes = [payer.spending_notes, `به ${receiver.staff_name} ${amount.toLocaleString('en-US')}`]
        .filter(Boolean)
        .join(' - ');
    }

    return new Response(
      JSON.stringify({
        success: true,
        staffRows,
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

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
  moduleLabel?: string,
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

KNOWN BANK CARDS (company cards, e.g. کارت ملت اجرایی / پشتیبانی / مدیریت). These are the ONLY cards you may use, and they already belong to the current module:
${cardList || '(empty)'}
${moduleLabel ? `CURRENT MODULE: ${moduleLabel}. When the money source is the company (card/صندوق/تنخواه/شرکت) but the exact card is not named, use the card in the list whose name best matches this module (اجرایی/پشتیبانی/مدیریت); if only one card exists in the list, use it.` : ''}

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
12. CARD ROWS (very important): whenever money is spent/withdrawn FROM a company card (کارت ملت اجرایی/پشتیبانی/مدیریت، کارت شرکت، صندوق شرکت) you MUST also add one row in "cardRows" for that card, with the exact bank_card_id from the directory, amount_spent = the amount taken out of that card, spending_notes = what it was spent on and to whom (e.g. "به حسین محمدی 1,000,000" or "خرید یخ برای شرکت"). Create one cardRows entry per card per purpose; if the same card paid several people/items, you may sum them and keep the breakdown in spending_notes.
   - ONE ROW PER CARD: create a separate cardRows entry for EVERY distinct card used that day (never merge two different cards into one row), and always fill bank_card_id with an exact id from the directory above. Even if the amount came from the company with no card explicitly named, still emit a cardRows entry using the module's card.
   - If the text says the expense belongs to the company itself (ماهیت شرکت اهرم، هزینه شرکت، برای شرکت خرج شد) set "is_company_expense": true on that card row; otherwise false.
14. COMPANY EXPENSES (very important): anything bought FOR the company or the work site — نهار/شام/صبحانه/غذا، یخ، آب، بنزین/گازوئیل/سوخت نیسان و خودروها، ایاب‌وذهاب/کرایه/تاکسی، ابزار و لوازم مصرفی، تعمیر خودرو — is a company expense (هزینه شرکت) no matter who paid for it (a staff member out of pocket, the cash box, or a company card). For EVERY such purchase add one entry to "companyExpenseRows" with "amount" = the amount in Toman and "description" = what was bought and who paid (e.g. "خرید نهار توسط داود احمدی"). Still keep the payer's own staff row with amount_spent as usual — companyExpenseRows is only the company-side classification.
15. Output MUST be valid minified JSON only, no markdown, matching:
{"staffRows":[{"staff_code":"","staff_name":"","work_status":"کارکرده","overtime_hours":0,"amount_received":0,"receiving_notes":"","amount_spent":0,"spending_notes":"","bank_card_id":"","bank_card_name":"","notes":""}],"cardRows":[{"bank_card_id":"","bank_card_name":"","amount_received":0,"receiving_notes":"","amount_spent":0,"spending_notes":"","is_company_expense":false,"notes":""}],"companyExpenseRows":[{"amount":0,"description":""}],"orderRows":[{"order_id":"","matched_label":"","activity_description":"","service_details":"","team_name":"","notes":""}],"summary":""}
staff_code must be a code from the directory when matched, otherwise "" and staff_name holds the raw name.
summary: one short Persian sentence about what was extracted, including how many people and projects.
${extra ? `\nEXTRA USER INSTRUCTIONS (highest priority):\n${extra}\n` : ''}`;
};


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, staffDirectory, ordersDirectory, bankCardsDirectory, extraInstructions, moduleLabel } = await req.json();

    if (!text || typeof text !== 'string' || !text.trim()) {
      return new Response(JSON.stringify({ success: false, error: 'متن گزارش ارسال نشده است' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ success: false, error: 'کلید هوش مصنوعی جیمینای پیکربندی نشده است' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = buildSystemPrompt(
      Array.isArray(staffDirectory) ? staffDirectory : [],
      Array.isArray(ordersDirectory) ? ordersDirectory : [],
      Array.isArray(bankCardsDirectory) ? bankCardsDirectory : [],
      typeof extraInstructions === 'string' ? extraInstructions : undefined,
      typeof moduleLabel === 'string' ? moduleLabel : undefined,
    );

    const userPrompt = `متن گزارش روزانه:\n\n${text}\n\nفقط JSON معتبر برگردان. مطمئن شو همه اشخاص ذکرشده ردیف دارند و پرداخت‌ها دوطرفه ثبت شده است.`;

    const callGemini = async (model: string) =>
      await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': GEMINI_API_KEY,
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            generationConfig: {
              temperature: 0.2,
              responseMimeType: 'application/json',
              maxOutputTokens: 32768,
            },
          }),
        },
      );

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    // Try several models; retry transient overload/rate-limit errors with backoff so
    // long reports still go through when a model is busy.
    const models = ['gemini-3.6-flash', 'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.0-flash'];
    let aiRes: Response | null = null;
    let lastStatus = 0;
    let lastErrText = '';

    outer: for (const model of models) {
      for (let attempt = 0; attempt < 3; attempt++) {
        const res = await callGemini(model);
        if (res.ok) {
          aiRes = res;
          break outer;
        }
        lastStatus = res.status;
        lastErrText = await res.text();
        console.error('Gemini error', model, res.status, lastErrText.slice(0, 400));

        if (res.status === 401 || res.status === 403) break outer;
        if (res.status === 404 || res.status === 400) break; // bad model → next model
        if (res.status === 429 || res.status >= 500) {
          await sleep(1500 * (attempt + 1) + Math.floor(Math.random() * 500));
          continue;
        }
        break; // other terminal error → next model
      }
    }

    if (!aiRes) {
      if (lastStatus === 401 || lastStatus === 403) {
        return new Response(
          JSON.stringify({ success: false, error: 'کلید جیمینای معتبر نیست یا دسترسی ندارد؛ کلید API را بررسی کنید.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      if (lastStatus === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'محدودیت درخواست هوش مصنوعی؛ چند لحظه بعد دوباره تلاش کنید.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      if (lastStatus >= 500) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'سرور هوش مصنوعی جیمینای موقتاً شلوغ است (۵۰۳). چند لحظه بعد دوباره «تحلیل هوشمند متن» را بزنید.',
          }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify({ success: false, error: 'خطا در پردازش هوش مصنوعی' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }


    const aiData = await aiRes.json();
    const content: string = (aiData?.candidates?.[0]?.content?.parts || [])
      .map((p: any) => p?.text || '')
      .join('') || '';


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
        .replace(/[،,_\-\/()]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();

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

    // Card rows: money taken out of company cards. Auto-derive missing ones from
    // receivers that were paid by a card, so every card payment has a card row.
    const cardRows: any[] = Array.isArray(parsed.cardRows) ? parsed.cardRows : [];
    const cardDir: BankCardDirectoryItem[] = Array.isArray(bankCardsDirectory) ? bankCardsDirectory : [];
    const resolveCard = (id?: string, name?: string) => {
      const byId = cardDir.find((c) => c.id === String(id || '').trim());
      if (byId) return byId;
      const n = norm(name);
      if (n) {
        const tokens = n.split(' ').filter((token) => token.length > 1 && token !== 'کارت' && token !== 'بانک');
        const byName = cardDir
          .map((card) => {
            const searchable = norm(`${card.card_name} ${card.bank_name || ''}`);
            const score = tokens.reduce((total, token) => total + (searchable.includes(token) ? 1 : 0), 0);
            return { card, score };
          })
          .sort((a, b) => b.score - a.score)
          .find((candidate) => candidate.score > 0)?.card;
        if (byName) return byName;
      }
      const ml = norm(moduleLabel);
      const byModule = ['اجرایی', 'پشتیبانی', 'مدیریت'].find((k) => ml.includes(k));
      if (byModule) {
        const c = cardDir.find((x) => norm(x.card_name).includes(byModule));
        if (c) return c;
      }
      return cardDir.length === 1 ? cardDir[0] : undefined;
    };

    // Make sure every card row (and card payment on a staff row) points at a real card id
    for (const c of cardRows) {
      const resolved = resolveCard(
        c.bank_card_id,
        c.bank_card_name || `${c.receiving_notes || ''} ${c.spending_notes || ''} ${c.notes || ''}`,
      );
      if (resolved) {
        c.bank_card_id = resolved.id;
        c.bank_card_name = resolved.card_name;
      }
      const expenseText = norm(`${c.bank_card_name || ''} ${c.receiving_notes || ''} ${c.spending_notes || ''} ${c.notes || ''}`);
      c.is_company_expense = c.is_company_expense === true ||
        String(c.is_company_expense).toLowerCase() === 'true' ||
        expenseText.includes('ماهیت شرکت') ||
        expenseText.includes('هزینه شرکت') ||
        expenseText.includes('برای شرکت');
    }

    // If the report explicitly calls an expense «ماهیت/هزینه شرکت» and there is only
    // one card expense, classify that card row deterministically even if the model omitted the flag.
    const reportText = norm(text);
    if (
      cardRows.length === 1 &&
      (reportText.includes('ماهیت شرکت') || reportText.includes('هزینه شرکت') || reportText.includes('برای شرکت'))
    ) {
      cardRows[0].is_company_expense = true;
    }
    for (const r of staffRows) {
      const note = norm(r.receiving_notes);
      const mentionsCard = !!String(r.bank_card_id || r.bank_card_name || '').trim() ||
        note.includes('کارت') || note.includes('صندوق') || note.includes('تنخواه');
      if (!mentionsCard || !(Number(r.amount_received) > 0)) continue;
      const resolved = resolveCard(r.bank_card_id, r.bank_card_name);
      if (resolved) {
        r.bank_card_id = resolved.id;
        r.bank_card_name = resolved.card_name;
      }
    }
    for (const r of staffRows) {
      const cardId = String(r.bank_card_id || '').trim();
      const amount = Number(r.amount_received) || 0;
      if (!cardId || amount <= 0) continue;
      const existing = cardRows.find((c) => String(c.bank_card_id || '').trim() === cardId);
      const label = `به ${r.staff_name || ''} ${amount.toLocaleString('en-US')}`.trim();
      if (existing) {
        const notes = norm(existing.spending_notes);
        const name = norm(r.staff_name);
        if (name && notes.includes(name)) continue;
        existing.amount_spent = (Number(existing.amount_spent) || 0) + amount;
        existing.spending_notes = [existing.spending_notes, label].filter(Boolean).join(' - ');
      } else {
        cardRows.push({
          bank_card_id: cardId,
          bank_card_name: r.bank_card_name || '',
          amount_received: 0,
          receiving_notes: '',
          amount_spent: amount,
          spending_notes: label,
          is_company_expense: false,
          notes: '',
        });
      }
    }

    // A «company expense» is a classification, not the financial source. Keep the
    // withdrawal on a real selectable card row and emit a separate zero-value
    // company row so the same amount is never counted twice.
    const normalizedCardRows: any[] = [];
    const cardRowById = new Map<string, any>();
    const companyDescriptions: { amount: number; description: string }[] = [];

    for (const sourceRow of cardRows) {
      const resolved = resolveCard(
        sourceRow.bank_card_id,
        sourceRow.bank_card_name || `${sourceRow.receiving_notes || ''} ${sourceRow.spending_notes || ''} ${sourceRow.notes || ''}`,
      );
      const isCompanyExpense = sourceRow.is_company_expense === true ||
        String(sourceRow.is_company_expense).toLowerCase() === 'true';

      if (isCompanyExpense) {
        const description = [sourceRow.spending_notes, sourceRow.notes].filter(Boolean).join(' - ');
        if (description) {
          companyDescriptions.push({
            amount: Number(sourceRow.amount_spent) || 0,
            description,
          });
        }
      }


      const cardId = resolved?.id || String(sourceRow.bank_card_id || '').trim();
      if (!cardId) continue;

      const existing = cardRowById.get(cardId);
      if (existing) {
        existing.amount_received += Number(sourceRow.amount_received) || 0;
        existing.amount_spent += Number(sourceRow.amount_spent) || 0;
        existing.receiving_notes = [existing.receiving_notes, sourceRow.receiving_notes].filter(Boolean).join(' - ');
        existing.spending_notes = [existing.spending_notes, sourceRow.spending_notes].filter(Boolean).join(' - ');
        existing.notes = [existing.notes, sourceRow.notes].filter(Boolean).join(' - ');
        continue;
      }

      const normalized = {
        ...sourceRow,
        bank_card_id: cardId,
        bank_card_name: resolved?.card_name || sourceRow.bank_card_name || '',
        amount_received: Number(sourceRow.amount_received) || 0,
        amount_spent: Number(sourceRow.amount_spent) || 0,
        is_company_expense: false,
      };
      cardRowById.set(cardId, normalized);
      normalizedCardRows.push(normalized);
    }

    // Company expenses (نهار، یخ، بنزین، ایاب‌وذهاب ...) always belong to the
    // «ماهیت شرکت اهرم» row: the amount goes in its «دریافتی» column with a note,
    // no matter who actually paid for it.
    const companyExpenses: { amount: number; description: string }[] = [];
    const pushExpense = (amount: number, description: string) => {
      const amt = Number(amount) || 0;
      const desc = String(description || '').trim();
      if (amt <= 0 && !desc) return;
      const dup = companyExpenses.find(
        (e) => e.amount === amt && norm(e.description) === norm(desc),
      );
      if (dup) return;
      companyExpenses.push({ amount: amt, description: desc });
    };

    for (const e of Array.isArray(parsed.companyExpenseRows) ? parsed.companyExpenseRows : []) {
      pushExpense(Number(e?.amount) || 0, String(e?.description || ''));
    }

    // Fallback: derive from staff rows that spent money on typical company items.
    const EXPENSE_KEYWORDS = [
      'نهار', 'ناهار', 'شام', 'صبحانه', 'غذا', 'یخ', 'اب معدنی', 'آب معدنی',
      'بنزین', 'گازوئیل', 'گازویل', 'سوخت', 'ایاب', 'کرایه', 'تاکسی', 'اسنپ',
      'ابزار', 'لوازم', 'تعمیر خودرو', 'پنچری', 'خرید',
    ].map((k) => norm(k));
    for (const r of staffRows) {
      const amount = Number(r.amount_spent) || 0;
      if (amount <= 0) continue;
      const text = norm(`${r.spending_notes || ''} ${r.notes || ''}`);
      if (!text) continue;
      // Skip person-to-person payments (already mirrored above)
      if (text.startsWith('به ') || text.includes(' به ')) {
        const paysPerson = staffRows.some((p) => {
          if (p === r) return false;
          const name = norm(p.staff_name);
          return !!name && text.includes(name);
        });
        if (paysPerson) continue;
      }
      if (!EXPENSE_KEYWORDS.some((k) => text.includes(k))) continue;
      pushExpense(amount, `${String(r.spending_notes || r.notes || '').trim()} - ${String(r.staff_name || '').trim()}`.replace(/^ - | - $/g, ''));
    }

    for (const description of companyDescriptions) {
      if (!companyExpenses.some((e) => norm(e.description).includes(norm(description)) || norm(description).includes(norm(e.description)))) {
        pushExpense(0, description);
      }
    }

    if (companyExpenses.length > 0) {
      const totalExpense = companyExpenses.reduce((sum, e) => sum + e.amount, 0);
      const expenseNote = companyExpenses
        .map((e) => (e.amount > 0 ? `${e.description} ${e.amount.toLocaleString('en-US')}`.trim() : e.description))
        .filter(Boolean)
        .join(' - ');
      normalizedCardRows.push({
        bank_card_id: '',
        bank_card_name: '',
        amount_received: totalExpense,
        receiving_notes: expenseNote,
        amount_spent: 0,
        spending_notes: '',
        is_company_expense: true,
        notes: expenseNote,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        staffRows,
        cardRows: normalizedCardRows,
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

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExcelSheetData {
  sheetName: string;
  rows: string[][];
}

interface ParsedDailyReport {
  date: string; // YYYY-MM-DD format
  staffReports: {
    staffName: string;
    workStatus: 'حاضر' | 'غایب';
    overtimeHours: number;
    amountReceived: number;
    receivingNotes: string;
    amountSpent: number;
    spendingNotes: string;
    notes: string;
    isCashBox: boolean;
  }[];
  orderReports: {
    projectName: string;
    activityDescription: string;
    serviceDetails: string;
    teamName: string;
    notes: string;
  }[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sheetsData, knownStaffMembers, customInstructions, instructionImages } = await req.json();

    if (!sheetsData || !Array.isArray(sheetsData)) {
      return new Response(
        JSON.stringify({ success: false, error: 'داده‌های اکسل ارسال نشده است' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'کلید API پیکربندی نشده است' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing', sheetsData.length, 'sheets');
    console.log('Known staff members:', knownStaffMembers?.length || 0);
    console.log('Custom instructions provided:', !!customInstructions);
    console.log('Instruction images provided:', instructionImages?.length || 0);

    const parsedReports: ParsedDailyReport[] = [];

    // Process each sheet with AI
    for (const sheet of sheetsData as ExcelSheetData[]) {
      console.log('Processing sheet:', sheet.sheetName);
      
      // Convert rows to a readable format for AI
      const sheetContent = sheet.rows
        .map((row, idx) => `Row ${idx + 1}: ${row.join(' | ')}`)
        .join('\n');

      // Build dynamic system prompt with custom instructions
      const customInstructionsSection = customInstructions 
        ? `
CUSTOM INSTRUCTIONS FROM USER (VERY IMPORTANT - FOLLOW THESE CAREFULLY):
${customInstructions}

The user has provided specific instructions above. These take priority over default rules where applicable.
`
        : '';

      const systemPrompt = `You are an expert at parsing Persian/Farsi daily work reports from Excel sheets.
You are like a highly skilled, intelligent, and professional employee who works precisely and carefully.
Your task is to extract structured data from the Excel content based on user instructions and context.

KNOWN STAFF MEMBERS IN THE SYSTEM:
${knownStaffMembers?.map((s: any) => `- ${s.full_name} (کد: ${s.code || 'ندارد'})`).join('\n') || 'هیچ نیروی ثبت شده‌ای وجود ندارد'}
${customInstructionsSection}
DEFAULT RULES (apply unless overridden by custom instructions):
1. Extract the date from the sheet name if it contains Persian date (like "30 آذر 1404" or "1 دی 1404")
2. For staff names, try to match with the known staff members above. Look for similarities in names.
3. "کارت صندوق اهرم" is a special cash box entry - set isCashBox: true for it
4. Work status "کارکرده" or "1روز کارکرد" means حاضر (present), "غایب" or "0" in work column means غایب (absent)
5. Parse amounts like "2,000,000 تومان" as numbers (2000000). Amounts are typically in Tomans unless specified otherwise.
6. Extract overtime hours from text like "0.5 ساعت" 
7. Look for the staff section that typically has columns: نیروها, کارکرد, اضافه کاری, مبلغ دریافتی, etc.
8. Look for the orders section that has project info, activity description, team names
9. Skip rows that are just "0" or empty
10. If a row has meaningful text in "توضیحات مبلغ خرج کرد", include it in spendingNotes
11. Be intelligent about understanding the context and structure of the data
12. If something is unclear, make your best professional judgment based on the context

OUTPUT FORMAT - Return valid JSON only:
{
  "date": "YYYY-MM-DD",
  "staffReports": [
    {
      "staffName": "full name with code if available",
      "workStatus": "حاضر" or "غایب",
      "overtimeHours": number,
      "amountReceived": number in tomans,
      "receivingNotes": "payment notes",
      "amountSpent": number in tomans,
      "spendingNotes": "spending notes",
      "notes": "other notes",
      "isCashBox": boolean
    }
  ],
  "orderReports": [
    {
      "projectName": "project address or name",
      "activityDescription": "what was done today",
      "serviceDetails": "service dimensions etc",
      "teamName": "team members names",
      "notes": "additional notes"
    }
  ]
}

If you cannot determine the date, use null. If a sheet seems empty or just a holiday notice (like "جمعه اکیپ تعطیل"), return empty arrays but still try to extract the date.`;

      // Build user message with optional images
      const userMessageContent: any[] = [];
      
      // Add text content first
      userMessageContent.push({
        type: 'text',
        text: `Parse this Persian daily work report Excel sheet:

Sheet Name: "${sheet.sheetName}"

Content:
${sheetContent}

Extract all staff and order data. Return valid JSON only.`
      });

      // Add instruction images if provided (only for first sheet to avoid redundancy)
      if (instructionImages && instructionImages.length > 0 && sheetsData.indexOf(sheet) === 0) {
        for (const imageBase64 of instructionImages) {
          userMessageContent.push({
            type: 'image_url',
            image_url: {
              url: imageBase64
            }
          });
        }
      }

      try {
        const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userMessageContent }
            ],
          }),
        });

        if (!response.ok) {
          console.error('AI API error for sheet', sheet.sheetName, ':', response.status);
          continue;
        }

        const aiData = await response.json();
        const content = aiData.choices?.[0]?.message?.content;
        
        if (!content) {
          console.error('No content in AI response for sheet', sheet.sheetName);
          continue;
        }

        // Parse JSON from AI response
        let parsed: ParsedDailyReport;
        try {
          // Try to extract JSON from the response (might be wrapped in markdown code blocks)
          const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                           content.match(/```\s*([\s\S]*?)\s*```/) ||
                           [null, content];
          const jsonStr = jsonMatch[1] || content;
          parsed = JSON.parse(jsonStr.trim());
          
          if (parsed.date || parsed.staffReports?.length || parsed.orderReports?.length) {
            parsedReports.push(parsed);
            console.log('Successfully parsed sheet:', sheet.sheetName, 'Date:', parsed.date);
          }
        } catch (parseError) {
          console.error('Failed to parse AI response JSON for sheet', sheet.sheetName, ':', parseError);
          console.log('AI response was:', content.substring(0, 500));
        }
      } catch (sheetError) {
        console.error('Error processing sheet', sheet.sheetName, ':', sheetError);
      }
    }

    console.log('Successfully parsed', parsedReports.length, 'reports');

    return new Response(
      JSON.stringify({ 
        success: true, 
        reports: parsedReports,
        totalSheets: sheetsData.length,
        parsedSheets: parsedReports.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in parse-excel-report:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'خطای نامشخص' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

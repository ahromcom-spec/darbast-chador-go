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
    const { sheetsData, knownStaffMembers, customInstructions, instructionImages, streaming } = await req.json();

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
    console.log('Streaming mode:', !!streaming);

    // If streaming mode is requested, use SSE
    if (streaming) {
      const encoder = new TextEncoder();
      
      // Use TransformStream for better control
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      
      const sendEvent = async (data: any) => {
        try {
          await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch (e) {
          console.error('Error sending SSE event:', e);
        }
      };

      // Start processing in background
      (async () => {
        try {
          const parsedReports: ParsedDailyReport[] = [];
          const allProcessingReports: any[] = [];

          await sendEvent({ 
            type: 'start', 
            message: `شروع پردازش ${sheetsData.length} شیت...`,
            totalSheets: sheetsData.length 
          });

          for (let i = 0; i < sheetsData.length; i++) {
            const sheet = sheetsData[i] as ExcelSheetData;
            const sheetIndex = i + 1;

            await sendEvent({ 
              type: 'progress', 
              sheetIndex,
              sheetName: sheet.sheetName,
              message: `در حال پردازش شیت ${sheetIndex} از ${sheetsData.length}: "${sheet.sheetName}"`,
              step: 'reading'
            });

            const sheetContent = sheet.rows
              .map((row, idx) => `Row ${idx + 1}: ${row.join(' | ')}`)
              .join('\n');

            const customInstructionsSection = customInstructions 
              ? `\nCUSTOM INSTRUCTIONS FROM USER (VERY IMPORTANT - FOLLOW THESE CAREFULLY):\n${customInstructions}\n\nThe user has provided specific instructions above. These take priority over default rules where applicable.\n`
              : '';

            const systemPrompt = buildSystemPrompt(knownStaffMembers, customInstructionsSection);

            const userMessageContent: any[] = [];
            userMessageContent.push({
              type: 'text',
              text: `Parse this Persian daily work report Excel sheet:\n\nSheet Name: "${sheet.sheetName}"\n\nContent:\n${sheetContent}\n\nExtract all staff and order data. Return valid JSON only.`
            });

            if (instructionImages && instructionImages.length > 0 && i === 0) {
              for (const imageBase64 of instructionImages) {
                userMessageContent.push({
                  type: 'image_url',
                  image_url: { url: imageBase64 }
                });
              }
            }

            await sendEvent({ 
              type: 'progress', 
              sheetIndex,
              sheetName: sheet.sheetName,
              message: `ارسال به هوش مصنوعی: "${sheet.sheetName}"`,
              step: 'ai_processing'
            });

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
                await sendEvent({ 
                  type: 'warning', 
                  sheetIndex,
                  sheetName: sheet.sheetName,
                  message: `خطا در پردازش شیت "${sheet.sheetName}": ${response.status}`
                });
                continue;
              }

              const aiData = await response.json();
              const content = aiData.choices?.[0]?.message?.content;

              if (!content) {
                await sendEvent({ 
                  type: 'warning', 
                  sheetIndex,
                  sheetName: sheet.sheetName,
                  message: `پاسخی از هوش مصنوعی برای "${sheet.sheetName}" دریافت نشد`
                });
                continue;
              }

              await sendEvent({ 
                type: 'progress', 
                sheetIndex,
                sheetName: sheet.sheetName,
                message: `تحلیل نتایج: "${sheet.sheetName}"`,
                step: 'parsing'
              });

              let parsed: any;
              try {
                const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                                 content.match(/```\s*([\s\S]*?)\s*```/) ||
                                 [null, content];
                const jsonStr = jsonMatch[1] || content;
                parsed = JSON.parse(jsonStr.trim());

                if (parsed.processingReport) {
                  allProcessingReports.push({
                    sheetName: sheet.sheetName,
                    ...parsed.processingReport
                  });
                }

                if (parsed.date || parsed.staffReports?.length || parsed.orderReports?.length) {
                  parsedReports.push({
                    date: parsed.date,
                    staffReports: parsed.staffReports || [],
                    orderReports: parsed.orderReports || []
                  });

                  const staffCount = parsed.staffReports?.length || 0;
                  const orderCount = parsed.orderReports?.length || 0;
                  
                  await sendEvent({ 
                    type: 'sheet_done', 
                    sheetIndex,
                    sheetName: sheet.sheetName,
                    message: `✓ "${sheet.sheetName}": ${staffCount} نیرو و ${orderCount} سفارش استخراج شد`,
                    date: parsed.date,
                    staffCount,
                    orderCount
                  });
                } else {
                  await sendEvent({ 
                    type: 'sheet_empty', 
                    sheetIndex,
                    sheetName: sheet.sheetName,
                    message: `"${sheet.sheetName}": داده‌ای برای استخراج یافت نشد`
                  });
                }
              } catch (parseError) {
                await sendEvent({ 
                  type: 'warning', 
                  sheetIndex,
                  sheetName: sheet.sheetName,
                  message: `خطا در تحلیل نتایج "${sheet.sheetName}"`
                });
                allProcessingReports.push({
                  sheetName: sheet.sheetName,
                  actionsPerformed: [],
                  itemsIgnored: [],
                  warnings: [`خطا در پردازش: ${parseError}`],
                  needsUserInput: []
                });
              }
            } catch (sheetError) {
              await sendEvent({ 
                type: 'error', 
                sheetIndex,
                sheetName: sheet.sheetName,
                message: `خطا در پردازش "${sheet.sheetName}": ${sheetError}`
              });
            }
          }

          // Send final result
          const aggregatedReport = {
            actionsPerformed: allProcessingReports.flatMap(r => r.actionsPerformed || []),
            itemsIgnored: allProcessingReports.flatMap(r => r.itemsIgnored || []),
            warnings: allProcessingReports.flatMap(r => r.warnings || []),
            needsUserInput: allProcessingReports.flatMap(r => r.needsUserInput || []),
            perSheet: allProcessingReports
          };

          console.log('Streaming complete, sending final result with', parsedReports.length, 'reports');

          await sendEvent({ 
            type: 'complete', 
            message: `پردازش کامل شد: ${parsedReports.length} گزارش از ${sheetsData.length} شیت`,
            success: true,
            reports: parsedReports,
            totalSheets: sheetsData.length,
            parsedSheets: parsedReports.length,
            processingReport: aggregatedReport
          });

          await sendEvent({ type: 'done' });
        } catch (err) {
          console.error('Error in streaming processing:', err);
          await sendEvent({ 
            type: 'error', 
            message: `خطای کلی: ${err instanceof Error ? err.message : 'خطای نامشخص'}`
          });
        } finally {
          try {
            await writer.close();
          } catch (e) {
            console.error('Error closing writer:', e);
          }
        }
      })();

      return new Response(readable, {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no'
        }
      });
    }

    // Non-streaming mode (original behavior)
    const parsedReports: ParsedDailyReport[] = [];
    const allProcessingReports: {
      sheetName: string;
      actionsPerformed: string[];
      itemsIgnored: string[];
      warnings: string[];
      needsUserInput: string[];
    }[] = [];

    for (const sheet of sheetsData as ExcelSheetData[]) {
      console.log('Processing sheet:', sheet.sheetName);
      
      const sheetContent = sheet.rows
        .map((row, idx) => `Row ${idx + 1}: ${row.join(' | ')}`)
        .join('\n');

      const customInstructionsSection = customInstructions 
        ? `\nCUSTOM INSTRUCTIONS FROM USER (VERY IMPORTANT - FOLLOW THESE CAREFULLY):\n${customInstructions}\n\nThe user has provided specific instructions above. These take priority over default rules where applicable.\n`
        : '';

      const systemPrompt = buildSystemPrompt(knownStaffMembers, customInstructionsSection);

      const userMessageContent: any[] = [];
      userMessageContent.push({
        type: 'text',
        text: `Parse this Persian daily work report Excel sheet:\n\nSheet Name: "${sheet.sheetName}"\n\nContent:\n${sheetContent}\n\nExtract all staff and order data. Return valid JSON only.`
      });

      if (instructionImages && instructionImages.length > 0 && sheetsData.indexOf(sheet) === 0) {
        for (const imageBase64 of instructionImages) {
          userMessageContent.push({
            type: 'image_url',
            image_url: { url: imageBase64 }
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

        let parsed: any;
        try {
          const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                           content.match(/```\s*([\s\S]*?)\s*```/) ||
                           [null, content];
          const jsonStr = jsonMatch[1] || content;
          parsed = JSON.parse(jsonStr.trim());
          
          if (parsed.processingReport) {
            allProcessingReports.push({
              sheetName: sheet.sheetName,
              actionsPerformed: parsed.processingReport.actionsPerformed || [],
              itemsIgnored: parsed.processingReport.itemsIgnored || [],
              warnings: parsed.processingReport.warnings || [],
              needsUserInput: parsed.processingReport.needsUserInput || []
            });
          }
          
          if (parsed.date || parsed.staffReports?.length || parsed.orderReports?.length) {
            parsedReports.push({
              date: parsed.date,
              staffReports: parsed.staffReports || [],
              orderReports: parsed.orderReports || []
            });
            console.log('Successfully parsed sheet:', sheet.sheetName, 'Date:', parsed.date);
          }
        } catch (parseError) {
          console.error('Failed to parse AI response JSON for sheet', sheet.sheetName, ':', parseError);
          console.log('AI response was:', content.substring(0, 500));
          allProcessingReports.push({
            sheetName: sheet.sheetName,
            actionsPerformed: [],
            itemsIgnored: [],
            warnings: [`خطا در پردازش این شیت: ${parseError}`],
            needsUserInput: []
          });
        }
      } catch (sheetError) {
        console.error('Error processing sheet', sheet.sheetName, ':', sheetError);
        allProcessingReports.push({
          sheetName: sheet.sheetName,
          actionsPerformed: [],
          itemsIgnored: [],
          warnings: [`خطا در ارتباط با هوش مصنوعی: ${sheetError}`],
          needsUserInput: []
        });
      }
    }

    console.log('Successfully parsed', parsedReports.length, 'reports');

    const aggregatedReport = {
      actionsPerformed: allProcessingReports.flatMap(r => r.actionsPerformed),
      itemsIgnored: allProcessingReports.flatMap(r => r.itemsIgnored),
      warnings: allProcessingReports.flatMap(r => r.warnings),
      needsUserInput: allProcessingReports.flatMap(r => r.needsUserInput),
      perSheet: allProcessingReports
    };

    return new Response(
      JSON.stringify({ 
        success: true, 
        reports: parsedReports,
        totalSheets: sheetsData.length,
        parsedSheets: parsedReports.length,
        processingReport: aggregatedReport
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

// Helper function to build system prompt
function buildSystemPrompt(knownStaffMembers: any[], customInstructionsSection: string): string {
  return `You are an expert at parsing Persian/Farsi daily work reports from Excel sheets.
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
  ],
  "processingReport": {
    "actionsPerformed": ["list of actions done", "e.g. استخراج اطلاعات 5 نیرو", "استخراج 3 سفارش"],
    "itemsIgnored": ["list of things ignored", "e.g. ردیف‌های خالی نادیده گرفته شد"],
    "warnings": ["warnings or issues found", "e.g. نام فلانی در لیست نیروها پیدا نشد"],
    "needsUserInput": ["things that need user clarification", "e.g. مبلغ X مشخص نیست - ریال است یا تومان؟"]
  }
}

IMPORTANT: Always include processingReport with detailed information about what you did, what you ignored, and what needs clarification.

If you cannot determine the date, use null. If a sheet seems empty or just a holiday notice (like "جمعه اکیپ تعطیل"), return empty arrays but still try to extract the date.`;
}

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "https://deno.land/x/xhr@0.3.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function extractTextFromPDF(pdfData: Blob): Promise<string> {
  // Convert PDF to base64 for AI processing
  const arrayBuffer = await pdfData.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
  
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;
  
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${lovableApiKey}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all text from this PDF document. Focus on capturing dates, times (especially in format @ HHMM-HHMM HRS), and event descriptions. Return the raw extracted text."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:application/pdf;base64,${base64}`
              }
            }
          ]
        }
      ]
    }),
  });

  const result = await response.json();
  return result.choices[0].message.content;
}

async function parseEventsFromText(text: string, fileName: string): Promise<any[]> {
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;
  
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${lovableApiKey}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `You are an expert AI Agent specialized in extracting event information from Schedule of Events (SOF) documents with inconsistent formatting.

CRITICAL EXTRACTION RULES:
1. Identify ALL events, even with irregular formats like:
   - "Meeting : ON OCT 21 @ 1500 HOURS"
   - "@ 0900 HRS. : INWARD FORMALITIES"
   - "@ HHMM-HHMM HRS" or "@ HHMM HRS"
   - "09:00 to 10:00" or "0900-1000"
   - Times embedded in sentences

2. Date formats to handle:
   - "Oct 20, 2025", "OCT 21", "2025-10-20", "20/10/2025"
   - Dates mentioned before or after event descriptions
   - Relative dates like "tomorrow" or "next Monday"

3. Time formats to normalize:
   - Military time: 0900, 1500, 2300 → convert to HH:MM:SS (09:00:00, 15:00:00, 23:00:00)
   - HRS/HOURS suffix: "@ 1500 HOURS" → 15:00:00
   - Range: "0900-1000" → start: 09:00:00, end: 10:00:00
   - AM/PM: "9:00 AM" → 09:00:00

4. Output format (STRICT JSON):
{
  "events": [
    {
      "event_date": "YYYY-MM-DD",
      "start_time": "HH:MM:SS",
      "end_time": "HH:MM:SS or null",
      "description": "Clean event description"
    }
  ]
}

5. If dates/times are ambiguous, make intelligent guesses based on context.
6. Extract EVERY event - missing events is worse than minor inaccuracies.
7. Clean up descriptions - remove extra whitespace, special characters.`
        },
        {
          role: "user",
          content: `Extract all events from this Schedule of Events document:\n\n${text}`
        }
      ],
      response_format: { type: "json_object" }
    }),
  });

  const result = await response.json();
  const parsed = JSON.parse(result.choices[0].message.content);
  const events = parsed.events || [];
  
  // Add source_pdf to each event and ensure proper formatting
  return events.map((event: any) => ({
    event_date: event.event_date,
    start_time: event.start_time?.length === 5 ? `${event.start_time}:00` : event.start_time,
    end_time: event.end_time?.length === 5 ? `${event.end_time}:00` : event.end_time,
    description: event.description,
    source_pdf: fileName,
  }));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { filePath, fileName } = await req.json();

    console.log("Processing PDF:", fileName);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Download the PDF from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("pdfs")
      .download(filePath);

    if (downloadError) {
      console.error("Download error:", downloadError);
      throw downloadError;
    }

    console.log("PDF downloaded, size:", fileData.size);

    // Extract text from PDF using AI
    console.log("Extracting text from PDF...");
    const extractedText = await extractTextFromPDF(fileData);
    console.log("Text extracted, length:", extractedText.length);

    // Parse events from extracted text
    console.log("Parsing events from text...");
    const events = await parseEventsFromText(extractedText, fileName);
    console.log("Events parsed:", events.length);

    if (events.length === 0) {
      console.warn("No events found in PDF");
      return new Response(
        JSON.stringify({
          success: true,
          eventsExtracted: 0,
          message: "No events found in PDF",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Insert events into database
    const { error: insertError } = await supabase
      .from("events")
      .insert(events);

    if (insertError) {
      console.error("Insert error:", insertError);
      throw insertError;
    }

    console.log("Events inserted successfully");

    return new Response(
      JSON.stringify({
        success: true,
        eventsExtracted: events.length,
        message: "PDF processed successfully",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error processing PDF:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

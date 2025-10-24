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
          content: `You are an expert AI Agent specialized in extracting ALL event information from Schedule of Events (SOF) documents, particularly maritime vessel SOF documents.

CRITICAL EXTRACTION RULES:
1. Extract EVERY SINGLE EVENT from the document. Common patterns include:
   - "DESCRIPTION: ON [DATE] @ [TIME] HOURS"
   - "@ [TIME] HRS: DESCRIPTION"
   - "ON [DATE] @ [TIME]-[TIME] HRS: DESCRIPTION"
   - "[TIME]-[TIME] HRS: DESCRIPTION"
   - Lines starting with "@" followed by time and description
   - Lines ending with "HOURS" or "HRS"

2. Date formats you MUST handle:
   - "APR. 19, 2024", "APRIL 19, 2024", "APR 19, 2024"
   - "MAY 04, 2024", "MAY. 04, 2024"
   - "OCT 21", "Oct 20, 2025"
   - If date is only mentioned once (e.g., "ON APRIL 20, 2024"), apply it to ALL subsequent events until a new date appears
   - Default to the most recent date mentioned if not explicitly stated

3. Time formats you MUST normalize:
   - Military time: "1540", "0800", "1724" → "15:40:00", "08:00:00", "17:24:00"
   - Time ranges: "1724-1830" → start: "17:24:00", end: "18:30:00"
   - Time ranges: "0800-1000" → start: "08:00:00", end: "10:00:00"
   - Single times: "@ 1654 HRS" → start: "16:54:00", end: null
   - Handle "HRS", "HOURS", "HRS.", "HRS:" suffixes

4. Description cleaning:
   - Remove date/time prefixes like "ON APR. 19, 2024 @", "@ 1540 HRS:", etc.
   - Keep the meaningful event description
   - Example: "ON APR. 19, 2024 @ 1540 HOURS: NOTICE OF READINESS TENDERED" → "NOTICE OF READINESS TENDERED"
   - Preserve important details but remove redundant formatting

5. STRICT JSON Output format:
{
  "events": [
    {
      "event_date": "2024-04-19",
      "start_time": "15:40:00",
      "end_time": "16:54:00",
      "description": "VESSEL ARRIVED AT SRIRACHA PILOT STATION"
    }
  ]
}

6. Context awareness:
   - If a date appears like "ON APRIL 20, 2024" and then multiple events follow with just times, apply that date to all those events
   - Look for section headers that indicate dates
   - Be intelligent about inferring dates from context

7. IGNORE:
   - Table headers
   - Page numbers
   - Company names and addresses
   - Vessel names and details at the top
   - Lines like "TO BE CONTINUED"
   - Pure metadata without events

8. YOUR PRIMARY GOAL: Extract EVERY SINGLE EVENT. Missing events is the worst outcome. If unsure about a date, make an intelligent guess based on surrounding context.`
        },
        {
          role: "user",
          content: `Extract ALL events from this Schedule of Events document. Be thorough and extract every single event line:\n\n${text}`
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

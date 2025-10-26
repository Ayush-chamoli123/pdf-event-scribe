import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "https://deno.land/x/xhr@0.3.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function extractAndParseEventsFromPDF(pdfUrl: string, fileName: string): Promise<any[]> {
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
          content: `You are an expert AI Agent specialized in extracting event information from documents. Extract ALL events with dates and times.

CRITICAL EXTRACTION RULES:
1. Extract EVERY event with a date and time
2. Date formats: "APR. 19, 2024", "APRIL 19, 2024", "APR 19, 2024", "May 04, 2024"
3. Time formats: Military time "1540", "0800" → "15:40:00", "08:00:00"
4. Time ranges: "1724-1830" → start: "17:24:00", end: "18:30:00"
5. Output format (JSON):
{
  "events": [
    {
      "event_date": "2024-04-19",
      "start_time": "15:40:00",
      "end_time": "16:54:00",
      "description": "VESSEL ARRIVED AT SRIRACHA PILOT STATION"
    }
  ]
}`
        },
        {
          role: "user",
          content: `Extract ALL events with dates and times from this document: ${pdfUrl}`
        }
      ],
      response_format: { type: "json_object" }
    }),
  });

  if (!response.ok) {
    if (response.status === 429) throw new Error("AI rate limit exceeded. Please retry shortly.");
    if (response.status === 402) throw new Error("AI credits exhausted. Please top up usage.");
    const errorText = await response.text();
    throw new Error(`AI gateway error (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  const parsed = JSON.parse(result.choices[0].message.content);
  const events = parsed.events || [];
  
  // Add source_pdf to each event
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
    const { filePath, fileName, documentId } = await req.json();

    console.log("Processing PDF:", fileName, "Document ID:", documentId);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get public URL for the PDF
    const { data: urlData } = supabase.storage
      .from("pdfs")
      .getPublicUrl(filePath);

    if (!urlData?.publicUrl) {
      throw new Error("Could not generate public URL for PDF");
    }

    console.log("Processing PDF from URL:", urlData.publicUrl);

    // Extract and parse events directly from PDF URL
    console.log("Extracting events from PDF...");
    const events = await extractAndParseEventsFromPDF(urlData.publicUrl, fileName);
    console.log("Events extracted:", events.length);

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

    // Update document status to completed
    if (documentId) {
      const { error: updateError } = await supabase
        .from("documents")
        .update({
          status: 'completed',
          events_count: events.length,
          completed_at: new Date().toISOString()
        })
        .eq('id', documentId);

      if (updateError) {
        console.error("Error updating document status:", updateError);
      } else {
        console.log("Document status updated to completed");
      }
    }

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

    // Update document status to failed if documentId provided
    const { documentId } = await req.json().catch(() => ({}));
    if (documentId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      await supabase
        .from("documents")
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : "Unknown error"
        })
        .eq('id', documentId);
    }

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

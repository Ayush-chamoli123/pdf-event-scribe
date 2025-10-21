import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

    // Mock event extraction - in production, this would use OCR
    // For now, we'll create sample events to demonstrate the system
    const mockEvents = [
      {
        event_date: new Date().toISOString().split("T")[0],
        start_time: "09:00:00",
        end_time: "10:00:00",
        description: `Sample event from ${fileName}`,
        source_pdf: fileName,
      },
      {
        event_date: new Date(Date.now() + 86400000).toISOString().split("T")[0],
        start_time: "14:00:00",
        end_time: "15:30:00",
        description: `Another event from ${fileName}`,
        source_pdf: fileName,
      },
    ];

    // Insert events into database
    const { error: insertError } = await supabase
      .from("events")
      .insert(mockEvents);

    if (insertError) {
      console.error("Insert error:", insertError);
      throw insertError;
    }

    console.log("Events inserted successfully");

    return new Response(
      JSON.stringify({
        success: true,
        eventsExtracted: mockEvents.length,
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

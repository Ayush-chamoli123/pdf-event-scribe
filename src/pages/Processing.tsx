import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, RefreshCw, Clock, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import EventsTable from "@/components/EventsTable";
import { format } from "date-fns";

interface Event {
  id: string;
  event_date: string;
  start_time: string;
  end_time: string | null;
  description: string;
  source_pdf: string;
  created_at: string;
}

const Processing = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedPdf, setSelectedPdf] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
    const channel = supabase
      .channel("processing-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, () => {
        fetchEvents();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setEvents(data || []);
      if (data && data.length > 0 && !selectedPdf) {
        setSelectedPdf(data[0].source_pdf);
      }
    } catch (error) {
      console.error("Error:", error);
      toast({ title: "Error", description: "Failed to load data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const uniquePdfs = Array.from(new Set(events.map(e => e.source_pdf)));
  const filteredEvents = selectedPdf ? events.filter(e => e.source_pdf === selectedPdf) : events;

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-start mb-8">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Processing Queue</h1>
              <p className="text-muted-foreground mt-1">Monitor document processing and view extracted events</p>
            </div>
          </div>
          <Button variant="outline" onClick={fetchEvents}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <Card className="p-6">
              <h2 className="font-semibold mb-4">Documents</h2>
              <div className="space-y-2">
                {loading ? (
                  <p className="text-center py-4 text-muted-foreground">Loading...</p>
                ) : uniquePdfs.length === 0 ? (
                  <p className="text-center py-4 text-muted-foreground">No documents</p>
                ) : (
                  uniquePdfs.map((pdf) => {
                    const pdfEvents = events.filter(e => e.source_pdf === pdf);
                    const latestEvent = pdfEvents[0];
                    const isSelected = selectedPdf === pdf;
                    return (
                      <button
                        key={pdf}
                        onClick={() => setSelectedPdf(pdf)}
                        className={`w-full text-left p-4 rounded-lg border transition-colors ${
                          isSelected ? "border-blue-600 bg-blue-50" : "border-border hover:bg-accent"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <Clock className="w-5 h-5 text-orange-500 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">({pdfEvents.length}) {pdf}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded">Processing</span>
                              <span className="text-xs text-muted-foreground">
                                {latestEvent && format(new Date(latestEvent.created_at), "MMM dd, HH:mm")}
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </Card>
          </div>

          <div className="lg:col-span-2">
            {selectedPdf ? (
              <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <FileText className="w-6 h-6 text-blue-600" />
                    <div>
                      <h2 className="font-semibold">Extracted Events</h2>
                      <p className="text-sm text-muted-foreground">{filteredEvents.length} events found</p>
                    </div>
                  </div>
                </div>
                <EventsTable />
              </Card>
            ) : (
              <div className="flex items-center justify-center h-96 bg-card rounded-2xl border">
                <div className="text-center">
                  <ArrowLeft className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-xl font-semibold mb-2">Select a Document</h3>
                  <p className="text-muted-foreground">Choose a document from the list to view processing details and results</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Processing;

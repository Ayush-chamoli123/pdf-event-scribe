import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, RefreshCw, Clock, FileText, CheckCircle, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import EventsTable from "@/components/EventsTable";
import { format } from "date-fns";

interface Document {
  id: string;
  filename: string;
  file_path: string;
  status: 'processing' | 'completed' | 'failed';
  events_count: number;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

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
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const docsChannel = supabase
      .channel("documents-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "documents" }, () => {
        fetchData();
      })
      .subscribe();
    const eventsChannel = supabase
      .channel("events-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, () => {
        if (selectedDoc) fetchEventsForDocument(selectedDoc.filename);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(docsChannel);
      supabase.removeChannel(eventsChannel);
    };
  }, []);

  const fetchData = async () => {
    try {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setDocuments((data || []) as Document[]);
      if (data && data.length > 0 && !selectedDoc) {
        setSelectedDoc(data[0] as Document);
        fetchEventsForDocument(data[0].filename);
      }
    } catch (error) {
      console.error("Error:", error);
      toast({ title: "Error", description: "Failed to load documents", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchEventsForDocument = async (filename: string) => {
    try {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("source_pdf", filename)
        .order("event_date", { ascending: true });
      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleSelectDoc = (doc: Document) => {
    setSelectedDoc(doc);
    fetchEventsForDocument(doc.filename);
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'completed':
        return { icon: CheckCircle, color: 'bg-green-100 text-green-700', label: 'Completed' };
      case 'processing':
        return { icon: Clock, color: 'bg-orange-100 text-orange-700', label: 'Processing' };
      case 'failed':
        return { icon: AlertCircle, color: 'bg-red-100 text-red-700', label: 'Failed' };
      default:
        return { icon: Clock, color: 'bg-slate-100 text-slate-700', label: 'Unknown' };
    }
  };

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
          <Button variant="outline" onClick={fetchData}>
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
                ) : documents.length === 0 ? (
                  <p className="text-center py-4 text-muted-foreground">No documents</p>
                ) : (
                  documents.map((doc) => {
                    const isSelected = selectedDoc?.id === doc.id;
                    const statusConfig = getStatusConfig(doc.status);
                    const StatusIcon = statusConfig.icon;
                    return (
                      <button
                        key={doc.id}
                        onClick={() => handleSelectDoc(doc)}
                        className={`w-full text-left p-4 rounded-lg border transition-colors ${
                          isSelected ? "border-blue-600 bg-blue-50" : "border-border hover:bg-accent"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <StatusIcon className={`w-5 h-5 mt-0.5 ${
                            doc.status === 'completed' ? 'text-green-500' :
                            doc.status === 'failed' ? 'text-red-500' : 'text-orange-500'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">({doc.events_count}) {doc.filename}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge className={`${statusConfig.color} text-xs border-none`}>
                                {statusConfig.label}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(doc.created_at), "MMM dd, HH:mm")}
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
            {selectedDoc ? (
              <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <FileText className="w-6 h-6 text-blue-600" />
                    <div>
                      <h2 className="font-semibold">Extracted Events</h2>
                      <p className="text-sm text-muted-foreground">{events.length} events found</p>
                    </div>
                  </div>
                  {selectedDoc.status === 'completed' && (
                    <Badge className="bg-green-100 text-green-700 border-none">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Processing Complete
                    </Badge>
                  )}
                </div>
                {selectedDoc.status === 'failed' && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700">
                      <strong>Error:</strong> {selectedDoc.error_message || 'Processing failed'}
                    </p>
                  </div>
                )}
                <EventsTable events={events} />
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

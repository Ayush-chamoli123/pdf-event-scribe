import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { FileText, CheckCircle, Clock, TrendingUp, AlertCircle, Plus, RefreshCw, Eye, Zap } from "lucide-react";
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

const Dashboard = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchEvents();
    const channel = supabase
      .channel("dashboard-changes")
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
    } catch (error) {
      console.error("Error:", error);
      toast({ title: "Error", description: "Failed to load data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const uniquePdfs = new Set(events.map((e) => e.source_pdf)).size;
  const recentDocs = Array.from(new Set(events.map(e => e.source_pdf))).slice(0, 5);

  const StatCard = ({ title, value, icon: Icon, gradient }: any) => (
    <Card className="p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground mb-1">{title}</p>
          <p className="text-3xl font-bold">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </Card>
  );

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Document Intelligence Center</h1>
            <p className="text-muted-foreground">Multi-agent AI system for comprehensive event extraction</p>
          </div>
          <Link to="/upload">
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Process New Document
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <StatCard title="TOTAL DOCUMENTS" value={uniquePdfs} icon={FileText} gradient="from-blue-500 to-blue-600" />
          <StatCard title="COMPLETED" value={uniquePdfs} icon={CheckCircle} gradient="from-green-500 to-green-600" />
          <StatCard title="PROCESSING" value={0} icon={Clock} gradient="from-orange-500 to-orange-600" />
          <StatCard title="EVENTS EXTRACTED" value={events.length} icon={TrendingUp} gradient="from-purple-500 to-purple-600" />
          <StatCard title="AVG TIME (S)" value="0.0" icon={AlertCircle} gradient="from-indigo-500 to-indigo-600" />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">Recent Documents</h2>
                <Button variant="ghost" size="sm" onClick={fetchEvents}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
              </div>
              <div className="space-y-3">
                {loading ? (
                  <p className="text-center py-8 text-muted-foreground">Loading...</p>
                ) : recentDocs.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">No documents yet</p>
                ) : (
                  recentDocs.map((pdf, idx) => {
                    const docEvents = events.filter(e => e.source_pdf === pdf);
                    const latestEvent = docEvents[0];
                    return (
                      <div key={idx} className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors">
                        <div className="flex items-center gap-3">
                          <Clock className="w-5 h-5 text-orange-500" />
                          <div>
                            <p className="font-medium">({docEvents.length}) {pdf}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">uploaded</span>
                              <span className="text-xs text-muted-foreground">
                                {latestEvent && format(new Date(latestEvent.created_at), "MMM dd, yyyy 'at' h:mm a")}
                              </span>
                            </div>
                          </div>
                        </div>
                        <Link to="/processing">
                          <Button variant="ghost" size="sm">
                            <Eye className="w-4 h-4 mr-2" />
                            View
                          </Button>
                        </Link>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          </div>

          <div>
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-6">
                <Zap className="w-5 h-5 text-blue-600" />
                <h2 className="text-xl font-semibold">Processing Insights</h2>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-sm text-muted-foreground">Success Rate</span>
                  </div>
                  <span className="text-lg font-semibold text-green-600">0.0%</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <span className="text-sm text-muted-foreground">Avg Confidence</span>
                  </div>
                  <span className="text-lg font-semibold text-blue-600">0.0%</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                    <span className="text-sm text-muted-foreground">Avg Processing Time</span>
                  </div>
                  <span className="text-lg font-semibold text-orange-600">0.0s</span>
                </div>
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground">Total Events Extracted</p>
                  <p className="text-2xl font-bold text-blue-600 mt-1">{events.length}</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

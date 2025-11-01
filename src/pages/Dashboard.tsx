import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { FileText, CheckCircle, Clock, TrendingUp, AlertCircle, Plus, RefreshCw, Eye, Zap } from "lucide-react";
import { format } from "date-fns";

interface Document {
  id: string;
  filename: string;
  status: 'processing' | 'completed' | 'failed';
  events_count: number;
  created_at: string;
  completed_at: string | null;
  processing_time_seconds: number | null;
  confidence_score: number | null;
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

const Dashboard = () => {
  console.log("Dashboard component rendering");
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel("dashboard-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "documents" }, () => {
        fetchData();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
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
    } catch (error) {
      console.error("Error:", error);
      toast({ title: "Error", description: "Failed to load data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const totalDocs = documents.length;
  const completedDocs = documents.filter(d => d.status === 'completed').length;
  const processingDocs = documents.filter(d => d.status === 'processing').length;
  const totalEvents = documents.reduce((sum, d) => sum + d.events_count, 0);
  const recentDocs = documents.slice(0, 5);

  // Calculate metrics
  const successRate = totalDocs > 0 ? ((completedDocs / totalDocs) * 100).toFixed(1) : '0.0';
  
  const completedDocsWithTime = documents.filter(d => d.status === 'completed' && d.processing_time_seconds);
  const avgProcessingTime = completedDocsWithTime.length > 0
    ? (completedDocsWithTime.reduce((sum, d) => sum + (d.processing_time_seconds || 0), 0) / completedDocsWithTime.length).toFixed(1)
    : '0.0';
  
  const completedDocsWithConfidence = documents.filter(d => d.status === 'completed' && d.confidence_score);
  const avgConfidence = completedDocsWithConfidence.length > 0
    ? (completedDocsWithConfidence.reduce((sum, d) => sum + (d.confidence_score || 0), 0) / completedDocsWithConfidence.length).toFixed(1)
    : '0.0';

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'completed': return CheckCircle;
      case 'processing': return Clock;
      case 'failed': return AlertCircle;
      default: return FileText;
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'completed': return 'text-green-500';
      case 'processing': return 'text-orange-500';
      case 'failed': return 'text-red-500';
      default: return 'text-slate-500';
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'completed': return 'bg-green-100 text-green-700';
      case 'processing': return 'bg-orange-100 text-orange-700';
      case 'failed': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

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
          <StatCard title="TOTAL DOCUMENTS" value={totalDocs} icon={FileText} gradient="from-blue-500 to-blue-600" />
          <StatCard title="COMPLETED" value={completedDocs} icon={CheckCircle} gradient="from-green-500 to-green-600" />
          <StatCard title="PROCESSING" value={processingDocs} icon={Clock} gradient="from-orange-500 to-orange-600" />
          <StatCard title="EVENTS EXTRACTED" value={totalEvents} icon={TrendingUp} gradient="from-purple-500 to-purple-600" />
          <StatCard title="AVG TIME (S)" value={avgProcessingTime} icon={AlertCircle} gradient="from-indigo-500 to-indigo-600" />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">Recent Documents</h2>
                <Button variant="ghost" size="sm" onClick={fetchData}>
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
                  recentDocs.map((doc) => {
                    const StatusIcon = getStatusIcon(doc.status);
                    return (
                      <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors">
                        <div className="flex items-center gap-3">
                          <StatusIcon className={`w-5 h-5 ${getStatusColor(doc.status)}`} />
                          <div>
                            <p className="font-medium">({doc.events_count}) {doc.filename}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-xs px-2 py-1 rounded ${getStatusBadge(doc.status)}`}>
                                {doc.status}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(doc.created_at), "MMM dd, yyyy 'at' h:mm a")}
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
                  <span className="text-lg font-semibold text-green-600">{successRate}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <span className="text-sm text-muted-foreground">Avg Confidence</span>
                  </div>
                  <span className="text-lg font-semibold text-blue-600">{avgConfidence}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                    <span className="text-sm text-muted-foreground">Avg Processing Time</span>
                  </div>
                  <span className="text-lg font-semibold text-orange-600">{avgProcessingTime}s</span>
                </div>
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground">Total Events Extracted</p>
                  <p className="text-2xl font-bold text-blue-600 mt-1">{totalEvents}</p>
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

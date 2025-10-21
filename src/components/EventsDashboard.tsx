import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Clock, FileText, TrendingUp } from "lucide-react";
import { format } from "date-fns";

interface Event {
  id: string;
  event_date: string;
  start_time: string;
  end_time: string | null;
  description: string;
  source_pdf: string;
}

interface DayStats {
  date: string;
  count: number;
}

const EventsDashboard = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchEvents();

    const channel = supabase
      .channel("events-dashboard-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "events",
        },
        () => {
          fetchEvents();
        }
      )
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
        .order("event_date", { ascending: true });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error("Error fetching events:", error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const totalEvents = events.length;

  const uniquePdfs = new Set(events.map((e) => e.source_pdf)).size;

  const eventsByDay = events.reduce((acc, event) => {
    const date = event.event_date;
    acc[date] = (acc[date] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const busiestDay = Object.entries(eventsByDay).sort(
    ([, a], [, b]) => b - a
  )[0];

  const earliestEvent = events.length > 0 ? events[0] : null;
  const latestEvent = events.length > 0 ? events[events.length - 1] : null;

  const topDays: DayStats[] = Object.entries(eventsByDay)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  if (loading) {
    return (
      <Card className="p-8">
        <p className="text-center text-muted-foreground">Loading dashboard...</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-primary/10">
              <Calendar className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Events</p>
              <p className="text-2xl font-bold">{totalEvents}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-accent/10">
              <FileText className="h-6 w-6 text-accent" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">PDF Files</p>
              <p className="text-2xl font-bold">{uniquePdfs}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-primary/10">
              <TrendingUp className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Busiest Day</p>
              <p className="text-lg font-bold">
                {busiestDay ? `${busiestDay[1]} events` : "-"}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-accent/10">
              <Clock className="h-6 w-6 text-accent" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Date Range</p>
              <p className="text-sm font-bold">
                {earliestEvent && latestEvent
                  ? `${Object.keys(eventsByDay).length} days`
                  : "-"}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Top Event Days</h3>
          {topDays.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              No data available
            </p>
          ) : (
            <div className="space-y-3">
              {topDays.map((day) => (
                <div
                  key={day.date}
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary"
                >
                  <span className="font-medium">
                    {format(new Date(day.date), "MMM dd, yyyy")}
                  </span>
                  <span className="text-sm font-bold text-primary">
                    {day.count} events
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold mb-4">Timeline</h3>
          {!earliestEvent || !latestEvent ? (
            <p className="text-center py-8 text-muted-foreground">
              No data available
            </p>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-secondary">
                <p className="text-sm text-muted-foreground mb-1">
                  Earliest Event
                </p>
                <p className="font-medium">
                  {format(new Date(earliestEvent.event_date), "MMMM dd, yyyy")}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  {earliestEvent.description}
                </p>
              </div>

              <div className="p-4 rounded-lg bg-secondary">
                <p className="text-sm text-muted-foreground mb-1">
                  Latest Event
                </p>
                <p className="font-medium">
                  {format(new Date(latestEvent.event_date), "MMMM dd, yyyy")}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  {latestEvent.description}
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default EventsDashboard;

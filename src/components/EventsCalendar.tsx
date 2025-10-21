import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Event {
  id: string;
  event_date: string;
  start_time: string;
  end_time: string | null;
  description: string;
  source_pdf: string;
}

const EventsCalendar = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchEvents();

    const channel = supabase
      .channel("events-calendar-changes")
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
        description: "Failed to load events",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const eventsOnSelectedDate = events.filter((event) => {
    if (!selectedDate) return false;
    const eventDate = new Date(event.event_date);
    return (
      eventDate.getFullYear() === selectedDate.getFullYear() &&
      eventDate.getMonth() === selectedDate.getMonth() &&
      eventDate.getDate() === selectedDate.getDate()
    );
  });

  const datesWithEvents = events.map((event) => new Date(event.event_date));

  if (loading) {
    return (
      <Card className="p-8">
        <p className="text-center text-muted-foreground">Loading calendar...</p>
      </Card>
    );
  }

  return (
    <div className="grid md:grid-cols-[1fr,2fr] gap-6">
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Select Date</h3>
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={setSelectedDate}
          className="rounded-md border"
          modifiers={{
            hasEvents: datesWithEvents,
          }}
          modifiersStyles={{
            hasEvents: {
              fontWeight: "bold",
              textDecoration: "underline",
            },
          }}
        />
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold mb-4">
          Events on {selectedDate ? format(selectedDate, "MMMM dd, yyyy") : "..."}
        </h3>

        {eventsOnSelectedDate.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No events on this date</p>
          </div>
        ) : (
          <div className="space-y-3">
            {eventsOnSelectedDate.map((event) => (
              <Card key={event.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary" className="font-mono">
                        {event.start_time}
                        {event.end_time && ` - ${event.end_time}`}
                      </Badge>
                    </div>
                    <p className="font-medium mb-1">{event.description}</p>
                    <p className="text-xs text-muted-foreground">
                      Source: {event.source_pdf}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default EventsCalendar;

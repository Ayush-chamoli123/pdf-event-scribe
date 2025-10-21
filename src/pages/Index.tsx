import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Table, BarChart3, Upload } from "lucide-react";
import PdfUpload from "@/components/PdfUpload";
import EventsTable from "@/components/EventsTable";
import EventsCalendar from "@/components/EventsCalendar";
import EventsDashboard from "@/components/EventsDashboard";

const Index = () => {
  const [activeTab, setActiveTab] = useState("upload");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold text-foreground">Event Manager</h1>
          <p className="text-sm text-muted-foreground">
            Upload and manage your event schedules
          </p>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-2xl mx-auto grid-cols-4 mb-8">
            <TabsTrigger value="upload" className="gap-2">
              <Upload className="h-4 w-4" />
              Upload
            </TabsTrigger>
            <TabsTrigger value="table" className="gap-2">
              <Table className="h-4 w-4" />
              Events
            </TabsTrigger>
            <TabsTrigger value="calendar" className="gap-2">
              <Calendar className="h-4 w-4" />
              Calendar
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="mt-0">
            <PdfUpload onUploadComplete={() => setActiveTab("table")} />
          </TabsContent>

          <TabsContent value="table" className="mt-0">
            <EventsTable />
          </TabsContent>

          <TabsContent value="calendar" className="mt-0">
            <EventsCalendar />
          </TabsContent>

          <TabsContent value="dashboard" className="mt-0">
            <EventsDashboard />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;

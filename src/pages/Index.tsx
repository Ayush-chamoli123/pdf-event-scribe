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
      <header className="border-b bg-card shadow-sm backdrop-blur-sm bg-card/80 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md">
              <Calendar className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Event Manager
              </h1>
              <p className="text-sm text-muted-foreground">
                Extract and manage events from PDF schedules
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-2xl mx-auto grid-cols-4 mb-8 h-12 p-1 bg-muted/50 backdrop-blur-sm">
            <TabsTrigger value="upload" className="gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Upload</span>
            </TabsTrigger>
            <TabsTrigger value="table" className="gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Table className="h-4 w-4" />
              <span className="hidden sm:inline">Events</span>
            </TabsTrigger>
            <TabsTrigger value="calendar" className="gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Calendar</span>
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
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

import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Upload, Activity, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const location = useLocation();
  console.log("Layout rendering, location:", location.pathname);

  const navItems = [
    { path: "/", icon: LayoutDashboard, label: "Dashboard" },
    { path: "/upload", icon: Upload, label: "Upload Document" },
    { path: "/processing", icon: Activity, label: "Processing Queue" },
  ];

  const agents = [
    { name: "Text Extractor", status: "active" },
    { name: "Event Detector", status: "active" },
    { name: "Date Validator", status: "active" },
    { name: "Accuracy Enhancer", status: "active" },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card p-6 flex flex-col">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg">AgentScribe</h1>
            <p className="text-xs text-muted-foreground">Multi-Agent Document AI</p>
          </div>
        </Link>

        {/* Navigation */}
        <nav className="space-y-1 mb-8">
          <p className="text-xs font-semibold text-muted-foreground mb-3 px-3">NAVIGATION</p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Agent Status */}
        <div className="mt-auto">
          <p className="text-xs font-semibold text-muted-foreground mb-3 px-3">AGENT STATUS</p>
          <div className="space-y-2">
            {agents.map((agent) => (
              <div
                key={agent.name}
                className="flex items-center justify-between px-3 py-2"
              >
                <span className="text-sm text-muted-foreground">{agent.name}</span>
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
};

export default Layout;

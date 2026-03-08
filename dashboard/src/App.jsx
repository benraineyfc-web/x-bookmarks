import { Component, lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { SidebarProvider } from "@/components/ui/sidebar";
import DashboardLayout from "./layouts/DashboardLayout";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Bookmarks = lazy(() => import("./pages/Bookmarks"));
const Import = lazy(() => import("./pages/Import"));
const Export = lazy(() => import("./pages/Export"));
const Tags = lazy(() => import("./pages/Tags"));
const Collections = lazy(() => import("./pages/Collections"));
const Categories = lazy(() => import("./pages/Categories"));

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-8">
          <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
          <p className="text-muted-foreground mb-4">{this.state.error?.message}</p>
          <button
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg"
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = "/"; }}
          >
            Go Home
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <h1 className="text-4xl font-bold mb-2">404</h1>
      <p className="text-muted-foreground mb-4">Page not found</p>
      <Link to="/" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg">
        Go Home
      </Link>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <TooltipProvider>
        <BrowserRouter>
          <SidebarProvider>
            <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><p className="text-muted-foreground">Loading...</p></div>}>
              <Routes>
                <Route element={<DashboardLayout />}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/bookmarks" element={<Bookmarks />} />
                  <Route path="/categories" element={<Categories />} />
                  <Route path="/import" element={<Import />} />
                  <Route path="/export" element={<Export />} />
                  <Route path="/tags" element={<Tags />} />
                  <Route path="/collections" element={<Collections />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Routes>
            </Suspense>
          </SidebarProvider>
        </BrowserRouter>
        <Toaster position="top-right" />
      </TooltipProvider>
    </ErrorBoundary>
  );
}

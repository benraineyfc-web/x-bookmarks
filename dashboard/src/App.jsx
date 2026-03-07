import { BrowserRouter, Routes, Route } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { SidebarProvider } from "@/components/ui/sidebar";
import DashboardLayout from "./layouts/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import Bookmarks from "./pages/Bookmarks";
import Import from "./pages/Import";
import Export from "./pages/Export";
import Tags from "./pages/Tags";
import Collections from "./pages/Collections";
import Categories from "./pages/Categories";

export default function App() {
  return (
    <TooltipProvider>
      <BrowserRouter>
        <SidebarProvider>
          <Routes>
            <Route element={<DashboardLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/bookmarks" element={<Bookmarks />} />
              <Route path="/categories" element={<Categories />} />
              <Route path="/import" element={<Import />} />
              <Route path="/export" element={<Export />} />
              <Route path="/tags" element={<Tags />} />
              <Route path="/collections" element={<Collections />} />
            </Route>
          </Routes>
        </SidebarProvider>
      </BrowserRouter>
      <Toaster position="top-right" />
    </TooltipProvider>
  );
}

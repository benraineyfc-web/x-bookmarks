import { Outlet } from "react-router-dom";
import { SidebarInset } from "@/components/ui/sidebar";
import AppSidebar from "../components/sidebar/Sidebar";

export default function DashboardLayout() {
  return (
    <>
      <AppSidebar />
      <SidebarInset>
        <div className="p-4 md:p-6">
          <Outlet />
        </div>
      </SidebarInset>
    </>
  );
}

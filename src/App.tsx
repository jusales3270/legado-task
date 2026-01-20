import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import AllBoards from "./pages/AllBoards";
import Favorites from "./pages/Favorites";
import Recent from "./pages/Recent";
import BoardView from "./pages/BoardView";
import BoardCalendarView from "./pages/BoardCalendarView";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import ClientPortal from "./pages/ClientPortal";
import { useEffect } from "react";

const queryClient = new QueryClient();

// Bypass Protection: Always renders children and ensures a session exists
function ProtectedRoute({ children, requiredRole }: { children: React.ReactNode; requiredRole?: string }) {
  // Auto-login logic for "No Login Screen" mode
  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (!userStr) {
      const mockUser = {
        id: 1,
        name: "Admin Bypass",
        email: "admin@demo.com",
        role: "admin"
      };
      localStorage.setItem("user", JSON.stringify(mockUser));
      console.log("Auto-logged in as Admin Bypass");
    }
  }, []);

  return <>{children}</>;
}

// Redirects root to Kanban (Admin view) by default
function AuthRedirect() {
  return <Navigate to="/kanban" replace />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" storageKey="taskflow-theme">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<AuthRedirect />} />
            {/* Login route kept accessible but not default */}
            <Route path="/login" element={<Login />} />

            <Route path="/client-portal" element={
              <ProtectedRoute requiredRole="client">
                <ClientPortal />
              </ProtectedRoute>
            } />

            <Route path="/kanban" element={
              <ProtectedRoute requiredRole="admin">
                <AllBoards />
              </ProtectedRoute>
            } />
            <Route path="/favorites" element={
              <ProtectedRoute requiredRole="admin">
                <Favorites />
              </ProtectedRoute>
            } />
            <Route path="/recent" element={
              <ProtectedRoute requiredRole="admin">
                <Recent />
              </ProtectedRoute>
            } />
            <Route path="/board/:id" element={
              <ProtectedRoute requiredRole="admin">
                <BoardView />
              </ProtectedRoute>
            } />
            <Route path="/board/:id/calendar" element={
              <ProtectedRoute requiredRole="admin">
                <BoardCalendarView />
              </ProtectedRoute>
            } />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;

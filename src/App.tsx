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

const queryClient = new QueryClient();

function ProtectedRoute({ children, requiredRole }: { children: React.ReactNode; requiredRole?: string }) {
  const userStr = localStorage.getItem("user");
  const location = useLocation();

  if (!userStr) {
    return <Navigate to="/login" replace />;
  }

  try {
    const user = JSON.parse(userStr);

    // Safety check: if user has no role, force logout to prevent infinite loops
    if (!user || !user.role) {
      console.error("User object missing role, forcing logout", user);
      localStorage.removeItem("user");
      return <Navigate to="/login" replace />;
    }

    if (requiredRole && user.role !== requiredRole) {
      // Prevent redirect loop: if we are already at the target path, logout instead
      const targetPath = user.role === "admin" ? "/kanban" : "/client-portal";

      // Use location.pathname from useLocation for reliable matching
      if (location.pathname === targetPath) {
        return <>{children}</>;
      }
      return <Navigate to={targetPath} replace />;
    }

    return <>{children}</>;
  } catch (e) {
    console.error("Auth error in ProtectedRoute:", e);
    localStorage.removeItem("user");
    return <Navigate to="/login" replace />;
  }
}

function AuthRedirect() {
  const userStr = localStorage.getItem("user");

  if (!userStr) {
    return <Navigate to="/login" replace />;
  }

  try {
    const user = JSON.parse(userStr);
    if (!user || !user.role) {
      localStorage.removeItem("user");
      return <Navigate to="/login" replace />;
    }
    return <Navigate to={user.role === "admin" ? "/kanban" : "/client-portal"} replace />;
  } catch (e) {
    localStorage.removeItem("user");
    return <Navigate to="/login" replace />;
  }
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

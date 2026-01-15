import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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
  
  if (!userStr) {
    return <Navigate to="/login" replace />;
  }
  
  const user = JSON.parse(userStr);
  
  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to={user.role === "admin" ? "/kanban" : "/client-portal"} replace />;
  }
  
  return <>{children}</>;
}

function AuthRedirect() {
  const userStr = localStorage.getItem("user");
  
  if (!userStr) {
    return <Navigate to="/login" replace />;
  }
  
  const user = JSON.parse(userStr);
  return <Navigate to={user.role === "admin" ? "/kanban" : "/client-portal"} replace />;
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

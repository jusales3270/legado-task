import { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutGrid, Star, Clock, Moon, Sun, Settings, LogOut, Bell, User, Camera, Lock, Pencil, Loader2, Menu, X } from "lucide-react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { useTheme } from "next-themes";
import { store } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import legadoLogo from "@/assets/logo-legado-digital.png";

interface LayoutProps {
  children: React.ReactNode;
  searchPlaceholder?: string;
}

export const Layout = ({ children, searchPlaceholder = "Buscar quadros, cartões..." }: LayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const favoriteBoards = store.getFavoriteBoards();
  const recentBoards = store.getRecentBoards();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 640) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // User state with ability to update
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("user") || "{}"));
  const userInitials = user.name ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) : "US";

  // Form states
  const [newName, setNewName] = useState(user.name || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = () => {
    localStorage.removeItem("user");
    toast({
      title: "Sessão encerrada",
      description: "Você foi desconectado com sucesso.",
    });
    navigate("/login");
  };

  const updateLocalUser = (updates: Partial<typeof user>) => {
    const updatedUser = { ...user, ...updates };
    setUser(updatedUser);
    localStorage.setItem("user", JSON.stringify(updatedUser));
  };

  const handleUpdateName = async () => {
    if (!newName.trim()) {
      toast({ title: "Erro", description: "O nome não pode estar vazio.", variant: "destructive" });
      return;
    }

    setIsUpdatingName(true);
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Falha ao atualizar nome");
      }

      const updatedUser = await response.json();
      updateLocalUser({ name: updatedUser.name });
      toast({ title: "Sucesso", description: "Nome atualizado com sucesso!" });
    } catch (error) {
      toast({ 
        title: "Erro", 
        description: error instanceof Error ? error.message : "Falha ao atualizar nome", 
        variant: "destructive" 
      });
    } finally {
      setIsUpdatingName(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      toast({ title: "Erro", description: "Preencha todos os campos de senha.", variant: "destructive" });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({ title: "Erro", description: "As senhas não coincidem.", variant: "destructive" });
      return;
    }

    if (newPassword.length < 4) {
      toast({ title: "Erro", description: "A nova senha deve ter pelo menos 4 caracteres.", variant: "destructive" });
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const response = await fetch(`/api/users/${user.id}/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Falha ao alterar senha");
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({ title: "Sucesso", description: "Senha alterada com sucesso!" });
    } catch (error) {
      toast({ 
        title: "Erro", 
        description: error instanceof Error ? error.message : "Falha ao alterar senha", 
        variant: "destructive" 
      });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({ title: "Erro", description: "Por favor, selecione uma imagem.", variant: "destructive" });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Erro", description: "A imagem deve ter no máximo 5MB.", variant: "destructive" });
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("photo", file);

      const response = await fetch(`/api/users/${user.id}/upload-photo`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Falha ao enviar foto");
      }

      const updatedUser = await response.json();
      updateLocalUser({ profilePhoto: updatedUser.profilePhoto });
      toast({ title: "Sucesso", description: "Foto atualizada com sucesso!" });
    } catch (error) {
      toast({ 
        title: "Erro", 
        description: error instanceof Error ? error.message : "Falha ao enviar foto", 
        variant: "destructive" 
      });
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="sm:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed sm:relative z-50 sm:z-auto
        w-64 h-full sm:h-auto
        border-r border-sidebar-border bg-sidebar p-5 shadow-sm
        transition-transform duration-300 ease-in-out
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full sm:translate-x-0"}
      `}>
        <div className="flex items-center justify-between mb-8">
          <Link to="/" className="flex items-center gap-3 rounded-xl bg-card px-3 py-2 shadow-sm border border-border flex-1">
            <img
              src={legadoLogo}
              alt="Legado Digital - Kanban e produtividade"
              className="h-10 w-auto"
            />
            <span className="text-xl font-semibold text-foreground tracking-tight">LegadoTask</span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="sm:hidden ml-2"
            onClick={() => setSidebarOpen(false)}
            data-testid="button-close-sidebar"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="space-y-1">
          <Link
            to="/"
            onClick={() => window.innerWidth < 640 && setSidebarOpen(false)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive("/")
                ? "bg-primary text-primary-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent"
            }`}
          >
            <LayoutGrid className="h-5 w-5" />
            Todos os quadros
          </Link>
          <Link
            to="/favorites"
            onClick={() => window.innerWidth < 640 && setSidebarOpen(false)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive("/favorites")
                ? "bg-primary text-primary-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent"
            }`}
          >
            <Star className="h-5 w-5" />
            Favoritos
          </Link>
          <Link
            to="/recent"
            onClick={() => window.innerWidth < 640 && setSidebarOpen(false)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive("/recent")
                ? "bg-primary text-primary-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent"
            }`}
          >
            <Clock className="h-5 w-5" />
            Recentes
          </Link>
        </nav>

        {favoriteBoards.length > 0 && (
          <div className="mt-6">
            <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              FAVORITOS
            </div>
            <div className="space-y-1">
              {favoriteBoards.map((board) => (
                <Link
                  key={board.id}
                  to={`/board/${board.id}`}
                  onClick={() => window.innerWidth < 640 && setSidebarOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent"
                >
                  <div className="h-4 w-4 rounded" style={{ backgroundColor: board.color }} />
                  <span className="truncate">{board.title}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border/60 bg-card/80 px-4 sm:px-8 py-4 shadow-sm backdrop-blur-sm gap-2">
          <div className="flex items-center gap-2 flex-1">
            <Button
              variant="ghost"
              size="icon"
              className="sm:hidden"
              onClick={() => setSidebarOpen(true)}
              data-testid="button-open-sidebar"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="relative w-full sm:w-96 max-w-full">
              <Input
                type="search"
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <Button variant="ghost" size="icon">
              <Bell className="h-5 w-5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" data-testid="button-user-menu">
                  <Avatar className="h-8 w-8">
                    {user.profilePhoto && <AvatarImage src={user.profilePhoto} alt={user.name} />}
                    <AvatarFallback className="bg-primary text-primary-foreground">{userInitials}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setSettingsOpen(true)} data-testid="button-settings">
                  <Settings className="mr-2 h-4 w-4" />Configurações
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={handleLogout} data-testid="button-logout">
                  <LogOut className="mr-2 h-4 w-4" />Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Configurações</DialogTitle>
            <DialogDescription>Gerencie suas preferências de conta e aparência.</DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="profile" className="mt-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="profile" data-testid="tab-profile">
                <User className="h-4 w-4 mr-2" />
                Perfil
              </TabsTrigger>
              <TabsTrigger value="security" data-testid="tab-security">
                <Lock className="h-4 w-4 mr-2" />
                Segurança
              </TabsTrigger>
              <TabsTrigger value="appearance" data-testid="tab-appearance">
                <Sun className="h-4 w-4 mr-2" />
                Aparência
              </TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-6 pt-4">
              {/* Profile Photo */}
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <Avatar className="h-24 w-24">
                    {user.profilePhoto && <AvatarImage src={user.profilePhoto} alt={user.name} />}
                    <AvatarFallback className="bg-primary text-primary-foreground text-2xl">{userInitials}</AvatarFallback>
                  </Avatar>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                    data-testid="input-photo-upload"
                  />
                  <Button
                    size="icon"
                    variant="secondary"
                    className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingPhoto}
                    data-testid="button-upload-photo"
                  >
                    {isUploadingPhoto ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Camera className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">Clique no ícone para alterar sua foto</p>
              </div>

              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <div className="flex gap-2">
                  <Input
                    id="name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Seu nome"
                    data-testid="input-name"
                  />
                  <Button 
                    onClick={handleUpdateName} 
                    disabled={isUpdatingName || newName === user.name}
                    data-testid="button-save-name"
                  >
                    {isUpdatingName ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {/* Email (read-only) */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={user.email || ""}
                  disabled
                  className="bg-muted"
                  data-testid="input-email"
                />
                <p className="text-xs text-muted-foreground">O email não pode ser alterado</p>
              </div>

              {/* Role (read-only) */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span>Tipo de conta: {user.role === "admin" ? "Administrador" : "Cliente"}</span>
              </div>
            </TabsContent>

            <TabsContent value="security" className="space-y-6 pt-4">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Alterar Senha</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="current-password">Senha Atual</Label>
                  <Input
                    id="current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Digite sua senha atual"
                    data-testid="input-current-password"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-password">Nova Senha</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Digite a nova senha"
                    data-testid="input-new-password"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirme a nova senha"
                    data-testid="input-confirm-password"
                  />
                </div>

                <Button 
                  onClick={handleChangePassword} 
                  disabled={isUpdatingPassword || !currentPassword || !newPassword || !confirmPassword}
                  className="w-full"
                  data-testid="button-change-password"
                >
                  {isUpdatingPassword ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Alterando...
                    </>
                  ) : (
                    <>
                      <Lock className="mr-2 h-4 w-4" />
                      Alterar Senha
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="appearance" className="space-y-6 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="dark-mode">Modo escuro</Label>
                  <p className="text-sm text-muted-foreground">Alternar entre tema claro e escuro</p>
                </div>
                <Switch
                  id="dark-mode"
                  checked={theme === "dark"}
                  onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                  data-testid="switch-dark-mode"
                />
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
};

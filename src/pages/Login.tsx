import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Lock, Mail, Upload, Settings } from "lucide-react";
import { useTheme } from "next-themes";
import loginLogo from "@/assets/logo-legado-digital-login.png";
import { EtherealBackground } from "@/components/ui/ethereal-background";

interface LoginResponse {
  id: number;
  email: string;
  name: string;
  role: string;
  profilePhoto?: string;
}

export default function Login() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const [clientEmail, setClientEmail] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  useEffect(() => {
    const previousTheme = theme;
    setTheme("dark");
    return () => {
      if (previousTheme && previousTheme !== "dark") {
        setTheme(previousTheme);
      }
    };
  }, []);

  const clientLoginMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await fetch("/api/auth/client-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorJson;
        try { errorJson = JSON.parse(errorText); } catch (e) { errorJson = { error: errorText }; }
        throw new Error(errorJson.error || "Falha no acesso");
      }

      return await response.json() as LoginResponse;
    },
    onSuccess: (data) => {
      localStorage.setItem("user", JSON.stringify(data));
      // Force hard redirect to ensure clean state
      setTimeout(() => {
        window.location.href = "/client-portal";
      }, 500);
    },
    onError: (error: Error) => {
      toast({
        title: "Falha no acesso",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const adminLoginMutation = useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Falha no login");
      }

      return await response.json() as LoginResponse;
    },
    onSuccess: (data) => {
      localStorage.setItem("user", JSON.stringify(data));
      // Force hard redirect to ensure clean state
      setTimeout(() => {
        if (data.role === "admin") {
          window.location.href = "/kanban";
        } else {
          window.location.href = "/client-portal";
        }
      }, 500);
    },
    onError: (error: Error) => {
      toast({
        title: "Falha no login",
        description: error.message === "Invalid credentials" ? "Credenciais inválidas" : error.message,
        variant: "destructive",
      });
    },
  });

  const handleClientSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    clientLoginMutation.mutate(clientEmail);
  };

  const handleAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    adminLoginMutation.mutate({ email: adminEmail, password: adminPassword });
  };

  return (
    <EtherealBackground
      className="bg-background"
      animation={{ scale: 60, speed: 12 }}
    >
      <div className="flex w-full items-center justify-center p-4">

        <Card className="relative w-full max-w-md bg-card/95 border-border backdrop-blur-sm shadow-2xl" data-testid="card-login">
          <CardHeader className="space-y-4 sm:space-y-6 text-center pb-2 px-4 sm:px-6">
            <div className="mx-auto">
              <img
                src={loginLogo}
                alt="Legado Digital"
                className="h-20 sm:h-28 w-auto mx-auto rounded-lg"
              />
            </div>
            <div>
              <CardTitle className="text-xl sm:text-2xl font-bold text-foreground">Bem-vindo</CardTitle>
              <CardDescription className="text-muted-foreground text-sm">
                Escolha como deseja acessar
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            <Tabs defaultValue="client" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="client" className="flex items-center gap-2" data-testid="tab-client">
                  <Upload className="w-4 h-4" />
                  Sou Cliente
                </TabsTrigger>
                <TabsTrigger value="admin" className="flex items-center gap-2" data-testid="tab-admin">
                  <Settings className="w-4 h-4" />
                  Administrativo
                </TabsTrigger>
              </TabsList>

              <TabsContent value="client">
                <form onSubmit={handleClientSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="client-email" className="text-foreground">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="client-email"
                        type="email"
                        placeholder="Digite seu email"
                        value={clientEmail}
                        onChange={(e) => setClientEmail(e.target.value)}
                        className="pl-10 bg-secondary/50 border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20"
                        required
                        data-testid="input-client-email"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Acesse diretamente para enviar seus arquivos
                    </p>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-6 transition-all duration-300 shadow-lg shadow-primary/25"
                    disabled={clientLoginMutation.isPending}
                    data-testid="button-client-access"
                  >
                    {clientLoginMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Acessando...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Acessar Portal
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="admin">
                <form onSubmit={handleAdminSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="admin-email" className="text-foreground">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="admin-email"
                        type="email"
                        placeholder="Digite seu email"
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        className="pl-10 bg-secondary/50 border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20"
                        required
                        data-testid="input-admin-email"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="admin-password" className="text-foreground">Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="admin-password"
                        type="password"
                        placeholder="Digite sua senha"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        className="pl-10 bg-secondary/50 border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20"
                        required
                        data-testid="input-admin-password"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-6 transition-all duration-300 shadow-lg shadow-primary/25"
                    disabled={adminLoginMutation.isPending}
                    data-testid="button-admin-login"
                  >
                    {adminLoginMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Entrando...
                      </>
                    ) : (
                      <>
                        <Lock className="mr-2 h-4 w-4" />
                        Entrar
                      </>
                    )}
                  </Button>
                </form>

                <div className="mt-4 text-center">
                  <p className="text-muted-foreground text-xs">
                    Demo: admin@demo.com (senha: 1234)
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </EtherealBackground>
  );
}

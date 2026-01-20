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
  const [logs, setLogs] = useState<string[]>([]);

  const appendLog = (msg: string) => {
    console.log(msg);
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()} - ${msg}`]);
  };

  useEffect(() => {
    const previousTheme = theme;
    setTheme("dark");
    appendLog("Componente Login montado");

    // Test connectivity
    fetch("/api/basic")
      .then(res => res.json().then(data => ({ status: res.status, data })))
      .then(res => appendLog(`Teste API (/api/basic): ${res.status} - ${JSON.stringify(res.data)}`))
      .catch(err => appendLog(`Erro API (/api/basic): ${err.message}`));

    return () => {
      if (previousTheme && previousTheme !== "dark") {
        setTheme(previousTheme);
      }
    };
  }, []);

  const clientLoginMutation = useMutation({
    mutationFn: async (email: string) => {
      appendLog(`Iniciando login de cliente: ${email}`);
      try {
        const response = await fetch("/api/auth/client-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });

        appendLog(`Status Resposta API: ${response.status} ${response.statusText}`);

        if (!response.ok) {
          const errorText = await response.text();
          appendLog(`Corpo Erro API: ${errorText}`);
          let errorJson;
          try { errorJson = JSON.parse(errorText); } catch (e) { errorJson = { error: errorText }; }
          throw new Error(errorJson.error || "Falha no acesso");
        }

        const data = await response.json();
        appendLog(`Dados Recebidos: ${JSON.stringify(data)}`);
        return data as LoginResponse;
      } catch (err: any) {
        appendLog(`Erro Catch Mutation: ${err.message}`);
        throw err;
      }
    },
    onSuccess: (data) => {
      appendLog("Sucesso! Salvando no localStorage e Redirecionando...");
      localStorage.setItem("user", JSON.stringify(data));

      // Force hard redirect
      setTimeout(() => {
        window.location.href = "/client-portal";
      }, 500);
    },
    onError: (error: Error) => {
      appendLog(`Erro Final: ${error.message}`);
      toast({
        title: "Falha no acesso",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const adminLoginMutation = useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      appendLog(`Iniciando login adm: ${credentials.email}`);
      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(credentials),
        });

        appendLog(`Status Resposta API: ${response.status}`);

        if (!response.ok) {
          const error = await response.json();
          appendLog(`Erro API: ${JSON.stringify(error)}`);
          throw new Error(error.error || "Falha no login");
        }

        const data = await response.json();
        appendLog(`Dados Adm Recebidos`);
        return data as LoginResponse;
      } catch (err: any) {
        appendLog(`Erro Catch Adm: ${err.message}`);
        throw err;
      }
    },
    onSuccess: (data) => {
      localStorage.setItem("user", JSON.stringify(data));
      appendLog("Sucesso Adm! Redirecionando...");

      setTimeout(() => {
        if (data.role === "admin") {
          window.location.href = "/kanban";
        } else {
          window.location.href = "/client-portal";
        }
      }, 500);
    },
    onError: (error: Error) => {
      appendLog(`Erro Final Adm: ${error.message}`);
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
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-background via-secondary to-background"></div>
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMyMDIwMjAiIGZpbGwtb3BhY2l0eT0iMC4xIj48Y2lyY2xlIGN4PSIxIiBjeT0iMSIgcj0iMSIvPjwvZz48L2c+PC9zdmc+')] opacity-20"></div>

      {/* Debug Panel */}
      <div className="z-50 w-full max-w-md bg-black/90 text-green-400 p-4 rounded mb-4 font-mono text-xs overflow-auto max-h-60 border border-green-500/50 shadow-lg">
        <h3 className="font-bold border-b border-green-500/30 mb-2 pb-1">DEBUG CONSOLE (Vercel Fix)</h3>
        {logs.length === 0 ? <span className="opacity-50">Pronto para iniciar...</span> : logs.map((log, i) => (
          <div key={i} className="whitespace-pre-wrap mb-1 border-b border-green-500/10 pb-1">{log}</div>
        ))}
      </div>

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
  );
}

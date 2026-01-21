import { useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Upload,
  Calendar as CalendarIcon,
  LogOut,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileVideo,
  X,
  Pause,
  Play,
} from "lucide-react";
import { cn } from "@/lib/utils";
import loginLogo from "@/assets/logo-legado-digital-login.png";

const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks
const PARALLEL_UPLOADS = 4; // Number of concurrent chunk uploads

type UrgencyLevel = "baixa" | "normal" | "urgente" | "critica";

interface PendingFile {
  file: File;
  name: string;
  size: number;
}

const urgencyConfig: Record<UrgencyLevel, { label: string; color: string; border: string; bg: string }> = {
  baixa: { label: "Baixa", color: "text-blue-400", border: "border-blue-500", bg: "bg-blue-500/20" },
  normal: { label: "Normal", color: "text-green-400", border: "border-green-500", bg: "bg-green-500/20" },
  urgente: { label: "Urgente", color: "text-orange-400", border: "border-orange-500", bg: "bg-orange-500/20" },
  critica: { label: "Crítica", color: "text-red-400", border: "border-red-500", bg: "bg-red-500/20" },
};

export default function ClientPortal() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [urgency, setUrgency] = useState<UrgencyLevel>("normal");
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [notes, setNotes] = useState("");
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const [chunksUploaded, setChunksUploaded] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);

  const isPausedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/login");
  };

  const handleFileSelect = (file: File) => {
    setUploadError(null);
    setPendingFile({
      file,
      name: file.name,
      size: file.size,
    });
    toast({
      title: "Arquivo selecionado",
      description: `${file.name} pronto para envio.`,
    });
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const removeFile = () => {
    setPendingFile(null);
    setUploadProgress(0);
    setUploadError(null);
  };

  const uploadChunk = async (
    uploadId: string,
    chunkIndex: number,
    chunk: Blob,
    signal: AbortSignal
  ): Promise<boolean> => {
    const formData = new FormData();
    formData.append("chunk", chunk);

    const response = await fetch(`/api/chunked-upload/${uploadId}/chunk/${chunkIndex}`, {
      method: "PUT",
      body: formData,
      signal,
    });

    return response.ok;
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!pendingFile) {
        throw new Error("No file selected");
      }

      setIsSubmitting(true);
      setUploadProgress(0);
      setIsPaused(false);
      isPausedRef.current = false;

      // Step 1: Create submission
      setUploadStatus("Criando envio...");
      const submissionResponse = await fetch("/api/client-submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: user.id,
          title: pendingFile.name,
          urgency,
          requestedDueDate: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
          notes,
        }),
      });

      if (!submissionResponse.ok) {
        throw new Error("Failed to create submission");
      }

      const submission = await submissionResponse.json();

      const file = pendingFile.file;
      const numChunks = Math.ceil(file.size / CHUNK_SIZE);
      setTotalChunks(numChunks);

      // Step 2: Direct Upload to Supabase
      setUploadStatus("Iniciando upload direto...");

      // Get Signed URL
      const urlResponse = await fetch("/api/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type || "application/octet-stream"
        }),
      });

      if (!urlResponse.ok) {
        const errorText = await urlResponse.text();
        console.error("Upload URL error:", errorText);
        try {
          const errorJson = JSON.parse(errorText);
          throw new Error(errorJson.error || "Falha ao preparar upload");
        } catch (e) {
          throw new Error(`Falha ao preparar upload: ${errorText}`);
        }
      }
      const { url: uploadUrl, publicUrl } = await urlResponse.json();

      // Upload directly to Supabase
      setUploadStatus("Enviando arquivo...");

      const uploadPromise = new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(progress);
          }
        });

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            console.error("Direct upload failed", xhr.status, xhr.responseText);
            reject(new Error("Falha no upload direto"));
          }
        };
        xhr.onerror = () => reject(new Error("Erro de rede no upload"));

        xhr.open("PUT", uploadUrl);
        // Supabase requires Content-Type header matches what was signed
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
        xhr.send(file);
      });

      await uploadPromise;

      // Step 3: Link attachment to submission
      setUploadStatus("Finalizando...");
      const linkResponse = await fetch(`/api/client-submissions/${submission.id}/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileUrl: publicUrl,
          fileType: file.type.split('/')[0],
          fileSize: file.size,
          mimeType: file.type
        }),
      });

      if (!linkResponse.ok) throw new Error("Falha ao vincular anexo");

      return submission;
    },
    onSuccess: () => {
      setIsSubmitting(false);
      setShowSuccess(true);
      setUploadStatus("");
      setUploadProgress(0); // Reset progress
    },
    onError: (error) => {
      console.error("Upload process error:", error);
      setIsSubmitting(false);
      setUploadStatus("");
      setUploadError(error instanceof Error ? error.message : "Erro desconhecido");

      toast({
        title: "Erro ao enviar",
        description: error instanceof Error ? error.message : "Não foi possível enviar o arquivo.",
        variant: "destructive",
      });
    },
  });

  const handlePauseResume = () => {
    if (isPaused) {
      isPausedRef.current = false;
      setIsPaused(false);
      toast({ title: "Upload retomado" });
    } else {
      isPausedRef.current = true;
      setIsPaused(true);
      toast({ title: "Upload pausado" });
    }
  };

  const handleSubmit = () => {
    if (!pendingFile) return;
    submitMutation.mutate();
  };

  const resetForm = () => {
    setShowSuccess(false);
    setPendingFile(null);
    setUploadProgress(0);
    setUrgency("normal");
    setDueDate(undefined);
    setNotes("");
    setUploadError(null);
    setIsSubmitting(false);
    setIsPaused(false);
    setUploadStatus("");
    setChunksUploaded(0);
    setTotalChunks(0);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
  };

  if (showSuccess) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-center space-y-8 animate-in fade-in zoom-in duration-500">
          <div className="mx-auto w-24 h-24 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center shadow-2xl shadow-green-500/30 animate-bounce">
            <CheckCircle2 className="w-12 h-12 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-white mb-4">Arquivo Enviado!</h1>
            <p className="text-gray-400 text-lg">Seu arquivo foi recebido com sucesso.</p>
          </div>
          <Button
            onClick={resetForm}
            className="bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white font-semibold px-8 py-6 text-lg"
            data-testid="button-send-another"
          >
            Enviar Outro Arquivo
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <header className="border-b border-gray-800 bg-black/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <img
              src={loginLogo}
              alt="Legado Digital"
              className="h-8 sm:h-12 w-auto rounded-lg"
            />
            <div className="hidden sm:block">
              <h1 className="text-white font-semibold">Portal do Cliente</h1>
              <p className="text-gray-400 text-sm">Olá, {user.name || "Cliente"}</p>
            </div>
            <div className="sm:hidden">
              <p className="text-gray-400 text-xs">Olá, {user.name?.split(' ')[0] || "Cliente"}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-gray-400 hover:text-white hover:bg-gray-800"
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <Card className="bg-zinc-900 border-zinc-800" data-testid="card-upload-form">
          <CardHeader className="pb-3 sm:pb-6">
            <CardTitle className="text-lg sm:text-xl text-white">Enviar Arquivo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 sm:space-y-6">
            <div className="space-y-2">
              <Label className="text-gray-300">Urgência</Label>
              <Select value={urgency} onValueChange={(v) => setUrgency(v as UrgencyLevel)}>
                <SelectTrigger
                  className={cn(
                    "bg-gray-700/50 text-white transition-all duration-300",
                    urgencyConfig[urgency].border
                  )}
                  data-testid="select-urgency"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {Object.entries(urgencyConfig).map(([key, config]) => (
                    <SelectItem
                      key={key}
                      value={key}
                      className="text-white hover:bg-gray-700 focus:bg-gray-700"
                    >
                      <div className="flex items-center gap-2">
                        <span className={cn("w-2 h-2 rounded-full", config.bg.replace("/20", ""))} />
                        <span className={config.color}>{config.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">Prazo de Entrega</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal bg-gray-700/50 border-gray-600 text-white hover:bg-gray-700 hover:text-white",
                      !dueDate && "text-gray-500"
                    )}
                    data-testid="button-date-picker"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, "PPP", { locale: ptBR }) : "Selecione uma data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-gray-800 border-gray-700">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={setDueDate}
                    initialFocus
                    className="bg-gray-800 text-white"
                    data-testid="calendar-deadline"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">Arquivo de Vídeo</Label>

              {!pendingFile && !isSubmitting && (
                <div
                  className={cn(
                    "border-2 border-dashed rounded-xl p-4 sm:p-8 text-center transition-all duration-300 cursor-pointer",
                    isDragging
                      ? "border-cyan-500 bg-cyan-500/10"
                      : "border-gray-600 hover:border-gray-500 bg-gray-700/30"
                  )}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => document.getElementById("file-input")?.click()}
                  data-testid="dropzone-upload"
                >
                  <input
                    id="file-input"
                    type="file"
                    accept="video/*,audio/*"
                    onChange={handleInputChange}
                    className="hidden"
                  />
                  <Upload className="w-8 h-8 sm:w-12 sm:h-12 text-gray-500 mx-auto mb-2 sm:mb-4" />
                  <p className="text-gray-300 font-medium mb-1 sm:mb-2 text-sm sm:text-base">
                    <span className="hidden sm:inline">Arraste e solte seu arquivo aqui</span>
                    <span className="sm:hidden">Toque para selecionar</span>
                  </p>
                  <p className="text-gray-500 text-xs sm:text-sm">
                    <span className="hidden sm:inline">ou clique para selecionar </span>(até 2GB)
                  </p>
                </div>
              )}

              {isSubmitting && (
                <div className="border border-gray-600 rounded-xl p-6 bg-gray-700/30">
                  <div className="flex items-center gap-4 mb-4">
                    {isPaused ? (
                      <Pause className="w-8 h-8 text-yellow-500" />
                    ) : (
                      <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
                    )}
                    <div className="flex-1">
                      <p className="text-white font-medium">
                        {isPaused ? "Upload pausado" : uploadStatus || "Enviando arquivo..."}
                      </p>
                      <p className="text-gray-400 text-sm">
                        {uploadProgress}% concluído
                        {totalChunks > 1 && ` (parte ${chunksUploaded}/${totalChunks})`}
                      </p>
                    </div>
                    {totalChunks > 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePauseResume}
                        className="border-gray-500 text-gray-300 hover:bg-gray-700"
                        data-testid="button-pause-resume"
                      >
                        {isPaused ? (
                          <>
                            <Play className="w-4 h-4 mr-1" />
                            Continuar
                          </>
                        ) : (
                          <>
                            <Pause className="w-4 h-4 mr-1" />
                            Pausar
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                  {pendingFile && pendingFile.size >= 50 * 1024 * 1024 && (
                    <p className="text-gray-500 text-xs mt-2">
                      Upload em partes para arquivos grandes - pode pausar e continuar
                    </p>
                  )}
                </div>
              )}

              {uploadError && (
                <div className="border border-red-500/50 rounded-xl p-4 bg-red-500/10 flex items-center gap-3">
                  <XCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-red-400">{uploadError}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setUploadError(null)}
                    className="text-gray-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}

              {pendingFile && !isSubmitting && (
                <div className="border border-cyan-500/50 rounded-xl p-4 bg-cyan-500/10">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                      <FileVideo className="w-6 h-6 text-cyan-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">{pendingFile.name}</p>
                      <p className="text-gray-400 text-sm">{formatFileSize(pendingFile.size)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-cyan-500" />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={removeFile}
                        className="text-gray-400 hover:text-white"
                        data-testid="button-remove-file"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300 text-sm sm:text-base">Observações (opcional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Adicione instruções ou comentários..."
                className="bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-500 min-h-[60px] sm:min-h-[100px] text-sm sm:text-base"
                data-testid="textarea-notes"
              />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={!pendingFile || submitMutation.isPending || isSubmitting}
              className="w-full bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white font-semibold py-4 sm:py-6 text-sm sm:text-base transition-all duration-300 shadow-lg shadow-cyan-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="button-submit"
            >
              {submitMutation.isPending || isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando... {uploadProgress}%
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Enviar Arquivo
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Inbox,
  FileVideo,
  Clock,
  AlertTriangle,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  Download,
  Plus,
  User,
  Calendar,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface Submission {
  id: number;
  clientId: number;
  title: string | null;
  urgency: string;
  requestedDueDate: string | null;
  notes: string | null;
  status: string;
  adminNotes: string | null;
  assignedBoardId: number | null;
  assignedCardId: number | null;
  createdAt: string;
  updatedAt: string;
}

interface Attachment {
  id: number;
  submissionId: number;
  fileName: string;
  fileUrl: string;
  thumbnailUrl: string | null;
  fileType: string;
  fileSize: number | null;
  mimeType: string | null;
  durationSeconds: number | null;
  createdAt: string;
}

interface SubmissionWithClient {
  submission: Submission;
  client: { id: number; name: string; email: string } | null;
  attachments: Attachment[];
}

export interface SubmissionAttachment {
  id: number;
  submissionId: number;
  fileName: string;
  fileUrl: string;
  thumbnailUrl: string | null;
  fileType: string;
  fileSize: number | null;
  mimeType: string | null;
  durationSeconds: number | null;
  createdAt: string;
}

interface ClientInboxPanelProps {
  onAddToBoard: (submission: Submission, listId: string, attachments: SubmissionAttachment[]) => void;
  availableLists: Array<{ id: string; title: string }>;
}

const urgencyConfig: Record<string, { color: string; icon: typeof AlertTriangle | null; label: string }> = {
  baixa: { color: "bg-slate-500", icon: null, label: "Baixa" },
  normal: { color: "bg-blue-500", icon: null, label: "Normal" },
  urgente: { color: "bg-orange-500", icon: AlertTriangle, label: "Urgente" },
  critica: { color: "bg-red-500", icon: AlertCircle, label: "Crítica" },
};

export function ClientInboxPanel({ onAddToBoard, availableLists }: ClientInboxPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);

  const { data: submissionsData = [], isLoading, refetch } = useQuery<SubmissionWithClient[]>({
    queryKey: ["/api/admin/submissions"],
    queryFn: async () => {
      const res = await fetch("/api/admin/submissions");
      if (!res.ok) throw new Error("Failed to fetch submissions");
      return res.json();
    },
  });

  const pendingSubmissions = submissionsData.filter(
    (item) => item.submission.status === "pendente" && !item.submission.assignedCardId
  );

  const formatFileSize = (size: number | null) => {
    if (!size) return "N/A";
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const handleAddToList = (submission: Submission, listId: string, attachments: Attachment[]) => {
    onAddToBoard(submission, listId, attachments);
    setSelectedSubmission(null);
  };

  if (!isExpanded) {
    return (
      <div className="fixed right-0 top-1/2 -translate-y-1/2 z-40">
        <Button
          variant="default"
          size="sm"
          className="rounded-l-lg rounded-r-none shadow-lg flex items-center gap-2 py-6"
          onClick={() => setIsExpanded(true)}
          data-testid="button-expand-inbox"
        >
          <ChevronLeft className="h-4 w-4" />
          <Inbox className="h-5 w-5" />
          {pendingSubmissions.length > 0 && (
            <Badge variant="destructive" className="ml-1">
              {pendingSubmissions.length}
            </Badge>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed right-0 top-0 h-full w-80 bg-card border-l border-border shadow-xl z-40 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-border bg-card/95 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Inbox className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-foreground">Inbox de Clientes</h2>
          {pendingSubmissions.length > 0 && (
            <Badge variant="secondary">{pendingSubmissions.length}</Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsExpanded(false)}
          data-testid="button-collapse-inbox"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 p-3">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            Carregando...
          </div>
        ) : pendingSubmissions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-center px-4">
            <Inbox className="h-10 w-10 mb-2 opacity-50" />
            <p className="text-sm">Nenhum envio pendente</p>
            <p className="text-xs mt-1">Os arquivos enviados pelos clientes aparecerão aqui</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingSubmissions.map((item) => {
              const { submission, client, attachments = [] } = item;
              const urgency = urgencyConfig[submission.urgency] || urgencyConfig.normal;
              const UrgencyIcon = urgency.icon;
              const mainAttachment = attachments.length > 0 ? attachments[0] : null;
              const totalSize = attachments.reduce((acc, att) => acc + (att.fileSize || 0), 0);

              return (
                <div
                  key={submission.id}
                  className={cn(
                    "rounded-lg border bg-background p-3 transition-all hover:shadow-md cursor-pointer",
                    selectedSubmission?.id === submission.id && "ring-2 ring-primary"
                  )}
                  onClick={() => setSelectedSubmission(selectedSubmission?.id === submission.id ? null : submission)}
                  data-testid={`submission-inbox-${submission.id}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <FileVideo className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium truncate">
                        {submission.title || mainAttachment?.fileName || "Envio sem título"}
                      </span>
                    </div>
                    <Badge className={cn("shrink-0 text-white text-xs font-semibold px-2 py-0.5", urgency.color)}>
                      {UrgencyIcon && <UrgencyIcon className="h-3.5 w-3.5 mr-1.5" />}
                      {urgency.label.toUpperCase()}
                    </Badge>
                  </div>

                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <User className="h-3 w-3" />
                      <span>{client?.name || `Cliente #${submission.clientId}`}</span>
                    </div>

                    {submission.requestedDueDate && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        <span>
                          Prazo: {format(new Date(submission.requestedDueDate), "dd 'de' MMM", { locale: ptBR })}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      <span>
                        Enviado: {format(new Date(submission.createdAt), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>

                    {totalSize > 0 && (
                      <div className="flex items-center gap-2">
                        <FileText className="h-3 w-3" />
                        <span>{formatFileSize(totalSize)} ({attachments.length} arquivo{attachments.length !== 1 ? 's' : ''})</span>
                      </div>
                    )}
                  </div>

                  {submission.notes && (
                    <p className="mt-2 text-xs text-muted-foreground line-clamp-2 border-t pt-2">
                      {submission.notes}
                    </p>
                  )}

                  {selectedSubmission?.id === submission.id && (
                    <div className="mt-3 pt-3 border-t space-y-3">
                      {mainAttachment && (
                        <div className="rounded-md overflow-hidden bg-black/20 border border-white/10 group relative">
                          {mainAttachment.fileType === "image" || mainAttachment.mimeType?.startsWith("image/") ? (
                            <Dialog>
                              <DialogTrigger asChild>
                                <div className="cursor-pointer relative">
                                  <img
                                    src={mainAttachment.fileUrl}
                                    alt={mainAttachment.fileName}
                                    className="w-full h-auto max-h-[200px] object-contain transition-transform group-hover:scale-[1.02]"
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 transition-opacity">
                                    <span className="text-white text-xs font-medium bg-black/50 px-2 py-1 rounded">Ver Tela Cheia</span>
                                  </div>
                                </div>
                              </DialogTrigger>
                              <DialogContent className="max-w-4xl w-full p-0 bg-transparent border-none shadow-none text-white">
                                <img
                                  src={mainAttachment.fileUrl}
                                  alt={mainAttachment.fileName}
                                  className="w-full h-auto max-h-[85vh] object-contain rounded-lg"
                                />
                              </DialogContent>
                            </Dialog>
                          ) : mainAttachment.fileType === "video" || mainAttachment.mimeType?.startsWith("video/") ? (
                            <Dialog>
                              <DialogTrigger asChild>
                                <div className="cursor-pointer relative">
                                  <video
                                    src={mainAttachment.fileUrl}
                                    className="w-full h-auto max-h-[200px] object-contain"
                                    preload="metadata"
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 transition-opacity pointer-events-none">
                                    <span className="text-white text-xs font-medium bg-black/50 px-2 py-1 rounded">Expandir Vídeo</span>
                                  </div>
                                </div>
                              </DialogTrigger>
                              <DialogContent className="max-w-4xl w-full p-0 bg-transparent border-none shadow-none">
                                <video
                                  src={mainAttachment.fileUrl}
                                  controls
                                  autoPlay
                                  className="w-full h-auto max-h-[85vh] rounded-lg"
                                />
                              </DialogContent>
                            </Dialog>
                          ) : (
                            <div className="p-4 flex items-center justify-center gap-2 text-muted-foreground">
                              <FileText className="h-6 w-6" />
                              <span className="text-sm">Pré-visualização não disponível</span>
                            </div>
                          )}
                        </div>
                      )}

                      <p className="text-xs font-medium text-foreground">Adicionar ao quadro:</p>
                      <div className="flex flex-wrap gap-1">
                        {availableLists.map((list) => (
                          <Button
                            key={list.id}
                            variant="outline"
                            size="sm"
                            className="text-xs h-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddToList(submission, list.id, attachments);
                            }}
                            data-testid={`button-add-to-list-${list.id}`}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            {list.title}
                          </Button>
                        ))}
                      </div>
                      {mainAttachment?.fileUrl && (
                        <a
                          href={mainAttachment.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Download className="h-3 w-3" />
                          Visualizar Mídia
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      <div className="p-3 border-t border-border bg-card/95">
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => refetch()}
          data-testid="button-refresh-inbox"
        >
          Atualizar inbox
        </Button>
      </div>
    </div>
  );
}

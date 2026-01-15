import { useState, useRef, useEffect } from "react";
import { X, Image, Calendar, CheckSquare, Paperclip, MessageSquare, Tag, Users, Copy, Archive, Trash2, ArrowRight, Upload, FileAudio, FileVideo, Pencil, GripVertical, Play, Pause, Volume2, VolumeX, FileText, Loader2, Search, Check, Menu, ChevronRight } from "lucide-react";
import { Dialog, DialogContent } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Checkbox } from "./ui/checkbox";
import { Progress } from "./ui/progress";
import { Slider } from "./ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { ScrollArea } from "./ui/scroll-area";
import { Calendar as CalendarComponent } from "./ui/calendar";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Card, Member, Tag as CardTag, List, Attachment, ChecklistItem } from "@/lib/store";

interface CardDetailsDialogProps {
  card: Card;
  listTitle: string;
  boardMembers: Member[];
  availableLists: List[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateCard: (cardId: string, updates: Partial<Card>) => void;
  onDeleteCard: (cardId: string) => void;
  onDuplicateCard: (cardId: string) => void;
  onAddMember: (cardId: string, member: Member) => void;
  onRemoveMember: (cardId: string, memberId: string) => void;
  onAddTag: (cardId: string, tag: CardTag) => void;
  onRemoveTag: (cardId: string, tagId: string) => void;
  onAddAttachment: (cardId: string, attachment: Attachment) => void;
  onRemoveAttachment: (cardId: string, attachmentId: string) => void;
  onMoveCard: (cardId: string, newListId: string) => void;
  onArchiveCard: (cardId: string) => void;
  onAddComment?: (cardId: string, text: string) => void;
}

const availableTags: CardTag[] = [
  { id: "t1", name: "Pesquisa", color: "hsl(172 66% 50%)" },
  { id: "t2", name: "Documentação", color: "hsl(45 93% 58%)" },
  { id: "t3", name: "Funcionalidade", color: "hsl(142 71% 45%)" },
  { id: "t4", name: "Correção", color: "hsl(0 84% 60%)" },
  { id: "t5", name: "Prioridade", color: "hsl(25 95% 55%)" },
  { id: "t6", name: "Design", color: "hsl(258 90% 66%)" },
];

// Audio Player Component
const AudioPlayer = ({ url, name }: { url: string; name: string }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcription, setTranscription] = useState<string | null>(null);
  const [transcriptionType, setTranscriptionType] = useState<'summarize' | 'full' | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("ended", handleEnded);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleProgressChange = (value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value[0];
    setCurrentTime(value[0]);
  };

  const handleVolumeChange = (value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    const newVolume = value[0];
    audio.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    
    if (isMuted) {
      audio.volume = volume || 0.5;
      setIsMuted(false);
    } else {
      audio.volume = 0;
      setIsMuted(true);
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const handleTranscribe = async (type: 'summarize' | 'full') => {
    setIsTranscribing(true);
    setTranscriptionType(type);
    setTranscription(null);

    try {
      const response = await fetch('/api/transcribe-audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audioUrl: url,
          transcriptionType: type
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Transcription failed');
      }

      const data = await response.json();

      if (data?.transcription) {
        setTranscription(data.transcription);
        toast({
          title: type === 'summarize' ? 'Resumo gerado' : 'Transcrição completa',
          description: 'O áudio foi processado com sucesso.',
        });
      }
    } catch (error) {
      console.error('Transcription error:', error);
      toast({
        title: 'Erro na transcrição',
        description: error instanceof Error ? error.message : 'Ocorreu um erro ao processar o áudio.',
        variant: 'destructive',
      });
    } finally {
      setIsTranscribing(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      <audio ref={audioRef} src={url} preload="metadata" />
      
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          onClick={togglePlay}
          className="h-10 w-10 rounded-full"
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4 ml-0.5" />
          )}
        </Button>

        <div className="flex-1 space-y-1">
          <Slider
            value={[currentTime]}
            max={duration || 100}
            step={0.1}
            onValueChange={handleProgressChange}
            className="cursor-pointer"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleMute}
            className="h-8 w-8"
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </Button>
          <Slider
            value={[isMuted ? 0 : volume]}
            max={1}
            step={0.01}
            onValueChange={handleVolumeChange}
            className="w-20 cursor-pointer"
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-2 border-t">
        <span className="text-sm text-muted-foreground truncate flex-1">{name}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={isTranscribing}
              className="gap-2"
            >
              {isTranscribing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              Transcrever
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleTranscribe('summarize')}>
              Sumarizar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleTranscribe('full')}>
              Transcrever na íntegra
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {transcription && (
        <div className="mt-2 p-3 bg-muted rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              {transcriptionType === 'summarize' ? 'Resumo' : 'Transcrição'}
            </span>
          </div>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {transcription}
          </p>
        </div>
      )}
    </div>
  );
};

// Sortable Checklist Item Component
const SortableChecklistItem = ({
  item,
  isCompleted,
  isEditing,
  editText,
  onToggle,
  onStartEdit,
  onUpdateText,
  onDelete,
  onEditTextChange,
  onCancelEdit,
}: {
  item: ChecklistItem;
  isCompleted: boolean;
  isEditing: boolean;
  editText: string;
  onToggle: () => void;
  onStartEdit: () => void;
  onUpdateText: () => void;
  onDelete: () => void;
  onEditTextChange: (text: string) => void;
  onCancelEdit: () => void;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 group"
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
      </div>
      <Checkbox checked={isCompleted} onCheckedChange={onToggle} />
      {isEditing ? (
        <Input
          value={editText}
          onChange={(e) => onEditTextChange(e.target.value)}
          onBlur={onUpdateText}
          onKeyDown={(e) => {
            if (e.key === "Enter") onUpdateText();
            if (e.key === "Escape") onCancelEdit();
          }}
          autoFocus
          className="flex-1"
        />
      ) : (
        <>
          <span
            className={`flex-1 cursor-pointer hover:bg-secondary rounded px-2 py-1 -mx-2 ${
              isCompleted ? "line-through text-muted-foreground" : ""
            }`}
            onClick={onStartEdit}
          >
            {item.text}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100"
            onClick={onStartEdit}
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </>
      )}
    </div>
  );
};

// Sortable Attachment Component
const SortableAttachment = ({
  attachment,
  onPreview,
  onDelete,
  formatFileSize,
}: {
  attachment: Attachment;
  onPreview: () => void;
  onDelete: () => void;
  formatFileSize: (bytes: number) => string;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: attachment.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 border rounded-lg hover:bg-secondary transition-colors group"
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        <GripVertical className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100" />
      </div>
      
      <div className="flex-1 min-w-0">
        {attachment.type === "image" && (
          <img
            src={attachment.url}
            alt={attachment.name}
            className="h-20 w-20 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity mb-2"
            onClick={onPreview}
          />
        )}
        
        {attachment.type === "audio" && (
          <div className="w-full">
            <AudioPlayer url={attachment.url} name={attachment.name} />
          </div>
        )}
        
        {attachment.type === "video" && (
          <div
            className="h-20 w-20 flex items-center justify-center bg-secondary rounded cursor-pointer hover:opacity-80 transition-opacity mb-2 relative overflow-hidden"
            onClick={onPreview}
          >
            {attachment.thumbnailUrl ? (
              <>
                <img 
                  src={attachment.thumbnailUrl} 
                  alt={attachment.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <FileVideo className="h-6 w-6 text-white" />
                </div>
              </>
            ) : (
              <FileVideo className="h-10 w-10 text-muted-foreground" />
            )}
          </div>
        )}
        
        {attachment.type === "other" && (
          <Paperclip className="h-10 w-10 text-muted-foreground mb-2" />
        )}
        
        <p className="font-medium truncate">{attachment.name}</p>
        <p className="text-sm text-muted-foreground">{formatFileSize(attachment.size)}</p>
      </div>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100"
      >
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
};

export const CardDetailsDialog = ({
  card,
  listTitle,
  boardMembers,
  availableLists,
  open,
  onOpenChange,
  onUpdateCard,
  onDeleteCard,
  onDuplicateCard,
  onAddMember,
  onRemoveMember,
  onAddTag,
  onRemoveTag,
  onAddAttachment,
  onRemoveAttachment,
  onMoveCard,
  onArchiveCard,
  onAddComment,
}: CardDetailsDialogProps) => {
  const { toast } = useToast();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description || "");
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [newComment, setNewComment] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [attachmentToDelete, setAttachmentToDelete] = useState<{ id: string; url: string } | null>(null);
  const [showDeleteCardAlert, setShowDeleteCardAlert] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const [editingChecklistItem, setEditingChecklistItem] = useState<string | null>(null);
  const [editingChecklistText, setEditingChecklistText] = useState("");
  
  // Popover states
  const [membersOpen, setMembersOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [labelSearch, setLabelSearch] = useState("");
  const [dateOpen, setDateOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    card.dueDate ? new Date(card.dueDate) : undefined
  );
  const [moveOpen, setMoveOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setActionsOpen(false);
    }
  }, [open]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const checklist = card.checklist || [];
  const completedCount = checklist.filter((item) => item.completed).length;
  const totalCount = checklist.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const handleUpdateTitle = () => {
     if (title.trim() && title !== card.title) {
       onUpdateCard(card.id, { title: title.trim() });
       toast({ title: "Título atualizado" });
     }
     setIsEditingTitle(false);
   };
 
   const handleUpdateDescription = () => {
     if (description !== card.description) {
       onUpdateCard(card.id, { description });
       toast({ title: "Descrição atualizada" });
     }
   };

  const handleAddChecklistItem = () => {
    if (!newChecklistItem.trim()) return;
    const newItem: ChecklistItem = {
      id: `ch${Date.now()}`,
      text: newChecklistItem.trim(),
      completed: false,
    };
    onUpdateCard(card.id, {
      checklist: [...checklist, newItem],
    });
    setNewChecklistItem("");
  };

  const handleToggleChecklistItem = (itemId: string) => {
    const updatedChecklist = checklist.map((item) =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );
    onUpdateCard(card.id, { checklist: updatedChecklist });
  };

  const handleStartEditChecklistItem = (itemId: string, currentText: string) => {
    setEditingChecklistItem(itemId);
    setEditingChecklistText(currentText);
  };

  const handleUpdateChecklistItem = () => {
     if (!editingChecklistText.trim() || !editingChecklistItem) return;
     
     const updatedChecklist = checklist.map((item) =>
       item.id === editingChecklistItem 
         ? { ...item, text: editingChecklistText.trim() } 
         : item
     );
     onUpdateCard(card.id, { checklist: updatedChecklist });
     setEditingChecklistItem(null);
     setEditingChecklistText("");
     toast({ title: "Item da checklist atualizado" });
   };
 
   const handleDeleteChecklistItem = (itemId: string) => {
     const updatedChecklist = checklist.filter((item) => item.id !== itemId);
     onUpdateCard(card.id, { checklist: updatedChecklist });
     toast({ title: "Item da checklist removido" });
   };
 
   const handleDragEndChecklist = (event: DragEndEvent) => {
     const { active, over } = event;
 
     if (over && active.id !== over.id) {
       const oldIndex = checklist.findIndex((item) => item.id === active.id);
       const newIndex = checklist.findIndex((item) => item.id === over.id);
 
       const reorderedChecklist = arrayMove(checklist, oldIndex, newIndex);
       onUpdateCard(card.id, { checklist: reorderedChecklist });
       toast({ title: "Checklist reorganizada" });
     }
   };

  const handleDragEndAttachments = (event: DragEndEvent) => {
    const { active, over } = event;
    const attachments = card.attachments || [];

    if (over && active.id !== over.id) {
      const oldIndex = attachments.findIndex((item) => item.id === active.id);
      const newIndex = attachments.findIndex((item) => item.id === over.id);

      const reorderedAttachments = arrayMove(attachments, oldIndex, newIndex);
      onUpdateCard(card.id, { attachments: reorderedAttachments });
      toast({ title: "Attachments reordered" });
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Upload failed');
        }

        const data = await response.json();

        let type: 'image' | 'video' | 'audio' | 'other' = 'other';
        if (file.type.startsWith('image/')) type = 'image';
        else if (file.type.startsWith('video/')) type = 'video';
        else if (file.type.startsWith('audio/')) type = 'audio';

        const attachment: Attachment = {
          id: `att${Date.now()}${Math.random()}`,
          name: file.name,
          url: data.url,
          type,
          size: file.size,
          uploadedAt: new Date().toISOString(),
          thumbnailUrl: data.thumbnailUrl,
        };

        onAddAttachment(card.id, attachment);
      }

      toast({ title: "Files uploaded successfully!" });
    } catch (error) {
      console.error("Upload error:", error);
      toast({ title: "Upload failed", description: "Please try again", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const confirmDeleteAttachment = async () => {
    if (!attachmentToDelete) return;

    try {
      // Extract filename from URL
      const urlParts = attachmentToDelete.url.split('/');
      const filename = urlParts[urlParts.length - 1];

      // Delete from storage
      const response = await fetch(`/api/upload/${filename}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        console.error("Storage deletion error");
      }

      // Remove from card regardless of storage deletion result
      onRemoveAttachment(card.id, attachmentToDelete.id);
      toast({ title: "Attachment deleted" });
    } catch (error) {
      console.error("Delete error:", error);
      toast({ title: "Error deleting file", variant: "destructive" });
    } finally {
      setAttachmentToDelete(null);
    }
  };

  const confirmDeleteCard = () => {
     onDeleteCard(card.id);
     setShowDeleteCardAlert(false);
     onOpenChange(false);
     toast({ title: "Card excluído" });
   };
 
 
   const handleAddComment = () => {
     if (!newComment.trim()) return;
     if (onAddComment) {
       onAddComment(card.id, newComment.trim());
       toast({ title: "Comentário adicionado" });
     }
     setNewComment("");
   };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  // Members handlers
   const handleAddMember = (member: Member) => {
     onAddMember(card.id, member);
     toast({ 
       title: "Membro adicionado",
       description: `${member.name} foi adicionado ao card.`
     });
   };
 
   // Labels handlers
   const handleToggleTag = (tag: CardTag) => {
     const isTagInCard = card.tags.some((t) => t.id === tag.id);
     if (isTagInCard) {
       onRemoveTag(card.id, tag.id);
       toast({ 
         title: "Etiqueta removida",
         description: `"${tag.name}" foi removida.`
       });
     } else {
       onAddTag(card.id, tag);
       toast({ 
         title: "Etiqueta adicionada",
         description: `"${tag.name}" foi adicionada.`
       });
     }
   };

  // Date handlers
   const handleDateSelect = (date: Date | undefined) => {
     if (date) {
       const formatted = format(date, "dd 'de' MMM 'de' yyyy");
       onUpdateCard(card.id, { dueDate: formatted });
       setSelectedDate(date);
       toast({ title: "Data de entrega definida" });
     }
     setDateOpen(false);
   };
 
   const handleRemoveDate = () => {
     onUpdateCard(card.id, { dueDate: undefined });
     setSelectedDate(undefined);
     toast({ title: "Data de entrega removida" });
   };

  // Move handlers
  const handleMoveToList = (targetListId: string) => {
    const targetList = availableLists.find(l => l.id === targetListId);
    onMoveCard(card.id, targetListId);
    setMoveOpen(false);
    onOpenChange(false);
    toast({ 
      title: "Card moved", 
      description: `Moved to ${targetList?.title}` 
    });
  };

  // Filter functions
  const availableMembers = boardMembers.filter(
    (member) => !card.members.some((m) => m.id === member.id)
  );
  const filteredMembers = availableMembers.filter((member) =>
    member.name.toLowerCase().includes(memberSearch.toLowerCase())
  );
  const filteredTags = availableTags.filter((tag) =>
    tag.name.toLowerCase().includes(labelSearch.toLowerCase())
  );
  const targetLists = availableLists.filter((list) => list.id !== card.listId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] overflow-hidden p-0">
        <div className="flex h-full max-h-[90vh]">
          {/* Main Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Header */}
            <div className="mb-6">
              <div className="mb-2 flex items-start gap-3">
                <Image className="h-6 w-6 mt-1 text-muted-foreground" />
                <div className="flex-1">
                  {isEditingTitle ? (
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      onBlur={handleUpdateTitle}
                      onKeyDown={(e) => e.key === "Enter" && handleUpdateTitle()}
                      autoFocus
                      className="text-xl font-semibold"
                    />
                  ) : (
                    <h2
                      onClick={() => setIsEditingTitle(true)}
                      className="text-xl font-semibold cursor-pointer hover:bg-secondary rounded px-2 -mx-2 py-1"
                    >
                      {card.title}
                    </h2>
                  )}
                  <p className="text-sm text-muted-foreground mt-1">
                    in list <span className="font-medium">{listTitle}</span>
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onOpenChange(false)}
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Labels, Members, Due Date */}
              <div className="flex flex-wrap gap-4 mt-4">
                {/* Labels */}
                {card.tags.length > 0 && (
                  <div>
                    <Label className="text-xs font-semibold mb-2 block">Labels</Label>
                    <div className="flex flex-wrap gap-1">
                      {card.tags.map((tag) => (
                        <span
                          key={tag.id}
                          className="rounded px-3 py-1 text-sm font-medium text-white cursor-pointer hover:opacity-80"
                          style={{ backgroundColor: tag.color }}
                          onClick={() => onRemoveTag(card.id, tag.id)}
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Members */}
                {card.members.length > 0 && (
                  <div>
                    <Label className="text-xs font-semibold mb-2 block">Members</Label>
                    <div className="flex -space-x-2">
                      {card.members.map((member) => (
                        <Avatar
                          key={member.id}
                          className="h-8 w-8 border-2 border-background cursor-pointer hover:scale-110 transition-transform"
                          onClick={() => onRemoveMember(card.id, member.id)}
                        >
                          <AvatarFallback>{member.avatar}</AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                  </div>
                )}

                {/* Due Date */}
                {card.dueDate && (
                  <div>
                    <Label className="text-xs font-semibold mb-2 block">Due Date</Label>
                    <div className="flex items-center gap-2 rounded bg-secondary px-3 py-1.5">
                      <Calendar className="h-4 w-4" />
                      <span className="text-sm font-medium">{card.dueDate}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
             <div className="mb-6">
               <div className="flex items-center gap-2 mb-2">
                 <MessageSquare className="h-5 w-5 text-muted-foreground" />
                 <Label className="font-semibold">Descrição</Label>
               </div>
               <Textarea
                 value={description}
                 onChange={(e) => setDescription(e.target.value)}
                 onBlur={handleUpdateDescription}
                 placeholder="Adicione uma descrição mais detalhada..."
                 className="min-h-[100px] bg-secondary"
               />
             </div>

            {/* Checklist */}
            {totalCount > 0 && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="h-5 w-5 text-muted-foreground" />
                    <Label className="font-semibold">Checklist</Label>
                    <span className="text-sm text-muted-foreground">
                      {completedCount}/{totalCount}
                    </span>
                  </div>
                </div>
                <Progress value={progress} className="mb-3 h-2" />
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEndChecklist}
                >
                  <SortableContext
                    items={checklist.map((item) => item.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {checklist.map((item) => (
                        <SortableChecklistItem
                          key={item.id}
                          item={item}
                          isCompleted={item.completed}
                          isEditing={editingChecklistItem === item.id}
                          editText={editingChecklistText}
                          onToggle={() => handleToggleChecklistItem(item.id)}
                          onStartEdit={() => handleStartEditChecklistItem(item.id, item.text)}
                          onUpdateText={handleUpdateChecklistItem}
                          onDelete={() => handleDeleteChecklistItem(item.id)}
                          onEditTextChange={setEditingChecklistText}
                          onCancelEdit={() => {
                            setEditingChecklistItem(null);
                            setEditingChecklistText("");
                          }}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            )}

            {/* Add Checklist Item */}
             <div className="mb-6">
               <div className="flex gap-2">
                 <Input
                   value={newChecklistItem}
                   onChange={(e) => setNewChecklistItem(e.target.value)}
                   onKeyDown={(e) => e.key === "Enter" && handleAddChecklistItem()}
                   placeholder="Adicionar um item..."
                   className="flex-1"
                 />
                 <Button onClick={handleAddChecklistItem} size="sm">
                   Adicionar
                 </Button>
               </div>
             </div>

            {/* Attachments */}
            {card.attachments && card.attachments.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Paperclip className="h-5 w-5 text-muted-foreground" />
                  <Label className="font-semibold">Anexos</Label>
                </div>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEndAttachments}
                >
                  <SortableContext
                    items={(card.attachments || []).map((item) => item.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="grid grid-cols-1 gap-3">
                      {card.attachments.map((attachment) => (
                        <SortableAttachment
                          key={attachment.id}
                          attachment={attachment}
                          onPreview={() => setPreviewAttachment(attachment)}
                          onDelete={() =>
                            setAttachmentToDelete({ id: attachment.id, url: attachment.url })
                          }
                          formatFileSize={formatFileSize}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            )}

            {/* Comments */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="h-5 w-5 text-muted-foreground" />
                <Label className="font-semibold">Comentários</Label>
              </div>
              {card.comments && card.comments.length > 0 && (
                <div className="mb-4 space-y-3">
                  {card.comments.map((comment) => (
                    <div key={comment.id} className="flex gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>{comment.authorAvatar}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{comment.authorName}</span>
                          <span className="text-xs text-muted-foreground">{comment.createdAt}</span>
                        </div>
                        <p className="text-sm">{comment.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="space-y-3">
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Escreva um comentário..."
                  className="min-h-[80px]"
                />
                <Button onClick={handleAddComment}>Enviar</Button>
              </div>
            </div>
          </div>

          {/* Mobile Actions Toggle Button */}
          <Button
            variant="secondary"
            size="sm"
            className="sm:hidden fixed bottom-4 right-4 z-50 gap-2 shadow-lg"
            onClick={() => setActionsOpen(!actionsOpen)}
            data-testid="button-toggle-actions"
          >
            <Menu className="h-4 w-4" />
            Ações
            <ChevronRight className={`h-4 w-4 transition-transform ${actionsOpen ? "rotate-180" : ""}`} />
          </Button>

          {/* Mobile Overlay */}
          {actionsOpen && (
            <div 
              className="sm:hidden fixed inset-0 bg-black/50 z-40"
              onClick={() => setActionsOpen(false)}
            />
          )}

          {/* Sidebar */}
          <div className={`
            fixed sm:relative right-0 top-0 h-full z-50 sm:z-auto
            w-48 border-l bg-secondary/30 sm:bg-secondary/30 bg-background p-4 overflow-y-auto
            transition-transform duration-300 ease-in-out
            ${actionsOpen ? "translate-x-0" : "translate-x-full sm:translate-x-0"}
          `}>
            <div className="flex items-center justify-between sm:hidden mb-4">
              <Label className="text-sm font-semibold">Menu</Label>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setActionsOpen(false)}
                data-testid="button-close-actions"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-4">
              <div>
                <Label className="text-xs font-semibold mb-2 block">Adicionar ao card</Label>
                <div className="space-y-2">
                  {/* Members Popover */}
                  <Popover open={membersOpen} onOpenChange={setMembersOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="secondary" size="sm" className="w-full justify-start gap-2">
                        <Users className="h-4 w-4" />
                        Membros
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80" align="start">
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold">Membros</Label>
                          <div className="relative">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="Buscar membros..."
                              value={memberSearch}
                              onChange={(e) => setMemberSearch(e.target.value)}
                              className="pl-8"
                            />
                          </div>
                        </div>
                        <ScrollArea className="h-64">
                          {filteredMembers.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              {availableMembers.length === 0 
                                ? "Todos os membros adicionados" 
                                : "Nenhum membro encontrado"}
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {filteredMembers.map((member) => (
                                <div
                                  key={member.id}
                                  className="flex items-center gap-3 p-2 rounded hover:bg-secondary cursor-pointer"
                                  onClick={() => handleAddMember(member)}
                                >
                                  <Avatar className="h-8 w-8">
                                    <AvatarFallback>{member.avatar}</AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{member.name}</p>
                                    <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                                  </div>
                                  <Button size="sm" variant="ghost">Adicionar</Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </ScrollArea>
                      </div>
                    </PopoverContent>
                  </Popover>

                  {/* Labels Popover */}
                  <Popover open={labelsOpen} onOpenChange={setLabelsOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="secondary" size="sm" className="w-full justify-start gap-2">
                        <Tag className="h-4 w-4" />
                        Etiquetas
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80" align="start">
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold">Etiquetas</Label>
                          <div className="relative">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="Buscar etiquetas..."
                              value={labelSearch}
                              onChange={(e) => setLabelSearch(e.target.value)}
                              className="pl-8"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          {filteredTags.map((tag) => {
                            const isSelected = card.tags.some((t) => t.id === tag.id);
                            return (
                              <div
                                key={tag.id}
                                className="flex items-center gap-3 p-2 rounded hover:bg-secondary cursor-pointer"
                                onClick={() => handleToggleTag(tag)}
                              >
                                <Checkbox checked={isSelected} />
                                <div
                                  className="flex-1 rounded px-3 py-1.5 text-sm font-medium text-white"
                                  style={{ backgroundColor: tag.color }}
                                >
                                  {tag.name}
                                </div>
                                {isSelected && <Check className="h-4 w-4 text-primary" />}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>

                  {/* Due Date Popover */}
                  <Popover open={dateOpen} onOpenChange={setDateOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="secondary" size="sm" className="w-full justify-start gap-2">
                        <Calendar className="h-4 w-4" />
                        Data de Entrega
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <div className="p-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-semibold">Data de Entrega</Label>
                          {card.dueDate && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleRemoveDate}
                              className="h-7 text-xs"
                            >
                              Remover
                            </Button>
                          )}
                        </div>
                        <CalendarComponent
                          mode="single"
                          selected={selectedDate}
                          onSelect={handleDateSelect}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full justify-start gap-2 relative"
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Paperclip className="h-4 w-4" />
                    )}
                    {isUploading ? "Enviando..." : "Anexo"}
                    <input
                      type="file"
                      multiple
                      accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                      onChange={handleFileUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      disabled={isUploading}
                    />
                  </Button>
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold mb-2 block">Ações</Label>
                <div className="space-y-2">
                  {/* Move Popover */}
                  <Popover open={moveOpen} onOpenChange={setMoveOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="secondary" size="sm" className="w-full justify-start gap-2">
                        <ArrowRight className="h-4 w-4" />
                        Mover
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64" align="start">
                      <div className="space-y-3">
                        <Label className="text-sm font-semibold">Mover para...</Label>
                        {targetLists.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            Nenhuma outra lista disponível
                          </p>
                        ) : (
                          <div className="space-y-1">
                            {targetLists.map((list) => (
                              <Button
                                key={list.id}
                                variant="ghost"
                                className="w-full justify-start gap-2 h-auto py-2"
                                onClick={() => handleMoveToList(list.id)}
                              >
                                <ArrowRight className="h-4 w-4" />
                                <span className="flex-1 text-left truncate">{list.title}</span>
                                <span className="text-xs text-muted-foreground">
                                  {list.cards.length} cards
                                </span>
                              </Button>
                            ))}
                          </div>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full justify-start gap-2"
                    onClick={() => {
                      onDuplicateCard(card.id);
                      onOpenChange(false);
                    }}
                  >
                    <Copy className="h-4 w-4" />
                    Copiar
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full justify-start gap-2"
                    onClick={() => {
                      onArchiveCard(card.id);
                      onOpenChange(false);
                    }}
                  >
                    <Archive className="h-4 w-4" />
                    Arquivar
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full justify-start gap-2 text-destructive hover:text-destructive"
                    onClick={() => setShowDeleteCardAlert(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Excluir
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>

      {/* Delete Attachment Confirmation */}
      <AlertDialog open={!!attachmentToDelete} onOpenChange={() => setAttachmentToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Anexo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este anexo? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteAttachment} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Card Confirmation */}
      <AlertDialog open={showDeleteCardAlert} onOpenChange={setShowDeleteCardAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Card</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este card? Isso irá remover permanentemente o card e todos os seus anexos, comentários e checklists. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteCard} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir Card
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Media Preview Modal */}
      <Dialog open={!!previewAttachment} onOpenChange={() => setPreviewAttachment(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          {previewAttachment && (
            <div className="relative bg-black">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setPreviewAttachment(null)}
                className="absolute top-2 right-2 z-10 bg-black/50 hover:bg-black/70 text-white"
              >
                <X className="h-4 w-4" />
              </Button>
              
              {previewAttachment.type === 'image' && (
                <img
                  src={previewAttachment.url}
                  alt={previewAttachment.name}
                  className="w-full h-auto max-h-[80vh] object-contain"
                />
              )}
              
              {previewAttachment.type === 'video' && (
                <video
                  src={previewAttachment.url}
                  controls
                  className="w-full h-auto max-h-[80vh]"
                  autoPlay
                >
                  Your browser does not support the video tag.
                </video>
              )}
              
              <div className="p-4 bg-background">
                <p className="font-medium text-sm">{previewAttachment.name}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatFileSize(previewAttachment.size)}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};
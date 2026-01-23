import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import {
  ChevronLeft,
  Star,
  Users,
  MoreHorizontal,
  LayoutGrid,
  Calendar,
  BarChart3,
  Filter,
  Plus,
} from "lucide-react";
import { CardDetailsDialog } from "@/components/CardDetailsDialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, Pie, PieChart, XAxis, YAxis, Cell } from "recharts";

import { store, Card, Member, Tag, Attachment } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { KanbanColumn } from "@/components/KanbanColumn";
import { KanbanCard } from "@/components/KanbanCard";
import { ClientInboxPanel, SubmissionAttachment } from "@/components/ClientInboxPanel";
import { useQueryClient } from "@tanstack/react-query";

interface ClientSubmission {
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

const BoardView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [board, setBoard] = useState(id ? store.getBoard(id) : undefined);
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [newListTitle, setNewListTitle] = useState("");
  const [showNewListInput, setShowNewListInput] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [cardDialogOpen, setCardDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [analyticsDialogOpen, setAnalyticsDialogOpen] = useState(false);
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteAvatar, setInviteAvatar] = useState("");
  const [filterText, setFilterText] = useState("");
  const [filterMemberId, setFilterMemberId] = useState<string | null>(null);
  const [filterTagId, setFilterTagId] = useState<string | null>(null);
  const [highlightedListId, setHighlightedListId] = useState<string | null>(null);
  const [currentColumnIndex, setCurrentColumnIndex] = useState(0);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const isPanningRef = useRef(false);
  const panStartXRef = useRef(0);
  const panScrollLeftRef = useRef(0);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    if (id) {
      store.fetchBoardData(id);
    }

    const unsubscribe = store.subscribe(() => {
      if (id) {
        // Force re-render by creating a new object reference
        const updatedBoard = store.getBoard(id);
        if (updatedBoard) {
          setBoard({ ...updatedBoard });
        }
      }
    });
    return unsubscribe;
  }, [id]);

  useEffect(() => {
    if (!board?.color) return;

    const originalBackground = document.body.style.background;
    const originalMinHeight = document.body.style.minHeight;
    const originalAttachment = document.body.style.backgroundAttachment;

    let backgroundValue = board.color;
    if (!board.color.startsWith("linear-gradient")) {
      backgroundValue = `linear-gradient(135deg, ${board.color} 0%, ${board.color} 100%)`;
    }

    document.body.style.minHeight = "100vh";
    document.body.style.background = backgroundValue;
    document.body.style.backgroundAttachment = "fixed";

    return () => {
      document.body.style.background = originalBackground;
      document.body.style.minHeight = originalMinHeight;
      document.body.style.backgroundAttachment = originalAttachment;
    };
  }, [board?.color]);

  if (!board) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-bold">Quadro não encontrado</h1>
          <Button onClick={() => navigate("/")}>Voltar para todos os quadros</Button>
        </div>
      </div>
    );
  }

  const handleDragStart = (event: DragStartEvent) => {
    const activeId = event.active.id as string;

    // Arrastar coluna
    if (activeId.startsWith("l")) {
      setActiveCard(null);
      return;
    }

    // Arrastar card
    const cardId = activeId;
    for (const list of board.lists) {
      const card = list.cards.find((c) => c.id === cardId);
      if (card) {
        setActiveCard(card);
        break;
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const activeId = active.id as string;
    setActiveCard(null);

    if (!over) return;

    const overId = over.id as string;

    // Movendo coluna inteira
    if (activeId.startsWith("l")) {
      let targetListId: string | null = null;

      if (overId.startsWith("l")) {
        targetListId = overId;
      } else {
        for (const list of board.lists) {
          if (list.cards.some((c) => c.id === overId)) {
            targetListId = list.id;
            break;
          }
        }
      }

      if (!targetListId || targetListId === activeId) return;

      store.moveList(board.id, activeId, targetListId);
      return;
    }

    // Movendo card entre listas e dentro da mesma lista
    const cardId = activeId;

    let targetListId: string | null = null;
    let targetCardId: string | undefined;

    for (const list of board.lists) {
      if (list.id === overId) {
        targetListId = list.id;
      }

      if (list.cards.some((c) => c.id === overId)) {
        targetListId = list.id;
        targetCardId = overId;
      }
    }

    if (!targetListId) return;

    store.moveCardTo(cardId, targetListId, targetCardId);
    toast({
      title: "Card movido!",
      description: "O card foi movido de posição.",
      duration: 2000,
    });
  };

  const handleToggleFavorite = () => {
    store.toggleFavorite(board.id);
    toast({
      title: board.isFavorite ? "Removido dos favoritos" : "Adicionado aos favoritos",
    });
  };

  const handleAddList = () => {
    if (!newListTitle.trim()) return;
    store.addList(board.id, newListTitle.trim());
    setNewListTitle("");
    setShowNewListInput(false);
    toast({
      title: "Lista criada!",
      description: `A lista "${newListTitle}" foi adicionada.`,
    });
  };

  const handleAddClientTaskToBoard = async (submission: ClientSubmission, listId: string, submissionAttachments: SubmissionAttachment[] = []) => {
    try {
      const urgencyConfig: Record<string, { name: string; color: string }> = {
        baixa: { name: "Baixa Urgência", color: "#64748b" },
        normal: { name: "Normal", color: "#3b82f6" },
        urgente: { name: "Urgente", color: "#f97316" },
        critica: { name: "Crítico", color: "#ef4444" },
      };

      const config = urgencyConfig[submission.urgency] || urgencyConfig.normal;

      // 1. Find or Create Tag
      // We check existing tags in the board data to avoid duplicates
      let tag = board.tags.find((t: Tag) => t.name === config.name);

      if (!tag) {
        try {
          const tagRes = await fetch("/api/tags", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              boardId: parseInt(board.id),
              name: config.name,
              color: config.color,
            }),
          });

          if (tagRes.ok) {
            const newTag = await tagRes.json();
            // Convert to store Tag format
            tag = {
              id: newTag.id.toString(),
              name: newTag.name,
              color: newTag.color,
            };
            // Optimistically update board tags
            board.tags.push(tag);
            store["notify"]();
          }
        } catch (err) {
          console.error("Failed to create tag:", err);
        }
      }

      // 2. Create Card via API
      const newCardPayload = {
        listId: parseInt(listId),
        title: submission.title || `Envio do Cliente #${submission.clientId}`,
        description: submission.notes || "",
        tagIds: tag ? [parseInt(tag.id)] : [],
        priority: "medium",
        dueDate: submission.requestedDueDate || undefined,
        position: 0
      };

      const createCardRes = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCardPayload)
      });

      if (!createCardRes.ok) throw new Error("Failed to create card");
      const createdCard = await createCardRes.json();

      // 3. Persist Attachments
      const cardAttachments: Attachment[] = [];
      for (const att of submissionAttachments) {
        const attachmentPayload = {
          name: att.fileName,
          url: att.fileUrl,
          type: att.fileType,
          size: att.fileSize,
          thumbnailUrl: att.thumbnailUrl
        };

        const attRes = await fetch(`/api/cards/${createdCard.id}/attachments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(attachmentPayload)
        });

        if (attRes.ok) {
          const savedAtt = await attRes.json();
          cardAttachments.push({
            id: savedAtt.id.toString(),
            name: savedAtt.fileName,
            url: savedAtt.fileUrl,
            type: savedAtt.fileType as any,
            size: savedAtt.fileSize,
            uploadedAt: savedAtt.createdAt,
            thumbnailUrl: savedAtt.thumbnailUrl,
            transcription: savedAtt.transcription,
            transcriptionStatus: savedAtt.transcriptionStatus
          });
        }
      }

      // 4. Update Store with Full Data
      const boardList = board.lists.find(l => l.id === listId);
      if (boardList) {
        const storeCard: Card = {
          id: createdCard.id.toString(),
          title: createdCard.title,
          description: createdCard.description,
          listId: listId,
          tags: tag ? [tag] : [],
          members: [],
          checklist: [],
          attachments: cardAttachments,
          comments: [],
          archived: false,
          order: createdCard.position,
          dueDate: createdCard.dueDate
        };

        // Add to beginning of list
        boardList.cards.unshift(storeCard);
        store["notify"]();
      }

      // 5. Update Submission Status
      const updateRes = await fetch(`/api/client-submissions/${submission.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "em_analise", assignedCardId: createdCard.id })
      });

      if (!updateRes.ok) {
        throw new Error("Failed to update submission status");
      }

      queryClient.invalidateQueries({ queryKey: ["/api/admin/submissions"] });

      toast({
        title: "Tarefa adicionada!",
        description: `O envio foi adicionado à lista.`,
      });
    } catch (error) {
      console.error("Error adding task to board:", error);
      toast({
        title: "Erro",
        description: "Não foi possível adicionar a tarefa ao quadro.",
        variant: "destructive",
      });
    }
  };

  const [scrollState, setScrollState] = useState({
    scrollLeft: 0,
    scrollWidth: 0,
    clientWidth: 0,
  });

  const isScrollbarDraggingRef = useRef(false);
  const scrollbarStartXRef = useRef(0);
  const scrollbarStartScrollLeftRef = useRef(0);
  const scrollbarTrackWidthRef = useRef(0);

  const updateScrollState = () => {
    const el = scrollContainerRef.current;
    if (!el) return;

    setScrollState({
      scrollLeft: el.scrollLeft,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    });
  };

  useEffect(() => {
    updateScrollState();

    const handleResize = () => updateScrollState();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [board.lists.length]);

  const handleBoardPanStart = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if (event.currentTarget !== event.target) return;

    isPanningRef.current = true;
    panStartXRef.current = event.clientX;
    panScrollLeftRef.current = event.currentTarget.scrollLeft;
    event.currentTarget.style.cursor = "grabbing";
    event.preventDefault();
  };

  const handleBoardPanMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanningRef.current || !scrollContainerRef.current) return;

    const deltaX = event.clientX - panStartXRef.current;
    scrollContainerRef.current.scrollLeft = panScrollLeftRef.current - deltaX;
  };

  const handleBoardPanEnd = () => {
    if (!scrollContainerRef.current) return;
    isPanningRef.current = false;
    scrollContainerRef.current.style.cursor = "grab";
  };

  const handleBoardScroll = () => {
    updateScrollState();

    const container = scrollContainerRef.current;
    if (!container || !board) return;

    const columnWidth = window.innerWidth < 640 ? window.innerWidth * 0.85 + 8 : 320 + 16;
    const scrollPosition = container.scrollLeft;
    const newIndex = Math.round(scrollPosition / columnWidth);
    const maxIndex = board.lists.length;
    setCurrentColumnIndex(Math.min(Math.max(0, newIndex), maxIndex));
  };

  const handleScrollbarMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!scrollContainerRef.current) return;

    isScrollbarDraggingRef.current = true;
    scrollbarStartXRef.current = event.clientX;
    scrollbarStartScrollLeftRef.current = scrollContainerRef.current.scrollLeft;
    scrollbarTrackWidthRef.current = event.currentTarget.getBoundingClientRect().width;

    document.addEventListener("mousemove", handleScrollbarMouseMove);
    document.addEventListener("mouseup", handleScrollbarMouseUp);
  };

  const handleScrollbarMouseMove = (event: MouseEvent) => {
    if (!isScrollbarDraggingRef.current || !scrollContainerRef.current) return;

    const deltaX = event.clientX - scrollbarStartXRef.current;
    const { scrollWidth, clientWidth } = scrollContainerRef.current;
    const maxScroll = Math.max(scrollWidth - clientWidth, 1);
    const trackWidth = scrollbarTrackWidthRef.current || clientWidth;

    const scrollDelta = (deltaX / trackWidth) * maxScroll;
    scrollContainerRef.current.scrollLeft =
      scrollbarStartScrollLeftRef.current + scrollDelta;

    updateScrollState();
  };

  const handleScrollbarMouseUp = () => {
    isScrollbarDraggingRef.current = false;
    document.removeEventListener("mousemove", handleScrollbarMouseMove);
    document.removeEventListener("mouseup", handleScrollbarMouseUp);
  };

  const scrollToList = (listId: string) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Encontra o índice da lista
    const listIndex = board.lists.findIndex((l) => l.id === listId);
    if (listIndex === -1) return;

    // Calcula a posição aproximada da coluna (largura de 320px + gap de 16px)
    const columnWidth = 320;
    const gap = 16;
    const scrollPosition = listIndex * (columnWidth + gap);

    // Faz o scroll suave até a posição
    container.scrollTo({
      left: scrollPosition,
      behavior: "smooth",
    });

    // Destaca temporariamente a lista selecionada (3 segundos)
    setHighlightedListId(listId);
    setTimeout(
      () => setHighlightedListId((current) => (current === listId ? null : current)),
      3000
    );

    // Fecha o dialog de Analytics
    setAnalyticsDialogOpen(false);
  };
  const handleAddCard = (listId: string, title: string) => {
    store.addCard(listId, title);
    toast({
      title: "Card criado!",
    });
  };

  const handleDeleteCard = (cardId: string) => {
    store.deleteCard(cardId);
    toast({
      title: "Card excluído",
    });
  };

  const handleDuplicateCard = (cardId: string) => {
    const duplicatedCard = store.duplicateCard(cardId);
    if (duplicatedCard) {
      toast({
        title: "Card duplicado!",
        description: `"${duplicatedCard.title}" foi criado.`,
      });
    }
  };

  const handleCardClick = (cardId: string) => {
    setSelectedCardId(cardId);
    setCardDialogOpen(true);
  };

  const handleUpdateCard = (cardId: string, updates: Partial<Card>) => {
    store.updateCard(cardId, updates);
  };

  const handleAddMember = (cardId: string, member: Member) => {
    store.addMemberToCard(cardId, member);
  };

  const handleRemoveMember = (cardId: string, memberId: string) => {
    store.removeMemberFromCard(cardId, memberId);
  };

  const handleAddTag = (cardId: string, tag: Tag) => {
    store.addTagToCard(cardId, tag);
  };

  const handleRemoveTag = (cardId: string, tagId: string) => {
    store.removeTagFromCard(cardId, tagId);
  };

  const handleAddAttachment = (cardId: string, attachment: Attachment) => {
    store.addAttachmentToCard(cardId, attachment);
  };

  const handleRemoveAttachment = (cardId: string, attachmentId: string) => {
    store.removeAttachmentFromCard(cardId, attachmentId);
  };

  const handleMoveCard = (cardId: string, newListId: string) => {
    store.moveCard(cardId, newListId);
  };

  const handleArchiveCard = (cardId: string) => {
    store.toggleArchiveCard(cardId);
    toast({
      title: "Card arquivado",
      description: "O card foi arquivado.",
    });
  };

  const handleAddComment = (cardId: string, text: string) => {
    const currentUser = localStorage.getItem("user");
    const user = currentUser ? JSON.parse(currentUser) : null;
    const comment = {
      id: `comment-${Date.now()}`,
      text,
      authorId: user?.id?.toString() || "unknown",
      authorName: user?.name || "Usuário",
      authorAvatar: user?.name?.charAt(0).toUpperCase() || "U",
      createdAt: new Date().toISOString(),
    };
    store.addCommentToCard(cardId, comment);
  };

  const handleInviteSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim()) {
      toast({ title: "Preencha nome e e-mail para convidar" });
      return;
    }

    const avatar = inviteAvatar.trim() || inviteName.trim().charAt(0).toUpperCase();
    const newMember = store.addMemberToBoard(board.id, {
      name: inviteName.trim(),
      email: inviteEmail.trim(),
      avatar,
    });

    if (newMember) {
      toast({
        title: "Membro adicionado ao board",
        description: `${newMember.name} agora pode ser atribuído aos cards.`,
      });
    }

    setInviteName("");
    setInviteEmail("");
    setInviteAvatar("");
    setInviteDialogOpen(false);
  };

  const selectedCardData = selectedCardId ? store.getCard(selectedCardId) : undefined;

  const { scrollLeft, scrollWidth, clientWidth } = scrollState;
  const maxScroll = Math.max(scrollWidth - clientWidth, 1);
  const visibleRatio = scrollWidth > 0 ? clientWidth / scrollWidth : 1;
  const thumbWidthPercent = Math.max(visibleRatio * 100, 10);
  const thumbOffsetPercent =
    maxScroll > 0 ? (scrollLeft / maxScroll) * (100 - thumbWidthPercent) : 0;

  return (
    <div className="flex min-h-screen w-full flex-col">
      <header className="border-b border-white/20 bg-black/10 px-3 sm:px-6 py-2 sm:py-4 backdrop-blur-sm shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            <Link to="/">
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 h-8 w-8 sm:h-10 sm:w-10">
                <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </Link>
            <h1 className="text-base sm:text-2xl font-bold text-white truncate max-w-[120px] sm:max-w-none">{board.title}</h1>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleToggleFavorite}
              className="text-white hover:bg-white/20 h-8 w-8 sm:h-10 sm:w-10"
            >
              <Star className={`h-4 w-4 sm:h-5 sm:w-5 ${board.isFavorite ? "fill-white" : ""}`} />
            </Button>
            <div className="hidden sm:flex -space-x-2">
              {(Array.isArray(board.members) ? board.members : []).slice(0, 5).map((member) => (
                <Avatar key={member.id} className="h-8 w-8 border-2 border-white">
                  <AvatarFallback className="text-xs">{member.avatar}</AvatarFallback>
                </Avatar>
              ))}
            </div>
            <Button
              variant="ghost"
              className="hidden sm:flex gap-2 text-white hover:bg-white/20"
              onClick={() => setInviteDialogOpen(true)}
            >
              <Users className="h-4 w-4" />
              Convidar
            </Button>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="sm:hidden text-white hover:bg-white/20 h-8 w-8"
              onClick={() => setInviteDialogOpen(true)}
            >
              <Users className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              className="hidden sm:flex gap-2 text-white hover:bg-white/20"
              onClick={() => navigate(`/board/${board.id}`)}
            >
              <LayoutGrid className="h-4 w-4" />
              Quadro
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="sm:hidden text-white hover:bg-white/20 h-8 w-8"
              onClick={() => navigate(`/board/${board.id}/calendar`)}
            >
              <Calendar className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              className="hidden sm:flex gap-2 text-white hover:bg-white/20"
              onClick={() => navigate(`/board/${board.id}/calendar`)}
            >
              <Calendar className="h-4 w-4" />
              Calendário
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="sm:hidden text-white hover:bg-white/20 h-8 w-8"
              onClick={() => setAnalyticsDialogOpen(true)}
            >
              <BarChart3 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              className="hidden sm:flex gap-2 text-white hover:bg-white/20"
              onClick={() => setAnalyticsDialogOpen(true)}
            >
              <BarChart3 className="h-4 w-4" />
              Analytics
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="sm:hidden text-white hover:bg-white/20 h-8 w-8"
              onClick={() => setFilterDialogOpen(true)}
            >
              <Filter className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              className="hidden sm:flex gap-2 text-white hover:bg-white/20"
              onClick={() => setFilterDialogOpen(true)}
            >
              <Filter className="h-4 w-4" />
              Filtro
            </Button>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 h-8 w-8 sm:h-10 sm:w-10">
              <MoreHorizontal className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 p-2 sm:p-6">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div
            ref={scrollContainerRef}
            className="h-full w-full overflow-x-auto pb-4 cursor-grab scrollbar-hidden snap-x snap-mandatory sm:snap-none"
            onMouseDown={handleBoardPanStart}
            onMouseMove={handleBoardPanMove}
            onMouseUp={handleBoardPanEnd}
            onMouseLeave={handleBoardPanEnd}
            onScroll={handleBoardScroll}
          >
            <div className="flex min-w-max gap-2 sm:gap-4 h-full pb-6 px-2 sm:px-0">
              <SortableContext
                items={(Array.isArray(board.lists) ? board.lists : []).map((list) => list.id)}
                strategy={horizontalListSortingStrategy}
              >
                {(Array.isArray(board.lists) ? board.lists : []).map((list) => {
                  const filteredCards = (Array.isArray(list.cards) ? list.cards : []).filter((card) => {
                    const matchesText = filterText
                      ? card.title.toLowerCase().includes(filterText.toLowerCase())
                      : true;
                    const matchesMember = filterMemberId
                      ? card.members.some((m) => m.id === filterMemberId)
                      : true;
                    const matchesTag = filterTagId
                      ? card.tags.some((t) => t.id === filterTagId)
                      : true;

                    return matchesText && matchesMember && matchesTag;
                  });

                  return (
                    <KanbanColumn
                      key={list.id}
                      list={{ ...list, cards: filteredCards }}
                      onAddCard={handleAddCard}
                      onDeleteCard={handleDeleteCard}
                      onDuplicateCard={handleDuplicateCard}
                      onCardClick={handleCardClick}
                      onRenameList={(listId, newTitle) => store.renameList(listId, newTitle)}
                      onDeleteList={(listId) => store.deleteList(listId)}
                      isHighlighted={list.id === highlightedListId}
                    />
                  );
                })}
              </SortableContext>

              {showNewListInput ? (
                <div className="w-[85vw] sm:w-80 shrink-0 rounded-xl bg-white/90 p-3 sm:p-4 shadow-lg backdrop-blur-sm snap-center">
                  <Input
                    autoFocus
                    value={newListTitle}
                    onChange={(e) => setNewListTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddList();
                      if (e.key === "Escape") setShowNewListInput(false);
                    }}
                    placeholder="Digite o título da lista..."
                    className="mb-2"
                  />
                  <div className="flex gap-2">
                    <Button onClick={handleAddList} size="sm">
                      Adicionar
                    </Button>
                    <Button
                      onClick={() => setShowNewListInput(false)}
                      variant="ghost"
                      size="sm"
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowNewListInput(true)}
                  className="flex w-[85vw] sm:w-80 shrink-0 items-center gap-2 rounded-xl bg-white/20 p-3 sm:p-4 text-white backdrop-blur-sm transition-colors hover:bg-white/30 snap-center"
                >
                  <Plus className="h-5 w-5" />
                  <span className="font-medium text-sm sm:text-base">
                    {board.lists.length > 0 ? "Adicionar lista" : "Adicionar primeira lista"}
                  </span>
                </button>
              )}
            </div>
          </div>

          <DragOverlay
            dropAnimation={{
              duration: 300,
              easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
            }}
          >
            {activeCard ? (
              <div className="rotate-3 scale-105 opacity-95 cursor-grabbing shadow-2xl">
                <KanbanCard card={activeCard} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        {/* Mobile column indicator dots */}
        {board.lists.length > 0 && (
          <div className="sm:hidden flex justify-center gap-2 py-3">
            {board.lists.map((list, index) => (
              <button
                key={list.id}
                onClick={() => {
                  const container = scrollContainerRef.current;
                  if (!container) return;
                  const columnWidth = window.innerWidth * 0.85 + 8;
                  container.scrollTo({
                    left: index * columnWidth,
                    behavior: "smooth",
                  });
                }}
                className={`w-2 h-2 rounded-full transition-all ${currentColumnIndex === index
                  ? "bg-white scale-125"
                  : "bg-white/40"
                  }`}
                aria-label={`Ir para coluna ${list.title}`}
              />
            ))}
            <button
              onClick={() => {
                const container = scrollContainerRef.current;
                if (!container) return;
                const columnWidth = window.innerWidth * 0.85 + 8;
                container.scrollTo({
                  left: board.lists.length * columnWidth,
                  behavior: "smooth",
                });
              }}
              className={`w-2 h-2 rounded-full transition-all ${currentColumnIndex === board.lists.length
                ? "bg-white scale-125"
                : "bg-white/40"
                }`}
              aria-label="Adicionar nova lista"
            />
          </div>
        )}

        {/* Barra de rolagem horizontal fixa no rodapé */}
        <div className="pointer-events-auto fixed left-0 right-0 bottom-0 px-6 pb-4 hidden sm:block">
          <div className="mx-auto max-w-[calc(100vw-3rem)]">
            <div
              className="relative h-3 w-full rounded-full bg-white/30 overflow-hidden cursor-pointer"
              onMouseDown={handleScrollbarMouseDown}
            >
              <div
                className="absolute inset-y-0 rounded-full bg-white shadow-sm"
                style={{
                  width: `${thumbWidthPercent}%`,
                  left: `${thumbOffsetPercent}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Card Details Dialog */}
        {selectedCardData && (
          <CardDetailsDialog
            card={selectedCardData.card}
            listTitle={selectedCardData.listTitle}
            boardMembers={board.members}
            availableLists={board.lists}
            open={cardDialogOpen}
            onOpenChange={setCardDialogOpen}
            onUpdateCard={handleUpdateCard}
            onDeleteCard={handleDeleteCard}
            onDuplicateCard={handleDuplicateCard}
            onAddMember={handleAddMember}
            onRemoveMember={handleRemoveMember}
            onAddTag={handleAddTag}
            onRemoveTag={handleRemoveTag}
            onAddAttachment={handleAddAttachment}
            onRemoveAttachment={handleRemoveAttachment}
            onMoveCard={handleMoveCard}
            onArchiveCard={handleArchiveCard}
            onAddComment={handleAddComment}
          />
        )}

        <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Convidar membros</DialogTitle>
              <DialogDescription>
                Adicione pessoas ao board para depois atribuí-las aos cards.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleInviteSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-name">Nome</Label>
                <Input
                  id="invite-name"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="Nome da pessoa"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-email">E-mail</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-avatar">Emoji ou inicial (opcional)</Label>
                <Input
                  id="invite-avatar"
                  maxLength={2}
                  value={inviteAvatar}
                  onChange={(e) => setInviteAvatar(e.target.value)}
                  placeholder="😀 ou A"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setInviteDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Adicionar membro</Button>
              </div>
            </form>

            {board.members.length > 0 && (
              <div className="mt-6 border-t pt-4">
                <h3 className="mb-2 text-sm font-semibold">Membros atuais</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {board.members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between rounded-md bg-secondary/60 px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7 border border-border">
                          <AvatarFallback className="text-xs">{member.avatar}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium leading-tight">{member.name}</p>
                          <p className="text-xs text-muted-foreground">{member.email}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={analyticsDialogOpen} onOpenChange={setAnalyticsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Analytics do quadro</DialogTitle>
              <DialogDescription>
                Visão geral rápida dos cards deste quadro.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Total de listas</p>
                  <p className="mt-1 text-2xl font-semibold">{board.lists.length}</p>
                </div>
                <div className="rounded-lg border bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Total de cards</p>
                  <p className="mt-1 text-2xl font-semibold">
                    {board.lists.reduce((acc, list) => acc + list.cards.length, 0)}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border bg-card/60 p-3">
                  <p className="mb-2 text-xs font-semibold text-muted-foreground">Cards por lista</p>
                  <div className="h-48">
                    <ChartContainer
                      config={{
                        cards: {
                          label: "Cards",
                          color: "hsl(var(--primary))",
                        },
                      } satisfies ChartConfig}
                    >
                      <BarChart
                        data={board.lists.map((list) => ({
                          name: list.title,
                          cards: list.cards.length,
                        }))}
                      >
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
                        <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="cards" fill="var(--color-cards)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ChartContainer>
                  </div>
                  <div className="mt-3 space-y-1">
                    {board.lists.map((list) => (
                      <button
                        key={list.id}
                        onClick={() => scrollToList(list.id)}
                        className="flex w-full items-center justify-between rounded-md bg-background/60 px-3 py-2 text-xs transition-colors hover:bg-background"
                      >
                        <span className="font-medium truncate mr-2">{list.title}</span>
                        <span className="text-muted-foreground whitespace-nowrap">
                          {list.cards.length} card(s)
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  {board.members.length > 0 && (
                    <div className="rounded-lg border bg-card/60 p-3">
                      <p className="mb-2 text-xs font-semibold text-muted-foreground">Cards por membro</p>
                      <div className="h-40">
                        <ChartContainer
                          config={{
                            cards: {
                              label: "Cards",
                              color: "hsl(var(--accent))",
                            },
                          } satisfies ChartConfig}
                        >
                          <BarChart
                            data={board.members.map((member) => ({
                              name: member.name,
                              cards: board.lists.reduce(
                                (acc, list) =>
                                  acc +
                                  list.cards.filter((card) =>
                                    card.members.some((m) => m.id === member.id)
                                  ).length,
                                0
                              ),
                            }))}
                          >
                            <CartesianGrid vertical={false} strokeDasharray="3 3" />
                            <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
                            <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Bar dataKey="cards" fill="var(--color-cards)" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ChartContainer>
                      </div>
                    </div>
                  )}

                  {board.lists.some((list) =>
                    list.cards.some((card) => card.tags && card.tags.length > 0)
                  ) && (
                      <div className="rounded-lg border bg-card/60 p-3">
                        <p className="mb-2 text-xs font-semibold text-muted-foreground">Cards por tag</p>
                        <div className="h-40">
                          {(() => {
                            const tagCounts = Array.from(
                              board.lists
                                .flatMap((list) => list.cards)
                                .flatMap((card) => card.tags || [])
                                .reduce((map, tag) => {
                                  const current = map.get(tag.name) || 0;
                                  map.set(tag.name, current + 1);
                                  return map;
                                }, new Map<string, number>())
                            ).map(([name, value]) => ({ name, value }));

                            const colors = [
                              "hsl(var(--tag-red))",
                              "hsl(var(--tag-orange))",
                              "hsl(var(--tag-yellow))",
                              "hsl(var(--tag-green))",
                              "hsl(var(--tag-blue))",
                              "hsl(var(--tag-purple))",
                              "hsl(var(--tag-pink))",
                            ];

                            return (
                              <ChartContainer
                                config={tagCounts.reduce(
                                  (acc, tag, index) => ({
                                    ...acc,
                                    [tag.name]: {
                                      label: tag.name,
                                      color: colors[index % colors.length],
                                    },
                                  }),
                                  {} as ChartConfig
                                )}
                              >
                                <PieChart>
                                  <Pie
                                    data={tagCounts}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={60}
                                    innerRadius={30}
                                    paddingAngle={2}
                                  >
                                    {tagCounts.map((entry, index) => (
                                      <Cell
                                        key={entry.name}
                                        fill={colors[index % colors.length]}
                                      />
                                    ))}
                                  </Pie>
                                  <ChartTooltip content={<ChartTooltipContent />} />
                                </PieChart>
                              </ChartContainer>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={filterDialogOpen} onOpenChange={setFilterDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Filtrar cards</DialogTitle>
              <DialogDescription>
                Aplique filtros para ver apenas os cards que importam agora.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="filter-text">Busca por título</Label>
                <Input
                  id="filter-text"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  placeholder="Digite parte do título do card"
                />
              </div>

              {board.members.length > 0 && (
                <div className="space-y-2">
                  <Label>Membro</Label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={filterMemberId === null ? "default" : "outline"}
                      onClick={() => setFilterMemberId(null)}
                    >
                      Todos
                    </Button>
                    {board.members.map((member) => (
                      <Button
                        key={member.id}
                        type="button"
                        size="sm"
                        variant={filterMemberId === member.id ? "default" : "outline"}
                        onClick={() =>
                          setFilterMemberId((current) =>
                            current === member.id ? null : member.id
                          )
                        }
                      >
                        {member.avatar} {member.name}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {board.lists.some((list) => list.cards.some((card) => card.tags.length > 0)) && (
                <div className="space-y-2">
                  <Label>Tag</Label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={filterTagId === null ? "default" : "outline"}
                      onClick={() => setFilterTagId(null)}
                    >
                      Todas
                    </Button>
                    {Array.from(
                      new Map(
                        board.lists
                          .flatMap((list) => list.cards)
                          .flatMap((card) => card.tags)
                          .map((tag) => [tag.id, tag])
                      ).values()
                    ).map((tag) => (
                      <Button
                        key={tag.id}
                        type="button"
                        size="sm"
                        variant={filterTagId === tag.id ? "default" : "outline"}
                        onClick={() =>
                          setFilterTagId((current) => (current === tag.id ? null : tag.id))
                        }
                      >
                        {tag.name}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setFilterText("");
                    setFilterMemberId(null);
                    setFilterTagId(null);
                  }}
                >
                  Limpar filtros
                </Button>
                <Button type="button" onClick={() => setFilterDialogOpen(false)}>
                  Aplicar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <ClientInboxPanel
          onAddToBoard={handleAddClientTaskToBoard}
          availableLists={board.lists.map((list) => ({ id: list.id, title: list.title }))}
        />
      </main>
    </div>
  );
};

export default BoardView;

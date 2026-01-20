import { useState } from "react";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, MoreHorizontal, GripVertical } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { KanbanCard } from "./KanbanCard";
import type { List } from "@/lib/store";

interface KanbanColumnProps {
  list: List;
  onAddCard: (listId: string, title: string) => void;
  onDeleteCard: (cardId: string) => void;
  onDuplicateCard: (cardId: string) => void;
  onCardClick: (cardId: string) => void;
  onRenameList: (listId: string, newTitle: string) => void;
  onDeleteList: (listId: string) => void;
  isHighlighted?: boolean;
}

export const KanbanColumn = ({
  list,
  onAddCard,
  onDeleteCard,
  onDuplicateCard,
  onCardClick,
  onRenameList,
  onDeleteList,
  isHighlighted,
}: KanbanColumnProps) => {
  const [showAddCard, setShowAddCard] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState("");

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id: list.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || "transform 200ms cubic-bezier(0.25, 0.1, 0.25, 1)",
  };

  const handleAddCard = () => {
    if (!newCardTitle.trim()) return;
    onAddCard(list.id, newCardTitle.trim());
    setNewCardTitle("");
    setShowAddCard(false);
  };

  const handleRenameList = () => {
    const newTitle = window.prompt("Renomear coluna", list.title)?.trim();
    if (!newTitle) return;
    onRenameList(list.id, newTitle);
  };

  const handleDeleteList = () => {
    const confirmed = window.confirm(
      "Tem certeza que deseja excluir esta lista? Todos os cards dentro dela serão removidos."
    );
    if (!confirmed) return;
    onDeleteList(list.id);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`w-[85vw] sm:w-80 shrink-0 h-full flex flex-col cursor-grab active:cursor-grabbing transition-all duration-200 snap-center ${isDragging
          ? "opacity-50 scale-105 ring-2 ring-white/50"
          : isHighlighted
            ? "scale-[1.03] ring-4 ring-primary shadow-2xl bg-primary/10 animate-[pulse_1.5s_cubic-bezier(0.4,0,0.6,1)_2]"
            : ""
        }`}
    >
      <div
        className="mb-3 flex items-center gap-2 px-2"
      >
        <GripVertical className="h-4 w-4 text-white/70" />
        <h3 className="flex-1 font-semibold text-white truncate" title={list.title}>
          {list.title}
        </h3>
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-xs font-medium text-white">
          {list.cards.length}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-white hover:bg-white/20"
          onClick={() => {
            const choice = window
              .prompt("Opções da lista: 1 - Renomear, 2 - Excluir", "1")
              ?.trim();
            if (choice === "2") {
              handleDeleteList();
            } else if (choice === "1") {
              handleRenameList();
            }
          }}
          title="Opções da lista"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </div>

      <SortableContext items={(Array.isArray(list.cards) ? list.cards : []).map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div
          className={`min-h-[200px] flex-1 overflow-y-auto rounded-xl p-3 backdrop-blur-sm transition-all duration-300 ${isOver ? "bg-white/25 ring-2 ring-white/50 scale-[1.02]" : "bg-black/10"
            }`}
        >
          <div className="space-y-3">
            {(Array.isArray(list.cards) ? list.cards : []).map((card) => (
              <KanbanCard
                key={card.id}
                card={card}
                onDelete={() => onDeleteCard(card.id)}
                onDuplicate={() => onDuplicateCard(card.id)}
                onClick={() => onCardClick(card.id)}
              />
            ))}

            {showAddCard ? (
              <div className="rounded-lg bg-white p-3 shadow-lg">
                <Input
                  autoFocus
                  value={newCardTitle}
                  onChange={(e) => setNewCardTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddCard();
                    if (e.key === "Escape") setShowAddCard(false);
                  }}
                  placeholder="Digite o título do cartão..."
                  className="mb-2"
                />
                <div className="flex gap-2">
                  <Button onClick={handleAddCard} size="sm">
                    Adicionar
                  </Button>
                  <Button onClick={() => setShowAddCard(false)} variant="ghost" size="sm">
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowAddCard(true)}
                className="flex w-full items-center gap-2 rounded-lg p-2 text-sm text-white transition-colors hover:bg-white/10"
              >
                <Plus className="h-4 w-4" />
                <span>Adicionar cartão</span>
              </button>
            )}
          </div>
        </div>
      </SortableContext>
    </div>
  );
};
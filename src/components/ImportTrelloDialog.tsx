import { useState } from "react";
import { Upload, FileJson, FileText, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { useToast } from "@/hooks/use-toast";
import type { Board, List, Card, Member, Tag } from "@/lib/store";

interface ImportTrelloDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportBoard: (board: Omit<Board, "id" | "updatedAt">) => void;
}

interface TrelloCard {
  id: string;
  name: string;
  desc?: string;
  idList: string;
  labels?: Array<{ id: string; name: string; color: string }>;
  idMembers?: string[];
  due?: string | null;
  cover?: { url?: string };
  pos: number;
}

interface TrelloList {
  id: string;
  name: string;
  pos: number;
  cards?: TrelloCard[];
}

interface TrelloMember {
  id: string;
  fullName: string;
  username: string;
  initials: string;
}

interface TrelloBoard {
  name: string;
  desc?: string;
  prefs?: { background?: string; backgroundColor?: string };
  lists?: TrelloList[];
  cards?: TrelloCard[];
  members?: TrelloMember[];
  labels?: Array<{ id: string; name: string; color: string }>;
}

export function ImportTrelloDialog({ open, onOpenChange, onImportBoard }: ImportTrelloDialogProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const mapTrelloColorToHSL = (trelloColor: string): string => {
    const colorMap: Record<string, string> = {
      green: "hsl(142 71% 45%)",
      yellow: "hsl(45 93% 58%)",
      orange: "hsl(25 95% 55%)",
      red: "hsl(0 84% 60%)",
      purple: "hsl(258 90% 66%)",
      blue: "hsl(217 91% 60%)",
      sky: "hsl(199 89% 48%)",
      lime: "hsl(84 81% 44%)",
      pink: "hsl(330 81% 60%)",
      black: "hsl(0 0% 20%)",
    };
    return colorMap[trelloColor.toLowerCase()] || "hsl(217 91% 60%)";
  };

  const parseTrelloJSON = (data: TrelloBoard): Omit<Board, "id" | "updatedAt"> => {
    // Map members
    const members: Member[] = (data.members || []).map((member) => ({
      id: member.id,
      name: member.fullName || member.username,
      email: `${member.username}@imported.trello`,
      avatar: member.initials || member.username.substring(0, 2).toUpperCase(),
    }));

    // Map labels to tags
    const labelMap = new Map<string, Tag>();
    (data.labels || []).forEach((label) => {
      if (label.name) {
        labelMap.set(label.id, {
          id: label.id,
          name: label.name,
          color: mapTrelloColorToHSL(label.color),
        });
      }
    });

    // Map cards by list
    const cardsByList = new Map<string, TrelloCard[]>();
    (data.cards || []).forEach((card) => {
      if (!cardsByList.has(card.idList)) {
        cardsByList.set(card.idList, []);
      }
      cardsByList.get(card.idList)?.push(card);
    });

    // Map lists and cards
    const lists: List[] = (data.lists || [])
      .sort((a, b) => a.pos - b.pos)
      .map((list, listIndex) => {
        const trelloCards = cardsByList.get(list.id) || [];
        const cards: Card[] = trelloCards
          .sort((a, b) => a.pos - b.pos)
          .map((card, cardIndex) => {
            const cardTags: Tag[] = (card.labels || [])
              .map((label) => labelMap.get(label.id))
              .filter((tag): tag is Tag => tag !== undefined);

            const cardMembers: Member[] = (card.idMembers || [])
              .map((memberId) => members.find((m) => m.id === memberId))
              .filter((member): member is Member => member !== undefined);

            return {
              id: card.id,
              title: card.name,
              description: card.desc || undefined,
              listId: list.id,
              tags: cardTags,
              members: cardMembers,
              dueDate: card.due ? new Date(card.due).toLocaleDateString() : undefined,
              coverImage: card.cover?.url,
              order: cardIndex,
              checklist: [],
              attachments: [],
              comments: [],
            };
          });

        return {
          id: list.id,
          title: list.name,
          boardId: "temp",
          cards,
          order: listIndex,
        };
      });

    // Determine board color
    const boardColor =
      data.prefs?.backgroundColor ||
      (data.prefs?.background && data.prefs.background.startsWith("#")
        ? data.prefs.background
        : undefined) ||
      "hsl(217 91% 60%)";

    return {
      title: data.name || "Imported Board",
      description: data.desc,
      color: boardColor.startsWith("hsl") ? boardColor : `hsl(217 91% 60%)`,
      isFavorite: false,
      lists,
      members,
    };
  };

  const parseTrelloCSV = (csvContent: string): Omit<Board, "id" | "updatedAt"> => {
    const lines = csvContent.split("\n").filter((line) => line.trim());
    if (lines.length < 2) {
      throw new Error("O arquivo CSV está vazio ou é inválido");
    }

    const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));
    const listMap = new Map<string, List>();
    let boardTitle = "Imported Board";

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim().replace(/"/g, ""));
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || "";
      });

      const listName = row["List"] || row["List Name"] || "Default List";
      const cardName = row["Card"] || row["Card Name"] || row["Title"];

      if (!cardName) continue;

      if (!listMap.has(listName)) {
        listMap.set(listName, {
          id: `list-${listMap.size}`,
          title: listName,
          boardId: "temp",
          cards: [],
          order: listMap.size,
        });
      }

      const list = listMap.get(listName)!;
      list.cards.push({
        id: `card-${Date.now()}-${Math.random()}`,
        title: cardName,
        description: row["Description"] || undefined,
        listId: list.id,
        tags: [],
        members: [],
        dueDate: row["Due Date"] || undefined,
        order: list.cards.length,
      });
    }

    return {
      title: boardTitle,
      color: "hsl(217 91% 60%)",
      isFavorite: false,
      lists: Array.from(listMap.values()),
      members: [],
    };
  };

  const handleFileUpload = async (file: File) => {
    setIsProcessing(true);
    try {
      const fileContent = await file.text();

      let board: Omit<Board, "id" | "updatedAt">;

      if (file.name.endsWith(".json")) {
        const jsonData = JSON.parse(fileContent);
        board = parseTrelloJSON(jsonData);
      } else if (file.name.endsWith(".csv")) {
        board = parseTrelloCSV(fileContent);
      } else {
        throw new Error("Formato não suportado. Envie um arquivo JSON ou CSV.");
      }

      onImportBoard(board);
      toast({
        title: "Quadro importado com sucesso!",
        description: `"${board.title}" foi importado com ${board.lists.length} listas.`,
      });
      onOpenChange(false);
    } catch (error) {
      console.error("Import error:", error);
      toast({
        title: "Falha ao importar",
        description: error instanceof Error ? error.message : "Formato de arquivo inválido",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith(".json") || file.name.endsWith(".csv"))) {
      handleFileUpload(file);
    } else {
      toast({
        title: "Invalid file",
        description: "Please upload a JSON or CSV file",
        variant: "destructive",
      });
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Importar do Trello</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <p className="mb-2">Importe seu quadro do Trello enviando:</p>
            <ul className="ml-2 list-inside list-disc space-y-1">
              <li>Arquivo JSON exportado do Trello</li>
              <li>Arquivo CSV com cartões e listas</li>
            </ul>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`relative rounded-lg border-2 border-dashed p-8 transition-colors ${
              isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
            }`}
          >
            <input
              type="file"
              accept=".json,.csv"
              onChange={handleFileInputChange}
              disabled={isProcessing}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
            />

            <div className="flex flex-col items-center gap-3 text-center">
              <div className="rounded-full bg-primary/10 p-3">
                <Upload className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-medium">
                  {isProcessing ? "Processando..." : "Solte o arquivo aqui"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">ou clique para selecionar</p>
              </div>
              <div className="mt-2 flex gap-2">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <FileJson className="h-4 w-4" />
                  JSON
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  CSV
                </div>
              </div>
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            <p className="mb-1 font-medium">Como exportar do Trello:</p>
            <ol className="ml-2 list-inside list-decimal space-y-1">
              <li>Abra o quadro no Trello</li>
              <li>Clique em "Mostrar menu" (canto superior direito)</li>
              <li>Clique em "Mais" → "Imprimir e exportar"</li>
              <li>Clique em "Exportar como JSON"</li>
            </ol>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

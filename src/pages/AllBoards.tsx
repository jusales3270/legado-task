import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { BoardCard, CreateBoardCard } from "@/components/BoardCard";
import { CreateBoardDialog } from "@/components/CreateBoardDialog";
import { ImportTrelloDialog } from "@/components/ImportTrelloDialog";
import { Button } from "@/components/ui/button";
import { LayoutGrid, Plus, Download } from "lucide-react";
import { store } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";

const AllBoards = () => {
  const [boards, setBoards] = useState(store.getBoards());
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = store.subscribe(() => setBoards(store.getBoards()));
    return unsubscribe;
  }, []);

  const handleCreateBoard = (title: string, color: string) => {
    store.addBoard({ title, color, isFavorite: false, lists: [], members: [] });
    toast({ title: "Quadro criado!", description: `O quadro "${title}" foi criado com sucesso.` });
  };

  const handleImportBoard = (board: Omit<import("@/lib/store").Board, "id" | "updatedAt">) => {
    store.addBoard(board);
    toast({ 
      title: "Quadro importado!", 
      description: `"${board.title}" foi importado com ${board.lists.length} listas e ${board.lists.reduce((acc, list) => acc + list.cards.length, 0)} cartões.` 
    });
  };
  return (
    <Layout>
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LayoutGrid className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Todos os quadros</h1>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setIsImportDialogOpen(true)} size="lg" variant="outline" className="gap-2">
              <Download className="h-5 w-5" />Importar do Trello
            </Button>
            <Button onClick={() => setIsCreateDialogOpen(true)} size="lg" className="gap-2">
              <Plus className="h-5 w-5" />Criar quadro
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {boards.map((board) => (
            <BoardCard key={board.id} board={board} onToggleFavorite={(id) => store.toggleFavorite(id)} onDelete={(id) => store.deleteBoard(id)} />
          ))}
          <CreateBoardCard onClick={() => setIsCreateDialogOpen(true)} />
        </div>
        <CreateBoardDialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen} onCreateBoard={handleCreateBoard} />
        <ImportTrelloDialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen} onImportBoard={handleImportBoard} />
      </div>
    </Layout>
  );
};

export default AllBoards;
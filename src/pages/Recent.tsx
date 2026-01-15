import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { BoardCard, CreateBoardCard } from "@/components/BoardCard";
import { CreateBoardDialog } from "@/components/CreateBoardDialog";
import { Clock } from "lucide-react";
import { store } from "@/lib/store";

const Recent = () => {
  const [boards, setBoards] = useState(store.getRecentBoards());
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = store.subscribe(() => setBoards(store.getRecentBoards()));
    return unsubscribe;
  }, []);

  return (
    <Layout>
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center gap-3">
          <Clock className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Recentes</h1>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {boards.map((board) => (
            <BoardCard key={board.id} board={board} onToggleFavorite={(id) => store.toggleFavorite(id)} onDelete={(id) => store.deleteBoard(id)} />
          ))}
          <CreateBoardCard onClick={() => setIsCreateDialogOpen(true)} />
        </div>
        <CreateBoardDialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen} onCreateBoard={(title, color) => store.addBoard({ title, color, isFavorite: false, lists: [], members: [] })} />
      </div>
    </Layout>
  );
};

export default Recent;
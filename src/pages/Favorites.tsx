import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { BoardCard, CreateBoardCard } from "@/components/BoardCard";
import { CreateBoardDialog } from "@/components/CreateBoardDialog";
import { Star } from "lucide-react";
import { store } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";

const Favorites = () => {
  const [boards, setBoards] = useState(store.getFavoriteBoards());
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = store.subscribe(() => setBoards(store.getFavoriteBoards()));
    return unsubscribe;
  }, []);

  return (
    <Layout>
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center gap-3">
          <Star className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Quadros favoritos</h1>
        </div>
        {boards.length === 0 ? (
          <p className="text-center text-muted-foreground">Ainda não há quadros favoritos</p>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {boards.map((board) => (
              <BoardCard key={board.id} board={board} onToggleFavorite={(id) => store.toggleFavorite(id)} onDelete={(id) => store.deleteBoard(id)} />
            ))}
            <CreateBoardCard onClick={() => setIsCreateDialogOpen(true)} />
          </div>
        )}
        <CreateBoardDialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen} onCreateBoard={(title, color) => store.addBoard({ title, color, isFavorite: false, lists: [], members: [] })} />
      </div>
    </Layout>
  );
};

export default Favorites;
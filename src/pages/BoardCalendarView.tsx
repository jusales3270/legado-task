import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Calendar as CalendarIcon, ChevronLeft } from "lucide-react";
import { format, isSameDay, parse } from "date-fns";

import { store, Card } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";

const BoardCalendarView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [board, setBoard] = useState(id ? store.getBoard(id) : undefined);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      if (id) {
        setBoard(store.getBoard(id));
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

  const parseDueDate = (card: Card): Date | null => {
    if (!card.dueDate) return null;
    const direct = new Date(card.dueDate);
    if (!isNaN(direct.getTime())) return direct;
    try {
      return parse(card.dueDate, "MMM d", new Date());
    } catch {
      return null;
    }
  };

  const cardsForSelectedDate: Card[] = board.lists
    .flatMap((list) => list.cards)
    .filter((card) => {
      const date = parseDueDate(card);
      return selectedDate && date && isSameDay(date, selectedDate);
    })
    .sort((a, b) => a.order - b.order);

  const handleClearDate = () => {
    setSelectedDate(undefined);
    toast({ title: "Filtro de data limpo" });
  };

  return (
    <div className="flex min-h-screen w-full flex-col">
      <header className="border-b border-white/20 bg-black/10 px-6 py-4 backdrop-blur-sm shrink-0">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={() => navigate(`/board/${board.id}`)}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Calendário – {board.title}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {board.members.slice(0, 5).map((member) => (
                <Avatar key={member.id} className="h-8 w-8 border-2 border-white">
                  <AvatarFallback className="text-xs">{member.avatar}</AvatarFallback>
                </Avatar>
              ))}
            </div>
            <Link to={`/board/${board.id}`}>
              <Button variant="ghost" className="gap-2 text-white hover:bg-white/20">
                Voltar para o board
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 p-6">
        <section className="grid gap-6 lg:grid-cols-[360px,minmax(0,1fr)]">
          <article className="rounded-xl bg-white/90 p-4 shadow-lg backdrop-blur-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                Selecione uma data
              </h2>
              {selectedDate && (
                <Button variant="outline" size="sm" onClick={handleClearDate}>
                  Limpar
                </Button>
              )}
            </div>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="rounded-md bg-transparent"
            />
            {selectedDate && (
              <p className="mt-4 text-sm text-muted-foreground">
                Mostrando cards com vencimento em <strong>{format(selectedDate, "PPP")}</strong>.
              </p>
            )}
          </article>

          <article className="rounded-xl bg-white/95 p-4 shadow-lg backdrop-blur-sm flex flex-col min-h-[320px]">
            <header className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Cards deste dia</h2>
              <span className="text-sm text-muted-foreground">
                {cardsForSelectedDate.length} card(s)
              </span>
            </header>

            {cardsForSelectedDate.length === 0 ? (
              <div className="flex flex-1 items-center justify-center text-center text-muted-foreground">
                <p>
                  Nenhum card com data de vencimento para este dia ainda.
                  <br />
                  Adicione datas aos cards dentro do board para vê-los aqui.
                </p>
              </div>
            ) : (
              <div className="space-y-3 overflow-y-auto pr-1">
                {cardsForSelectedDate.map((card) => (
                  <div
                    key={card.id}
                    className="rounded-lg border border-border bg-card/80 p-3 shadow-sm transition-shadow hover:shadow-md"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium leading-snug">{card.title}</p>
                        {card.description && (
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                            {card.description}
                          </p>
                        )}
                      </div>
                      <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                        {card.dueDate ? card.dueDate : format(selectedDate ?? new Date(), "PPP")}
                      </span>
                    </div>
                    {card.tags?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {card.tags.map((tag) => (
                          <span
                            key={tag.id}
                            className="rounded-full px-2 py-0.5 text-xs font-medium"
                            style={{
                              background: tag.color,
                              color: "white",
                            }}
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </article>
        </section>
      </main>
    </div>
  );
};

export default BoardCalendarView;

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Palette, Sparkles } from "lucide-react";

interface CreateBoardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateBoard: (title: string, color: string) => void;
}

const boardColors = [
  { name: "Orange", value: "hsl(25 95% 55%)" },
  { name: "Purple", value: "hsl(258 90% 66%)" },
  { name: "Green", value: "hsl(172 66% 50%)" },
  { name: "Pink", value: "hsl(328 86% 70%)" },
  { name: "Red", value: "hsl(8 92% 64%)" },
  { name: "Blue", value: "hsl(220 90% 56%)" },
];

export const CreateBoardDialog = ({ open, onOpenChange, onCreateBoard }: CreateBoardDialogProps) => {
  const [title, setTitle] = useState("");
  const [selectedColor, setSelectedColor] = useState(boardColors[0].value);
  const [gradientColor1, setGradientColor1] = useState("#ff6b35");
  const [gradientColor2, setGradientColor2] = useState("#f7931e");
  const [gradientAngle, setGradientAngle] = useState(135);
  const [activeTab, setActiveTab] = useState<"preset" | "custom">("preset");

  const customGradient = `linear-gradient(${gradientAngle}deg, ${gradientColor1}, ${gradientColor2})`;
  const displayColor = activeTab === "preset" ? selectedColor : customGradient;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const finalColor = activeTab === "preset" ? selectedColor : customGradient;
    onCreateBoard(title.trim(), finalColor);
    setTitle("");
    setSelectedColor(boardColors[0].value);
    setActiveTab("preset");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Criar novo quadro</DialogTitle>
          <DialogDescription>Dê um título ao quadro e escolha uma cor de fundo.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex h-32 items-center justify-center rounded-lg overflow-hidden" style={{ background: displayColor }}>
            <span className="text-2xl font-bold text-white drop-shadow-lg">{title || "Título do quadro"}</span>
          </div>
          <div className="space-y-2">
            <Label htmlFor="title">Título do quadro</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Digite o título do quadro..." />
          </div>
        <div className="space-y-2">
          <Label>Plano de fundo</Label>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "preset" | "custom")} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="preset" className="gap-2">
                <Palette className="h-4 w-4" />
                Cores prontas
              </TabsTrigger>
              <TabsTrigger value="custom" className="gap-2">
                <Sparkles className="h-4 w-4" />
                Gradiente personalizado
              </TabsTrigger>
            </TabsList>

              <TabsContent value="preset" className="mt-4">
                <div className="flex gap-2 flex-wrap">
                  {boardColors.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setSelectedColor(color.value)}
                      className={`h-12 w-12 rounded-lg border-4 transition-all ${selectedColor === color.value ? "border-foreground scale-110" : "border-transparent hover:scale-105"}`}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    />
                  ))}
                </div>
              </TabsContent>

          <TabsContent value="custom" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="color1">Cor inicial</Label>
                <div className="flex gap-2">
                  <Input
                    id="color1"
                    type="color"
                    value={gradientColor1}
                    onChange={(e) => setGradientColor1(e.target.value)}
                    className="h-10 w-16 cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={gradientColor1}
                    onChange={(e) => setGradientColor1(e.target.value)}
                    className="flex-1"
                    placeholder="#ff6b35"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="color2">Cor final</Label>
                <div className="flex gap-2">
                  <Input
                    id="color2"
                    type="color"
                    value={gradientColor2}
                    onChange={(e) => setGradientColor2(e.target.value)}
                    className="h-10 w-16 cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={gradientColor2}
                    onChange={(e) => setGradientColor2(e.target.value)}
                    className="flex-1"
                    placeholder="#f7931e"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="angle">Ângulo do gradiente</Label>
                <span className="text-sm text-muted-foreground">{gradientAngle}°</span>
              </div>
              <input
                id="angle"
                type="range"
                min="0"
                max="360"
                value={gradientAngle}
                onChange={(e) => setGradientAngle(Number(e.target.value))}
                className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0° (→)</span>
                <span>90° (↑)</span>
                <span>180° (←)</span>
                <span>270° (↓)</span>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
        <Button type="submit" disabled={!title.trim()}>Criar quadro</Button>
      </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
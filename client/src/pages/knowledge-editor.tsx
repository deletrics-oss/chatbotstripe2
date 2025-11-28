import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Save, ArrowLeft, Upload, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { KnowledgeBase } from "@shared/schema";

export default function KnowledgeEditor() {
  const params = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const isEditMode = params.id !== undefined;

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [imageInput, setImageInput] = useState("");

  const [isScrapeDialogOpen, setIsScrapeDialogOpen] = useState(false);
  const [scrapeUrl, setScrapeUrl] = useState("");

  const { data: knowledge, isLoading } = useQuery<KnowledgeBase>({
    queryKey: ['/api/knowledge', params.id],
    enabled: isEditMode,
  });

  useEffect(() => {
    if (knowledge) {
      setTitle(knowledge.title);
      setContent(knowledge.content);
      setCategory(knowledge.category || "");
      setTags(knowledge.tags || []);
      setImageUrls(knowledge.imageUrls || []);
    }
  }, [knowledge]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/knowledge", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/knowledge'] });
      toast({
        title: "Criado",
        description: "Artigo criado com sucesso",
      });
      navigate("/knowledge");
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível criar o artigo",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("PATCH", `/api/knowledge/${params.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/knowledge'] });
      queryClient.invalidateQueries({ queryKey: ['/api/knowledge', params.id] });
      toast({
        title: "Salvo",
        description: "Artigo atualizado com sucesso",
      });
      navigate("/knowledge");
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível salvar o artigo",
        variant: "destructive",
      });
    },
  });

  const scrapeMutation = useMutation({
    mutationFn: async (url: string) => {
      const res = await apiRequest("POST", "/api/knowledge/scrape", { url });
      return await res.json();
    },
    onSuccess: (data) => {
      setTitle(data.title || "");
      setContent(data.content || "");
      setIsScrapeDialogOpen(false);
      setScrapeUrl("");
      toast({
        title: "Importado",
        description: "Conteúdo importado com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível importar o conteúdo. Verifique a URL.",
        variant: "destructive",
      });
    },
  });

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleAddImage = () => {
    if (imageInput.trim() && !imageUrls.includes(imageInput.trim())) {
      setImageUrls([...imageUrls, imageInput.trim()]);
      setImageInput("");
    }
  };

  const handleRemoveImage = (url: string) => {
    setImageUrls(imageUrls.filter(u => u !== url));
  };

  const handleSave = () => {
    if (!title.trim() || !content.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha título e conteúdo",
        variant: "destructive",
      });
      return;
    }

    const data = {
      title: title.trim(),
      content: content.trim(),
      category: category.trim() || null,
      tags: tags.length > 0 ? tags : [],
      imageUrls: imageUrls.length > 0 ? imageUrls : [],
    };

    if (isEditMode) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  if (isEditMode && isLoading) {
    return (
      <div className="p-6 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="h-8 w-32 bg-muted animate-pulse rounded mb-6" />
          <Card>
            <CardHeader>
              <div className="h-6 w-48 bg-muted animate-pulse rounded" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="h-10 bg-muted animate-pulse rounded" />
              <div className="h-40 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="max-w-4xl mx-auto">
        <Button variant="ghost" onClick={() => navigate("/knowledge")} className="mb-4" data-testid="button-back">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold" data-testid="text-page-title">
            {isEditMode ? "Editar Artigo" : "Novo Artigo"}
          </h1>
          <div className="flex gap-2">
            <Dialog open={isScrapeDialogOpen} onOpenChange={setIsScrapeDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-import-site">
                  <Upload className="w-4 h-4 mr-2" />
                  Importar do Site
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Importar Conteúdo</DialogTitle>
                  <DialogDescription>
                    Insira a URL de uma página para extrair o título e texto automaticamente.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <Label htmlFor="scrape-url">URL do Site</Label>
                  <Input
                    id="scrape-url"
                    placeholder="https://exemplo.com/pagina"
                    value={scrapeUrl}
                    onChange={(e) => setScrapeUrl(e.target.value)}
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsScrapeDialogOpen(false)}>Cancelar</Button>
                  <Button
                    onClick={() => scrapeMutation.mutate(scrapeUrl)}
                    disabled={!scrapeUrl || scrapeMutation.isPending}
                  >
                    {scrapeMutation.isPending ? "Importando..." : "Importar"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button onClick={handleSave} disabled={isPending} data-testid="button-save">
              <Save className="w-4 h-4 mr-2" />
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Informações do Artigo</CardTitle>
            <CardDescription>Preencha os dados do artigo de conhecimento</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                placeholder="Ex: Como configurar o WhatsApp Business"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                data-testid="input-title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Categoria</Label>
              <Input
                id="category"
                placeholder="Ex: Tutorial, FAQ, Produto"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                data-testid="input-category"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Conteúdo *</Label>
              <Textarea
                id="content"
                placeholder="Escreva o conteúdo completo do artigo..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={10}
                data-testid="input-content"
              />
            </div>

            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Adicionar tag"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                  data-testid="input-tag"
                />
                <Button type="button" variant="outline" onClick={handleAddTag} data-testid="button-add-tag">
                  Adicionar
                </Button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {tags.map((tag, idx) => (
                    <Badge key={idx} variant="secondary" className="gap-1" data-testid={`tag-${idx}`}>
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-1 hover:text-destructive"
                        data-testid={`button-remove-tag-${idx}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Imagens (URLs)</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="https://exemplo.com/imagem.jpg"
                  value={imageInput}
                  onChange={(e) => setImageInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddImage())}
                  data-testid="input-image-url"
                />
                <Button type="button" variant="outline" onClick={handleAddImage} data-testid="button-add-image">
                  <Upload className="w-4 h-4 mr-2" />
                  Adicionar
                </Button>
              </div>
              {imageUrls.length > 0 && (
                <div className="space-y-2 mt-2">
                  {imageUrls.map((url, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 border rounded" data-testid={`image-${idx}`}>
                      <img src={url} alt="" className="w-16 h-16 object-cover rounded" />
                      <span className="flex-1 text-sm truncate">{url}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveImage(url)}
                        data-testid={`button-remove-image-${idx}`}
                      >
                        <X className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

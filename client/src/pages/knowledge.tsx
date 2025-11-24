import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Trash2, Edit, BookOpen } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
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
import type { KnowledgeBase } from "@shared/schema";

export default function Knowledge() {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedKnowledgeId, setSelectedKnowledgeId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: knowledgeItems, isLoading } = useQuery<KnowledgeBase[]>({
    queryKey: ['/api/knowledge'],
  });

  const deleteKnowledgeMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/knowledge/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/knowledge'] });
      setDeleteDialogOpen(false);
      setSelectedKnowledgeId(null);
      toast({
        title: "Removido",
        description: "Artigo removido com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível remover o artigo",
        variant: "destructive",
      });
    },
  });

  const handleDelete = (id: string) => {
    setSelectedKnowledgeId(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (selectedKnowledgeId) {
      deleteKnowledgeMutation.mutate(selectedKnowledgeId);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Base de Conhecimento</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie artigos para treinar a IA do seu chatbot
          </p>
        </div>

        <Link href="/knowledge/new">
          <Button data-testid="button-create-knowledge">
            <Plus className="w-4 h-4 mr-2" />
            Novo Artigo
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : knowledgeItems && knowledgeItems.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {knowledgeItems.map((item) => (
            <Card key={item.id} className="hover-elevate" data-testid={`card-knowledge-${item.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg truncate" data-testid={`text-knowledge-title-${item.id}`}>
                      {item.title}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {item.category && (
                        <Badge variant="secondary" className="mb-2">
                          {item.category}
                        </Badge>
                      )}
                    </CardDescription>
                  </div>
                  <BookOpen className="w-5 h-5 text-muted-foreground shrink-0" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                  {item.content}
                </p>
                
                {item.tags && item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-4">
                    {item.tags.slice(0, 3).map((tag, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {item.tags.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{item.tags.length - 3}
                      </Badge>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <Link href={`/knowledge/${item.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full" data-testid={`button-edit-${item.id}`}>
                      <Edit className="w-4 h-4 mr-2" />
                      Editar
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(item.id)}
                    data-testid={`button-delete-${item.id}`}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum artigo criado</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Crie artigos para treinar a IA do seu chatbot
            </p>
            <Link href="/knowledge/new">
              <Button data-testid="button-create-first">
                <Plus className="w-4 h-4 mr-2" />
                Criar Primeiro Artigo
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este artigo? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

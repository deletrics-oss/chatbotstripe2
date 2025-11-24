import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Trash2, Edit, Brain, Sparkles } from "lucide-react";
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
import type { BotBehaviorConfig } from "@shared/schema";

export default function Behaviors() {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedBehaviorId, setSelectedBehaviorId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: behaviors, isLoading } = useQuery<BotBehaviorConfig[]>({
    queryKey: ['/api/bot-behaviors'],
  });

  const deleteBehaviorMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/bot-behaviors/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bot-behaviors'] });
      setDeleteDialogOpen(false);
      setSelectedBehaviorId(null);
      toast({
        title: "Removido",
        description: "Comportamento removido com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível remover o comportamento",
        variant: "destructive",
      });
    },
  });

  const handleDelete = (id: string) => {
    setSelectedBehaviorId(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (selectedBehaviorId) {
      deleteBehaviorMutation.mutate(selectedBehaviorId);
    }
  };

  const presets = behaviors?.filter(b => b.isPreset) || [];
  const customBehaviors = behaviors?.filter(b => !b.isPreset) || [];

  const getToneIcon = (tone: string) => {
    switch (tone) {
      case 'formal': return '👔';
      case 'friendly': return '😊';
      case 'persuasive': return '💼';
      case 'empathetic': return '🤝';
      default: return '🤖';
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Comportamentos do Bot</h1>
          <p className="text-muted-foreground mt-1">
            Configure personalidades e estilos de resposta para seu chatbot
          </p>
        </div>

        <Link href="/behaviors/new">
          <Button data-testid="button-create-behavior">
            <Plus className="w-4 h-4 mr-2" />
            Novo Comportamento
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4].map(i => (
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
      ) : (
        <div className="space-y-8">
          {presets.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold">Comportamentos Padrões</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {presets.map((behavior) => (
                  <Card key={behavior.id} className="hover-elevate" data-testid={`card-preset-${behavior.id}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-2xl">{getToneIcon(behavior.tone)}</span>
                            <CardTitle className="text-lg truncate" data-testid={`text-preset-name-${behavior.id}`}>
                              {behavior.name}
                            </CardTitle>
                          </div>
                          <CardDescription>
                            <Badge variant="secondary" className="text-xs">
                              {behavior.responseStyle === 'concise' ? 'Conciso' : 'Detalhado'}
                            </Badge>
                          </CardDescription>
                        </div>
                        <Brain className="w-5 h-5 text-primary shrink-0" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-4">
                        {behavior.personality}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {customBehaviors.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Comportamentos Personalizados</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {customBehaviors.map((behavior) => (
                  <Card key={behavior.id} className="hover-elevate" data-testid={`card-behavior-${behavior.id}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-lg truncate" data-testid={`text-behavior-name-${behavior.id}`}>
                            {behavior.name}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            <div className="flex gap-1 flex-wrap">
                              <Badge variant="secondary" className="text-xs">
                                {getToneIcon(behavior.tone)} {behavior.tone}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {behavior.responseStyle === 'concise' ? 'Conciso' : 'Detalhado'}
                              </Badge>
                            </div>
                          </CardDescription>
                        </div>
                        <Brain className="w-5 h-5 text-muted-foreground shrink-0" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                        {behavior.personality}
                      </p>
                      
                      <div className="flex gap-2">
                        <Link href={`/behaviors/${behavior.id}`} className="flex-1">
                          <Button variant="outline" size="sm" className="w-full" data-testid={`button-edit-${behavior.id}`}>
                            <Edit className="w-4 h-4 mr-2" />
                            Editar
                          </Button>
                        </Link>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(behavior.id)}
                          data-testid={`button-delete-${behavior.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {!isLoading && presets.length === 0 && customBehaviors.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Brain className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhum comportamento configurado</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Crie comportamentos personalizados para seu chatbot
                </p>
                <Link href="/behaviors/new">
                  <Button data-testid="button-create-first">
                    <Plus className="w-4 h-4 mr-2" />
                    Criar Primeiro Comportamento
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este comportamento? Esta ação não pode ser desfeita.
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

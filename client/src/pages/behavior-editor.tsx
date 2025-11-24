import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Save, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { BotBehaviorConfig } from "@shared/schema";

export default function BehaviorEditor() {
  const params = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const isEditMode = params.id !== undefined;

  const [name, setName] = useState("");
  const [tone, setTone] = useState<string>("friendly");
  const [personality, setPersonality] = useState("");
  const [responseStyle, setResponseStyle] = useState<string>("detailed");
  const [customInstructions, setCustomInstructions] = useState("");

  const { data: behavior, isLoading } = useQuery<BotBehaviorConfig>({
    queryKey: ['/api/bot-behaviors', params.id],
    enabled: isEditMode,
  });

  useEffect(() => {
    if (behavior) {
      setName(behavior.name);
      setTone(behavior.tone);
      setPersonality(behavior.personality);
      setResponseStyle(behavior.responseStyle);
      setCustomInstructions(behavior.customInstructions || "");
    }
  }, [behavior]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/bot-behaviors", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bot-behaviors'] });
      toast({
        title: "Criado",
        description: "Comportamento criado com sucesso",
      });
      navigate("/behaviors");
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível criar o comportamento",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("PATCH", `/api/bot-behaviors/${params.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bot-behaviors'] });
      queryClient.invalidateQueries({ queryKey: ['/api/bot-behaviors', params.id] });
      toast({
        title: "Salvo",
        description: "Comportamento atualizado com sucesso",
      });
      navigate("/behaviors");
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível salvar o comportamento",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!name.trim() || !personality.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha nome e personalidade",
        variant: "destructive",
      });
      return;
    }

    const data = {
      name: name.trim(),
      tone,
      personality: personality.trim(),
      responseStyle,
      customInstructions: customInstructions.trim() || null,
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
        <Button variant="ghost" onClick={() => navigate("/behaviors")} className="mb-4" data-testid="button-back">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold" data-testid="text-page-title">
            {isEditMode ? "Editar Comportamento" : "Novo Comportamento"}
          </h1>
          <Button onClick={handleSave} disabled={isPending} data-testid="button-save">
            <Save className="w-4 h-4 mr-2" />
            {isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Configuração do Comportamento</CardTitle>
            <CardDescription>Defina como o bot deve se comportar e responder</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                placeholder="Ex: Atendimento VIP"
                value={name}
                onChange={(e) => setName(e.target.value)}
                data-testid="input-name"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tone">Tom de Voz</Label>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger id="tone" data-testid="select-tone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="formal">👔 Formal</SelectItem>
                    <SelectItem value="friendly">😊 Amigável</SelectItem>
                    <SelectItem value="persuasive">💼 Persuasivo</SelectItem>
                    <SelectItem value="empathetic">🤝 Empático</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="responseStyle">Estilo de Resposta</Label>
                <Select value={responseStyle} onValueChange={setResponseStyle}>
                  <SelectTrigger id="responseStyle" data-testid="select-response-style">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="concise">⚡ Conciso</SelectItem>
                    <SelectItem value="detailed">📝 Detalhado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="personality">Personalidade *</Label>
              <Textarea
                id="personality"
                placeholder="Descreva como o bot deve se apresentar. Ex: Sou um assistente prestativo e profissional..."
                value={personality}
                onChange={(e) => setPersonality(e.target.value)}
                rows={6}
                data-testid="input-personality"
              />
              <p className="text-xs text-muted-foreground">
                Descreva em primeira pessoa como o bot deve se comportar
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="customInstructions">Instruções Customizadas</Label>
              <Textarea
                id="customInstructions"
                placeholder="Instruções adicionais para o bot seguir. Ex: Sempre pergunte o nome do cliente no início..."
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                rows={4}
                data-testid="input-custom-instructions"
              />
              <p className="text-xs text-muted-foreground">
                Regras e diretrizes específicas que o bot deve seguir
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

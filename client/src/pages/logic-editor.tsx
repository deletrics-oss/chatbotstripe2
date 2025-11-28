import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Upload, Download, Save, FileJson, Sparkles, Trash2, Play } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import type { LogicConfig, BotBehaviorConfig } from "@shared/schema";
import Editor from "@monaco-editor/react";

export default function LogicEditor() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [newLogicName, setNewLogicName] = useState("");
  const [newLogicDescription, setNewLogicDescription] = useState("");
  const [newLogicType, setNewLogicType] = useState<'json' | 'ai' | 'hybrid'>('json');
  const [selectedBehaviorId, setSelectedBehaviorId] = useState<string>("");
  const [selectedLogicId, setSelectedLogicId] = useState<string | null>(null);
  const [jsonContent, setJsonContent] = useState("{}");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiSourceType, setAiSourceType] = useState<'text' | 'url'>('text');
  const [aiSourceContent, setAiSourceContent] = useState("");
  const [useEmojis, setUseEmojis] = useState(true);
  const [aiGeneratedJson, setAiGeneratedJson] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("editor");
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: templates } = useQuery<any[]>({
    queryKey: ['/api/logics/templates'],
  });

  const handleUseTemplate = (template: any) => {
    setNewLogicName(template.name);
    setNewLogicDescription(template.description);
    setJsonContent(JSON.stringify(template.logic, null, 2));
    setNewLogicType('json');
    setIsCreateDialogOpen(true);

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    toast({
      title: "Template selecionado",
      description: "Preencha os detalhes para criar a lógica.",
    });
  };

  const { data: logics, isLoading } = useQuery<LogicConfig[]>({
    queryKey: ['/api/logics'],
  });

  const { data: behaviors } = useQuery<BotBehaviorConfig[]>({
    queryKey: ['/api/bot-behaviors'],
  });

  const generateAiLogicMutation = useMutation({
    mutationFn: async (data: { prompt: string; sourceType: 'text' | 'url'; sourceContent: string; useEmojis?: boolean }) => {
      const res = await apiRequest("POST", "/api/ai/generate-logic", data);
      return await res.json();
    },
    onSuccess: (data: any) => {
      try {
        const generatedJson = data.logicJson || data;
        setAiGeneratedJson(generatedJson);
        setJsonContent(JSON.stringify(generatedJson, null, 2));
        toast({
          title: "Lógica gerada",
          description: "JSON gerado com sucesso pela IA. Revise e salve se necessário.",
        });
      } catch (error) {
        toast({
          title: "Erro ao processar",
          description: "Não foi possível processar a resposta da IA",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.message || "Não foi possível gerar a lógica com IA",
        variant: "destructive",
      });
    },
  });

  const generateAndSaveAiLogicMutation = useMutation({
    mutationFn: async ({ prompt, logicName, sourceType, sourceContent, useEmojis }: { prompt: string; logicName: string; sourceType?: 'text' | 'url'; sourceContent?: string; useEmojis?: boolean }) => {
      return await apiRequest("POST", "/api/ai/generate-and-save-logic", { prompt, logicName, sourceType, sourceContent, useEmojis });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/logics'] });
      setAiPrompt("");
      toast({
        title: "Lógica criada",
        description: "Lógica gerada e salva com sucesso pela IA!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.message || "Não foi possível gerar e salvar a lógica",
        variant: "destructive",
      });
    },
  });

  const editLogicWithAiMutation = useMutation({
    mutationFn: async ({ currentJson, prompt, sourceType, sourceContent, useEmojis }: { currentJson: any; prompt: string; sourceType?: 'text' | 'url'; sourceContent?: string; useEmojis?: boolean }) => {
      const res = await apiRequest("POST", "/api/ai/edit-logic", { currentJson, prompt, sourceType, sourceContent, useEmojis });
      return await res.json();
    },
    onSuccess: (data: any) => {
      try {
        const modifiedJson = data.logicJson || data;
        setJsonContent(JSON.stringify(modifiedJson, null, 2));
        setAiPrompt("");
        setActiveTab("editor");
        toast({
          title: "Lógica atualizada",
          description: "JSON modificado pela IA com sucesso. Revise e salve.",
        });
        // Switch back to editor tab to show changes
        const editorTab = document.querySelector('[value="editor"]') as HTMLElement;
        if (editorTab) editorTab.click();
      } catch (error) {
        toast({
          title: "Erro ao processar",
          description: "Não foi possível processar a resposta da IA",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.message || "Não foi possível editar a lógica com IA",
        variant: "destructive",
      });
    },
  });

  const createLogicMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; logicJson: any; logicType: 'json' | 'ai' | 'hybrid'; behaviorConfigId?: string; aiPrompt?: string }) => {
      return await apiRequest("POST", "/api/logics", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/logics'] });
      setIsCreateDialogOpen(false);
      setNewLogicName("");
      setNewLogicDescription("");
      setNewLogicType('json');
      setSelectedBehaviorId("");
      toast({
        title: "Lógica criada",
        description: "Nova lógica adicionada com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível criar a lógica",
        variant: "destructive",
      });
    },
  });

  const updateLogicMutation = useMutation({
    mutationFn: async ({ id, logicJson }: { id: string; logicJson: any }) => {
      return await apiRequest("PATCH", `/api/logics/${id}`, { logicJson });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/logics'] });
      toast({
        title: "Salvo",
        description: "Lógica atualizada com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível salvar a lógica",
        variant: "destructive",
      });
    },
  });

  const deleteLogicMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/logics/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/logics'] });
      setSelectedLogicId(null);
      setJsonContent("{}");
      toast({
        title: "Deletada",
        description: "Lógica removida com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível deletar a lógica",
        variant: "destructive",
      });
    },
  });

  const selectedLogic = logics?.find(l => l.id === selectedLogicId);

  const handleSave = () => {
    if (!selectedLogicId) return;
    try {
      const parsedJson = JSON.parse(jsonContent);
      updateLogicMutation.mutate({ id: selectedLogicId, logicJson: parsedJson });
    } catch (error) {
      toast({
        title: "JSON Inválido",
        description: "Verifique a sintaxe do JSON",
        variant: "destructive",
      });
    }
  };

  const handleUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const content = event.target?.result as string;
            const parsed = JSON.parse(content);
            setJsonContent(JSON.stringify(parsed, null, 2));
            toast({
              title: "Arquivo carregado",
              description: "JSON importado com sucesso",
            });
          } catch (error) {
            toast({
              title: "Erro",
              description: "Arquivo JSON inválido",
              variant: "destructive",
            });
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleDownload = () => {
    if (!selectedLogic) return;
    const blob = new Blob([JSON.stringify(selectedLogic.logicJson, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedLogic.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const canUseAI = true; // Allow all plans to use AI for generation
  const canCreateLogics = user?.currentPlan !== 'free' || (logics?.length || 0) < 1;

  return (
    <div className="p-6 md:p-8 space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Editor de Lógicas</h1>
          <p className="text-muted-foreground mt-1">
            Crie e edite comportamentos do chatbot
          </p>
        </div>

        <div className="flex gap-2">
          {canCreateLogics ? (
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-logic">
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Lógica
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Lógica</DialogTitle>
                  <DialogDescription>
                    Defina um nome e descrição para a nova lógica
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="logic-name">Nome</Label>
                    <Input
                      id="logic-name"
                      placeholder="Ex: Atendimento Inicial"
                      value={newLogicName}
                      onChange={(e) => setNewLogicName(e.target.value)}
                      data-testid="input-logic-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="logic-description">Descrição</Label>
                    <Textarea
                      id="logic-description"
                      placeholder="Descreva o comportamento desta lógica"
                      value={newLogicDescription}
                      onChange={(e) => setNewLogicDescription(e.target.value)}
                      data-testid="input-logic-description"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="behavior">Comportamento do Bot (Opcional)</Label>
                    <Select value={selectedBehaviorId || "none"} onValueChange={setSelectedBehaviorId}>
                      <SelectTrigger id="behavior" data-testid="select-behavior">
                        <SelectValue placeholder="Selecione um comportamento" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {behaviors?.map((behavior) => (
                          <SelectItem key={behavior.id} value={behavior.id}>
                            {behavior.isPreset ? '⭐ ' : ''}{behavior.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <div>
                    <Label htmlFor="logic-type">Tipo de Lógica</Label>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      <Button
                        variant={newLogicType === 'json' ? 'default' : 'outline'}
                        className="flex-1 min-w-fit"
                        onClick={() => setNewLogicType('json')}
                        data-testid="button-type-json"
                      >
                        📋 JSON
                      </Button>
                      <Button
                        variant={newLogicType === 'ai' ? 'default' : 'outline'}
                        className="flex-1 min-w-fit"
                        onClick={() => setNewLogicType('ai')}
                        data-testid="button-type-ai"
                      >
                        🤖 IA
                      </Button>
                      <Button
                        variant={newLogicType === 'hybrid' ? 'default' : 'outline'}
                        className="flex-1 min-w-fit"
                        onClick={() => setNewLogicType('hybrid')}
                        data-testid="button-type-hybrid"
                      >
                        ⚡ HÍBRIDO
                      </Button>
                    </div>
                  </div>

                </div>

                {newLogicType === 'ai' && (
                  <div className="space-y-4 mt-4 border-t pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="ai-prompt-create">O que você quer criar?</Label>
                      <Textarea
                        id="ai-prompt-create"
                        placeholder="Ex: Criar bot de atendimento para loja de roupas..."
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        className="h-24"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Fonte de Conhecimento (Opcional)</Label>
                      <div className="flex gap-2">
                        <Button
                          variant={aiSourceType === 'text' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setAiSourceType('text')}
                          className="flex-1"
                        >
                          Texto
                        </Button>
                        <Button
                          variant={aiSourceType === 'url' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setAiSourceType('url')}
                          className="flex-1"
                        >
                          URL do Site
                        </Button>
                      </div>

                      {aiSourceType === 'url' ? (
                        <Input
                          placeholder="https://www.exemplo.com.br"
                          value={aiSourceContent}
                          onChange={(e) => setAiSourceContent(e.target.value)}
                        />
                      ) : (
                        <Textarea
                          placeholder="Cole o texto aqui..."
                          value={aiSourceContent}
                          onChange={(e) => setAiSourceContent(e.target.value)}
                          className="h-24"
                        />
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="use-emojis-create"
                        checked={useEmojis}
                        onCheckedChange={(checked) => setUseEmojis(checked as boolean)}
                      />
                      <Label htmlFor="use-emojis-create">Usar Emojis</Label>
                    </div>

                    <Button
                      className="w-full"
                      onClick={() => generateAndSaveAiLogicMutation.mutate({
                        prompt: aiPrompt,
                        logicName: newLogicName || "Nova Lógica IA",
                        sourceType: aiSourceType,
                        sourceContent: aiSourceContent,
                        useEmojis
                      })}
                      disabled={!aiPrompt || generateAndSaveAiLogicMutation.isPending}
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      {generateAndSaveAiLogicMutation.isPending ? "Gerando..." : "Gerar e Salvar"}
                    </Button>
                  </div>
                )}

                {newLogicType === 'hybrid' && (
                  <div className="space-y-2 mt-4">
                    <Label htmlFor="ai-prompt">Prompt da IA (para comando /ia)</Label>
                    <Textarea
                      id="ai-prompt"
                      placeholder="Defina a personalidade e instruções da IA aqui..."
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      className="h-32"
                    />
                    <p className="text-xs text-muted-foreground">
                      No modo Híbrido, este prompt será usado apenas quando o cliente enviar o comando <code>/ia</code>.
                    </p>
                  </div>
                )}

                <DialogFooter className="mt-6">
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={() => createLogicMutation.mutate({
                      name: newLogicName,
                      description: newLogicDescription,
                      logicJson: {},
                      logicType: newLogicType,
                      behaviorConfigId: (selectedBehaviorId && selectedBehaviorId !== "none") ? selectedBehaviorId : undefined,
                      aiPrompt: newLogicType === 'hybrid' ? aiPrompt : undefined,
                    })}
                    disabled={!newLogicName || createLogicMutation.isPending}
                    data-testid="button-submit-logic"
                  >
                    {createLogicMutation.isPending ? "Criando..." : "Criar"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : (
            <Button disabled data-testid="button-create-logic-disabled">
              <Plus className="w-4 h-4 mr-2" />
              Upgrade para criar mais
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Logics List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Lógicas</CardTitle>
            <CardDescription>
              Suas configurações de comportamento
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : logics && logics.length > 0 ? (
              <div className="space-y-2">
                {logics.map((logic) => (
                  <button
                    key={logic.id}
                    onClick={() => {
                      setSelectedLogicId(logic.id);
                      setJsonContent(JSON.stringify(logic.logicJson, null, 2));
                    }}
                    className={`w-full text-left p-3 rounded-lg border border-border hover-elevate active-elevate-2 ${selectedLogicId === logic.id ? 'bg-accent' : ''
                      }`}
                    data-testid={`logic-item-${logic.id}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{logic.name}</p>
                        {logic.description && (
                          <p className="text-xs text-muted-foreground truncate mt-1">
                            {logic.description}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {logic.isActive && (
                          <Badge variant="default">Ativa</Badge>
                        )}
                        <Badge variant={logic.logicType === 'ai' ? 'secondary' : logic.logicType === 'hybrid' ? 'default' : 'outline'}>
                          {logic.logicType === 'ai' ? '🤖 IA' : logic.logicType === 'hybrid' ? '⚡ HÍBRIDO' : '📋 JSON'}
                        </Badge>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhuma lógica criada
              </p>
            )}
          </CardContent>
        </Card>

        {/* Editor */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle>
                  {selectedLogic ? selectedLogic.name : "Editor JSON"}
                </CardTitle>
                <CardDescription>
                  {selectedLogic ? selectedLogic.description : "Selecione uma lógica para editar"}
                </CardDescription>
              </div>
              {selectedLogic && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleUpload} data-testid="button-upload">
                    <Upload className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownload} data-testid="button-download">
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={updateLogicMutation.isPending} data-testid="button-save">
                    <Save className="w-4 h-4 mr-2" />
                    Salvar
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (confirm('Tem certeza que deseja deletar esta lógica?') && selectedLogicId) {
                        deleteLogicMutation.mutate(selectedLogicId);
                      }
                    }}
                    disabled={deleteLogicMutation.isPending}
                    data-testid="button-delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {selectedLogic ? (
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="w-full">
                  <TabsTrigger value="editor" className="flex-1">Editor</TabsTrigger>
                  <TabsTrigger value="preview" className="flex-1">Preview</TabsTrigger>
                  {canUseAI && (
                    <TabsTrigger value="ai" className="flex-1">
                      <Sparkles className="w-4 h-4 mr-2" />
                      IA
                    </TabsTrigger>
                  )}
                </TabsList>
                <TabsContent value="editor" className="mt-4">
                  <div className="border border-border rounded-lg overflow-hidden">
                    <Editor
                      height="500px"
                      language="json"
                      value={jsonContent}
                      onChange={(value) => setJsonContent(value || "{}")}
                      theme="vs-dark"
                      options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        lineNumbers: 'on',
                        formatOnPaste: true,
                        formatOnType: true,
                      }}
                    />
                  </div>
                </TabsContent>
                <TabsContent value="preview" className="mt-4">
                  <div className="border border-border rounded-lg p-4 bg-muted min-h-[500px]">
                    <pre className="text-sm font-mono overflow-auto">
                      {jsonContent}
                    </pre>
                  </div>
                </TabsContent>
                {canUseAI && (
                  <TabsContent value="ai" className="mt-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="space-y-4">
                          <div className="flex items-center gap-2 text-primary">
                            <Sparkles className="w-5 h-5" />
                            <p className="font-medium">
                              {selectedLogic ? "Editor Assistido por IA" : "Gerador IA Gemini"}
                            </p>
                          </div>

                          <p className="text-sm text-muted-foreground">
                            {selectedLogic
                              ? "Descreva como você quer alterar esta lógica e a IA fará as modificações no JSON."
                              : "Descreva o comportamento desejado e a IA gerará a lógica JSON automaticamente."}
                          </p>

                          <Textarea
                            placeholder={selectedLogic
                              ? "Ex: Adicione uma regra para responder 'O preço é R$ 50' quando perguntarem sobre 'preço' ou 'valor'"
                              : "Ex: Criar um fluxo que responde 'Olá! Como posso ajudar?' quando receber 'oi' ou 'olá'..."}
                            rows={4}
                            value={aiPrompt}
                            onChange={(e) => setAiPrompt(e.target.value)}
                            data-testid="input-ai-prompt"
                          />

                          {/* Source Inputs (Available for both Edit and Create) */}
                          <div className="space-y-2">
                            <Label>Fonte de Conhecimento (Opcional)</Label>
                            <div className="flex gap-2">
                              <Button
                                variant={aiSourceType === 'text' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setAiSourceType('text')}
                                className="flex-1"
                              >
                                Texto
                              </Button>
                              <Button
                                variant={aiSourceType === 'url' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setAiSourceType('url')}
                                className="flex-1"
                              >
                                URL do Site
                              </Button>
                            </div>
                            {aiSourceType === 'text' ? (
                              <Textarea
                                placeholder="Cole aqui o texto de base (ex: cardápio, FAQ)..."
                                value={aiSourceContent}
                                onChange={(e) => setAiSourceContent(e.target.value)}
                                className="h-24"
                              />
                            ) : (
                              <Input
                                placeholder="https://seu-site.com"
                                value={aiSourceContent}
                                onChange={(e) => setAiSourceContent(e.target.value)}
                              />
                            )}
                          </div>

                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="use-emojis"
                              checked={useEmojis}
                              onCheckedChange={(checked) => setUseEmojis(checked as boolean)}
                            />
                            <Label htmlFor="use-emojis" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                              Usar Emojis nas respostas
                            </Label>
                          </div>

                          {selectedLogic ? (
                            <Button
                              className="w-full"
                              onClick={() => {
                                try {
                                  const currentJson = JSON.parse(jsonContent);
                                  editLogicWithAiMutation.mutate({
                                    currentJson,
                                    prompt: aiPrompt,
                                    sourceType: aiSourceType,
                                    sourceContent: aiSourceContent,
                                    useEmojis
                                  });
                                } catch (e) {
                                  toast({
                                    title: "JSON Inválido",
                                    description: "Corrija o JSON atual antes de usar a IA",
                                    variant: "destructive"
                                  });
                                }
                              }}
                              disabled={!aiPrompt || editLogicWithAiMutation.isPending}
                            >
                              <Sparkles className="w-4 h-4 mr-2" />
                              {editLogicWithAiMutation.isPending ? "Processando..." : "Aplicar Alterações com IA"}
                            </Button>
                          ) : (
                            !aiGeneratedJson ? (
                              <div className="space-y-3">
                                <Button
                                  variant="outline"
                                  className="w-full"
                                  onClick={() => generateAiLogicMutation.mutate({ prompt: aiPrompt, sourceType: aiSourceType, sourceContent: aiSourceContent, useEmojis })}
                                  disabled={!aiPrompt || generateAiLogicMutation.isPending}
                                >
                                  <Play className="w-4 h-4 mr-2" />
                                  {generateAiLogicMutation.isPending ? "Gerando Preview..." : "Gerar Preview"}
                                </Button>
                                <Button
                                  className="w-full"
                                  onClick={() => setIsSaveDialogOpen(true)}
                                  disabled={!aiPrompt}
                                >
                                  <Save className="w-4 h-4 mr-2" />
                                  Gerar e Salvar
                                </Button>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <div className="border border-border rounded-lg p-4 bg-muted">
                                  <p className="text-sm font-medium mb-2">JSON Gerado:</p>
                                  <pre className="text-xs font-mono overflow-auto max-h-[300px]">
                                    {JSON.stringify(aiGeneratedJson, null, 2)}
                                  </pre>
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="save-ai-name">Nome da Lógica</Label>
                                  <Input
                                    id="save-ai-name"
                                    placeholder="Ex: Atendimento Inicial"
                                    value={newLogicName}
                                    onChange={(e) => setNewLogicName(e.target.value)}
                                    data-testid="input-save-ai-name"
                                  />
                                </div>

                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => {
                                      setAiGeneratedJson(null);
                                      setNewLogicName("");
                                    }}
                                    data-testid="button-reject-ai"
                                  >
                                    Descartar
                                  </Button>
                                  <Button
                                    className="flex-1"
                                    onClick={() => {
                                      if (selectedLogicId && newLogicName) {
                                        updateLogicMutation.mutate({
                                          id: selectedLogicId,
                                          logicJson: aiGeneratedJson
                                        });
                                        setAiGeneratedJson(null);
                                      } else if (!selectedLogicId && newLogicName) {
                                        createLogicMutation.mutate({
                                          name: newLogicName,
                                          description: `Gerada por IA Gemini`,
                                          logicJson: aiGeneratedJson,
                                          logicType: 'ai',
                                        });
                                        setAiGeneratedJson(null);
                                        setNewLogicName("");
                                      }
                                    }}
                                    disabled={!newLogicName || updateLogicMutation.isPending || createLogicMutation.isPending}
                                    data-testid="button-accept-ai"
                                  >
                                    <Save className="w-4 h-4 mr-2" />
                                    Salvar Lógica
                                  </Button>
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                )}
              </Tabs>
            ) : (
              <div className="flex items-center justify-center h-[500px] text-center">
                <div className="space-y-3">
                  <FileJson className="w-16 h-16 text-muted-foreground mx-auto" />
                  <p className="text-sm text-muted-foreground">
                    Selecione uma lógica na lista ou crie uma nova
                  </p>
                </div>
              </div>
            )
            }
          </CardContent >
        </Card >
      </div >

      {/* Templates */}
      < Card >
        <CardHeader>
          <CardTitle>Templates Prontos</CardTitle>
          <CardDescription>Modelos pré-configurados para começar rapidamente</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card para Gerar com IA */}
            <Card
              className="hover-elevate cursor-pointer transition-all border-dashed border-2 hover:border-primary bg-muted/30"
              onClick={() => {
                if (!canCreateLogics) {
                  toast({
                    title: "Limite atingido",
                    description: "Você atingiu o limite de lógicas do seu plano. Faça upgrade ou exclua uma lógica existente.",
                    variant: "destructive"
                  });
                  return;
                }
                setNewLogicType('ai');
                setIsCreateDialogOpen(true);
              }}
            >
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  Criar com IA
                </CardTitle>
                <Badge variant="secondary" className="w-fit mt-1">Recomendado</Badge>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Descreva o que você quer ou envie um link/texto e a IA cria tudo para você.
                </p>
              </CardContent>
            </Card>

            {templates?.map((template) => (
              <Card
                key={template.id}
                className="hover-elevate cursor-pointer transition-all hover:border-primary"
                onClick={() => {
                  if (!canCreateLogics) {
                    toast({
                      title: "Limite atingido",
                      description: "Você atingiu o limite de lógicas do seu plano. Faça upgrade ou exclua uma lógica existente.",
                      variant: "destructive"
                    });
                    return;
                  }
                  handleUseTemplate(template);
                }}
                data-testid={`template-${template.id}`}
              >
                <CardHeader>
                  <CardTitle className="text-base">{template.name}</CardTitle>
                  <Badge variant="outline" className="w-fit mt-1">{template.category}</Badge>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {template.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card >
    </div >
  );
}

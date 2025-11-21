import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Upload, Download, Save, FileJson, Sparkles, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import type { LogicConfig } from "@shared/schema";
import Editor from "@monaco-editor/react";

export default function LogicEditor() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newLogicName, setNewLogicName] = useState("");
  const [newLogicDescription, setNewLogicDescription] = useState("");
  const [newLogicType, setNewLogicType] = useState<'json' | 'ai' | 'hybrid'>('json');
  const [selectedLogicId, setSelectedLogicId] = useState<string | null>(null);
  const [jsonContent, setJsonContent] = useState("{}");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGeneratedJson, setAiGeneratedJson] = useState<any>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: logics, isLoading } = useQuery<LogicConfig[]>({
    queryKey: ['/api/logics'],
  });

  const generateAiLogicMutation = useMutation({
    mutationFn: async (prompt: string) => {
      return await apiRequest("POST", "/api/ai/generate-logic", { prompt });
    },
    onSuccess: (data: any) => {
      try {
        const generatedJson = data.logicJson || data;
        setAiGeneratedJson(generatedJson);
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
    mutationFn: async ({ prompt, logicName }: { prompt: string; logicName: string }) => {
      return await apiRequest("POST", "/api/ai/generate-and-save-logic", { prompt, logicName });
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

  const createLogicMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; logicJson: any; logicType: 'json' | 'ai' | 'hybrid' }) => {
      return await apiRequest("POST", "/api/logics", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/logics'] });
      setIsCreateDialogOpen(false);
      setNewLogicName("");
      setNewLogicDescription("");
      setNewLogicType('json');
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
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={() => createLogicMutation.mutate({
                      name: newLogicName,
                      description: newLogicDescription,
                      logicJson: {},
                      logicType: newLogicType,
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
                    className={`w-full text-left p-3 rounded-lg border border-border hover-elevate active-elevate-2 ${
                      selectedLogicId === logic.id ? 'bg-accent' : ''
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
                      if (confirm('Tem certeza que deseja deletar esta lógica?')) {
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
              <Tabs defaultValue="editor" className="w-full">
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
                            <p className="font-medium">Gerador IA Gemini</p>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Descreva o comportamento desejado e a IA gerará a lógica JSON automaticamente.
                          </p>
                          <Textarea
                            placeholder="Ex: Criar um fluxo que responde 'Olá! Como posso ajudar?' quando receber 'oi' ou 'olá', e responde 'Nosso horário é 9h às 18h' quando receber 'horário' ou 'funcionamento'"
                            rows={4}
                            value={aiPrompt}
                            onChange={(e) => setAiPrompt(e.target.value)}
                            data-testid="input-ai-prompt"
                          />
                          
                          {!aiGeneratedJson ? (
                            <div className="space-y-3">
                              <Button 
                                variant="outline"
                                className="w-full" 
                                onClick={() => generateAiLogicMutation.mutate(aiPrompt)}
                                disabled={!aiPrompt || generateAiLogicMutation.isPending}
                                data-testid="button-generate-ai"
                              >
                                <Sparkles className="w-4 h-4 mr-2" />
                                {generateAiLogicMutation.isPending ? "Gerando..." : "Gerar Prévia"}
                              </Button>
                              <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                  <div className="w-full border-t border-border" />
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                  <span className="bg-card px-2 text-muted-foreground">ou</span>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="logic-auto-name">Nome da Lógica</Label>
                                <Input
                                  id="logic-auto-name"
                                  placeholder="Ex: Atendimento Inicial"
                                  value={newLogicName}
                                  onChange={(e) => setNewLogicName(e.target.value)}
                                  data-testid="input-logic-auto-name"
                                />
                              </div>
                              <Button 
                                className="w-full" 
                                onClick={() => generateAndSaveAiLogicMutation.mutate({ prompt: aiPrompt, logicName: newLogicName })}
                                disabled={!aiPrompt || !newLogicName || generateAndSaveAiLogicMutation.isPending}
                                data-testid="button-generate-and-save-ai"
                              >
                                <Sparkles className="w-4 h-4 mr-2" />
                                {generateAndSaveAiLogicMutation.isPending ? "Gerando e Salvando..." : "Gerar e Salvar"}
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
            )}
          </CardContent>
        </Card>
      </div>

      {/* Templates */}
      <Card>
        <CardHeader>
          <CardTitle>Templates Prontos</CardTitle>
          <CardDescription>Modelos pré-configurados para começar rapidamente</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="hover-elevate cursor-pointer" data-testid="template-welcome">
              <CardHeader>
                <CardTitle className="text-base">Boas-vindas</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Mensagem automática de boas-vindas para novos contatos
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate cursor-pointer" data-testid="template-faq">
              <CardHeader>
                <CardTitle className="text-base">FAQ Automático</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Responde perguntas frequentes automaticamente
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate cursor-pointer" data-testid="template-support">
              <CardHeader>
                <CardTitle className="text-base">Suporte</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Fluxo de atendimento e triagem de suporte
                </p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

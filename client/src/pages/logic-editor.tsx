import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Sparkles,
  Plus,
  Save,
  Trash2,
  Bot,
  Play,
  Copy,
  Wand2,
  FileText,
  CheckCircle2,
  MessageSquare,
  Send,
  Globe,
  Code,
  Zap,
  Sliders,
  HelpCircle,
} from "lucide-react";
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
  const [selectedLogicId, setSelectedLogicId] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isAssistModalOpen, setIsAssistModalOpen] = useState(false);
  const [showJsonEditor, setShowJsonEditor] = useState(false);

  // Form State for Creation
  const [newLogicName, setNewLogicName] = useState("");
  const [newLogicDescription, setNewLogicDescription] = useState("");
  const [newLogicType, setNewLogicType] = useState<'ai' | 'hybrid' | 'json'>('ai');
  const [selectedBehaviorId, setSelectedBehaviorId] = useState<string>("");

  // Editor State
  const [systemPrompt, setSystemPrompt] = useState("");
  const [defaultReply, setDefaultReply] = useState("Olá! Seja bem-vindo(a)! Como posso te ajudar hoje?");
  const [jsonContent, setJsonContent] = useState("{}");
  const [activeTab, setActiveTab] = useState("prompt");

  // Gemini Assistant Dialog State
  const [assistBusiness, setAssistBusiness] = useState("");
  const [assistObjective, setAssistObjective] = useState("");

  // Test Simulator State
  const [simMessage, setSimMessage] = useState("");
  const [simHistory, setSimHistory] = useState<Array<{ role: 'user' | 'bot'; text: string }>>([]);
  const [isSimulating, setIsSimulating] = useState(false);

  const { toast } = useToast();
  const { user } = useAuth();

  // Queries
  const { data: logics, isLoading } = useQuery<LogicConfig[]>({
    queryKey: ['/api/logics'],
  });

  const { data: behaviors } = useQuery<BotBehaviorConfig[]>({
    queryKey: ['/api/bot-behaviors'],
  });

  const selectedLogic = logics?.find(l => l.id === selectedLogicId);

  // Sync state when selected logic changes
  const handleSelectLogic = (logic: LogicConfig) => {
    setSelectedLogicId(logic.id);
    const logicJsonProp: any = logic.logicJson || {};
    const promptText = logicJsonProp.ai_sys_prompt || logic.description || "";
    setSystemPrompt(promptText);
    setDefaultReply(logicJsonProp.default_reply || "Olá! Seja bem-vindo(a)! Como posso te ajudar hoje?");
    setJsonContent(JSON.stringify(logic.logicJson || {}, null, 2));
    setSimHistory([]);
  };

  // Gemini Assist Prompt Mutation
  const assistPromptMutation = useMutation({
    mutationFn: async (data: { businessDescription: string; objective: string; currentPrompt?: string }) => {
      const res = await apiRequest("POST", "/api/ai/assist-prompt", data);
      return await res.json();
    },
    onSuccess: (data: any) => {
      if (data.prompt) {
        setSystemPrompt(data.prompt);
        setIsAssistModalOpen(false);
        toast({
          title: "Prompt Gerado com Sucesso! ✨",
          description: "O Gemini estruturou as instruções do seu atendente. Revise e salve quando quiser.",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao gerar com Gemini",
        description: error?.message || "Não foi possível conectar ao Gemini. Verifique sua API Key.",
        variant: "destructive",
      });
    }
  });

  // Save Logic Mutation
  const updateLogicMutation = useMutation({
    mutationFn: async ({ id, name, description, logicJson, logicType }: { id: string; name?: string; description?: string; logicJson: any; logicType?: string }) => {
      return await apiRequest("PATCH", `/api/logics/${id}`, {
        ...(name && { name }),
        ...(description && { description }),
        ...(logicType && { logicType }),
        logicJson
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/logics'] });
      toast({
        title: "Lógica Salva! 💾",
        description: "As alterações foram atualizadas no banco de dados com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao salvar",
        description: error?.message || "Não foi possível salvar a lógica.",
        variant: "destructive",
      });
    }
  });

  // Create Logic Mutation
  const createLogicMutation = useMutation({
    mutationFn: async (data: { prompt: string; logicName: string; sourceType?: 'text' | 'url'; sourceContent?: string }) => {
      return await apiRequest("POST", "/api/ai/generate-and-save-logic", data);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/logics'] });
      setIsCreateDialogOpen(false);
      setNewLogicName("");
      setNewLogicDescription("");
      if (data && data.id) {
        setSelectedLogicId(data.id);
        setSystemPrompt(data.logicJson?.ai_sys_prompt || "");
      }
      toast({
        title: "Atendente Criado com IA! 🤖",
        description: "Nova lógica de atendimento cadastrada e ativada.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar lógica",
        description: error?.message || "Falha ao gerar e salvar a lógica.",
        variant: "destructive",
      });
    }
  });

  // Delete Logic Mutation
  const deleteLogicMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/logics/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/logics'] });
      setSelectedLogicId(null);
      setSystemPrompt("");
      toast({
        title: "Removido",
        description: "Lógica excluída com sucesso.",
      });
    },
  });

  // Save current prompt back into selected logic
  const handleSavePrompt = () => {
    if (!selectedLogicId || !selectedLogic) return;

    let currentJsonObj: any = {};
    try {
      currentJsonObj = JSON.parse(jsonContent);
    } catch (e) {
      currentJsonObj = (selectedLogic.logicJson as any) || {};
    }

    const updatedJson = {
      ...currentJsonObj,
      default_reply: defaultReply,
      fallback_to_ai: true,
      ai_sys_prompt: systemPrompt,
    };

    updateLogicMutation.mutate({
      id: selectedLogicId,
      name: selectedLogic.name,
      description: systemPrompt.slice(0, 120) + "...",
      logicJson: updatedJson,
    });
  };

  // Test Simulator logic
  const handleRunSimulation = async () => {
    if (!simMessage.trim() || !systemPrompt) return;

    const userText = simMessage;
    setSimMessage("");
    setSimHistory(prev => [...prev, { role: 'user', text: userText }]);
    setIsSimulating(true);

    try {
      const res = await apiRequest("POST", "/api/ai/chat-logic", {
        messages: [{ role: "user", content: userText }],
        currentJson: {
          fallback_to_ai: true,
          ai_sys_prompt: systemPrompt,
          default_reply: defaultReply,
        }
      });
      const data = await res.json();
      const botText = data.edited || data.text || "Simulação concluída com Gemini!";
      setSimHistory(prev => [...prev, { role: 'bot', text: botText }]);
    } catch (err: any) {
      setSimHistory(prev => [...prev, { role: 'bot', text: "Erro ao testar com Gemini. Verifique a API Key." }]);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Atendentes & Lógicas de IA</h1>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 gap-1 py-1">
              <Sparkles className="w-3.5 h-3.5 text-primary" /> Gemini AI Engine
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            Configure as instruções, personalidades e fluxos de atendimento do seu robô no WhatsApp.
          </p>
        </div>

        <div className="flex gap-3">
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="gap-2 shadow-sm">
                <Plus className="w-5 h-5" />
                Novo Atendente com IA
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <Bot className="w-6 h-6 text-primary" />
                  Criar Atendente Virtual Gemini
                </DialogTitle>
                <DialogDescription>
                  Informe o nome do atendente e o que ele deve fazer. A IA Gemini gerará as regras completas.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-3">
                <div className="space-y-2">
                  <Label htmlFor="logic-name" className="font-semibold">Nome do Atendente / Lógica</Label>
                  <Input
                    id="logic-name"
                    placeholder="Ex: Atendente de Vendas - Pizzeria Bella"
                    value={newLogicName}
                    onChange={(e) => setNewLogicName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="logic-prompt-init" className="font-semibold">O que este atendente deve fazer?</Label>
                  <Textarea
                    id="logic-prompt-init"
                    placeholder="Ex: Sou uma clínica médica em São Paulo. Quero agendar consultas, informar preços dos exames e mandar o endereço quando pedirem."
                    rows={4}
                    value={newLogicDescription}
                    onChange={(e) => setNewLogicDescription(e.target.value)}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancelar</Button>
                <Button
                  onClick={() => createLogicMutation.mutate({
                    logicName: newLogicName || "Atendente de Vendas",
                    prompt: newLogicDescription || "Atendimento rápido e humanizado no WhatsApp",
                  })}
                  disabled={!newLogicName || createLogicMutation.isPending}
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  {createLogicMutation.isPending ? "Criando..." : "Criar com IA"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Logics List */}
        <Card className="lg:col-span-4 shadow-sm border-border">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-lg flex items-center justify-between">
              <span>Seus Atendentes</span>
              <Badge variant="secondary">{logics?.length || 0}</Badge>
            </CardTitle>
            <CardDescription className="text-xs">
              Clique em um atendente para editar suas instruções
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 space-y-2 max-h-[600px] overflow-y-auto">
            {isLoading ? (
              <div className="space-y-2 py-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            ) : logics && logics.length > 0 ? (
              logics.map((logic) => {
                const isSelected = selectedLogicId === logic.id;
                return (
                  <button
                    key={logic.id}
                    onClick={() => handleSelectLogic(logic)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all flex flex-col gap-2 ${
                      isSelected
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border/60 hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-lg ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
                          <Bot className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm leading-tight">{logic.name}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                            {logic.description || "Sem descrição"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 justify-between pt-1 border-t border-border/40 text-xs">
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-primary" /> Gemini Flash 2.0
                      </span>
                      {logic.isActive && (
                        <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4 bg-emerald-600">
                          Ativa
                        </Badge>
                      )}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="text-center py-12 px-4 space-y-3">
                <Bot className="w-12 h-12 text-muted-foreground/40 mx-auto" />
                <p className="text-sm font-medium text-muted-foreground">Nenhum atendente cadastrado</p>
                <Button size="sm" variant="outline" onClick={() => setIsCreateDialogOpen(true)}>
                  Criar Primeiro Atendente
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Column: Simplified Prompt & Logic Editor */}
        <Card className="lg:col-span-8 shadow-sm border-border flex flex-col">
          {selectedLogic ? (
            <>
              <CardHeader className="border-b pb-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-xl font-bold">{selectedLogic.name}</CardTitle>
                      <Badge variant="secondary" className="gap-1">
                        <Bot className="w-3 h-3" /> IA Gemini
                      </Badge>
                    </div>
                    <CardDescription className="text-xs mt-1">
                      Edite o comportamento e a personalidade do seu bot diretamente em linguagem natural.
                    </CardDescription>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 text-xs"
                      onClick={() => setShowJsonEditor(!showJsonEditor)}
                    >
                      <Code className="w-3.5 h-3.5" />
                      {showJsonEditor ? "Ocultar JSON Avançado" : "Modo JSON"}
                    </Button>

                    <Button
                      size="sm"
                      className="gap-2"
                      onClick={handleSavePrompt}
                      disabled={updateLogicMutation.isPending}
                    >
                      <Save className="w-4 h-4" />
                      {updateLogicMutation.isPending ? "Salvando..." : "Salvar Alterações"}
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        if (confirm(`Deseja excluir a lógica "${selectedLogic.name}"?`)) {
                          deleteLogicMutation.mutate(selectedLogic.id);
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-6 space-y-6">
                {/* Gemini Assistant Banner / Helper Tool */}
                <div className="bg-gradient-to-r from-primary/10 via-indigo-500/10 to-purple-500/10 p-4 rounded-xl border border-primary/20 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-primary text-primary-foreground rounded-lg shadow-sm">
                      <Wand2 className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">Assistente de Criação de Prompt Gemini</p>
                      <p className="text-xs text-muted-foreground">
                        Deixe a IA estruturar as regras perfeitas de atendimento para o seu negócio em segundos.
                      </p>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    className="gap-2 shadow-sm"
                    onClick={() => {
                      setAssistBusiness(selectedLogic.name);
                      setIsAssistModalOpen(true);
                    }}
                  >
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    Aprimorar com Gemini
                  </Button>
                </div>

                {/* Prompt Textarea Input */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="sys-prompt" className="font-semibold text-sm flex items-center gap-2">
                      <FileText className="w-4 h-4 text-primary" />
                      Instruções do Atendente Virtual (Prompt de IA)
                    </Label>
                    <span className="text-xs text-muted-foreground">Linguagem Natural</span>
                  </div>

                  <Textarea
                    id="sys-prompt"
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    rows={10}
                    className="font-sans text-sm p-4 leading-relaxed resize-y border-border focus:ring-2 focus:ring-primary"
                    placeholder="Digite aqui as instruções que a IA deve seguir durante o atendimento..."
                  />
                  <p className="text-xs text-muted-foreground">
                    💡 **Dica:** Defina a saudação inicial, tom de voz, regras de brevidade e opções de valores/produtos.
                  </p>
                </div>

                {/* Default Reply Fallback */}
                <div className="space-y-2 pt-2 border-t">
                  <Label htmlFor="default-reply" className="font-semibold text-sm">
                    Resposta Padrão de Boas-Vindas ou Fallback
                  </Label>
                  <Input
                    id="default-reply"
                    value={defaultReply}
                    onChange={(e) => setDefaultReply(e.target.value)}
                    placeholder="Ex: Olá! Seja bem-vindo(a)! Como posso te ajudar hoje?"
                  />
                </div>

                {/* Developer Monaco JSON Mode (Optional Toggle) */}
                {showJsonEditor && (
                  <div className="space-y-2 pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <Label className="font-semibold text-sm text-amber-600 dark:text-amber-400 flex items-center gap-2">
                        <Code className="w-4 h-4" />
                        Estrutura JSON Completa (Avançado)
                      </Label>
                    </div>
                    <div className="border rounded-lg overflow-hidden border-border">
                      <Editor
                        height="250px"
                        language="json"
                        value={jsonContent}
                        onChange={(value) => setJsonContent(value || "{}")}
                        theme="vs-dark"
                        options={{
                          minimap: { enabled: false },
                          fontSize: 13,
                          lineNumbers: 'on',
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Real-Time Prompt Tester / Simulator */}
                <div className="border rounded-xl p-4 bg-muted/30 space-y-3">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-primary" />
                    <p className="font-semibold text-sm">Simulador de Atendimento (Teste em Tempo Real)</p>
                  </div>

                  {simHistory.length > 0 && (
                    <div className="space-y-2 max-h-[200px] overflow-y-auto p-3 bg-background rounded-lg border text-xs">
                      {simHistory.map((h, idx) => (
                        <div
                          key={idx}
                          className={`flex ${h.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`p-2.5 rounded-lg max-w-[80%] ${
                              h.role === 'user'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-foreground border'
                            }`}
                          >
                            {h.text}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Input
                      placeholder="Simule uma mensagem do cliente (ex: Qual o preço do plano?)"
                      value={simMessage}
                      onChange={(e) => setSimMessage(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleRunSimulation()}
                    />
                    <Button
                      size="sm"
                      onClick={handleRunSimulation}
                      disabled={isSimulating || !simMessage.trim()}
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </>
          ) : (
            <div className="flex items-center justify-center h-[450px] text-center p-6">
              <div className="space-y-4 max-w-sm">
                <div className="p-4 bg-primary/10 text-primary rounded-full w-fit mx-auto">
                  <Bot className="w-10 h-10" />
                </div>
                <h3 className="font-semibold text-lg">Selecione uma lógica</h3>
                <p className="text-sm text-muted-foreground">
                  Escolha um atendente na lista à esquerda para ajustar o prompt de IA ou crie um novo atendente.
                </p>
                <Button variant="outline" className="gap-2" onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="w-4 h-4" /> Criar Novo Atendente
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Gemini Assistant Modal Dialog */}
      <Dialog open={isAssistModalOpen} onOpenChange={setIsAssistModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Gerador de Prompts Gemini AI
            </DialogTitle>
            <DialogDescription>
              Descreva seu negócio e o Gemini escreverá um prompt completo para o seu bot.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="assist-business" className="font-semibold">Qual é a sua empresa / segmento?</Label>
              <Input
                id="assist-business"
                placeholder="Ex: Empresa de Gás e Água com entrega rápida"
                value={assistBusiness}
                onChange={(e) => setAssistBusiness(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="assist-objective" className="font-semibold">Qual o objetivo do atendimento?</Label>
              <Textarea
                id="assist-objective"
                placeholder="Ex: Informar preços (Gás P13 por R$ 110), pegar o endereço para entrega, aceitar PIX e cartão, e falar com atendente se preciso."
                rows={4}
                value={assistObjective}
                onChange={(e) => setAssistObjective(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssistModalOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => assistPromptMutation.mutate({
                businessDescription: assistBusiness,
                objective: assistObjective,
                currentPrompt: systemPrompt
              })}
              disabled={!assistBusiness || assistPromptMutation.isPending}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {assistPromptMutation.isPending ? "Gerando Prompt..." : "Gerar e Aplicar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

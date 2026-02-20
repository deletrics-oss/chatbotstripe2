"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Slider } from "@/components/ui/slider";
import { Send, Users, Sparkles, CheckCircle, XCircle, Clock, Play, Pause, Trash2, Copy, Search, Edit, Smartphone, LayoutDashboard } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface Contact {
  id: string;
  name: string;
  number: string;
  isGroup: boolean;
}

export default function BroadcastPage() {
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const leadsParam = searchParams.get('leads');

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isAIDialogOpen, setIsAIDialogOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<string>("");
  const [broadcastName, setBroadcastName] = useState("");
  const [message, setMessage] = useState("");
  const [aiPrompt, setAIPrompt] = useState("");
  const [aiContext, setAiContext] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [delay, setDelay] = useState(30);
  const [searchTerm, setSearchTerm] = useState("");
  const [includeGroups, setIncludeGroups] = useState(false);
  const [onlyRegisteredClients, setOnlyRegisteredClients] = useState(false);
  const [scheduledFor, setScheduledFor] = useState("");
  const [contactSource, setContactSource] = useState<"whatsapp" | "leads">("whatsapp");
  const [neighborhoodFilter, setNeighborhoodFilter] = useState("");
  const [editingBroadcastId, setEditingBroadcastId] = useState<string | null>(null);

  // Time Window State
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [selectedDays, setSelectedDays] = useState<string[]>(['Seg', 'Ter', 'Qua', 'Qui', 'Sex']);

  const { toast } = useToast();

  // Mass Actions State
  const [selectedBroadcasts, setSelectedBroadcasts] = useState<string[]>([]);

  const { data: devices } = useQuery<any[]>({
    queryKey: ['/api/devices'],
  });

  useEffect(() => {
    if (devices && devices.length > 0 && !selectedDevice) {
      const connected = devices.find((d: any) => d.connectionStatus === 'connected');
      setSelectedDevice(connected ? connected.id : devices[0].id);
    }
  }, [devices, selectedDevice]);

  const { data: broadcasts, isLoading: loadingBroadcasts } = useQuery<any[]>({
    queryKey: ['/api/broadcasts'],
    refetchInterval: 5000,
  });

  const { data: contacts, isLoading: loadingContacts } = useQuery<Contact[]>({
    queryKey: ['/api/whatsapp/contacts', selectedDevice, onlyRegisteredClients, includeGroups],
    queryFn: async () => {
      if (!selectedDevice) return [];
      const res = await fetch(`/api/whatsapp/contacts?deviceId=${selectedDevice}`);
      if (!res.ok) return [];
      const data = await res.json();
      const contactsList = data.contacts || [];
      return Array.isArray(contactsList) ? contactsList.map((c: any) => ({
        id: c.id || c.phone,
        name: c.name || 'Sem nome',
        number: c.phone || c.id,
        isGroup: false
      })) : [];
    },
    enabled: !!selectedDevice && contactSource === 'whatsapp',
  });

  const { data: templates } = useQuery<any[]>({
    queryKey: ['/api/logic-templates'],
    queryFn: async () => {
      const res = await fetch('/api/logics/templates');
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: leads = [] } = useQuery<any[]>({
    queryKey: ['/api/leads'],
    enabled: contactSource === 'leads',
  });

  const uniqueNeighborhoods = Array.from(new Set(leads.map(l => l.neighborhood).filter(Boolean))).sort();

  const generateAIMutation = useMutation({
    mutationFn: async (prompt: string) => {
      const res = await apiRequest("POST", "/api/ai/generate-broadcast", { prompt, context: aiContext });
      return res.json();
    },
    onSuccess: (data: any) => {
      setMessage(data.message);
      setIsAIDialogOpen(false);
      toast({ title: "Mensagem gerada!" });
    },
  });

  const createBroadcastMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/broadcasts", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/broadcasts'] });
      setIsCreateDialogOpen(false);
      resetForm();
      toast({ title: "Disparo criado com sucesso! 🚀" });
    },
  });

  const startBroadcastMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/broadcasts/${id}/start`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/broadcasts'] })
  });

  const pauseBroadcastMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/broadcasts/${id}/pause`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/broadcasts'] })
  });

  const deleteBroadcastMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/broadcasts/${id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/broadcasts'] });
      toast({ title: "Disparo removido." });
    }
  });

  const resetForm = () => {
    setBroadcastName("");
    setMessage("");
    setSelectedContacts([]);
    setSelectAll(false);
    setScheduledFor("");
    setEditingBroadcastId(null);
  };

  const handleCreateBroadcast = () => {
    const data: any = {
      name: broadcastName,
      deviceId: selectedDevice,
      message,
      delay,
      contacts: selectedContacts,
      startTime,
      endTime,
      daysOfWeek: selectedDays,
      scheduledAt: scheduledFor || undefined
    };

    createBroadcastMutation.mutate(data);
  };

  const filteredContacts = (contactSource === 'whatsapp' ? contacts : leads?.map(l => ({
    id: l.id,
    name: l.name || 'Lead',
    number: l.phone || '',
    isGroup: false,
    neighborhood: l.neighborhood
  })))?.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.number.includes(searchTerm);
    if (contactSource === 'leads' && neighborhoodFilter && neighborhoodFilter !== 'all') {
      return matchesSearch && (c as any).neighborhood === neighborhoodFilter;
    }
    return matchesSearch;
  });

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked && filteredContacts) {
      setSelectedContacts(filteredContacts.map(c => c.number));
    } else {
      setSelectedContacts([]);
    }
  };

  const handleContactToggle = (phone: string, checked: boolean) => {
    if (checked) setSelectedContacts(prev => [...prev, phone]);
    else {
      setSelectedContacts(prev => prev.filter(p => p !== phone));
      setSelectAll(false);
    }
  };

  const toggleDay = (day: string) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const getStatusBadge = (status: string) => {
    const statusMap: any = {
      pending: { label: "Aguardando", variant: "secondary" as const, icon: Clock },
      scheduled: { label: "Agendado", variant: "outline" as const, icon: Clock },
      running: { label: "Enviando", variant: "default" as const, icon: Send },
      completed: { label: "Concluído", variant: "success" as any, icon: CheckCircle },
      failed: { label: "Falhou", variant: "destructive" as const, icon: XCircle },
      paused: { label: "Pausado", variant: "warning" as any, icon: Pause },
    };
    return statusMap[status] || statusMap.pending;
  };

  return (
    <div className="p-6 md:p-8 space-y-8 bg-background">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Disparo em Massa</h1>
          <p className="text-muted-foreground mt-1">Configure envios automáticos com agendamento inteligente</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setLocation("/")}>
            Voltar
          </Button>
          <Button onClick={() => { resetForm(); setIsCreateDialogOpen(true); }}>
            <Send className="w-4 h-4 mr-2" />
            Novo Disparo
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <Send className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total de Disparos</p>
                <p className="text-2xl font-bold">{broadcasts?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500/10 rounded-full">
                <CheckCircle className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Concluídos</p>
                <p className="text-2xl font-bold">{broadcasts?.filter(b => b.status === 'completed').length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-full">
                <Clock className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Em Execução</p>
                <p className="text-2xl font-bold">{broadcasts?.filter(b => b.status === 'running').length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configurar Novo Disparo</DialogTitle>
            <DialogDescription>Preencha os dados abaixo para iniciar sua campanha de disparos.</DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label>Nome do Disparo</Label>
              <Input placeholder="Ex: Promoção de Verão" value={broadcastName} onChange={e => setBroadcastName(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Apis/Dispositivo WhatsApp</Label>
              <Select value={selectedDevice} onValueChange={setSelectedDevice}>
                <SelectTrigger><SelectValue placeholder="Selecione o dispositivo" /></SelectTrigger>
                <SelectContent>
                  {devices?.map(d => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name} ({d.phoneNumber || 'Sem número'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label>Conteúdo da Mensagem</Label>
                <Button variant="ghost" size="sm" onClick={() => setIsAIDialogOpen(true)} className="text-primary hover:text-primary/80">
                  <Sparkles className="w-4 h-4 mr-1" /> Gerar com IA
                </Button>
              </div>
              <Textarea
                placeholder="Olá, gostaria de apresentar..."
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={5}
                className="resize-none"
              />
              {templates && templates.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs text-muted-foreground self-center">Modelos:</span>
                  {templates.slice(0, 3).map(t => (
                    <Badge
                      key={t.id}
                      variant="outline"
                      className="cursor-pointer hover:bg-primary hover:text-white transition-colors"
                      onClick={() => setMessage(t.logicJson?.default_reply || message)}
                    >
                      {t.name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Delay entre envios (segundos)</Label>
                <Input type="number" min={5} value={delay} onChange={e => setDelay(parseInt(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Iniciar em (Opcional)</Label>
                <Input type="datetime-local" value={scheduledFor} onChange={e => setScheduledFor(e.target.value)} />
              </div>
            </div>

            <div className="space-y-4 p-4 border rounded-xl bg-muted/20">
              <Label className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Clock className="w-4 h-4" /> Janela de Funcionamento
              </Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Horário Início</Label>
                  <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Horário Término</Label>
                  <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Dias da Semana</Label>
                <div className="flex flex-wrap gap-2">
                  {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(day => (
                    <Button
                      key={day}
                      variant={selectedDays.includes(day) ? "default" : "outline"}
                      size="sm"
                      className="h-8 px-3"
                      onClick={() => toggleDay(day)}
                    >
                      {day}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-lg font-bold">Destinatários</Label>
                <div className="flex gap-2">
                  <Button
                    variant={contactSource === 'whatsapp' ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setContactSource('whatsapp')}
                  >
                    WhatsApp
                  </Button>
                  <Button
                    variant={contactSource === 'leads' ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setContactSource('leads')}
                  >
                    Leads CRM
                  </Button>
                </div>
              </div>

              {contactSource === 'leads' && uniqueNeighborhoods.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs">Filtrar por Bairro</Label>
                  <Select value={neighborhoodFilter} onValueChange={setNeighborhoodFilter}>
                    <SelectTrigger className="h-8"><SelectValue placeholder="Todos os bairros" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os bairros</SelectItem>
                      {uniqueNeighborhoods.map(n => <SelectItem key={n as string} value={n as string}>{n as string}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="border rounded-xl bg-background overflow-hidden">
                <div className="flex items-center gap-3 p-3 bg-muted/30 border-b">
                  <Checkbox checked={selectAll} onCheckedChange={handleSelectAll} />
                  <Label className="text-sm font-medium">Selecionar Todos ({filteredContacts?.length || 0})</Label>
                  <div className="relative ml-auto w-32 md:w-48">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                    <Input
                      placeholder="Buscar..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="h-8 pl-7 text-xs"
                    />
                  </div>
                </div>
                <div className="h-48 overflow-y-auto p-2 space-y-1">
                  {loadingContacts ? (
                    <div className="space-y-2 p-2">
                      {[1, 2, 3].map(i => <Skeleton key={i} className="h-8 w-full" />)}
                    </div>
                  ) : filteredContacts && filteredContacts.length > 0 ? (
                    filteredContacts.map(c => (
                      <div key={c.id} className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded-lg transition-colors group">
                        <Checkbox
                          checked={selectedContacts.includes(c.number)}
                          onCheckedChange={checked => handleContactToggle(c.number, checked as boolean)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{c.name}</p>
                          <p className="text-[10px] text-muted-foreground">{c.number}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="h-full flex items-center justify-center p-4">
                      <p className="text-xs text-muted-foreground">Nenhum contato encontrado</p>
                    </div>
                  )}
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground px-1">
                Selecionados: <strong>{selectedContacts.length}</strong> contatos
              </p>
            </div>
          </div>

          <DialogFooter className="border-t pt-4">
            <Button variant="ghost" onClick={() => setIsCreateDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleCreateBroadcast}
              disabled={createBroadcastMutation.isPending || !broadcastName || !message || selectedContacts.length === 0}
              className="gap-2"
            >
              {createBroadcastMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Iniciar Disparo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Generate Dialog */}
      <Dialog open={isAIDialogOpen} onOpenChange={setIsAIDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" /> Gerar Mensagem com IA
            </DialogTitle>
            <DialogDescription>A IA criará uma mensagem persuasiva com base no seu objetivo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>O que você quer vender ou comunicar?</Label>
              <Textarea
                placeholder="Ex: Quero oferecer um desconto de 20% para ex-clientes..."
                value={aiPrompt}
                onChange={e => setAIPrompt(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Contexto Adicional (Produtos, links...)</Label>
              <Textarea
                placeholder="Loja FightArcade, site www.fightarcade.com.br..."
                value={aiContext}
                onChange={e => setAiContext(e.target.value)}
                className="h-20"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsAIDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => generateAIMutation.mutate(aiPrompt)}
              disabled={generateAIMutation.isPending || !aiPrompt}
            >
              {generateAIMutation.isPending ? "Processando..." : "Gerar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Broadcasts List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            Histórico de Disparos
          </h2>
          <Button variant="ghost" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/broadcasts'] })}>
            <RefreshCw className="w-4 h-4 mr-1" /> Atualizar
          </Button>
        </div>

        {loadingBroadcasts ? (
          <div className="space-y-4">
            {[1, 2].map(i => <Skeleton key={i} className="h-40 w-full rounded-2xl" />)}
          </div>
        ) : broadcasts?.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-3xl opacity-40">
            <LayoutDashboard className="w-12 h-12 mb-4" />
            <p className="font-medium text-lg">Nenhum disparo realizado</p>
            <p className="text-sm">Clique em "Novo Disparo" para começar.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {broadcasts?.map(b => {
              const status = getStatusBadge(b.status);
              const progress = Math.round((b.sentCount / (b.totalContacts || 1)) * 100);
              const StatusIcon = status.icon;

              return (
                <Card key={b.id} className="overflow-hidden hover:shadow-md transition-shadow">
                  <CardHeader className="flex flex-row items-center justify-between pb-2 bg-muted/20">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${b.status === 'running' ? 'bg-primary/20 text-primary' : 'bg-muted'}`}>
                        <StatusIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-bold">{b.name}</CardTitle>
                        <p className="text-[10px] text-muted-foreground">ID: {b.id.substring(0, 8)} • {new Date(b.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={status.variant} className="h-6 gap-1 px-2 uppercase text-[10px] font-bold">
                        {status.label}
                      </Badge>
                      <div className="flex ml-2">
                        {b.status === 'pending' || b.status === 'paused' ? (
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-green-500" onClick={() => startBroadcastMutation.mutate(b.id)}>
                            <Play className="w-4 h-4" />
                          </Button>
                        ) : b.status === 'running' ? (
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-yellow-500" onClick={() => pauseBroadcastMutation.mutate(b.id)}>
                            <Pause className="w-4 h-4" />
                          </Button>
                        ) : null}
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => {
                          if (confirm("Deseja realmente excluir este disparo?")) {
                            deleteBroadcastMutation.mutate(b.id);
                          }
                        }}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="space-y-4">
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <p className="text-xs italic line-clamp-2 text-muted-foreground">"{b.message}"</p>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs font-bold mb-1">
                          <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {b.sentCount} / {b.totalContacts}</span>
                          <span>{progress}%</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                        {b.failedCount > 0 && (
                          <p className="text-[10px] text-destructive font-bold">⚠️ {b.failedCount} envios falharam</p>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-[10px] text-muted-foreground border-t pt-2">
                        <div className="flex items-center gap-1">
                          < स्मार्टफोन className="w-3 h-3" />
                          Dispositivo: {devices?.find(d => d.id === b.deviceId)?.name || 'Desconhecido'}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Janela: {b.startTime || '09:00'} - {b.endTime || '18:00'}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Sub-component for icons/refresh
function RefreshCw(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M3 3v5h5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M21 21v-5h-5" />
    </svg>
  )
}

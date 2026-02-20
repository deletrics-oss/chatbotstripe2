"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Slider } from "@/components/ui/slider";
import {
  Send, Users, Sparkles, CheckCircle, XCircle, Clock, Play, Pause,
  Trash2, Copy, Search, Edit, Smartphone, LayoutDashboard, RefreshCw,
  Plus, Upload, FileText, Image as ImageIcon, Film
} from "lucide-react";
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
import { cn } from "@/lib/utils";

interface Contact {
  id: string;
  name: string;
  number: string;
  isGroup: boolean;
}

export default function BroadcastPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // State for Dialogs
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isAIDialogOpen, setIsAIDialogOpen] = useState(false);

  // Form State
  const [selectedDevice, setSelectedDevice] = useState<string>("");
  const [broadcastName, setBroadcastName] = useState("");
  const [message, setMessage] = useState("");
  const [aiPrompt, setAIPrompt] = useState("");
  const [aiContext, setAiContext] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [delay, setDelay] = useState(30);
  const [searchTerm, setSearchTerm] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");

  // Advanced Config
  const [contactSource, setContactSource] = useState<"whatsapp" | "leads">("whatsapp");
  const [neighborhoodFilter, setNeighborhoodFilter] = useState("all");
  const [mediaType, setMediaType] = useState<"none" | "image" | "video">("none");
  const [mediaUrl, setMediaUrl] = useState("");

  // Time Window
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [selectedDays, setSelectedDays] = useState<string[]>(['Seg', 'Ter', 'Qua', 'Qui', 'Sex']);

  // Queries
  const { data: devices = [] } = useQuery<any[]>({
    queryKey: ['/api/devices'],
  });

  useEffect(() => {
    if (devices.length > 0 && !selectedDevice) {
      const connected = devices.find((d: any) => d.connectionStatus === 'connected');
      setSelectedDevice(connected ? connected.id : devices[0].id);
    }
  }, [devices, selectedDevice]);

  const { data: broadcasts = [], isLoading: loadingBroadcasts } = useQuery<any[]>({
    queryKey: ['/api/broadcasts'],
    refetchInterval: 5000,
  });

  const { data: contacts = [], isLoading: loadingContacts, refetch: refetchContacts } = useQuery<Contact[]>({
    queryKey: ['/api/whatsapp/contacts', selectedDevice],
    queryFn: async () => {
      if (!selectedDevice) return [];
      const res = await fetch(`/api/whatsapp/contacts/${selectedDevice}`);
      if (!res.ok) return [];
      const data = await res.json();
      const contactsList = Array.isArray(data) ? data : (data.contacts || []);
      return contactsList.map((c: any) => ({
        id: c.id || c.phone,
        name: c.name || c.id || 'Sem nome',
        number: c.phone || c.id?.split('@')[0] || '',
        isGroup: c.id?.includes('@g.us') || false
      }));
    },
    enabled: !!selectedDevice && contactSource === 'whatsapp',
  });

  const { data: leads = [] } = useQuery<any[]>({
    queryKey: ['/api/leads'],
    enabled: contactSource === 'leads',
  });

  const { data: templates = [] } = useQuery<any[]>({
    queryKey: ['/api/templates'],
  });

  // Mutations
  const syncContactsMutation = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/whatsapp/sync-contacts/${selectedDevice}`, {}),
    onSuccess: () => {
      toast({ title: "Contatos sincronizados!", description: "A lista de contatos foi atualizada." });
      refetchContacts();
    },
    onError: () => toast({ title: "Erro ao sincronizar", variant: "destructive" })
  });

  const generateAIMutation = useMutation({
    mutationFn: async (prompt: string) => {
      const res = await apiRequest("POST", "/api/ai/generate-broadcast", { prompt, context: aiContext });
      return res;
    },
    onSuccess: (data: any) => {
      setMessage(data.message);
      setIsAIDialogOpen(false);
      toast({ title: "Mensagem gerada com sucesso! ✨" });
    },
  });

  const createBroadcastMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/broadcasts", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/broadcasts'] });
      setIsCreateDialogOpen(false);
      resetForm();
      toast({ title: "Disparo agendado com sucesso! 🚀" });
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/broadcasts'] })
  });

  // Helpers
  const resetForm = () => {
    setBroadcastName("");
    setMessage("");
    setSelectedContacts([]);
    setSelectAll(false);
    setScheduledFor("");
    setMediaType("none");
    setMediaUrl("");
  };

  const handleCreateBroadcast = () => {
    const payload = {
      name: broadcastName,
      deviceId: selectedDevice,
      message,
      delay,
      contacts: selectedContacts.map(phone => ({ number: phone })),
      mediaUrl: mediaType !== 'none' ? mediaUrl : undefined,
      mediaType: mediaType !== 'none' ? mediaType : undefined,
      startTime,
      endTime,
      daysOfWeek: selectedDays,
      scheduledFor: scheduledFor || undefined
    };
    createBroadcastMutation.mutate(payload);
  };

  const filteredContacts = (contactSource === 'whatsapp' ? contacts : leads?.map((l: any) => ({
    id: l.id,
    name: l.name || 'Lead',
    number: l.phone || '',
    isGroup: false,
    neighborhood: l.neighborhood
  })))?.filter((c: any) => {
    const matchesSearch = (c.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || c.number.includes(searchTerm);
    if (contactSource === 'leads' && neighborhoodFilter !== 'all') {
      return matchesSearch && c.neighborhood === neighborhoodFilter;
    }
    return matchesSearch;
  });

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked && filteredContacts) {
      setSelectedContacts(filteredContacts.map((c: any) => c.number));
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
    setSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const getStatusBadge = (status: string) => {
    const map: any = {
      pending: { label: "Aguardando", variant: "secondary", icon: Clock },
      scheduled: { label: "Agendado", variant: "outline", icon: Clock },
      running: { label: "Enviando", variant: "default", icon: Send },
      completed: { label: "Concluído", variant: "success", icon: CheckCircle },
      failed: { label: "Falhou", variant: "destructive", icon: XCircle },
      paused: { label: "Pausado", variant: "warning", icon: Pause },
    };
    return map[status] || map.pending;
  };

  const uniqueNeighborhoods = Array.from(new Set(leads?.map((l: any) => l.neighborhood).filter(Boolean))).sort();

  return (
    <div className="p-6 md:p-8 space-y-8 bg-white min-h-screen">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Disparo em Massa</h1>
          <p className="text-slate-500 mt-1">Configure envios automáticos para sua base de clientes</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setLocation("/")}>Voltar</Button>
          <Button onClick={() => { resetForm(); setIsCreateDialogOpen(true); }} className="shadow-lg">
            <Plus className="w-4 h-4 mr-2" /> Novo Disparo
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: "Total", value: broadcasts.length, color: "bg-slate-100", icon: LayoutDashboard },
          { label: "Enviando", value: broadcasts.filter(b => b.status === 'running').length, color: "bg-blue-50 text-blue-700", icon: Send },
          { label: "Concluídos", value: broadcasts.filter(b => b.status === 'completed').length, color: "bg-green-50 text-green-700", icon: CheckCircle },
          { label: "Falhas", value: broadcasts.filter(b => b.status === 'failed').length, color: "bg-red-50 text-red-700", icon: XCircle },
        ].map((stat, i) => (
          <Card key={i} className={cn("border-none shadow-sm", stat.color)}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium opacity-80">{stat.label}</p>
                  <p className="text-3xl font-bold mt-1">{stat.value}</p>
                </div>
                <stat.icon className="w-8 h-8 opacity-20" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Configurar Novo Disparo</DialogTitle>
            <DialogDescription>Preencha os dados abaixo para iniciar sua campanha.</DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome da Campanha</Label>
                <Input placeholder="Ex: Black Friday 2026" value={broadcastName} onChange={e => setBroadcastName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Dispositivo WhatsApp</Label>
                <Select value={selectedDevice} onValueChange={setSelectedDevice}>
                  <SelectTrigger><SelectValue placeholder="Selecione o aparelho" /></SelectTrigger>
                  <SelectContent>
                    {devices.map((d: any) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name} ({d.phoneNumber || 'Ativo'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label>Mensagem</Label>
                <Button variant="ghost" size="sm" onClick={() => setIsAIDialogOpen(true)} className="text-blue-600 hover:text-blue-700 font-bold">
                  <Sparkles className="w-4 h-4 mr-1 transition-all group-hover:rotate-12" /> Gerar com IA
                </Button>
              </div>
              <Textarea
                placeholder="Olá, confira nossas ofertas..."
                value={message}
                onChange={e => setMessage(e.target.value)}
                className="min-h-[120px] bg-slate-50/50"
              />
              {templates.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400 self-center">Modelos:</span>
                  {templates.slice(0, 3).map((t: any) => (
                    <Badge key={t.id} variant="outline" className="cursor-pointer hover:bg-slate-100" onClick={() => setMessage(t.content)}>
                      {t.name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-slate-500">Delay entre Envios (segundos)</Label>
                <Input type="number" value={delay} onChange={e => setDelay(parseInt(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-slate-500">Agendar Início</Label>
                <Input type="datetime-local" value={scheduledFor} onChange={e => setScheduledFor(e.target.value)} />
              </div>
            </div>

            {/* Schedule Window */}
            <div className="space-y-4 p-4 border rounded-2xl bg-slate-50/30">
              <Label className="text-xs font-bold uppercase text-slate-500 flex items-center gap-2">
                <Clock className="w-3 h-3" /> Janela de Funcionamento
              </Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] text-slate-400">Horário De</Label>
                  <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="h-9" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] text-slate-400">Até</Label>
                  <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="h-9" />
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(day => (
                  <Button key={day} variant={selectedDays.includes(day) ? "default" : "outline"} size="sm" className="h-7 text-[10px] px-2" onClick={() => toggleDay(day)}>
                    {day}
                  </Button>
                ))}
              </div>
            </div>

            {/* Contacts Selection */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-lg font-bold">Destinatários</Label>
                <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                  <Button variant={contactSource === 'whatsapp' ? 'secondary' : 'ghost'} size="sm" className="h-7 text-xs" onClick={() => setContactSource('whatsapp')}>WhatsApp</Button>
                  <Button variant={contactSource === 'leads' ? 'secondary' : 'ghost'} size="sm" className="h-7 text-xs" onClick={() => setContactSource('leads')}>Leads CRM</Button>
                </div>
              </div>

              <div className="border rounded-2xl overflow-hidden bg-white shadow-sm">
                <div className="p-3 bg-slate-50/50 border-b flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Checkbox checked={selectAll} onCheckedChange={handleSelectAll} />
                    <Label className="text-xs font-bold">Selecionar Todos ({filteredContacts?.length || 0})</Label>
                  </div>
                  <div className="relative flex-1">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                    <Input
                      placeholder="Filtrar por nome ou celular..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="h-8 pl-8 text-xs border-none bg-white shadow-inner"
                    />
                  </div>
                  {contactSource === 'whatsapp' && (
                    <Button variant="ghost" size="sm" className="h-8 text-blue-600 font-bold" onClick={() => syncContactsMutation.mutate()} disabled={syncContactsMutation.isPending}>
                      <RefreshCw className={cn("w-3 h-3 mr-1", syncContactsMutation.isPending && "animate-spin")} /> Sincronizar
                    </Button>
                  )}
                </div>

                {contactSource === 'leads' && uniqueNeighborhoods.length > 0 && (
                  <div className="px-3 py-2 bg-slate-50/20 border-b flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400">BAIRRO:</span>
                    <Select value={neighborhoodFilter} onValueChange={setNeighborhoodFilter}>
                      <SelectTrigger className="h-7 w-40 text-[10px] font-bold"><SelectValue placeholder="Todos" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os Bairros</SelectItem>
                        {uniqueNeighborhoods.map(n => <SelectItem key={n as string} value={n as string}>{n as string}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="h-60 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                  {loadingContacts && contactSource === 'whatsapp' ? (
                    <div className="p-4 space-y-2">
                      {[1, 2, 3].map(i => <Skeleton key={i} className="h-8 w-full rounded-lg" />)}
                    </div>
                  ) : filteredContacts && filteredContacts.length > 0 ? (
                    filteredContacts.map((c: any) => (
                      <div key={c.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-xl transition-colors">
                        <Checkbox checked={selectedContacts.includes(c.number)} onCheckedChange={checked => handleContactToggle(c.number, !!checked)} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate text-slate-700">{c.name}</p>
                          <p className="text-[10px] text-slate-400">{c.number} {c.neighborhood ? `• ${c.neighborhood}` : ''}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-2">
                      <Search className="w-8 h-8 opacity-20" />
                      <p className="text-xs font-bold">Nenhum contato encontrado</p>
                    </div>
                  )}
                </div>
                <div className="p-2 border-t bg-slate-50/50 text-center">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Total Selecionado: <span className="text-blue-600">{selectedContacts.length}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="bg-slate-50 -mx-6 -mb-6 p-6 mt-4">
            <Button variant="ghost" onClick={() => setIsCreateDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleCreateBroadcast}
              disabled={createBroadcastMutation.isPending || !broadcastName || !message || selectedContacts.length === 0}
              className="px-8 shadow-blue-200 shadow-lg"
            >
              {createBroadcastMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Iniciar Campanha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Dialog */}
      <Dialog open={isAIDialogOpen} onOpenChange={setIsAIDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-600" /> Gerar Conteúdo com IA
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Objetivo da Mensagem</Label>
              <Textarea placeholder="Ex: Crie uma oferta de 20% para ex-clientes avisando sobre a nova coleção..." value={aiPrompt} onChange={e => setAIPrompt(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Contexto Extra (Links, preços...)</Label>
              <Textarea placeholder="Lista de produtos: T-shirt R$ 50, Calça R$ 120..." value={aiContext} onChange={e => setAiContext(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsAIDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => generateAIMutation.mutate(aiPrompt)} disabled={generateAIMutation.isPending || !aiPrompt}>
              {generateAIMutation.isPending ? "A IA está pensando..." : "Gerar Agora ✨"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800">Histórico de Campanhas</h2>
          <Button variant="ghost" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/broadcasts'] })}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {loadingBroadcasts ? (
          <div className="space-y-4">
            {[1, 2].map(i => <Skeleton key={i} className="h-40 w-full rounded-3xl" />)}
          </div>
        ) : broadcasts.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-20 border-2 border-dashed border-slate-200 rounded-[2.5rem] opacity-30">
            <LayoutDashboard className="w-16 h-16 mb-4" />
            <p className="font-bold text-lg">Nenhum disparo iniciado</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {broadcasts.map((b: any) => {
              const status = getStatusBadge(b.status || 'pending');
              const progress = Math.round((b.sentCount / (b.totalContacts || 1)) * 100);
              const Icon = status.icon;

              return (
                <Card key={b.id} className="border-none shadow-sm hover:shadow-md transition-all rounded-[2rem] overflow-hidden group">
                  <div className="flex flex-col md:flex-row">
                    <div className={cn("p-6 flex flex-col justify-center items-center md:w-48 text-white", b.status === 'running' ? 'bg-blue-600' : 'bg-slate-800')}>
                      <Icon className="w-8 h-8 mb-2" />
                      <p className="text-[10px] font-bold uppercase tracking-widest">{status.label}</p>
                    </div>
                    <div className="flex-1 p-6 space-y-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-xl font-bold text-slate-800">{b.name}</h3>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">ID: {b.id.substring(0, 8)} • Criado em {new Date(b.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div className="flex gap-1 group-hover:opacity-100 transition-opacity">
                          {(b.status === 'paused' || b.status === 'pending') && (
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={() => startBroadcastMutation.mutate(b.id)}>
                              <Play className="w-4 h-4 fill-current" />
                            </Button>
                          )}
                          {b.status === 'running' && (
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-yellow-600" onClick={() => pauseBroadcastMutation.mutate(b.id)}>
                              <Pause className="w-4 h-4 fill-current" />
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={() => { if (confirm("Excluir campanha?")) deleteBroadcastMutation.mutate(b.id); }}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 italic text-muted-foreground text-xs line-clamp-2">
                        "{b.message}"
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase">
                          <span>Progresso: {b.sentCount} de {b.totalContacts}</span>
                          <span>{progress}%</span>
                        </div>
                        <Progress value={progress} className="h-2 rounded-full px-0.5 py-0.5" />
                      </div>

                      <div className="flex flex-wrap gap-4 text-[10px] font-bold text-slate-400 uppercase pt-2 border-t border-slate-50">
                        <div className="flex items-center gap-1"><Smartphone className="w-3 h-3" /> APARELHO: {devices.find((d: any) => d.id === b.deviceId)?.name || 'Outro'}</div>
                        <div className="flex items-center gap-1"><Clock className="w-3 h-3" /> JANELA: {b.startTime || '09:00'} - {b.endTime || '18:00'}</div>
                        {b.failedCount > 0 && <div className="flex items-center gap-1 text-red-500"><XCircle className="w-3 h-3" /> FALHAS: {b.failedCount}</div>}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

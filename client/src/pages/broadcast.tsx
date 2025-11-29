import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Send, Users, Sparkles, CheckCircle, XCircle, Clock, Play, Pause, Trash2 } from "lucide-react";
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
  phone: string;
  isGroup: boolean;
}

export default function BroadcastPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isAIDialogOpen, setIsAIDialogOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<string>("");
  const [broadcastName, setBroadcastName] = useState("");
  const [message, setMessage] = useState("");
  const [aiPrompt, setAIPrompt] = useState("");
  const [aiContext, setAiContext] = useState("");
  const [mediaType, setMediaType] = useState<"none" | "image" | "video">("none");
  const [mediaUrl, setMediaUrl] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const { data: devices } = useQuery<any[]>({
    queryKey: ['/api/devices'],
  });

  const { data: broadcasts, isLoading: loadingBroadcasts } = useQuery<any[]>({
    queryKey: ['/api/broadcasts'],
    refetchInterval: 5000,
  });

  const { data: contacts, isLoading: loadingContacts } = useQuery<Contact[]>({
    queryKey: ['/api/whatsapp/contacts', selectedDevice],
    enabled: !!selectedDevice && isCreateDialogOpen,
  });

  const { data: templates } = useQuery<any[]>({
    queryKey: ['/api/broadcast-templates'],
  });

  const createTemplateMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/broadcast-templates", {
        name: broadcastName || `Modelo ${new Date().toLocaleString()}`,
        content: message,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/broadcast-templates'] });
      toast({ title: "Modelo salvo com sucesso!" });
    },
  });

  const generateAIMutation = useMutation({
    mutationFn: async (prompt: string) => {
      const res = await apiRequest("POST", "/api/ai/generate-broadcast", {
        prompt,
        context: aiContext
      });
      return await res.json();
    },
    onSuccess: (data: any) => {
      setMessage(data.message);
      setIsAIDialogOpen(false);
      toast({ title: "Mensagem gerada!", description: "A IA criou sua mensagem com sucesso" });
    },
  });

  const createBroadcastMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/broadcasts", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/broadcasts'] });
      setIsCreateDialogOpen(false);
      resetForm();
      toast({ title: "Disparo criado!", description: "Pronto para iniciar o envio" });
    },
  });

  const startBroadcastMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("POST", `/api/broadcasts/${id}/start`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/broadcasts'] });
      toast({ title: "Disparo iniciado!", description: "Mensagens sendo enviadas..." });
    },
  });

  const pauseBroadcastMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("POST", `/api/broadcasts/${id}/pause`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/broadcasts'] });
    },
  });

  const deleteBroadcastMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/broadcasts/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/broadcasts'] });
      toast({ title: "Disparo excluído" });
    },
  });

  const resetForm = () => {
    setBroadcastName("");
    setMessage("");
    setSelectedDevice("");
    setSelectedContacts([]);
    setSelectAll(false);
    setMediaType("none");
    setMediaUrl("");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setMediaUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked && contacts) {
      setSelectedContacts(contacts.map(c => c.phone));
    } else {
      setSelectedContacts([]);
    }
  };

  const handleContactToggle = (phone: string, checked: boolean) => {
    if (checked) {
      setSelectedContacts(prev => [...prev, phone]);
    } else {
      setSelectedContacts(prev => prev.filter(p => p !== phone));
      setSelectAll(false);
    }
  };

  const handleCreateBroadcast = () => {
    if (!broadcastName || !selectedDevice || !message || selectedContacts.length === 0) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos e selecione pelo menos um contato",
        variant: "destructive",
      });
      return;
    }

    createBroadcastMutation.mutate({
      name: broadcastName,
      deviceId: selectedDevice,
      message,
      contacts: selectedContacts,
      mediaUrl: mediaType !== 'none' ? mediaUrl : undefined,
      mediaType: mediaType !== 'none' ? mediaType : undefined
    });
  };

  const getStatusBadge = (status: string) => {
    const statusMap: any = {
      pending: { label: "Aguardando", variant: "secondary", icon: Clock },
      running: { label: "Enviando", variant: "default", icon: Send },
      paused: { label: "Pausado", variant: "secondary", icon: Pause },
      completed: { label: "Concluído", variant: "default", icon: CheckCircle },
      failed: { label: "Falhou", variant: "destructive", icon: XCircle },
    };
    return statusMap[status] || statusMap.pending;
  };

  const connectedDevices = devices?.filter(d => d.connectionStatus === 'connected') || [];

  return (
    <div className="p-6 md:p-8 space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Disparo em Massa</h1>
          <p className="text-muted-foreground mt-1">Envie mensagens para múltiplos contatos</p>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-broadcast">
              <Send className="w-4 h-4 mr-2" />
              Novo Disparo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Criar Disparo em Massa</DialogTitle>
              <DialogDescription>
                Envie mensagens para múltiplos contatos do WhatsApp
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="broadcast-name">Nome do Disparo</Label>
                <Input
                  id="broadcast-name"
                  placeholder="Ex: Promoção Black Friday"
                  value={broadcastName}
                  onChange={(e) => setBroadcastName(e.target.value)}
                  data-testid="input-broadcast-name"
                />
              </div>

              {/* Templates Section */}
              <div className="flex gap-2 items-end p-3 bg-muted/30 rounded-md border">
                <div className="flex-1 space-y-2">
                  <Label className="text-xs text-muted-foreground">Carregar Modelo (Template)</Label>
                  <Select onValueChange={(val) => {
                    const t = templates?.find((t: any) => t.id === val);
                    if (t) setMessage(t.content);
                  }}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Selecione um modelo..." />
                    </SelectTrigger>
                    <SelectContent>
                      {templates?.map((t: any) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => createTemplateMutation.mutate()}
                  disabled={!message || createTemplateMutation.isPending}
                  title="Salvar mensagem atual como modelo"
                >
                  Salvar Modelo
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="device-select">Dispositivo WhatsApp</Label>
                <Select value={selectedDevice} onValueChange={setSelectedDevice}>
                  <SelectTrigger id="device-select" data-testid="select-device">
                    <SelectValue placeholder="Selecione um dispositivo conectado" />
                  </SelectTrigger>
                  <SelectContent>
                    {connectedDevices.length === 0 ? (
                      <SelectItem value="none" disabled>Nenhum dispositivo conectado</SelectItem>
                    ) : (
                      connectedDevices.map((device) => (
                        <SelectItem key={device.id} value={device.id}>
                          {device.name} - {device.phoneNumber}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="message">Mensagem</Label>
                  <Button variant="outline" size="sm" onClick={() => setIsAIDialogOpen(true)} data-testid="button-ai-generate">
                    <Sparkles className="w-3 h-3 mr-1" />
                    IA
                  </Button>
                </div>
                <Textarea
                  id="message"
                  placeholder="Digite a mensagem..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  data-testid="textarea-message"
                />
              </div>

              <div className="space-y-2">
                <Label>Mídia (Opcional)</Label>
                <Select value={mediaType} onValueChange={(v: any) => setMediaType(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo de mídia" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    <SelectItem value="image">Imagem</SelectItem>
                    <SelectItem value="video">Vídeo</SelectItem>
                  </SelectContent>
                </Select>

                {mediaType !== 'none' && (
                  <div className="space-y-2 mt-2 p-4 border rounded-md bg-muted/20">
                    <Label>URL ou Upload</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="https://..."
                        value={mediaUrl.startsWith('data:') ? '' : mediaUrl}
                        onChange={(e) => setMediaUrl(e.target.value)}
                        disabled={mediaUrl.startsWith('data:')}
                      />
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept={mediaType === 'image' ? "image/*" : "video/*"}
                        onChange={handleFileUpload}
                      />
                      <Button
                        variant="outline"
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Upload
                      </Button>
                    </div>

                    {mediaUrl && (
                      <div className="mt-2">
                        <p className="text-xs text-muted-foreground mb-1">Preview:</p>
                        {mediaType === 'image' ? (
                          <img src={mediaUrl} alt="Preview" className="max-h-40 rounded border" />
                        ) : (
                          <video src={mediaUrl} controls className="max-h-40 rounded border" />
                        )}
                        {mediaUrl.startsWith('data:') && (
                          <Button variant="ghost" size="sm" onClick={() => setMediaUrl("")} className="mt-1 text-destructive h-auto p-0">
                            Remover arquivo
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {selectedDevice && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Contatos ({contacts?.length || 0})</Label>
                    <Checkbox
                      id="select-all"
                      checked={selectAll}
                      onCheckedChange={handleSelectAll}
                      data-testid="checkbox-select-all"
                    />
                  </div>
                  <Card className="max-h-60 overflow-y-auto">
                    <CardContent className="pt-4 space-y-2">
                      {loadingContacts ? (
                        [1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)
                      ) : contacts && contacts.length > 0 ? (
                        contacts.map((contact) => (
                          <div key={contact.phone} className="flex items-center gap-3 p-2 rounded-md">
                            <Checkbox
                              id={contact.phone}
                              checked={selectedContacts.includes(contact.phone)}
                              onCheckedChange={(checked) => handleContactToggle(contact.phone, checked as boolean)}
                              data-testid={`checkbox-contact-${contact.phone}`}
                            />
                            <label htmlFor={contact.phone} className="flex-1 cursor-pointer">
                              <p className="text-sm font-medium">{contact.name}</p>
                              <p className="text-xs text-muted-foreground">{contact.phone}</p>
                            </label>
                            {contact.isGroup && <Badge variant="secondary" className="text-xs">Grupo</Badge>}
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">Nenhum contato</p>
                      )}
                    </CardContent>
                  </Card>
                  {selectedContacts.length > 0 && (
                    <p className="text-sm text-muted-foreground">{selectedContacts.length} contato(s) selecionado(s)</p>
                  )}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => { setIsCreateDialogOpen(false); resetForm(); }} data-testid="button-cancel">
                Cancelar
              </Button>
              <Button
                onClick={handleCreateBroadcast}
                disabled={createBroadcastMutation.isPending || !broadcastName || !selectedDevice || !message || selectedContacts.length === 0}
                data-testid="button-create-broadcast"
              >
                {createBroadcastMutation.isPending ? "Criando..." : "Criar Disparo"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* AI Dialog */}
      <Dialog open={isAIDialogOpen} onOpenChange={setIsAIDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Gerar Mensagem com IA
            </DialogTitle>
            <DialogDescription>
              Descreva o tipo de mensagem que deseja
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Contexto (Opcional)</Label>
              <Textarea
                placeholder="Ex: Lista de produtos: Camisa R$50, Calça R$80..."
                value={aiContext}
                onChange={(e) => setAiContext(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Instrução</Label>
              <Textarea
                placeholder="Ex: Crie uma mensagem de oferta para estes produtos"
                value={aiPrompt}
                onChange={(e) => setAIPrompt(e.target.value)}
                rows={3}
                data-testid="textarea-ai-prompt"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAIDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => generateAIMutation.mutate(aiPrompt)}
              disabled={generateAIMutation.isPending || !aiPrompt}
              data-testid="button-generate-ai"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {generateAIMutation.isPending ? "Gerando..." : "Gerar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Broadcasts List */}
      {loadingBroadcasts ? (
        <div className="space-y-4">
          {[1, 2].map(i => <Card key={i}><Skeleton className="h-40 w-full" /></Card>)}
        </div>
      ) : broadcasts && broadcasts.length > 0 ? (
        <div className="space-y-4">
          {broadcasts.map((broadcast) => {
            const statusInfo = getStatusBadge(broadcast.status);
            const progress = broadcast.totalContacts > 0 ? Math.round((broadcast.sentCount / broadcast.totalContacts) * 100) : 0;

            return (
              <Card key={broadcast.id} data-testid={`broadcast-card-${broadcast.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <CardTitle className="text-xl">{broadcast.name}</CardTitle>
                        <Badge variant={statusInfo.variant as any}>
                          {statusInfo.icon && <statusInfo.icon className="w-3 h-3 mr-1" />}
                          {statusInfo.label}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-muted p-3 rounded-md">
                    <p className="text-sm whitespace-pre-wrap">{broadcast.message}</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Progresso</span>
                      <span className="font-medium">{broadcast.sentCount} / {broadcast.totalContacts}</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-primary">{broadcast.totalContacts}</p>
                      <p className="text-xs text-muted-foreground">Total</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-status-online">{broadcast.sentCount}</p>
                      <p className="text-xs text-muted-foreground">Enviadas</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-destructive">{broadcast.failedCount}</p>
                      <p className="text-xs text-muted-foreground">Falhas</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {broadcast.status === 'pending' && (
                      <Button size="sm" onClick={() => startBroadcastMutation.mutate(broadcast.id)} disabled={startBroadcastMutation.isPending} data-testid={`button-start-${broadcast.id}`}>
                        <Play className="w-4 h-4 mr-2" />
                        Iniciar
                      </Button>
                    )}
                    {broadcast.status === 'running' && (
                      <Button variant="outline" size="sm" onClick={() => pauseBroadcastMutation.mutate(broadcast.id)} disabled={pauseBroadcastMutation.isPending} data-testid={`button-pause-${broadcast.id}`}>
                        <Pause className="w-4 h-4 mr-2" />
                        Pausar
                      </Button>
                    )}
                    <Button variant="destructive" size="sm" onClick={() => deleteBroadcastMutation.mutate(broadcast.id)} disabled={deleteBroadcastMutation.isPending || broadcast.status === 'running'} data-testid={`button-delete-${broadcast.id}`}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Send className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum disparo criado</h3>
            <p className="text-sm text-muted-foreground text-center mb-6">Crie seu primeiro disparo para enviar mensagens</p>
            <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-first-broadcast">
              <Send className="w-4 h-4 mr-2" />
              Criar Disparo
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

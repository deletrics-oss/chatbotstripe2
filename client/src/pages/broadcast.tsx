import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Send, Users, Sparkles, CheckCircle, XCircle, Clock, Play, Pause, Trash2, RefreshCw } from "lucide-react";
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
import type { WhatsappDevice, Broadcast } from "@shared/schema";

interface WhatsAppContact {
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
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const { toast } = useToast();

  // Fetch devices
  const { data: devices } = useQuery<WhatsappDevice[]>({
    queryKey: ['/api/devices'],
  });

  // Fetch broadcasts
  const { data: broadcasts, isLoading: loadingBroadcasts } = useQuery<Broadcast[]>({
    queryKey: ['/api/broadcasts'],
  });

  // Fetch contacts for selected device
  const { data: contacts, isLoading: loadingContacts } = useQuery<WhatsAppContact[]>({
    queryKey: ['/api/whatsapp/contacts', selectedDevice],
    enabled: !!selectedDevice && isCreateDialogOpen,
  });

  // Generate message with AI
  const generateAIMutation = useMutation({
    mutationFn: async (prompt: string) => {
      const response = await apiRequest("POST", "/api/ai/generate-message", { prompt });
      return response;
    },
    onSuccess: (data: any) => {
      setMessage(data.message);
      setIsAIDialogOpen(false);
      toast({
        title: "Mensagem gerada!",
        description: "A IA criou sua mensagem com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível gerar a mensagem",
        variant: "destructive",
      });
    },
  });

  // Create broadcast
  const createBroadcastMutation = useMutation({
    mutationFn: async (data: { name: string; deviceId: string; message: string; contacts: string[] }) => {
      return await apiRequest("POST", "/api/broadcasts", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/broadcasts'] });
      setIsCreateDialogOpen(false);
      resetForm();
      toast({
        title: "Disparo criado!",
        description: "O envio será iniciado em breve",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível criar o disparo",
        variant: "destructive",
      });
    },
  });

  // Start broadcast
  const startBroadcastMutation = useMutation({
    mutationFn: async (broadcastId: string) => {
      return await apiRequest("POST", `/api/broadcasts/${broadcastId}/start`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/broadcasts'] });
      toast({
        title: "Disparo iniciado!",
        description: "Mensagens sendo enviadas...",
      });
    },
  });

  // Pause broadcast
  const pauseBroadcastMutation = useMutation({
    mutationFn: async (broadcastId: string) => {
      return await apiRequest("POST", `/api/broadcasts/${broadcastId}/pause`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/broadcasts'] });
    },
  });

  // Delete broadcast
  const deleteBroadcastMutation = useMutation({
    mutationFn: async (broadcastId: string) => {
      return await apiRequest("DELETE", `/api/broadcasts/${broadcastId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/broadcasts'] });
      toast({
        title: "Disparo excluído",
        description: "O disparo foi removido com sucesso",
      });
    },
  });

  const resetForm = () => {
    setBroadcastName("");
    setMessage("");
    setSelectedDevice("");
    setSelectedContacts([]);
    setSelectAll(false);
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
    });
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      pending: { label: "Aguardando", variant: "secondary" as const, icon: Clock },
      running: { label: "Enviando", variant: "default" as const, icon: Send },
      paused: { label: "Pausado", variant: "secondary" as const, icon: Pause },
      completed: { label: "Concluído", variant: "default" as const, icon: CheckCircle },
      failed: { label: "Falhou", variant: "destructive" as const, icon: XCircle },
    };
    return statusMap[status as keyof typeof statusMap] || statusMap.pending;
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
                Configure o envio de mensagens para múltiplos contatos
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Broadcast Name */}
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

              {/* Device Selection */}
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

              {/* Message */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="message">Mensagem</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsAIDialogOpen(true)}
                    data-testid="button-ai-generate"
                  >
                    <Sparkles className="w-3 h-3 mr-1" />
                    Gerar com IA
                  </Button>
                </div>
                <Textarea
                  id="message"
                  placeholder="Digite a mensagem que será enviada para todos os contatos selecionados..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  data-testid="textarea-message"
                />
                <p className="text-xs text-muted-foreground">
                  {message.length} caracteres
                </p>
              </div>

              {/* Contact Selection */}
              {selectedDevice && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Selecionar Contatos</Label>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="select-all"
                        checked={selectAll}
                        onCheckedChange={handleSelectAll}
                        data-testid="checkbox-select-all"
                      />
                      <label htmlFor="select-all" className="text-sm cursor-pointer">
                        Selecionar Todos ({contacts?.length || 0})
                      </label>
                    </div>
                  </div>

                  <Card className="max-h-60 overflow-y-auto">
                    <CardContent className="pt-4 space-y-2">
                      {loadingContacts ? (
                        <div className="space-y-2">
                          {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-10 w-full" />
                          ))}
                        </div>
                      ) : contacts && contacts.length > 0 ? (
                        contacts.map((contact) => (
                          <div
                            key={contact.phone}
                            className="flex items-center gap-3 p-2 rounded-md hover-elevate"
                          >
                            <Checkbox
                              id={contact.phone}
                              checked={selectedContacts.includes(contact.phone)}
                              onCheckedChange={(checked) => handleContactToggle(contact.phone, checked as boolean)}
                              data-testid={`checkbox-contact-${contact.phone}`}
                            />
                            <label htmlFor={contact.phone} className="flex-1 cursor-pointer">
                              <p className="font-medium">{contact.name}</p>
                              <p className="text-xs text-muted-foreground">{contact.phone}</p>
                            </label>
                            {contact.isGroup && (
                              <Badge variant="secondary" className="text-xs">Grupo</Badge>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Nenhum contato encontrado
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  {selectedContacts.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {selectedContacts.length} contato(s) selecionado(s)
                    </p>
                  )}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreateDialogOpen(false);
                  resetForm();
                }}
                data-testid="button-cancel"
              >
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

      {/* AI Message Generator Dialog */}
      <Dialog open={isAIDialogOpen} onOpenChange={setIsAIDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Gerar Mensagem com IA
            </DialogTitle>
            <DialogDescription>
              Descreva o tipo de mensagem que deseja e a IA irá criá-la
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="ai-prompt">Descreva sua mensagem</Label>
              <Textarea
                id="ai-prompt"
                placeholder="Ex: Crie uma mensagem promocional para Black Friday com 50% de desconto em todos os produtos"
                value={aiPrompt}
                onChange={(e) => setAIPrompt(e.target.value)}
                rows={4}
                data-testid="textarea-ai-prompt"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAIDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => generateAIMutation.mutate(aiPrompt)}
              disabled={generateAIMutation.isPending || !aiPrompt}
              data-testid="button-generate-ai"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {generateAIMutation.isPending ? "Gerando..." : "Gerar Mensagem"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Broadcasts List */}
      {loadingBroadcasts ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32 mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : broadcasts && broadcasts.length > 0 ? (
        <div className="space-y-4">
          {broadcasts.map((broadcast) => {
            const statusInfo = getStatusBadge(broadcast.status);
            const StatusIcon = statusInfo.icon;
            const progress = broadcast.totalContacts > 0
              ? Math.round((broadcast.sentCount / broadcast.totalContacts) * 100)
              : 0;

            return (
              <Card key={broadcast.id} data-testid={`broadcast-card-${broadcast.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <CardTitle className="text-xl">{broadcast.name}</CardTitle>
                        <Badge variant={statusInfo.variant}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {statusInfo.label}
                        </Badge>
                      </div>
                      <CardDescription className="mt-2">
                        Criado em {new Date(broadcast.createdAt).toLocaleString('pt-BR')}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Message Preview */}
                  <div className="bg-muted p-3 rounded-md">
                    <p className="text-sm whitespace-pre-wrap">{broadcast.message}</p>
                  </div>

                  {/* Progress */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Progresso do envio</span>
                      <span className="font-medium">
                        {broadcast.sentCount} / {broadcast.totalContacts}
                      </span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>

                  {/* Stats */}
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

                  {/* Actions */}
                  <div className="flex gap-2">
                    {broadcast.status === 'pending' && (
                      <Button
                        size="sm"
                        onClick={() => startBroadcastMutation.mutate(broadcast.id)}
                        disabled={startBroadcastMutation.isPending}
                        data-testid={`button-start-${broadcast.id}`}
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Iniciar Envio
                      </Button>
                    )}
                    {broadcast.status === 'running' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => pauseBroadcastMutation.mutate(broadcast.id)}
                        disabled={pauseBroadcastMutation.isPending}
                        data-testid={`button-pause-${broadcast.id}`}
                      >
                        <Pause className="w-4 h-4 mr-2" />
                        Pausar
                      </Button>
                    )}
                    {broadcast.status === 'paused' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => startBroadcastMutation.mutate(broadcast.id)}
                        disabled={startBroadcastMutation.isPending}
                        data-testid={`button-resume-${broadcast.id}`}
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Retomar
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteBroadcastMutation.mutate(broadcast.id)}
                      disabled={deleteBroadcastMutation.isPending || broadcast.status === 'running'}
                      data-testid={`button-delete-${broadcast.id}`}
                    >
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
            <p className="text-sm text-muted-foreground text-center mb-6 max-w-md">
              Crie seu primeiro disparo em massa para enviar mensagens para múltiplos contatos
            </p>
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

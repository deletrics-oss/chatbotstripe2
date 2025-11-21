import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Smartphone, Wifi, WifiOff, Trash2, RefreshCw, Pause, Play, FileJson } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { WhatsappDevice, LogicConfig } from "@shared/schema";

export default function Devices() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState("");
  const { toast } = useToast();

  const { data: devices, isLoading } = useQuery<WhatsappDevice[]>({
    queryKey: ['/api/devices'],
    refetchInterval: 3000,
  });

  const { data: logics } = useQuery<LogicConfig[]>({
    queryKey: ['/api/logics'],
  });

  const addDeviceMutation = useMutation({
    mutationFn: async (name: string) => {
      return await apiRequest("POST", "/api/devices", { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/devices'] });
      setIsAddDialogOpen(false);
      setNewDeviceName("");
      toast({
        title: "Dispositivo adicionado",
        description: "Escaneie o QR Code para conectar",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível adicionar o dispositivo",
        variant: "destructive",
      });
    },
  });

  const deleteDeviceMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      return await apiRequest("DELETE", `/api/devices/${deviceId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/devices'] });
      toast({
        title: "Dispositivo removido",
        description: "O dispositivo foi desconectado e removido",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível remover o dispositivo",
        variant: "destructive",
      });
    },
  });

  const reconnectMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      return await apiRequest("POST", `/api/devices/${deviceId}/reconnect`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/devices'] });
      toast({
        title: "Reconectando",
        description: "Gerando novo QR Code...",
      });
    },
  });

  const setLogicMutation = useMutation({
    mutationFn: async ({ deviceId, logicId }: { deviceId: string; logicId: string | null }) => {
      return await apiRequest("POST", `/api/devices/${deviceId}/set-logic`, { logicId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/devices'] });
      toast({
        title: "Lógica atualizada",
        description: "A lógica do bot foi atualizada com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a lógica",
        variant: "destructive",
      });
    },
  });

  const togglePauseMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      return await apiRequest("POST", `/api/devices/${deviceId}/toggle-pause`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/devices'] });
    },
  });

  const getStatusBadge = (status: string) => {
    const statusMap = {
      connected: { label: "Conectado", variant: "default" as const, color: "bg-status-online" },
      connecting: { label: "Conectando", variant: "secondary" as const, color: "bg-status-away" },
      qr_ready: { label: "QR Pronto", variant: "secondary" as const, color: "bg-status-away" },
      disconnected: { label: "Desconectado", variant: "secondary" as const, color: "bg-status-offline" },
    };
    return statusMap[status as keyof typeof statusMap] || statusMap.disconnected;
  };

  const getActiveLogicName = (device: WhatsappDevice) => {
    if (!device.activeLogicId) return null;
    const logic = logics?.find(l => l.id === device.activeLogicId);
    return logic?.name || null;
  };

  return (
    <div className="p-6 md:p-8 space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Dispositivos WhatsApp</h1>
          <p className="text-muted-foreground mt-1">Gerencie suas conexões WhatsApp</p>
        </div>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-device">
              <Plus className="w-4 h-4 mr-2" />
              Novo Dispositivo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Dispositivo</DialogTitle>
              <DialogDescription>
                Dê um nome ao dispositivo para identificá-lo facilmente
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="device-name">Nome do Dispositivo</Label>
                <Input
                  id="device-name"
                  placeholder="Ex: Atendimento, Vendas, Suporte"
                  value={newDeviceName}
                  onChange={(e) => setNewDeviceName(e.target.value)}
                  data-testid="input-device-name"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsAddDialogOpen(false)}
                data-testid="button-cancel"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => addDeviceMutation.mutate(newDeviceName)}
                disabled={!newDeviceName || addDeviceMutation.isPending}
                data-testid="button-submit"
              >
                {addDeviceMutation.isPending ? "Adicionando..." : "Adicionar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-24 mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-48 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : devices && devices.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {devices.map((device) => {
            const statusInfo = getStatusBadge(device.connectionStatus);
            const activeLogicName = getActiveLogicName(device);
            
            return (
              <Card key={device.id} data-testid={`device-card-${device.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <Smartphone className="w-5 h-5 text-primary" />
                      <div>
                        <CardTitle className="text-lg">{device.name}</CardTitle>
                        <CardDescription className="mt-1">
                          {device.phoneNumber || "Aguardando conexão"}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant={statusInfo.variant} className="shrink-0">
                      <div className={`w-2 h-2 rounded-full ${statusInfo.color} mr-1`} />
                      {statusInfo.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {device.connectionStatus === 'connected' ? (
                    <div className="flex items-center justify-center p-8 bg-status-online/10 rounded-lg">
                      <div className="text-center space-y-2">
                        <Wifi className="w-12 h-12 text-status-online mx-auto" />
                        <p className="text-sm font-medium">Dispositivo Conectado</p>
                        {device.lastConnectedAt && (
                          <p className="text-xs text-muted-foreground">
                            Desde {new Date(device.lastConnectedAt).toLocaleDateString('pt-BR')}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : device.qrCode && device.qrCode.startsWith('data:image') ? (
                    <div className="space-y-3">
                      <div className="bg-white p-4 rounded-lg flex items-center justify-center">
                        <img
                          src={device.qrCode}
                          alt="QR Code do WhatsApp"
                          className="w-48 h-48"
                          data-testid={`qr-code-${device.id}`}
                        />
                      </div>
                      <p className="text-xs text-center text-muted-foreground">
                        Escaneie com o WhatsApp
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center p-8 bg-muted rounded-lg">
                      <div className="text-center space-y-2">
                        <WifiOff className="w-12 h-12 text-muted-foreground mx-auto" />
                        <p className="text-sm font-medium">Desconectado</p>
                      </div>
                    </div>
                  )}

                  {/* Logic Selector */}
                  <div className="space-y-2">
                    <Label htmlFor={`logic-${device.id}`} className="text-xs font-medium flex items-center gap-1">
                      <FileJson className="w-3 h-3" />
                      Lógica Ativa
                    </Label>
                    <Select
                      value={device.activeLogicId || "none"}
                      onValueChange={(value) => {
                        setLogicMutation.mutate({
                          deviceId: device.id,
                          logicId: value === "none" ? null : value,
                        });
                      }}
                    >
                      <SelectTrigger id={`logic-${device.id}`} className="w-full" data-testid={`select-logic-${device.id}`}>
                        <SelectValue placeholder="Selecione uma lógica" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma</SelectItem>
                        {logics?.map((logic) => (
                          <SelectItem key={logic.id} value={logic.id}>
                            {logic.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    {activeLogicName && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md">
                        <Badge variant={device.isPaused ? "secondary" : "default"} className="text-xs">
                          {device.isPaused ? "Pausado" : "Ativo"}
                        </Badge>
                        <span className="text-xs text-muted-foreground truncate flex-1">
                          {activeLogicName}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {device.activeLogicId && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => togglePauseMutation.mutate(device.id)}
                        disabled={togglePauseMutation.isPending}
                        data-testid={`button-pause-${device.id}`}
                      >
                        {device.isPaused ? (
                          <>
                            <Play className="w-4 h-4 mr-2" />
                            Retomar
                          </>
                        ) : (
                          <>
                            <Pause className="w-4 h-4 mr-2" />
                            Pausar
                          </>
                        )}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => reconnectMutation.mutate(device.id)}
                      disabled={reconnectMutation.isPending}
                      data-testid={`button-reconnect-${device.id}`}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Reconectar
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteDeviceMutation.mutate(device.id)}
                      disabled={deleteDeviceMutation.isPending}
                      data-testid={`button-delete-${device.id}`}
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
            <Smartphone className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum dispositivo configurado</h3>
            <p className="text-sm text-muted-foreground text-center mb-6 max-w-md">
              Adicione seu primeiro dispositivo WhatsApp para começar a gerenciar conversas
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-first-device">
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Dispositivo
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

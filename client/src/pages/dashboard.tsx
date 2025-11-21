import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Activity, Zap, Wifi, WifiOff } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { WhatsappDevice } from "@shared/schema";

export default function Dashboard() {
  const { data: devices, isLoading: devicesLoading } = useQuery<WhatsappDevice[]>({
    queryKey: ['/api/devices'],
  });

  const { data: stats, isLoading: statsLoading } = useQuery<{
    activeChats: number;
    messagesToday: number;
    responseRate: number;
  }>({
    queryKey: ['/api/stats'],
  });

  const connectedDevices = devices?.filter(d => d.connectionStatus === 'connected').length || 0;
  const totalDevices = devices?.length || 0;

  return (
    <div className="p-6 md:p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Dashboard de Gerenciamento</h1>
        <p className="text-muted-foreground mt-1">Visão geral do sistema</p>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversas Ativas</CardTitle>
            <MessageSquare className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-active-chats">{stats?.activeChats || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">em tempo real</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mensagens Hoje</CardTitle>
            <Activity className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-messages-today">{stats?.messagesToday || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">últimas 24h</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Resposta</CardTitle>
            <Zap className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-response-rate">{stats?.responseRate || 0}%</div>
                <p className="text-xs text-muted-foreground mt-1">média geral</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dispositivos</CardTitle>
            {connectedDevices > 0 ? (
              <Wifi className="w-4 h-4 text-status-online" />
            ) : (
              <WifiOff className="w-4 h-4 text-status-offline" />
            )}
          </CardHeader>
          <CardContent>
            {devicesLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-devices-connected">
                  {connectedDevices}/{totalDevices}
                </div>
                <p className="text-xs text-muted-foreground mt-1">conectados</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Status do Sistema */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Status do Sistema</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-status-online animate-pulse" />
                <span className="text-sm font-medium">Gemini AI</span>
              </div>
              <Badge variant="default" className="bg-status-online hover:bg-status-online" data-testid="badge-gemini-status">
                Online
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-status-online animate-pulse" />
                <span className="text-sm font-medium">WhatsSckt</span>
              </div>
              <Badge variant="default" className="bg-status-online hover:bg-status-online" data-testid="badge-whatsapp-status">
                Online
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dispositivos WhatsApp</CardTitle>
          </CardHeader>
          <CardContent>
            {devicesLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : devices && devices.length > 0 ? (
              <div className="space-y-3">
                {devices.slice(0, 3).map((device) => (
                  <div
                    key={device.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border"
                    data-testid={`device-item-${device.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        device.connectionStatus === 'connected' ? 'bg-status-online' : 'bg-status-offline'
                      }`} />
                      <div>
                        <p className="text-sm font-medium">{device.name}</p>
                        <p className="text-xs text-muted-foreground">{device.phoneNumber || 'Sem número'}</p>
                      </div>
                    </div>
                    <Badge variant={device.connectionStatus === 'connected' ? 'default' : 'secondary'}>
                      {device.connectionStatus === 'connected' ? 'Conectado' : 'Desconectado'}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum dispositivo configurado ainda.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Conversas em Tempo Real */}
      <Card>
        <CardHeader>
          <CardTitle>Conversas em Tempo Real</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Selecione uma conversa na aba "Conversas" para visualizar
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

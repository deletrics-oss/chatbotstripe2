import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
    Users, Search, Crown, TrendingUp, Activity, Wifi, WifiOff,
    CheckCircle2, XCircle, Clock, DollarSign, Edit, Trash2,
    RefreshCw, BarChart3, Zap
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface SuperAdminUser {
    id: string;
    username: string;
    email: string | null;
    currentPlan: string;
    planExpiresAt: string | null;
    isAdmin: boolean;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    createdAt: string;
    deviceCount?: number;
    connectedDevices?: number;
}

interface GlobalStats {
    totalUsers: number;
    activeSubscriptions: number;
    freeUsers: number;
    basicUsers: number;
    fullUsers: number;
    totalRevenue: number;
    totalDevices: number;
    connectedDevices: number;
    messagesLast24h: number;
}

export default function SuperAdminPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [planFilter, setPlanFilter] = useState("all");
    const { toast } = useToast();

    // Fetch all users (admin only)
    const { data: users, isLoading: loadingUsers, refetch: refetchUsers } = useQuery<SuperAdminUser[]>({
        queryKey: ['/api/admin/users'],
        refetchInterval: 5000, // Real-time updates every 5s
    });

    // Fetch global statistics
    const { data: stats, isLoading: loadingStats } = useQuery<GlobalStats>({
        queryKey: ['/api/admin/stats'],
        refetchInterval: 3000, // Real-time updates every 3s
    });

    // Update user plan mutation
    const updateUserPlanMutation = useMutation({
        mutationFn: async ({ userId, plan }: { userId: string; plan: string }) => {
            return await apiRequest("POST", `/api/admin/users/${userId}/update-plan`, { plan });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
            queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
            toast({ title: "Plano atualizado com sucesso!" });
        },
        onError: () => {
            toast({
                title: "Erro",
                description: "Não foi possível atualizar o plano",
                variant: "destructive",
            });
        },
    });

    // Delete user mutation
    const deleteUserMutation = useMutation({
        mutationFn: async (userId: string) => {
            return await apiRequest("DELETE", `/api/admin/users/${userId}`, {});
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
            queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
            toast({ title: "Usuário removido com sucesso!" });
        },
        onError: () => {
            toast({
                title: "Erro",
                description: "Não foi possível remover o usuário",
                variant: "destructive",
            });
        },
    });

    // Filter users
    const filteredUsers = users?.filter((user) => {
        const matchesSearch =
            user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase()));

        const matchesPlan = planFilter === "all" || user.currentPlan === planFilter;

        return matchesSearch && matchesPlan;
    });

    const getPlanBadge = (plan: string) => {
        const planMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
            free: { label: "Grátis", variant: "secondary" },
            basic: { label: "Básico", variant: "default" },
            full: { label: "Completo", variant: "default" },
        };
        return planMap[plan] || { label: plan, variant: "outline" };
    };

    return (
        <div className="p-6 md:p-8 space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <Crown className="w-8 h-8 text-yellow-500" />
                        <h1 className="text-3xl font-bold">Super Admin Dashboard</h1>
                    </div>
                    <p className="text-muted-foreground mt-1">
                        Gerencie usuários, planos e monitore o sistema em tempo real
                    </p>
                </div>
                <Button onClick={() => refetchUsers()} variant="outline">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Atualizar
                </Button>
            </div>

            {/* Global Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
                        <Users className="w-4 h-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {loadingStats ? (
                            <Skeleton className="h-8 w-16" />
                        ) : (
                            <>
                                <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {stats?.activeSubscriptions || 0} assinaturas ativas
                                </p>
                            </>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Dispositivos</CardTitle>
                        <Wifi className="w-4 h-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {loadingStats ? (
                            <Skeleton className="h-8 w-24" />
                        ) : (
                            <>
                                <div className="text-2xl font-bold">
                                    {stats?.connectedDevices || 0}/{stats?.totalDevices || 0}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">conectados/total</p>
                            </>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Mensagens 24h</CardTitle>
                        <Activity className="w-4 h-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {loadingStats ? (
                            <Skeleton className="h-8 w-16" />
                        ) : (
                            <>
                                <div className="text-2xl font-bold">{stats?.messagesLast24h || 0}</div>
                                <p className="text-xs text-muted-foreground mt-1">últimas 24 horas</p>
                            </>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Distribuição</CardTitle>
                        <BarChart3 className="w-4 h-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {loadingStats ? (
                            <Skeleton className="h-8 w-full" />
                        ) : (
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs">
                                    <span className="text-muted-foreground">Free: {stats?.freeUsers || 0}</span>
                                    <span className="text-muted-foreground">Basic: {stats?.basicUsers || 0}</span>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    Full: {stats?.fullUsers || 0}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Users Management */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div>
                            <CardTitle>Gerenciamento de Usuários</CardTitle>
                            <CardDescription>
                                Visualize e gerencie todos os usuários do sistema
                            </CardDescription>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            <div className="relative w-64">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar usuários..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                            <Select value={planFilter} onValueChange={setPlanFilter}>
                                <SelectTrigger className="w-40">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos os planos</SelectItem>
                                    <SelectItem value="free">Grátis</SelectItem>
                                    <SelectItem value="basic">Básico</SelectItem>
                                    <SelectItem value="full">Completo</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {loadingUsers ? (
                        <div className="space-y-2">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <Skeleton key={i} className="h-12 w-full" />
                            ))}
                        </div>
                    ) : filteredUsers && filteredUsers.length > 0 ? (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Usuário</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Plano</TableHead>
                                        <TableHead>Dispositivos</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Criado em</TableHead>
                                        <TableHead className="text-right">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredUsers.map((user) => {
                                        const planBadge = getPlanBadge(user.currentPlan);
                                        const isExpired = user.planExpiresAt && new Date(user.planExpiresAt) < new Date();

                                        return (
                                            <TableRow key={user.id}>
                                                <TableCell className="font-medium">
                                                    <div className="flex items-center gap-2">
                                                        {user.username}
                                                        {user.isAdmin && <Crown className="w-3 h-3 text-yellow-500" />}
                                                    </div>
                                                </TableCell>
                                                <TableCell>{user.email || "—"}</TableCell>
                                                <TableCell>
                                                    <Badge variant={planBadge.variant}>
                                                        {planBadge.label}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1">
                                                        <Wifi className={`w-3 h-3 ${(user.connectedDevices || 0) > 0 ? 'text-status-online' : 'text-status-offline'}`} />
                                                        <span className="text-sm">
                                                            {user.connectedDevices || 0}/{user.deviceCount || 0}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {isExpired ? (
                                                        <Badge variant="destructive" className="text-xs">
                                                            <XCircle className="w-3 h-3 mr-1" />
                                                            Expirado
                                                        </Badge>
                                                    ) : user.planExpiresAt ? (
                                                        <Badge variant="default" className="text-xs">
                                                            <CheckCircle2 className="w-3 h-3 mr-1" />
                                                            Ativo
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="secondary" className="text-xs">
                                                            <Clock className="w-3 h-3 mr-1" />
                                                            Permanente
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground">
                                                    {new Date(user.createdAt).toLocaleDateString('pt-BR')}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex gap-1 justify-end">
                                                        <Select
                                                            value={user.currentPlan}
                                                            onValueChange={(plan) =>
                                                                updateUserPlanMutation.mutate({ userId: user.id, plan })
                                                            }
                                                        >
                                                            <SelectTrigger className="h-8 w-24">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="free">Grátis</SelectItem>
                                                                <SelectItem value="basic">Básico</SelectItem>
                                                                <SelectItem value="full">Completo</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => {
                                                                if (confirm(`Tem certeza que deseja remover o usuário ${user.username}?`)) {
                                                                    deleteUserMutation.mutate(user.id);
                                                                }
                                                            }}
                                                            disabled={deleteUserMutation.isPending || user.isAdmin}
                                                        >
                                                            <Trash2 className="w-4 h-4 text-destructive" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            Nenhum usuário encontrado
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

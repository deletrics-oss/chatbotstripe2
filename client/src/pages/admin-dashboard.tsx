import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Loader2,
    Shield,
    ShieldAlert,
    User as UserIcon,
    Smartphone,
    Activity,
    Users,
    MessageSquare,
    MoreVertical,
    Calendar,
    Check,
    X
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Redirect } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface User {
    id: string;
    username: string;
    email: string | null;
    isAdmin: boolean;
    currentPlan: string;
    planExpiresAt: string | null;
    createdAt: string;
}

interface Device {
    id: string;
    name: string;
    phoneNumber: string | null;
    connectionStatus: 'connected' | 'disconnected' | 'connecting' | 'qr_ready';
    ownerName: string;
    ownerEmail: string;
    updatedAt: string;
}

interface Stats {
    totalUsers: number;
    activeSubscriptions: number;
    totalDevices: number;
    connectedDevices: number;
}

export default function AdminDashboard() {
    const { user: currentUser, isLoading: authLoading } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

    // Form state for editing user
    const [editForm, setEditForm] = useState({
        currentPlan: "",
        isAdmin: false,
        planExpiresAt: "",
    });

    const { data: users, isLoading: usersLoading } = useQuery<User[]>({
        queryKey: ["/api/admin/users"],
        enabled: !!currentUser?.isAdmin,
    });

    const { data: devices, isLoading: devicesLoading } = useQuery<Device[]>({
        queryKey: ["/api/admin/devices"],
        enabled: !!currentUser?.isAdmin,
    });

    const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
        queryKey: ["/api/admin/stats"],
        enabled: !!currentUser?.isAdmin,
    });

    const updateUserMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await apiRequest("PATCH", `/api/admin/users/${selectedUser?.id}`, data);
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
            toast({
                title: "Usuário atualizado",
                description: "As alterações foram salvas com sucesso.",
            });
            setIsEditDialogOpen(false);
        },
        onError: (error) => {
            toast({
                title: "Erro ao atualizar",
                description: "Não foi possível salvar as alterações.",
                variant: "destructive",
            });
        },
    });

    const handleEditUser = (user: User) => {
        setSelectedUser(user);
        setEditForm({
            currentPlan: user.currentPlan,
            isAdmin: user.isAdmin,
            planExpiresAt: user.planExpiresAt ? new Date(user.planExpiresAt).toISOString().split('T')[0] : "",
        });
        setIsEditDialogOpen(true);
    };

    const handleSaveUser = () => {
        updateUserMutation.mutate({
            currentPlan: editForm.currentPlan,
            isAdmin: editForm.isAdmin,
            planExpiresAt: editForm.planExpiresAt || null,
        });
    };

    if (authLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    if (!currentUser?.isAdmin) {
        return <Redirect to="/" />;
    }

    return (
        <div className="p-8 space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
                    <p className="text-muted-foreground">Gerencie usuários, planos e monitore o sistema.</p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Assinaturas Ativas</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats?.activeSubscriptions || 0}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Dispositivos Totais</CardTitle>
                        <Smartphone className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats?.totalDevices || 0}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Dispositivos Conectados</CardTitle>
                        <Check className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats?.connectedDevices || 0}</div>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="users" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="users">Usuários</TabsTrigger>
                    <TabsTrigger value="devices">Dispositivos WhatsApp</TabsTrigger>
                </TabsList>

                <TabsContent value="users" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Gerenciamento de Usuários</CardTitle>
                            <CardDescription>Visualize e gerencie todos os usuários registrados.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {usersLoading ? (
                                <div className="flex justify-center p-8">
                                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Usuário</TableHead>
                                            <TableHead>Email</TableHead>
                                            <TableHead>Plano</TableHead>
                                            <TableHead>Role</TableHead>
                                            <TableHead>Criado em</TableHead>
                                            <TableHead>Ações</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {users?.map((user) => (
                                            <TableRow key={user.id}>
                                                <TableCell className="font-medium">
                                                    <div className="flex items-center gap-2">
                                                        <div className="bg-primary/10 p-2 rounded-full">
                                                            <UserIcon className="h-4 w-4 text-primary" />
                                                        </div>
                                                        {user.username}
                                                    </div>
                                                </TableCell>
                                                <TableCell>{user.email || "No email"}</TableCell>
                                                <TableCell>
                                                    <Badge variant={user.currentPlan === "full" ? "default" : user.currentPlan === "basic" ? "secondary" : "outline"}>
                                                        {user.currentPlan.toUpperCase()}
                                                    </Badge>
                                                    {user.planExpiresAt && (
                                                        <div className="text-xs text-muted-foreground mt-1">
                                                            Expira: {new Date(user.planExpiresAt).toLocaleDateString()}
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {user.isAdmin ? (
                                                        <Badge variant="destructive" className="gap-1">
                                                            <ShieldAlert className="h-3 w-3" /> Admin
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="gap-1">
                                                            <Shield className="h-3 w-3" /> User
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {new Date(user.createdAt).toLocaleDateString()}
                                                </TableCell>
                                                <TableCell>
                                                    <Button variant="ghost" size="sm" onClick={() => handleEditUser(user)}>
                                                        Editar
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="devices" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Monitoramento de Dispositivos</CardTitle>
                            <CardDescription>Status de conexão de todos os dispositivos do sistema.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {devicesLoading ? (
                                <div className="flex justify-center p-8">
                                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Dispositivo</TableHead>
                                            <TableHead>Proprietário</TableHead>
                                            <TableHead>Número</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Última Atualização</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {devices?.map((device) => (
                                            <TableRow key={device.id}>
                                                <TableCell className="font-medium">
                                                    <div className="flex items-center gap-2">
                                                        <Smartphone className="h-4 w-4 text-muted-foreground" />
                                                        {device.name}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">{device.ownerName}</span>
                                                        <span className="text-xs text-muted-foreground">{device.ownerEmail}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>{device.phoneNumber || "-"}</TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant={device.connectionStatus === 'connected' ? 'default' : 'destructive'}
                                                        className={device.connectionStatus === 'connected' ? 'bg-green-500 hover:bg-green-600' : ''}
                                                    >
                                                        {device.connectionStatus === 'connected' ? 'Conectado' :
                                                            device.connectionStatus === 'connecting' ? 'Conectando...' :
                                                                device.connectionStatus === 'qr_ready' ? 'Aguardando QR' : 'Desconectado'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {new Date(device.updatedAt).toLocaleString()}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Edit User Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Editar Usuário</DialogTitle>
                        <DialogDescription>
                            Alterar plano e permissões para {selectedUser?.username}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="plan" className="text-right">
                                Plano
                            </Label>
                            <Select
                                value={editForm.currentPlan}
                                onValueChange={(value) => setEditForm({ ...editForm, currentPlan: value })}
                            >
                                <SelectTrigger className="col-span-3">
                                    <SelectValue placeholder="Selecione um plano" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="free">Free Trial</SelectItem>
                                    <SelectItem value="basic">Básico</SelectItem>
                                    <SelectItem value="full">Full</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="expires" className="text-right">
                                Expira em
                            </Label>
                            <Input
                                id="expires"
                                type="date"
                                className="col-span-3"
                                value={editForm.planExpiresAt}
                                onChange={(e) => setEditForm({ ...editForm, planExpiresAt: e.target.value })}
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="admin" className="text-right">
                                Admin
                            </Label>
                            <div className="flex items-center space-x-2 col-span-3">
                                <Switch
                                    id="admin"
                                    checked={editForm.isAdmin}
                                    onCheckedChange={(checked) => setEditForm({ ...editForm, isAdmin: checked })}
                                />
                                <Label htmlFor="admin">Acesso de Super Admin</Label>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSaveUser} disabled={updateUserMutation.isPending}>
                            {updateUserMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Salvar Alterações
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

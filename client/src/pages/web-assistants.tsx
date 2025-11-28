import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, MessageSquare, Trash2, ExternalLink, Copy, Check } from "lucide-react";
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
import type { WebAssistant, LogicConfig } from "@shared/schema";

export default function WebAssistants() {
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [newAssistant, setNewAssistant] = useState({
        name: "",
        slug: "",
        themeColor: "#000000",
        activeLogicId: "none"
    });
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const { toast } = useToast();

    const { data: assistants, isLoading } = useQuery<WebAssistant[]>({
        queryKey: ['/api/web-assistants'],
    });

    const { data: logics } = useQuery<LogicConfig[]>({
        queryKey: ['/api/logics'],
    });

    const createAssistantMutation = useMutation({
        mutationFn: async (data: typeof newAssistant) => {
            return await apiRequest("POST", "/api/web-assistants", {
                ...data,
                activeLogicId: data.activeLogicId === "none" ? null : data.activeLogicId
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/web-assistants'] });
            setIsAddDialogOpen(false);
            setNewAssistant({ name: "", slug: "", themeColor: "#000000", activeLogicId: "none" });
            toast({
                title: "Assistente criado",
                description: "Seu assistente web está pronto para uso.",
            });
        },
        onError: (error: any) => {
            toast({
                title: "Erro",
                description: error.message || "Não foi possível criar o assistente",
                variant: "destructive",
            });
        },
    });

    const deleteAssistantMutation = useMutation({
        mutationFn: async (id: string) => {
            return await apiRequest("DELETE", `/api/web-assistants/${id}`, {});
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/web-assistants'] });
            toast({
                title: "Assistente removido",
                description: "O assistente foi excluído com sucesso.",
            });
        },
    });

    const copyLink = (slug: string, id: string) => {
        const url = `${window.location.origin}/chat/${slug}`;
        navigator.clipboard.writeText(url);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
        toast({
            title: "Link copiado",
            description: "Link do chat copiado para a área de transferência.",
        });
    };

    return (
        <div className="p-6 md:p-8 space-y-8">
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-3xl font-bold">Assistentes Web</h1>
                    <p className="text-muted-foreground mt-1">Crie chats personalizados para seu site ou link direto</p>
                </div>

                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="w-4 h-4 mr-2" />
                            Novo Assistente
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Criar Assistente Web</DialogTitle>
                            <DialogDescription>
                                Configure seu assistente de chat público.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Nome do Assistente</Label>
                                <Input
                                    id="name"
                                    placeholder="Ex: Suporte Online"
                                    value={newAssistant.name}
                                    onChange={(e) => setNewAssistant({ ...newAssistant, name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="slug">Link Personalizado (Slug)</Label>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-muted-foreground">/chat/</span>
                                    <Input
                                        id="slug"
                                        placeholder="minha-empresa"
                                        value={newAssistant.slug}
                                        onChange={(e) => setNewAssistant({ ...newAssistant, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="color">Cor do Tema</Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="color"
                                        type="color"
                                        className="w-12 h-10 p-1"
                                        value={newAssistant.themeColor}
                                        onChange={(e) => setNewAssistant({ ...newAssistant, themeColor: e.target.value })}
                                    />
                                    <Input
                                        value={newAssistant.themeColor}
                                        onChange={(e) => setNewAssistant({ ...newAssistant, themeColor: e.target.value })}
                                        placeholder="#000000"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="logic">Lógica do Bot</Label>
                                <Select
                                    value={newAssistant.activeLogicId}
                                    onValueChange={(value) => setNewAssistant({ ...newAssistant, activeLogicId: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione uma lógica" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Nenhuma (Apenas Log)</SelectItem>
                                        {logics?.map((logic) => (
                                            <SelectItem key={logic.id} value={logic.id}>
                                                {logic.name} ({logic.logicType})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancelar</Button>
                            <Button
                                onClick={() => createAssistantMutation.mutate(newAssistant)}
                                disabled={!newAssistant.name || !newAssistant.slug || createAssistantMutation.isPending}
                            >
                                {createAssistantMutation.isPending ? "Criando..." : "Criar Assistente"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-48 w-full" />
                    ))}
                </div>
            ) : assistants && assistants.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {assistants.map((assistant) => (
                        <Card key={assistant.id}>
                            <CardHeader className="pb-4">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-10 h-10 rounded-full flex items-center justify-center text-white"
                                            style={{ backgroundColor: assistant.themeColor || '#000' }}
                                        >
                                            <MessageSquare className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-lg">{assistant.name}</CardTitle>
                                            <CardDescription className="font-mono text-xs mt-1">
                                                /chat/{assistant.slug}
                                            </CardDescription>
                                        </div>
                                    </div>
                                    <Badge variant={assistant.isActive ? "default" : "secondary"}>
                                        {assistant.isActive ? "Ativo" : "Inativo"}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="text-sm text-muted-foreground">
                                    Lógica: <span className="font-medium text-foreground">
                                        {logics?.find(l => l.id === assistant.activeLogicId)?.name || "Nenhuma"}
                                    </span>
                                </div>

                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        className="flex-1"
                                        onClick={() => window.open(`/chat/${assistant.slug}`, '_blank')}
                                    >
                                        <ExternalLink className="w-4 h-4 mr-2" />
                                        Abrir
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => copyLink(assistant.slug, assistant.id)}
                                    >
                                        {copiedId === assistant.id ? (
                                            <Check className="w-4 h-4 text-green-500" />
                                        ) : (
                                            <Copy className="w-4 h-4" />
                                        )}
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        size="icon"
                                        onClick={() => deleteAssistantMutation.mutate(assistant.id)}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <MessageSquare className="w-16 h-16 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">Nenhum assistente web</h3>
                        <p className="text-sm text-muted-foreground text-center mb-6 max-w-md">
                            Crie seu primeiro assistente para atender clientes via link direto ou site.
                        </p>
                        <Button onClick={() => setIsAddDialogOpen(true)}>
                            <Plus className="w-4 h-4 mr-2" />
                            Criar Assistente
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

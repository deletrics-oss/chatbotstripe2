import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Save, Sparkles, Trash2, UserCheck, MessageCircle, Settings2, History } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { LogicConfig } from "@shared/schema";

export default function SDREditor() {
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [selectedLogicId, setSelectedLogicId] = useState<string | null>(null);

    // New Logic State
    const [newName, setNewName] = useState("");
    const [newDescription, setNewDescription] = useState("");
    const [newProduct, setNewProduct] = useState("");
    const [newProductDescription, setNewProductDescription] = useState("");
    const [newTone, setNewTone] = useState<any>("professional");
    const [newIncludeEmoji, setNewIncludeEmoji] = useState(true);

    // Edit State
    const [editProduct, setEditProduct] = useState("");
    const [editProductDescription, setEditProductDescription] = useState("");
    const [editTone, setEditTone] = useState<any>("professional");
    const [editIncludeEmoji, setEditIncludeEmoji] = useState(true);

    const { toast } = useToast();

    const { data: logics, isLoading } = useQuery<LogicConfig[]>({
        queryKey: ['/api/logics'],
        select: (data) => data.filter(l => l.logicType === 'sdr')
    });

    const createSDRMutation = useMutation({
        mutationFn: async (data: any) => {
            const logicJson = {
                product: data.product,
                productDescription: data.productDescription,
                tone: data.tone,
                includeEmoji: data.includeEmoji
            };
            return await apiRequest("POST", "/api/logics", {
                name: data.name,
                description: data.description,
                logicType: 'sdr',
                logicJson
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/logics'] });
            setIsCreateDialogOpen(false);
            resetNewForm();
            toast({ title: "Sucesso", description: "Lógica SDR criada com sucesso!" });
        }
    });

    const updateSDRMutation = useMutation({
        mutationFn: async (data: any) => {
            const logicJson = {
                product: data.product,
                productDescription: data.productDescription,
                tone: data.tone,
                includeEmoji: data.includeEmoji
            };
            return await apiRequest("PATCH", `/api/logics/${data.id}`, { logicJson });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/logics'] });
            toast({ title: "Salvo", description: "Configurações atualizadas!" });
        }
    });

    const deleteSDRMutation = useMutation({
        mutationFn: async (id: string) => {
            return await apiRequest("DELETE", `/api/logics/${id}`, {});
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/logics'] });
            setSelectedLogicId(null);
            toast({ title: "Deletado", description: "Lógica removida." });
        }
    });

    const resetNewForm = () => {
        setNewName("");
        setNewDescription("");
        setNewProduct("");
        setNewProductDescription("");
        setNewTone("professional");
        setNewIncludeEmoji(true);
    };

    const currentLogic = logics?.find(l => l.id === selectedLogicId);

    // Handle Logic Selection
    const handleSelectLogic = (logic: LogicConfig) => {
        setSelectedLogicId(logic.id);
        const config = logic.logicJson as any;
        setEditProduct(config.product || "");
        setEditProductDescription(config.productDescription || "");
        setEditTone(config.tone || "professional");
        setEditIncludeEmoji(config.includeEmoji ?? true);
    };

    return (
        <div className="p-6 md:p-8 space-y-8 bg-zinc-50/50 dark:bg-zinc-950/50 min-h-screen">
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-xl">
                        <Sparkles className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Vendedor Inteligente (SDR)</h1>
                        <p className="text-muted-foreground">Lógica humanizada com memória e classificação de intenção</p>
                    </div>
                </div>

                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="shadow-lg shadow-primary/20">
                            <Plus className="w-4 h-4 mr-2" />
                            Novo Vendedor
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Configurar Novo Vendedor AI</DialogTitle>
                            <DialogDescription>Defina os detalhes do produto e o estilo de abordagem do bot.</DialogDescription>
                        </DialogHeader>
                        <div className="grid grid-cols-2 gap-4 py-4">
                            <div className="col-span-2 space-y-2">
                                <Label>Nome da Configuração</Label>
                                <Input placeholder="Ex: SDR Vendas Gás" value={newName} onChange={e => setNewName(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Produto/Serviço</Label>
                                <Input placeholder="Ex: Botijão de Gás" value={newProduct} onChange={e => setNewProduct(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Tom de Voz</Label>
                                <Select value={newTone} onValueChange={setNewTone}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="professional">Profissional</SelectItem>
                                        <SelectItem value="friendly">Amigável</SelectItem>
                                        <SelectItem value="casual">Casual</SelectItem>
                                        <SelectItem value="sales">Vendas Agressivas</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="col-span-2 space-y-2">
                                <Label>Descrição Detalhada / Preços</Label>
                                <Textarea
                                    placeholder="Descreva seu produto, preços e diferenciais aqui..."
                                    className="h-32"
                                    value={newProductDescription}
                                    onChange={e => setNewProductDescription(e.target.value)}
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <Checkbox id="emoji-new" checked={newIncludeEmoji} onCheckedChange={c => setNewIncludeEmoji(!!c)} />
                                <Label htmlFor="emoji-new cursor-pointer">Usar Emojis</Label>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={() => createSDRMutation.mutate({
                                name: newName,
                                description: newDescription,
                                product: newProduct,
                                productDescription: newProductDescription,
                                tone: newTone,
                                includeEmoji: newIncludeEmoji
                            })} disabled={!newName || !newProduct || createSDRMutation.isPending}>
                                {createSDRMutation.isPending ? "Criando..." : "Criar Vendedor"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* List of SDR Logics */}
                <div className="lg:col-span-4 space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Meus Vendedores</CardTitle>
                        </CardHeader>
                        <CardContent className="p-2 space-y-1">
                            {isLoading ? (
                                <div className="p-4 space-y-2">
                                    <Skeleton className="h-12 w-full" />
                                    <Skeleton className="h-12 w-full" />
                                </div>
                            ) : logics?.length === 0 ? (
                                <div className="p-8 text-center text-muted-foreground text-sm">
                                    Nenhum vendedor configurado ainda.
                                </div>
                            ) : (
                                logics?.map(logic => (
                                    <button
                                        key={logic.id}
                                        onClick={() => handleSelectLogic(logic)}
                                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${selectedLogicId === logic.id
                                                ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                                                : "hover:bg-accent"
                                            }`}
                                    >
                                        <div className={`p-2 rounded-lg ${selectedLogicId === logic.id ? "bg-white/20" : "bg-primary/10"}`}>
                                            <UserCheck className="w-5 h-5" />
                                        </div>
                                        <div className="text-left font-medium truncate flex-1">{logic.name}</div>
                                    </button>
                                ))
                            )}
                        </CardContent>
                    </Card>

                    {/* Tips Card */}
                    <Card className="bg-primary/5 border-primary/20">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <History className="w-4 h-4 text-primary" />
                                Dica SDR
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground leading-relaxed">
                            O modo SDR lê as últimas 10 mensagens da conversa para dar respostas mais humanas.
                            Mantenha a descrição do produto clara e com preços para melhores resultados.
                        </CardContent>
                    </Card>
                </div>

                {/* Configuration Editor */}
                <div className="lg:col-span-8">
                    {selectedLogicId ? (
                        <Card className="border-2 border-primary/10 shadow-xl">
                            <CardHeader className="border-b">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-primary/10 rounded-lg">
                                            <Settings2 className="w-6 h-6 text-primary" />
                                        </div>
                                        <CardTitle>Configuração do {currentLogic?.name}</CardTitle>
                                    </div>
                                    <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10"
                                        onClick={() => {
                                            if (confirm("Deseja deletar este vendedor?")) deleteSDRMutation.mutate(selectedLogicId);
                                        }}
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="p-6 space-y-6">
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label className="font-semibold">O que ele vende?</Label>
                                        <Input placeholder="Ex: Plano de Saúde" value={editProduct} onChange={e => setEditProduct(e.target.value)} />
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Identificador Principal</p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="font-semibold">Tom de Voz</Label>
                                        <Select value={editTone} onValueChange={setEditTone}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="professional">Profissional</SelectItem>
                                                <SelectItem value="friendly">Amigável</SelectItem>
                                                <SelectItem value="casual">Casual</SelectItem>
                                                <SelectItem value="sales">Vendas Agressivas</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="col-span-2 space-y-2">
                                        <Label className="font-semibold">Conhecimento e Preços</Label>
                                        <Textarea
                                            placeholder="Detalhes sobre o produto, FAQ rápido, links de pagamento..."
                                            className="h-48 resize-none font-mono text-sm"
                                            value={editProductDescription}
                                            onChange={e => setEditProductDescription(e.target.value)}
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 bg-accent/50 p-3 rounded-lg w-fit">
                                        <Checkbox id="emoji-edit" checked={editIncludeEmoji} onCheckedChange={c => setEditIncludeEmoji(!!c)} />
                                        <Label htmlFor="emoji-edit" className="cursor-pointer font-medium">✨ Usar Emojis nas respostas</Label>
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className="bg-accent/30 p-4 border-t flex justify-end">
                                <Button size="lg" className="w-48" onClick={() => updateSDRMutation.mutate({
                                    id: selectedLogicId,
                                    product: editProduct,
                                    productDescription: editProductDescription,
                                    tone: editTone,
                                    includeEmoji: editIncludeEmoji
                                })} disabled={updateSDRMutation.isPending}>
                                    <Save className="w-4 h-4 mr-2" />
                                    {updateSDRMutation.isPending ? "Salvando..." : "Salvar Alterações"}
                                </Button>
                            </CardFooter>
                        </Card>
                    ) : (
                        <div className="h-[500px] flex flex-col items-center justify-center text-center space-y-4 border-2 border-dashed rounded-3xl opacity-60">
                            <div className="p-6 bg-primary/5 rounded-full">
                                <MessageCircle className="w-12 h-12 text-primary" />
                            </div>
                            <div>
                                <h3 className="text-xl font-semibold">Nenhum Vendedor Selecionado</h3>
                                <p className="text-muted-foreground max-w-xs mx-auto">Selecione um vendedor ao lado ou crie um novo para configurar a inteligência.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

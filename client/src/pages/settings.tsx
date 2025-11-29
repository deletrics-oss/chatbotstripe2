import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Key, ExternalLink, User, Mail, Lock, Save } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // API Key state
  const [geminiApiKey, setGeminiApiKey] = useState(user?.geminiApiKey || "");

  // Profile states
  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [email, setEmail] = useState(user?.email || "");

  // Password states
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Save API Key mutation
  const saveKeyMutation = useMutation({
    mutationFn: async (apiKey: string) => {
      const response = await fetch("/api/user/gemini-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ geminiApiKey: apiKey }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to save API key");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Sucesso!",
        description: "Chave API salva com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Save Profile mutation
  const saveProfileMutation = useMutation({
    mutationFn: async (data: { firstName: string; lastName: string }) => {
      const response = await fetch("/api/user/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Failed to update profile");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Sucesso!",
        description: "Perfil atualizado com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao atualizar perfil",
        variant: "destructive",
      });
    },
  });

  const handleSaveKey = () => {
    saveKeyMutation.mutate(geminiApiKey);
  };

  const handleSaveProfile = () => {
    saveProfileMutation.mutate({ firstName, lastName });
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Configurações</h1>
        <p className="text-muted-foreground">
          Gerencie suas preferências e configurações da conta
        </p>
      </div>

      <div className="space-y-6">
        {/* Profile Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Perfil
            </CardTitle>
            <CardDescription>
              Atualize suas informações pessoais
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Nome</Label>
                <Input
                  id="firstName"
                  placeholder="Seu nome"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Sobrenome</Label>
                <Input
                  id="lastName"
                  placeholder="Seu sobrenome"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  disabled
                  className="bg-muted"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                O email não pode ser alterado
              </p>
            </div>

            <div className="space-y-2">
              <Label>Nome de usuário</Label>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <Input
                  value={user?.username || ""}
                  disabled
                  className="bg-muted"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                O nome de usuário não pode ser alterado
              </p>
            </div>

            <Button
              onClick={handleSaveProfile}
              disabled={saveProfileMutation.isPending}
              className="w-full md:w-auto"
            >
              {saveProfileMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              <Save className="mr-2 h-4 w-4" />
              Salvar Perfil
            </Button>
          </CardContent>
        </Card>

        <Separator />

        {/* API Key Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Chave API Gemini
            </CardTitle>
            <CardDescription>
              Configure sua chave API do Google Gemini para usar recursos de IA.
              Sua chave será usada para gerar lógicas e respostas inteligentes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="gemini-key">Chave API</Label>
              <Input
                id="gemini-key"
                type="password"
                placeholder="AIzaSy..."
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Não tem uma chave?{" "}
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Obtenha gratuitamente no Google AI Studio
                  <ExternalLink className="h-3 w-3" />
                </a>
              </p>
            </div>

            <Button
              onClick={handleSaveKey}
              disabled={saveKeyMutation.isPending}
              className="w-full md:w-auto"
            >
              {saveKeyMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              <Save className="mr-2 h-4 w-4" />
              Salvar Chave API
            </Button>

            {user?.geminiApiKey && (
              <div className="mt-4 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md">
                <p className="text-sm text-green-800 dark:text-green-200">
                  ✓ Chave API configurada. Você pode usar recursos de IA.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Separator />

        {/* Account Info */}
        <Card>
          <CardHeader>
            <CardTitle>Informações da Conta</CardTitle>
            <CardDescription>
              Detalhes sobre sua assinatura e limites
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Plano Atual:</span>
              <span className="text-sm px-3 py-1 bg-primary/10 text-primary rounded-full">
                {user?.currentPlan === 'free' ? 'Gratuito' :
                  user?.currentPlan === 'basic' ? 'Básico' : 'Full'}
              </span>
            </div>

            {user?.currentPlan === 'free' && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  💡 Faça upgrade para desbloquear recursos avançados como IA ilimitada e mais dispositivos
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

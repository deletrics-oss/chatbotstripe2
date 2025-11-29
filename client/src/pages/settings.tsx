import { useState } from "react";
import { useUser } from "@/hooks/use-user";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Key, ExternalLink } from "lucide-react";

export default function Settings() {
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [geminiApiKey, setGeminiApiKey] = useState(user?.geminiApiKey || "");

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

  const handleSave = () => {
    saveKeyMutation.mutate(geminiApiKey);
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Configurações</h1>
        <p className="text-muted-foreground">
          Gerencie suas preferências e configurações
        </p>
      </div>

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
            onClick={handleSave}
            disabled={saveKeyMutation.isPending}
          >
            {saveKeyMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
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
    </div>
  );
}

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function Settings() {
  const { user } = useAuth();

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Configurações</h1>
        <p className="text-muted-foreground mt-1">Gerencie suas preferências e conta</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle>Perfil</CardTitle>
          <CardDescription>Suas informações pessoais</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={user?.profileImageUrl || undefined} />
              <AvatarFallback className="text-2xl">
                {user?.firstName?.[0] || user?.email?.[0] || 'U'}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium" data-testid="text-profile-name">
                {user?.firstName || user?.email?.split('@')[0]}
              </p>
              <p className="text-sm text-muted-foreground" data-testid="text-profile-email">
                {user?.email}
              </p>
            </div>
          </div>

          <Separator />

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="firstName">Nome</Label>
              <Input id="firstName" defaultValue={user?.firstName || ""} data-testid="input-first-name" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lastName">Sobrenome</Label>
              <Input id="lastName" defaultValue={user?.lastName || ""} data-testid="input-last-name" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" defaultValue={user?.email || ""} disabled data-testid="input-email" />
            </div>
          </div>

          <Button data-testid="button-save-profile">Salvar Alterações</Button>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>Notificações</CardTitle>
          <CardDescription>Configure suas preferências de notificação</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Notificações de Email</p>
              <p className="text-sm text-muted-foreground">Receba atualizações por email</p>
            </div>
            <Switch data-testid="switch-email-notifications" />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Novas Mensagens</p>
              <p className="text-sm text-muted-foreground">Notificar sobre novas conversas</p>
            </div>
            <Switch defaultChecked data-testid="switch-message-notifications" />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Resumos Diários</p>
              <p className="text-sm text-muted-foreground">Receba resumo das atividades</p>
            </div>
            <Switch data-testid="switch-daily-summaries" />
          </div>
        </CardContent>
      </Card>

      {/* Chatbot Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Chatbot</CardTitle>
          <CardDescription>Configurações do bot automático</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Bot Automático Ativo</p>
              <p className="text-sm text-muted-foreground">Ativar respostas automáticas</p>
            </div>
            <Switch defaultChecked data-testid="switch-bot-enabled" />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Modo Aprendizado</p>
              <p className="text-sm text-muted-foreground">Bot aprende com conversas</p>
            </div>
            <Switch data-testid="switch-learning-mode" />
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Zona de Perigo</CardTitle>
          <CardDescription>Ações irreversíveis</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Excluir Conta</p>
              <p className="text-sm text-muted-foreground">
                Remove permanentemente sua conta e todos os dados
              </p>
            </div>
            <Button variant="destructive" data-testid="button-delete-account">
              Excluir
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

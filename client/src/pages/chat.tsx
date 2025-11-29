import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Send, Search, MoreVertical } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Conversation, Message } from "@shared/schema";
import { cn } from "@/lib/utils";

function ContactAvatar({ deviceId, contactId, name, className }: { deviceId: string, contactId: string, name: string, className?: string }) {
  const { data } = useQuery({
    queryKey: ['/api/whatsapp/contacts', deviceId, contactId, 'pic'],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/whatsapp/contacts/${deviceId}/${contactId}/pic`);
      return res.json();
    },
    staleTime: 1000 * 60 * 60, // 1 hour
    enabled: !!deviceId && !!contactId
  });

  return (
    <Avatar className={className}>
      <AvatarImage src={data?.url} alt={name} />
      <AvatarFallback>{name[0]}</AvatarFallback>
    </Avatar>
  );
}

export default function Chat() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  const { data: conversations, isLoading: conversationsLoading } = useQuery<Conversation[]>({
    queryKey: ['/api/conversations'],
  });

  const { data: messages, isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: ['/api/conversations', selectedConversationId, 'messages'],
    enabled: !!selectedConversationId,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      return await apiRequest("POST", `/api/conversations/${selectedConversationId}/messages`, {
        content,
        direction: 'outgoing',
        isFromBot: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations', selectedConversationId, 'messages'] });
      setMessageText("");
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível enviar a mensagem",
        variant: "destructive",
      });
    },
  });

  const filteredConversations = conversations?.filter((conv) =>
    conv.contactName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.contactPhone.includes(searchQuery)
  ) || [];

  const selectedConversation = conversations?.find(c => c.id === selectedConversationId);

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Conversations List */}
      <div className="w-full md:w-96 border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar conversas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-conversations"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          {conversationsLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <Skeleton className="w-12 h-12 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-32 mb-2" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredConversations.length > 0 ? (
            <div className="p-2">
              {filteredConversations.map((conversation) => (
                <button
                  key={conversation.id}
                  onClick={() => setSelectedConversationId(conversation.id)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-lg hover-elevate active-elevate-2 text-left",
                    selectedConversationId === conversation.id && "bg-accent"
                  )}
                  data-testid={`conversation-item-${conversation.id}`}
                >
                  <ContactAvatar
                    deviceId={conversation.deviceId}
                    contactId={conversation.contactId}
                    name={conversation.contactName}
                    className="h-12 w-12"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="font-medium truncate">{conversation.contactName}</p>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {conversation.lastMessageAt ? new Date(conversation.lastMessageAt).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        }) : ''}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm text-muted-foreground truncate">
                        {conversation.contactPhone}
                      </p>
                      {conversation.unreadCount > 0 && (
                        <Badge variant="default" className="shrink-0 h-5 min-w-5 px-1.5">
                          {conversation.unreadCount}
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <p className="text-sm text-muted-foreground">
                {searchQuery ? "Nenhuma conversa encontrada" : "Nenhuma conversa ainda"}
              </p>
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Chat Window */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ContactAvatar
                  deviceId={selectedConversation.deviceId}
                  contactId={selectedConversation.contactId}
                  name={selectedConversation.contactName}
                />
                <div>
                  <p className="font-medium" data-testid="text-contact-name">
                    {selectedConversation.contactName}
                  </p>
                  <p className="text-sm text-muted-foreground" data-testid="text-contact-phone">
                    {selectedConversation.contactPhone}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon">
                <MoreVertical className="w-5 h-5" />
              </Button>
            </div>

            {/* Messages Area */}
            <ScrollArea className="flex-1 p-4">
              {messagesLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-3/4" />
                  ))}
                </div>
              ) : messages && messages.length > 0 ? (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "flex",
                        message.direction === 'outgoing' ? "justify-end" : "justify-start"
                      )}
                      data-testid={`message-${message.id}`}
                    >
                      <div
                        className={cn(
                          "max-w-md rounded-2xl px-4 py-2",
                          message.direction === 'outgoing'
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        )}
                      >
                        <p className="text-sm">{message.content}</p>
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <span className="text-xs opacity-70">
                            {new Date(message.timestamp).toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          {message.isFromBot && (
                            <Badge variant="secondary" className="h-4 text-xs px-1">
                              Bot
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-center">
                  <p className="text-sm text-muted-foreground">Nenhuma mensagem ainda</p>
                </div>
              )}
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 border-t border-border">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (messageText.trim()) {
                    sendMessageMutation.mutate(messageText);
                  }
                }}
                className="flex gap-2"
              >
                <Input
                  placeholder="Digite sua mensagem..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  className="flex-1"
                  data-testid="input-message"
                />
                <Button
                  type="submit"
                  disabled={!messageText.trim() || sendMessageMutation.isPending}
                  data-testid="button-send-message"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-2">
              <p className="text-lg font-medium">Selecione uma conversa</p>
              <p className="text-sm text-muted-foreground">
                Escolha uma conversa na lista para começar
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

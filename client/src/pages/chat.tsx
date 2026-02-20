"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  User, Image as ImageIcon, Video, FileText, Bot,
  Maximize2, Headphones, Download, Info, Facebook, Instagram, RefreshCw, Search, Smartphone, MessageSquare, Send
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { queryClient } from "@/lib/queryClient";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { Conversation, Message } from "@shared/schema";

export default function ChatPage() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("all");
  const [messageText, setMessageText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [tempAvatar, setTempAvatar] = useState<Record<string, string>>({});
  const [isSyncingAvatar, setIsSyncingAvatar] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Fetch conversations
  const { data: conversations = [], isLoading: conversationsLoading } = useQuery<Conversation[]>({
    queryKey: ['/api/conversations'],
    refetchInterval: 5000,
  });

  // Fetch available devices
  const { data: devices = [] } = useQuery<any[]>({
    queryKey: ['/api/devices'],
  });

  // Fetch messages for selected conversation
  const { data: messages = [], isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: ['/api/conversations', selectedConversationId, 'messages'],
    enabled: !!selectedConversationId,
    refetchInterval: 3000,
  });

  const selectedConversation = conversations.find(c => c.id === selectedConversationId);

  const filteredConversations = conversations.filter(c => {
    if (selectedDeviceId !== "all" && c.deviceId !== selectedDeviceId) return false;
    const nameMatch = (c.contactName?.toLowerCase() || '').includes(searchQuery.toLowerCase());
    const phoneMatch = (c.contactPhone || '').includes(searchQuery);
    return nameMatch || phoneMatch;
  });

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    if (messages?.length > 0) {
      scrollToBottom();
    }
  }, [messages]);

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!selectedConversationId) return;
      const res = await fetch(`/api/conversations/${selectedConversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, direction: 'outgoing' })
      });
      if (!res.ok) throw new Error('Failed to send');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations', selectedConversationId, 'messages'] });
      setMessageText("");
    },
    onError: () => {
      toast({ title: "Erro ao enviar mensagem", variant: "destructive" });
    },
  });

  const syncAvatar = async (conversationId: string) => {
    setIsSyncingAvatar(true);
    try {
      const res = await fetch(`/api/whatsapp/sync-profile-pic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId })
      });
      const data = await res.json();
      if (data.url) {
        setTempAvatar(prev => ({ ...prev, [conversationId]: data.url }));
        toast({ title: "Avatar atualizado!" });
      } else {
        toast({ title: "Não foi possível buscar o avatar", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Erro ao buscar avatar", variant: "destructive" });
    } finally {
      setIsSyncingAvatar(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-background">
      {/* Sidebar List */}
      <div className={cn(
        "w-full md:w-[380px] border-r border-border flex flex-col bg-card/50",
        selectedConversationId ? "hidden md:flex" : "flex"
      )}>
        <div className="p-4 space-y-4 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight">Conversas</h2>
            <Button variant="ghost" size="icon" onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/conversations'] })}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar contato..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-background/50"
              />
            </div>

            <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
              <SelectTrigger className="w-full bg-background/50">
                <div className="flex items-center gap-2 truncate">
                  <Smartphone className="w-4 h-4 shrink-0" />
                  <SelectValue placeholder="Todos os aparelhos" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os aparelhos</SelectItem>
                {devices.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {conversationsLoading ? (
            <div className="p-4 space-y-4">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
            </div>
          ) : filteredConversations.length > 0 ? (
            <div className="divide-y divide-border/50">
              {filteredConversations.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConversationId(conv.id)}
                  className={cn(
                    "w-full flex items-center gap-4 p-4 hover:bg-accent/50 transition-all text-left group relative",
                    selectedConversationId === conv.id && "bg-accent shadow-inner"
                  )}
                >
                  <div className="relative">
                    <Avatar className="h-14 w-14 border-2 border-background shadow-md">
                      <AvatarImage src={tempAvatar[conv.id] || ''} />
                      <AvatarFallback className="bg-primary/10 text-primary font-bold">
                        {conv.contactName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-background bg-white flex items-center justify-center">
                      <Smartphone className="w-3 h-3 text-green-500 fill-green-500" />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="font-bold truncate group-hover:text-primary transition-colors text-foreground">
                        {conv.contactName}
                      </p>
                      {conv.lastMessageAt && (
                        <span className="text-[10px] uppercase font-bold text-muted-foreground whitespace-nowrap">
                          {new Date(conv.lastMessageAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="truncate">{conv.contactPhone}</span>
                    </div>
                  </div>

                  {conv.unreadCount > 0 && (
                    <div className="ml-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                      <span className="text-[10px] font-bold text-primary-foreground">{conv.unreadCount}</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center opacity-50">
              <MessageSquare className="w-12 h-12 mb-4" />
              <p className="text-sm font-medium">Nenhuma conversa encontrada</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Chat View */}
      <div className={cn(
        "flex-1 flex flex-col relative",
        !selectedConversationId && "hidden md:flex bg-muted/20"
      )}>
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="h-20 border-b bg-card flex items-center justify-between px-6 shadow-sm z-10">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  onClick={() => setSelectedConversationId(null)}
                >
                  <Search className="h-5 w-5 rotate-180" />
                </Button>
                <Avatar className="h-12 w-12 border-2 border-primary/20">
                  <AvatarImage src={tempAvatar[selectedConversation.id] || ''} />
                  <AvatarFallback>{selectedConversation.contactName.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-bold leading-none mb-1 text-foreground">{selectedConversation.contactName}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-[10px] h-4 uppercase font-bold py-0 bg-green-50 text-green-600 border-green-200">WhatsApp</Badge>
                    <span>{selectedConversation.contactPhone}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => syncAvatar(selectedConversation.id)}
                  disabled={isSyncingAvatar}
                >
                  <RefreshCw className={cn("w-4 h-4 mr-2", isSyncingAvatar && "animate-spin")} />
                  Sync Photo
                </Button>
                <Button variant="ghost" size="icon">
                  <Info className="w-5 h-5 text-muted-foreground" />
                </Button>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-white shadow-inner">
              {messagesLoading ? (
                <div className="space-y-6">
                  {[1, 2, 3].map(i => (
                    <div key={i} className={cn("flex", i % 2 === 0 ? "justify-end" : "justify-start")}>
                      <Skeleton className="h-16 w-[280px] rounded-2xl" />
                    </div>
                  ))}
                </div>
              ) : messages.length > 0 ? (
                <>
                  {messages.map((msg, idx) => {
                    const isOutgoing = msg.direction === 'outgoing';
                    return (
                      <div key={msg.id} className={cn("flex", isOutgoing ? "justify-end" : "justify-start")}>
                        <div className={cn(
                          "max-w-[85%] md:max-w-[70%] rounded-2xl p-4 shadow-sm",
                          isOutgoing
                            ? "bg-primary text-primary-foreground rounded-br-none"
                            : "bg-muted text-foreground rounded-bl-none border"
                        )}>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                          <div className={cn(
                            "flex items-center gap-2 mt-2",
                            isOutgoing ? "justify-end" : "justify-start"
                          )}>
                            <span className="text-[10px] opacity-60 font-medium">
                              {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {msg.isFromBot && (
                              <Badge variant="secondary" className="text-[9px] h-3.5 px-1 py-0 uppercase">
                                Bot
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center space-y-4 opacity-30">
                  <MessageSquare className="w-10 h-10" />
                  <p className="text-sm font-medium italic">Nenhuma mensagem ainda</p>
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="p-4 md:p-6 bg-card border-t border-border z-10 shadow-lg">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (messageText.trim()) sendMessageMutation.mutate(messageText);
                }}
                className="flex items-center gap-3 max-w-5xl mx-auto"
              >
                <Input
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Digite sua mensagem..."
                  className="flex-1 bg-muted/50 border-none rounded-full h-12 px-6"
                />
                <Button
                  type="submit"
                  size="icon"
                  className="h-12 w-12 rounded-full shadow-lg shrink-0"
                  disabled={!messageText.trim() || sendMessageMutation.isPending}
                >
                  <Send className="w-5 h-5" />
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-muted/5">
            <div className="w-32 h-32 bg-card rounded-3xl shadow-2xl flex items-center justify-center border border-primary/10 mb-8">
              <Bot className="w-16 h-16 text-primary" />
            </div>
            <h3 className="text-2xl font-bold tracking-tight mb-2 text-foreground">Central de Atendimento</h3>
            <p className="max-w-xs text-muted-foreground mx-auto text-sm">
              Selecione um cliente na lista ao lado para iniciar uma conversa.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function RefreshCw(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M3 3v5h5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M21 21v-5h-5" />
    </svg>
  )
}

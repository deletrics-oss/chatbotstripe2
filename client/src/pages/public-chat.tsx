import { useState, useEffect, useRef } from "react";
import { useRoute } from "wouter";
import { Send, MessageSquare, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface Message {
    id: string;
    content: string;
    mediaUrl?: string;
    mediaType?: 'image' | 'video' | 'audio' | 'document';
    isFromBot: boolean;
    timestamp: Date;
}

interface AssistantConfig {
    name: string;
    themeColor: string;
    slug: string;
}

export default function PublicChat() {
    const [match, params] = useRoute("/chat/:slug");
    const slug = params?.slug;

    const [assistant, setAssistant] = useState<AssistantConfig | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const scrollRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();

    useEffect(() => {
        if (slug) {
            fetchAssistantConfig();
        }
    }, [slug]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const fetchAssistantConfig = async () => {
        try {
            const res = await fetch(`/api/public/assistants/${slug}`);
            if (!res.ok) {
                throw new Error(res.status === 404 ? "Assistente não encontrado" : "Erro ao carregar assistente");
            }
            const data = await res.json();
            setAssistant(data);

            // Add welcome message
            setMessages([{
                id: "welcome",
                content: `Olá! Bem-vindo ao atendimento de ${data.name}. Como posso ajudar?`,
                isFromBot: true,
                timestamp: new Date()
            }]);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const sendMessage = async () => {
        if (!inputValue.trim() || isSending) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            content: inputValue,
            isFromBot: false,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMsg]);
        setInputValue("");
        setIsSending(true);

        try {
            const res = await apiRequest("POST", `/api/public/chat/${slug}`, { message: userMsg.content });
            const data = await res.json();

            const botMsg: Message = {
                id: (Date.now() + 1).toString(),
                content: data.reply,
                isFromBot: true,
                timestamp: new Date()
            };

            setMessages(prev => [...prev, botMsg]);
        } catch (err) {
            toast({
                title: "Erro ao enviar",
                description: "Não foi possível enviar sua mensagem. Tente novamente.",
                variant: "destructive"
            });
        } finally {
            setIsSending(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-pulse flex flex-col items-center">
                    <div className="h-12 w-12 bg-gray-200 rounded-full mb-4"></div>
                    <div className="h-4 w-32 bg-gray-200 rounded"></div>
                </div>
            </div>
        );
    }

    if (error || !assistant) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <Card className="w-full max-w-md">
                    <CardContent className="flex flex-col items-center py-10 text-center">
                        <AlertCircle className="w-12 h-12 text-destructive mb-4" />
                        <h2 className="text-xl font-bold mb-2">Indisponível</h2>
                        <p className="text-muted-foreground">{error || "Este chat não está disponível no momento."}</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-md h-[80vh] flex flex-col shadow-xl border-0 overflow-hidden">
                <CardHeader
                    className="text-white py-4 px-6 flex flex-row items-center gap-3 space-y-0"
                    style={{ backgroundColor: assistant.themeColor }}
                >
                    <div className="bg-white/20 p-2 rounded-full">
                        <MessageSquare className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <CardTitle className="text-lg font-medium">{assistant.name}</CardTitle>
                        <p className="text-xs text-white/80">Online agora</p>
                    </div>
                </CardHeader>

                <CardContent className="flex-1 p-0 flex flex-col overflow-hidden bg-white">
                    <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                        <div className="space-y-4 pb-4">
                            {messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`flex ${msg.isFromBot ? 'justify-start' : 'justify-end'}`}
                                >
                                    <div
                                        className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${msg.isFromBot
                                            ? 'bg-gray-100 text-gray-800 rounded-tl-none'
                                            : 'text-white rounded-tr-none'
                                            }`}
                                        style={!msg.isFromBot ? { backgroundColor: assistant.themeColor } : {}}
                                    >
                                        {msg.content}
                                        <div
                                            className={`text-[10px] mt-1 ${msg.isFromBot ? 'text-gray-400' : 'text-white/70'
                                                }`}
                                        >
                                            {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {isSending && (
                                <div className="flex justify-start">
                                    <div className="bg-gray-100 rounded-2xl rounded-tl-none px-4 py-3 flex gap-1">
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                </div>
                            )}
                        </div>
                    </ScrollArea>

                    <div className="p-4 border-t bg-gray-50">
                        <form
                            className="flex gap-2"
                            onSubmit={(e) => {
                                e.preventDefault();
                                sendMessage();
                            }}
                        >
                            <Input
                                placeholder="Digite sua mensagem..."
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                className="bg-white"
                            />
                            <Button
                                type="submit"
                                size="icon"
                                disabled={!inputValue.trim() || isSending}
                                style={{ backgroundColor: assistant.themeColor }}
                            >
                                <Send className="w-4 h-4" />
                            </Button>
                        </form>
                        <div className="text-center mt-2">
                            <p className="text-[10px] text-muted-foreground">
                                Powered by ChatBot Host
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Bot, Send, Loader2, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export function SystemAssistant() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', content: 'Olá! Sou o Guru do Sistema. 🧞‍♂️\nPosso te ensinar a configurar o bot, conectar WhatsApp ou qualquer outra dúvida. Como posso ajudar?' }
    ]);
    const [inputValue, setInputValue] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isOpen]);

    const handleSendMessage = async (text?: string) => {
        const userMsg = text || inputValue;
        if (!userMsg.trim() || isLoading) return;

        setInputValue("");
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setIsLoading(true);

        try {
            const response = await fetch('/api/assistant/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMsg,
                    history: messages.slice(1)
                })
            });

            const data = await response.json();
            if (data.response) {
                setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
            } else {
                throw new Error('No response');
            }
        } catch (error) {
            setMessages(prev => [...prev, { role: 'assistant', content: 'Erro de conexão. Tente novamente! 😓' }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            {/* Floating Button */}
            <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-4 items-end">
                {!isOpen && (
                    <div className="animate-in fade-in zoom-in duration-300">
                        <Button
                            onClick={() => setIsOpen(true)}
                            className={cn(
                                "h-14 w-14 rounded-full shadow-2xl",
                                "bg-gradient-to-br from-indigo-600 to-violet-600",
                                "hover:from-indigo-700 hover:to-violet-700",
                                "border-2 border-indigo-400/30",
                                "transition-all duration-300 hover:scale-110",
                                "relative group"
                            )}
                            size="icon"
                            data-testid="button-system-guru"
                        >
                            <Bot className="h-7 w-7 text-white" />
                            <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500"></span>
                            </span>
                        </Button>
                    </div>
                )}
            </div>

            {/* Chat Window */}
            {isOpen && (
                <div className="fixed bottom-6 right-6 z-50 w-[380px] md:w-[420px] shadow-2xl rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <Card className="border-0 shadow-none h-[550px] flex flex-col bg-background ring-1 ring-border">
                        {/* Header */}
                        <div className="p-4 bg-gradient-to-r from-indigo-600 to-violet-600 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white/20 rounded-full backdrop-blur-sm">
                                    <Bot className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-white text-base">Guru do Sistema</h3>
                                    <p className="text-indigo-100 text-xs flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                                        Online agora
                                    </p>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-white hover:bg-white/20 rounded-full h-8 w-8"
                                onClick={() => setIsOpen(false)}
                            >
                                <X className="h-5 w-5" />
                            </Button>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/30" ref={scrollRef}>
                            {messages.map((msg, i) => (
                                <div
                                    key={i}
                                    className={cn("flex w-full animate-in fade-in slide-in-from-bottom-2", msg.role === 'user' ? "justify-end" : "justify-start")}
                                >
                                    <div className={cn(
                                        "max-w-[85%] p-3.5 rounded-2xl text-sm leading-relaxed shadow-sm",
                                        msg.role === 'user'
                                            ? "bg-indigo-600 text-white rounded-br-none"
                                            : "bg-card text-card-foreground rounded-bl-none border"
                                    )}>
                                        <p className="whitespace-pre-wrap">{msg.content}</p>
                                    </div>
                                </div>
                            ))}

                            {/* Quick Suggestions */}
                            {messages.length === 1 && (
                                <div className="grid grid-cols-1 gap-2 mt-4 px-2">
                                    <p className="text-xs text-muted-foreground font-medium mb-1">Sugestões rápidas:</p>
                                    {[
                                        "📱 Como conecto meu WhatsApp?",
                                        "📋 Como crio uma lógica JSON?",
                                        "🤖 Como configuro a IA Gemini?",
                                        "💰 Como funciona os planos?"
                                    ].map((text, i) => (
                                        <Button
                                            key={i}
                                            variant="outline"
                                            className="justify-start h-auto py-2 px-3 text-xs hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors whitespace-normal text-left"
                                            onClick={() => handleSendMessage(text)}
                                        >
                                            {text}
                                        </Button>
                                    ))}
                                </div>
                            )}

                            {isLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-card p-4 rounded-2xl rounded-bl-none border flex items-center gap-2">
                                        <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                                        <span className="text-xs text-muted-foreground">Digitando...</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Input */}
                        <div className="p-4 bg-background border-t shrink-0">
                            <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="relative flex items-center gap-2">
                                <Input
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    placeholder="Digite sua dúvida..."
                                    className="pr-12 h-12 rounded-full"
                                />
                                <Button
                                    type="submit"
                                    size="icon"
                                    disabled={!inputValue.trim() || isLoading}
                                    className="absolute right-1 top-1 h-10 w-10 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white"
                                >
                                    <Send className="h-4 w-4" />
                                </Button>
                            </form>
                        </div>
                    </Card>
                </div>
            )}
        </>
    );
}

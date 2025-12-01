import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Mic, MicOff, Sparkles, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface VoiceEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

export function VoiceEditor({ value, onChange, placeholder, className }: VoiceEditorProps) {
    const [isListening, setIsListening] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const recognitionRef = useRef<any>(null);
    const { toast } = useToast();

    useEffect(() => {
        if ('webkitSpeechRecognition' in window) {
            const recognition = new (window as any).webkitSpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = 'pt-BR';

            recognition.onstart = () => {
                setIsListening(true);
            };

            recognition.onend = () => {
                setIsListening(false);
            };

            recognition.onerror = (event: any) => {
                console.error("Speech recognition error", event.error);
                setIsListening(false);
                toast({
                    title: "Erro no reconhecimento de voz",
                    description: "Verifique se o microfone está permitido.",
                    variant: "destructive",
                });
            };

            recognition.onresult = async (event: any) => {
                const transcript = event.results[0][0].transcript;
                console.log("Transcript:", transcript);

                if (transcript) {
                    await processVoiceCommand(transcript);
                }
            };

            recognitionRef.current = recognition;
        } else {
            console.warn("Web Speech API not supported");
        }
    }, []);

    const processVoiceCommand = async (instruction: string) => {
        setIsProcessing(true);
        try {
            toast({
                title: "Processando comando...",
                description: `"${instruction}"`,
            });

            const res = await apiRequest("POST", "/api/ai/edit-text", {
                text: value,
                instruction,
            });

            const data = await res.json();
            if (data.modifiedText) {
                onChange(data.modifiedText);
                toast({
                    title: "Texto atualizado!",
                    description: "As alterações foram aplicadas com sucesso.",
                });
            }
        } catch (error) {
            console.error("Error processing voice command:", error);
            toast({
                title: "Erro ao processar",
                description: "Não foi possível atualizar o texto.",
                variant: "destructive",
            });
        } finally {
            setIsProcessing(false);
        }
    };

    const toggleListening = () => {
        if (isListening) {
            recognitionRef.current?.stop();
        } else {
            if (!recognitionRef.current) {
                toast({
                    title: "Navegador não suportado",
                    description: "Seu navegador não suporta reconhecimento de voz.",
                    variant: "destructive",
                });
                return;
            }
            recognitionRef.current.start();
        }
    };

    return (
        <div className={`relative ${className}`}>
            <Textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="min-h-[150px] pr-12 resize-y"
                disabled={isProcessing}
            />

            <div className="absolute top-2 right-2 flex flex-col gap-2">
                <Button
                    type="button"
                    variant={isListening ? "destructive" : "secondary"}
                    size="icon"
                    className={`h-8 w-8 rounded-full transition-all ${isListening ? "animate-pulse" : ""}`}
                    onClick={toggleListening}
                    disabled={isProcessing}
                    title={isListening ? "Parar de ouvir" : "Editar com voz"}
                >
                    {isProcessing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isListening ? (
                        <MicOff className="h-4 w-4" />
                    ) : (
                        <Mic className="h-4 w-4" />
                    )}
                </Button>
            </div>

            {isListening && (
                <div className="absolute bottom-2 right-2 text-xs text-destructive font-medium animate-pulse bg-background/80 px-2 py-1 rounded">
                    Ouvindo...
                </div>
            )}
        </div>
    );
}

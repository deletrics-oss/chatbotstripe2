import { useState } from "react";
import { VoiceEditor } from "@/components/voice-editor";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function VoiceEditorDemo() {
    const [text, setText] = useState(`Lista de Preços:
1. Coca-Cola: R$ 5,00
2. X-Bacon: R$ 25,00
3. Batata Frita: R$ 15,00

Horário de Funcionamento:
Segunda a Sexta: 18h às 23h`);

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-8">
            <div className="flex items-center gap-4">
                <Link href="/">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <h1 className="text-3xl font-bold">Smart Voice Editor Demo</h1>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Editor Inteligente</CardTitle>
                    <CardDescription>
                        Clique no microfone e diga o que você quer alterar.
                        <br />
                        Exemplo: "Muda o preço da Coca para 6 reais" ou "Adiciona Suco de Laranja por 10 reais".
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <VoiceEditor
                        value={text}
                        onChange={setText}
                        placeholder="Digite ou fale para editar..."
                        className="min-h-[300px]"
                    />
                </CardContent>
            </Card>
        </div>
    );
}

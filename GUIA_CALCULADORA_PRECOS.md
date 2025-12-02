# 🧮 CALCULADORA INTELIGENTE DE PREÇOS - GUIA DE USO

## ✨ NOVA FUNCIONALIDADE IMPLEMENTADA

Agora o sistema detecta automaticamente operações matemáticas e **calcula os preços** ao invés de apenas gerar texto genérico!

---

## 📋 COMO USAR

### **1. Cenário: Aumentar Preços**

**Mensagem atual:**
```
🔥 PROMOÇÃO! 🔥

Camisa Polo - R$ 50,00
Calça Jeans - R$ 80,00
Tênis Esportivo - R$ 120,00
```

**Instrução da IA:**
```
subir em 10%
```

**Resultado automático:**
```
🔥 PROMOÇÃO! 🔥

Camisa Polo - R$ 55,00
Calça Jeans - R$ 88,00
Tênis Esportivo - R$ 132,00
```

✅ **Notificação:** "✨ Cálculo automático realizado! Preços atualizados com sucesso"

---

### **2. Cenário: Aplicar Desconto**

**Mensagem atual:**
```
📦 Produtos:
- Item A: R$ 100,00
- Item B: R$ 250,00
- Item C: R$ 75,50
```

**Instruções aceitas:**
- "baixar em 15%"
- "diminuir 20%"
- "reduzir em 10%"  
- "descontar 25%"

**Exemplo com "descontar 15%":**
```
📦 Produtos:
- Item A: R$ 85,00
- Item B: R$ 212,50
- Item C: R$ 64,18
```

---

### **3. Cenário: Multiplicar Preços**

**Mensagem atual:**
```
Preço unitário: R$ 45,00
```

**Instrução:**
```
multiplicar por 3
```

**Resultado:**
```
Preço unitário: R$ 135,00
```

---

## 🎯 PALAVRAS-CHAVE DETECTADAS

### **Para AUMENTAR:**
- "subir em X%"
- "aumentar X%"
- "acrescentar X%"
- "adicionar X%"

### **Para DIMINUIR:**
- "baixar em X%"
- "diminuir X%"
- "reduzir em X%"
- "descontar X%"

### **Para MULTIPLICAR:**
- "multiplicar por X"
- "vezes X"

---

## 🔍 DETECÇÃO AUTOMÁTICA DE PREÇOS

O sistema reconhece preços em vários formatos:
- ✅ R$ 100
- ✅ R$ 100,00
- ✅ R$ 1.250,50
- ✅ R$100 (sem espaço)

---

## 💡 QUANDO USA CÁLCULO vs IA

### **USA CÁLCULO AUTOMÁTICO quando:**
- Detecta operação matemática (%, multiplicar, etc)
- Encontra preços na mensagem atual
- → **Resultado instantâneo e preciso**

### **USA IA GEMINI quando:**
- NÃO há operação matemática detectada
- Ou NÃO há preços na mensagem
- → **Gera texto criativo**

---

## 📊 EXEMPLOS PRÁTICOS

### Exemplo 1: Lista de Produtos com Aumento
```
ANTES:
Notebook: R$ 2.500,00
Mouse: R$ 45,00
Teclado: R$ 150,00

INSTRUÇÃO: "subir em 10%"

DEPOIS (automático):
Notebook: R$ 2.750,00
Mouse: R$ 49,50
Teclado: R$ 165,00
```

### Exemplo 2: Campanha de Desconto
```
ANTES:
🎁 BLACK FRIDAY
Produto 1: R$ 199,90
Produto 2: R$ 349,00

INSTRUÇÃO: "descontar 30%"

DEPOIS (automático):
🎁 BLACK FRIDAY
Produto 1: R$ 139,93
Produto 2: R$ 244,30
```

### Exemplo 3: Sem Operação Matemática
```
INSTRUÇÃO: "Crie uma mensagem promocional"

RESULTADO: USA A IA GEMINI
(Gera texto criativo sem calcular)
```

---

## 🚀 VANTAGENS

1. **⚡ Instantâneo** - Não precisa esperar IA processar
2. **🎯 Preciso** - Cálculos matemáticos exatos
3. **💰 Econômico** - Não gasta tokens da IA em operações simples
4. **🧠 Inteligente** - Entende português natural
5. **🔄 Automático** - Detecta e processa sozinho

---

## ⚠️ OBSERVAÇÕES

- Os preços são **arredondados para 2 casas decimais**
- Mantém o formato brasileiro (vírgula para decimal)
- Processa **todos os preços** encontrados na mensagem
- Se não encontrar preços, usa a IA normalmente

---

## 🎨 PRÓXIMAS MELHORIAS POSSÍVEIS

- [ ] Detectar "aplicar promoção X para Y"
- [ ] Suportar operações mistas (aumentar uns, diminuir outros)
- [ ] Histórico de alterações nos preços
- [ ] Desfazer última alteração

---

✅ **Implementado e funcionando!**

Agora você pode simplesmente digitar "subir em 10%" e o sistema faz o resto! 🎉

import OpenAI from "openai";
import prisma from "../prisma/client";

const openai = new OpenAI({apiKey: process.env.OPENAI_API_KEY});

// Cache simple en memoria para recomendaciones por 24h
const recommendationsCache = new Map<number, { data: any; createdAt: number }>();
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

interface CategorizeResult {
    categoryName: string;
    amountExtracted: number;
    descriptionExtracted: string;
    transactionTypeExtracted: 'INCOME' | 'EXPENSE';
}

// Recomendaciones
interface RecommendationItem {
    id: number;
    title: string;
    description: string;
    type: 'warning' | 'success' | 'info';
}

async function gptCategorize(text: string): Promise<CategorizeResult> {
    // 1. Trae todas las categorías con su tipo
    const categories = await prisma.category.findMany({
        select: { name: true, type: true },
        orderBy: { name: 'asc' }
    });
    const categoryNames = categories.map(c => c.name);

    const prompt = `
Dada la siguiente descripción de transacción, extrae:
- categoría: una de ${categoryNames.join(', ')}
- monto: como número (si está presente)
- descripción: un resumen corto
- tipo de transacción: 'INCOME' o 'EXPENSE' según el contexto
Devuelve un objeto JSON con las claves: category, amount, description, transactionType.

Descripción: "${text}"
`;

    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            {
                role: 'system',
                content: 'Eres un asistente útil para categorización de transacciones. Responde siempre en español.'
            },
            { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 500
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) throw new Error('No response from GPT');

    try {
        const clean = content.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(clean);

        // 2. Filtra las categorías por el tipo devuelto por GPT
        const validCategories = categories
            .filter(c => c.type === parsed.transactionType)
            .map(c => c.name);

        // 3. Valida que la categoría esté en la lista filtrada
        if (
            typeof parsed.category !== 'string' ||
            typeof parsed.amount !== 'number' ||
            typeof parsed.description !== 'string' ||
            typeof parsed.transactionType !== 'string' ||
            !validCategories.includes(parsed.category)
        ) {
            throw new Error('Invalid response shape');
        }
        return {
            categoryName: parsed.category,
            amountExtracted: parsed.amount,
            descriptionExtracted: parsed.description,
            transactionTypeExtracted: parsed.transactionType
        };
    } catch (err) {
        throw new Error('Failed to parse GPT response: ' + content);
    }
}

export async function categorizeTransaction(req: any, res: any, next: any) {
    try {
        const { text } = req.body;
        const result = await safeGptCategorize(text);
        res.json(result);
    } catch (err) {
        next(err);
    }
}

async function safeGptCategorize(
  text: string,
  retries = 3,
): Promise<CategorizeResult> {
  for (let i = 0; i < retries; i++) {
    try {
      return await gptCategorize(text);
    } catch (err: any) {
      if (err?.response?.status === 429 && i < retries - 1) {
        await new Promise((res) => setTimeout(res, 1000 * (i + 1)));
        continue;
      }
      throw err;
    }
  }
  throw new Error('Demasiadas solicitudes a la API de OpenAI.');
}

// ====== Nuevas utilidades para recomendaciones ======
function toNumber(val: any): number {
    if (val == null) return 0;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') return parseFloat(val);
    if (typeof val === 'object' && 'toNumber' in val && typeof (val as any).toNumber === 'function') {
        return (val as any).toNumber();
    }
    return Number(val);
}

async function getUserFinancialData(userId: number) {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const transactions = await prisma.transaction.findMany({
        where: {
            userId,
            date: { gte: since }
        },
        include: { category: true }
    });

    const totalIncome = transactions
        .filter(t => t.category.type === 'INCOME')
        .reduce((sum, t) => sum + toNumber(t.amount), 0);

    const totalExpenses = transactions
        .filter(t => t.category.type === 'EXPENSE')
        .reduce((sum, t) => sum + toNumber(t.amount), 0);

    const expensesByCategory = transactions
        .filter(t => t.category.type === 'EXPENSE')
        .reduce<Record<string, number>>((acc, t) => {
            const category = t.category.name;
            acc[category] = (acc[category] || 0) + toNumber(t.amount);
            return acc;
        }, {});

    return {
        totalIncome,
        totalExpenses,
        netBalance: totalIncome - totalExpenses,
        expensesByCategory,
        transactionCount: transactions.length,
        period: '30 días'
    };
}

function createFinancialPrompt(data: any) {
    return `
Analiza los siguientes datos financieros de un usuario y proporciona exactamente 3 recomendaciones financieras personalizadas:

DATOS FINANCIEROS (últimos ${data.period}):
- Ingresos totales: Bs ${data.totalIncome}
- Gastos totales: Bs ${data.totalExpenses}
- Balance neto: Bs ${data.netBalance}
- Número de transacciones: ${data.transactionCount}

GASTOS POR CATEGORÍA:
${Object.entries(data.expensesByCategory)
  .map(([category, amount]) => `- ${category}: Bs ${amount}`)
  .join('\n')}

INSTRUCCIONES:
1. Proporciona exactamente 3 recomendaciones
2. Cada recomendación debe tener un título corto y una descripción de máximo 100 palabras
3. Clasifica cada recomendación como: "success", "warning", o "info"
4. Sé específico con los números y porcentajes
5. Responde en formato JSON válido

FORMATO DE RESPUESTA REQUERIDO:
{
  "recommendations": [
    {
      "title": "Título de la recomendación",
      "description": "Descripción detallada con números específicos",
      "type": "warning|success|info"
    }
  ]
}
`;
}

function parseGPTResponse(gptResponse: string): RecommendationItem[] {
    try {
        const jsonMatch = gptResponse.match(/{[\s\S]*}/);
        if (!jsonMatch) {
            throw new Error('No JSON found in response');
        }
        const parsed = JSON.parse(jsonMatch[0]);
        if (!parsed.recommendations || !Array.isArray(parsed.recommendations)) {
            throw new Error('Invalid response structure');
        }
        return parsed.recommendations.slice(0, 3).map((rec: any, index: number) => ({
            id: index + 1,
            title: rec.title || 'Recomendación',
            description: rec.description || 'Sin descripción',
            type: ['warning', 'success', 'info'].includes(rec.type) ? rec.type : 'info'
        }));
    } catch (error) {
        console.error('Error parsing GPT response:', error);
        return getDefaultRecommendations();
    }
}

function getDefaultRecommendations(): RecommendationItem[] {
    return [
        {
            id: 1,
            title: "Revisar Gastos Mensuales",
            description: "Analiza tus gastos del último mes para identificar áreas de mejora.",
            type: "info"
        },
        {
            id: 2,
            title: "Establecer Presupuesto",
            description: "Crea un presupuesto mensual basado en tus ingresos actuales.",
            type: "warning"
        },
        {
            id: 3,
            title: "Continúa Ahorrando",
            description: "Mantén tus hábitos de ahorro actuales para alcanzar tus metas.",
            type: "success"
        }
    ];
}

async function safeCreateCompletion(messages: { role: 'system'|'user'|'assistant'; content: string }[], retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            return await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages,
                temperature: 0.7,
                max_tokens: 1000
            });
        } catch (err: any) {
            if (err?.status === 429 && i < retries - 1) {
                await new Promise(res => setTimeout(res, 1000 * (i + 1)));
                continue;
            }
            throw err;
        }
    }
    throw new Error('Demasiadas solicitudes a la API de OpenAI.');
}

export async function generateRecommendations(req: any, res: any) {
    try {
        const authUserId = req.user?.id as number | undefined;
        const bodyUserId = req.body?.userId as number | undefined;
        const userId = authUserId || bodyUserId;
        if (!userId) {
            return res.status(400).json({ error: 'userId requerido' });
        }

        // Cache 24h
        const cached = recommendationsCache.get(userId);
        const now = Date.now();
        if (cached && now - cached.createdAt < ONE_DAY_MS) {
            return res.json({ ...cached.data, cached: true });
        }

        // 1. Datos financieros
        const financialData = await getUserFinancialData(userId);

        // 2. Prompt
        const prompt = createFinancialPrompt(financialData);

        // 3. Llamada a OpenAI
        const completion = await safeCreateCompletion([
            {
                role: 'system',
                content: 'Eres un asesor financiero experto que analiza datos financieros y da recomendaciones personalizadas en español.'
            },
            { role: 'user', content: prompt }
        ]);

        const content = completion.choices?.[0]?.message?.content || '';

        // 4. Parsear respuesta
        const recommendations = parseGPTResponse(content);

        const payload = {
            recommendations,
            generatedAt: new Date().toISOString()
        };

        // Guardar en cache
        recommendationsCache.set(userId, { data: payload, createdAt: now });

        res.json(payload);
    } catch (error) {
        console.error('Error generating recommendations:', error);
        res.status(500).json({ error: 'Error generating recommendations' });
    }
}

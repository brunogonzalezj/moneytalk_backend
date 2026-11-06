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
    dateExtracted?: string; // Formato YYYY-MM-DD
    transactionTypeExtracted: 'INCOME' | 'EXPENSE';
    isValidFinancialTransaction: boolean;
    suggestedCategory?: string;
    confidence: number;
    rejectionReason?: string;
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

    const incomeCategories = categories.filter(c => c.type === 'INCOME').map(c => c.name);
    const expenseCategories = categories.filter(c => c.type === 'EXPENSE').map(c => c.name);

    const prompt = `
Eres un experto financiero que analiza transacciones. Tu tarea es determinar si el siguiente texto describe una transacción financiera válida y categorizarla.

TEXTO A ANALIZAR: "${text}"

FECHA ACTUAL: ${new Date().toISOString().split('T')[0]} (YYYY-MM-DD)
DÍA DE HOY: ${new Date().toLocaleDateString('es-ES', { weekday: 'long' })}

=== REGLAS DE VALIDACIÓN ===
1. El texto DEBE describir una transacción financiera (gasto o ingreso)
2. Se rechazan textos que: hablen del clima, deportes sin contexto financiero, noticias generales, chistes, conversaciones casuales SIN CONTEXTO ECONÓMICO
3. El texto debe contener o implicar un monto monetario explícito (ej: "$500", "500 dolares", "Bs 200")
4. Debe ser una transacción personal o de negocio

=== ANÁLISIS DE FECHAS (MUY IMPORTANTE) ===
Debes extraer la fecha de la transacción del texto usando estas reglas:

PALABRAS CLAVE DE FECHA:
- "hoy" → ${new Date().toISOString().split('T')[0]}
- "ayer" → ${new Date(Date.now() - 24*60*60*1000).toISOString().split('T')[0]}
- "anteayer" o "antier" → ${new Date(Date.now() - 2*24*60*60*1000).toISOString().split('T')[0]}
- "hace 2 días" → ${new Date(Date.now() - 2*24*60*60*1000).toISOString().split('T')[0]}
- "hace 3 días" → ${new Date(Date.now() - 3*24*60*60*1000).toISOString().split('T')[0]}
- "hace 4 días" → ${new Date(Date.now() - 4*24*60*60*1000).toISOString().split('T')[0]}
- "hace 5 días" → ${new Date(Date.now() - 5*24*60*60*1000).toISOString().split('T')[0]}
- "hace 6 días" → ${new Date(Date.now() - 6*24*60*60*1000).toISOString().split('T')[0]}
- "hace una semana" o "la semana pasada" → ${new Date(Date.now() - 7*24*60*60*1000).toISOString().split('T')[0]}

Si menciona día de la semana (lunes, martes, etc.), calcula el día más reciente en el pasado.
Si NO menciona fecha → usa ${new Date().toISOString().split('T')[0]} (hoy)

IMPORTANTE:
- SIEMPRE incluye el campo "date" en tu respuesta
- La fecha DEBE estar en formato YYYY-MM-DD
- SOLO fechas pasadas o hoy (nunca futuras)
- Si dice "mañana" → usa hoy en su lugar

=== ANÁLISIS FINANCIERO ===
Responde las siguientes preguntas:
- ¿Es claramente una transacción financiera? (gasto/ingreso)
- ¿Hay un monto monetario explícito presente?
- ¿El contexto es personal/negocio/económico?
- ¿Cuándo ocurrió la transacción? (OBLIGATORIO)

EJEMPLOS CON FECHAS:
- "ayer gasté 50 en comida" 
  → date: "${new Date(Date.now() - 24*60*60*1000).toISOString().split('T')[0]}"
  
- "hace 3 días compré algo por 100" 
  → date: "${new Date(Date.now() - 3*24*60*60*1000).toISOString().split('T')[0]}"
  
- "gasté 50 en comida" (sin mención de fecha)
  → date: "${new Date().toISOString().split('T')[0]}"

CATEGORÍAS DISPONIBLES:
- INGRESOS: ${incomeCategories.join(', ') || 'Salario, Freelance, Ventas, Inversiones'}
- GASTOS: ${expenseCategories.join(', ') || 'Alimentación, Transporte, Vivienda, Entretenimiento'}

=== FORMATO DE RESPUESTA (OBLIGATORIO) ===
Devuelve ÚNICAMENTE JSON con esta estructura EXACTA:
{
  "isValidFinancialTransaction": boolean,
  "confidence": number (0.0-1.0),
  "transactionType": "INCOME"|"EXPENSE"|null,
  "amount": number|null,
  "description": string|null,
  "date": "YYYY-MM-DD" (OBLIGATORIO, nunca null),
  "category": string|null,
  "suggestedCategory": string|null,
  "rejectionReason": string|null
}

EJEMPLO DE RESPUESTA CORRECTA CON CATEGORÍA EXISTENTE:
{
  "isValidFinancialTransaction": true,
  "confidence": 0.9,
  "transactionType": "EXPENSE",
  "amount": 50,
  "description": "Compra de alimentos",
  "date": "${new Date(Date.now() - 24*60*60*1000).toISOString().split('T')[0]}",
  "category": "Alimentación",
  "suggestedCategory": null,
  "rejectionReason": null
}

EJEMPLO DE RESPUESTA CON NUEVA CATEGORÍA SUGERIDA:
{
  "isValidFinancialTransaction": true,
  "confidence": 0.85,
  "transactionType": "EXPENSE",
  "amount": 150,
  "description": "Pago de servicio de streaming",
  "date": "${new Date().toISOString().split('T')[0]}",
  "category": null,
  "suggestedCategory": "Suscripciones",
  "rejectionReason": null
}

CRITERIOS IMPORTANTES:
- isValidFinancialTransaction: true solo si es claramente una transacción financiera
- confidence: qué tan seguro estás del análisis (0.0-1.0)
- date: SIEMPRE debe tener un valor en formato YYYY-MM-DD (NUNCA null)
- description: descripción LIMPIA y PROFESIONAL de la transacción (ej: "Compra de alimentos" NO "ayer gasté 50 en comida"). Debe ser corta, sin el monto ni la fecha.
- category: usa SOLO si la categoría existe en la lista de CATEGORÍAS DISPONIBLES (comparación exacta, case-insensitive)
- suggestedCategory: si NO encuentras una categoría exacta en la lista pero la transacción es válida, sugiere un nombre específico para crear una nueva categoría (ej: "Suscripciones", "Mascotas", "Educación", "Gimnasio")
- rejectionReason: explica por qué se rechaza si no es válida

REGLAS DE CATEGORIZACIÓN:
1. Si la transacción claramente encaja en una categoría existente → usa "category"
2. Si NO encaja en ninguna categoría existente pero es válida → usa "suggestedCategory" con un nombre descriptivo y específico
3. Solo usa "suggestedCategory" cuando estés seguro de que necesitas una nueva categoría
4. Nombres de categoría sugerida deben ser: específicos, cortos (1-2 palabras), en español, con mayúscula inicial

EJEMPLOS DE DESCRIPCIONES LIMPIAS:
- Texto: "ayer gasté 50 en comida" → description: "Compra de alimentos"
- Texto: "hace 3 días compré ropa por 100" → description: "Compra de ropa"
- Texto: "entraron 500 de un trabajo" → description: "Ingreso por trabajo realizado"
- Texto: "recibí mi sueldo de 2000" → description: "Pago de salario mensual"

REGLA CLAVE: 
- El campo "date" es OBLIGATORIO y NUNCA debe ser null
- El campo "description" debe ser una descripción LIMPIA sin el monto, sin la fecha, sin palabras temporales (ayer, hoy, hace X días)
`;

    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            {
                role: 'system',
                content: 'Eres un experto financiero analizando transacciones. Responde únicamente con JSON válido como se especifica. No agregues comentarios ni texto fuera del JSON.'
            },
            { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 300
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) throw new Error('No response from GPT');

    try {
        const clean = content.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(clean);

        console.log('📋 GPT Response Parsed:', JSON.stringify(parsed, null, 2));

        // Primero intentar con el nuevo formato (con validaciones)
        if (typeof parsed.isValidFinancialTransaction === 'boolean') {
            // Si no es una transacción válida, devolver respuesta de rechazo sin descripción
            if (!parsed.isValidFinancialTransaction) {
                return {
                    categoryName: '',
                    amountExtracted: 0,
                    descriptionExtracted: '', // Siempre vacío para transacciones inválidas
                    dateExtracted: undefined,
                    transactionTypeExtracted: 'EXPENSE',
                    isValidFinancialTransaction: false,
                    confidence: parsed.confidence || 0,
                    rejectionReason: parsed.rejectionReason || 'Texto no reconocido como transacción financiera válida'
                };
            }

            // Si es válida, procesar los datos
            const transactionType = parsed.transactionType as 'INCOME' | 'EXPENSE';

            // Validar que la categoría exista para el tipo de transacción
            if (parsed.category && transactionType) {
                const validCategories = categories
                    .filter(c => c.type === transactionType)
                    .map(c => c.name);

                if (!validCategories.includes(parsed.category)) {
                    // La categoría no existe, marcar como sugerencia CON descripción
                    return {
                        categoryName: '',
                        amountExtracted: parsed.amount || 0,
                        descriptionExtracted: parsed.description || '', // Mantener descripción de GPT
                        dateExtracted: parsed.date || new Date().toISOString().split('T')[0],
                        transactionTypeExtracted: transactionType,
                        isValidFinancialTransaction: true,
                        suggestedCategory: parsed.category, // La categoría que GPT sugirió
                        confidence: parsed.confidence || 0.7
                    };
                }
            }

            // Si hay suggestedCategory pero no category, también procesarlo
            if (parsed.suggestedCategory && !parsed.category && transactionType) {
                return {
                    categoryName: '',
                    amountExtracted: parsed.amount || 0,
                    descriptionExtracted: parsed.description || '', // Mantener descripción de GPT
                    dateExtracted: parsed.date || new Date().toISOString().split('T')[0],
                    transactionTypeExtracted: transactionType,
                    isValidFinancialTransaction: true,
                    suggestedCategory: parsed.suggestedCategory,
                    confidence: parsed.confidence || 0.7
                };
            }

            return {
                categoryName: parsed.category || '',
                amountExtracted: parsed.amount || 0,
                descriptionExtracted: parsed.description || text,
                dateExtracted: parsed.date || new Date().toISOString().split('T')[0],
                transactionTypeExtracted: transactionType || 'EXPENSE',
                isValidFinancialTransaction: true,
                suggestedCategory: undefined,
                confidence: parsed.confidence || 0.8
            };
        }
        // Si no tiene el nuevo formato, intentar con el formato antiguo (compatibilidad)
        else if (parsed.category && parsed.transactionType) {
            console.log('⚠️ Using fallback format (old)');
            // Validar estructura del formato antiguo
            const validCategories = categories
                .filter(c => c.type === parsed.transactionType)
                .map(c => c.name);

            if (validCategories.includes(parsed.category)) {
                return {
                    categoryName: parsed.category,
                    amountExtracted: parsed.amount || 0,
                    descriptionExtracted: parsed.description || text,
                    dateExtracted: parsed.date || new Date().toISOString().split('T')[0],
                    transactionTypeExtracted: parsed.transactionType,
                    isValidFinancialTransaction: true,
                    confidence: 0.8
                };
            } else if (parsed.category) {
                // Categoría no existe, marcar como sugerencia CON descripción
                return {
                    categoryName: '',
                    amountExtracted: parsed.amount || 0,
                    descriptionExtracted: parsed.description || '', // Mantener descripción de GPT
                    dateExtracted: parsed.date || new Date().toISOString().split('T')[0],
                    transactionTypeExtracted: parsed.transactionType,
                    isValidFinancialTransaction: true,
                    suggestedCategory: parsed.category,
                    confidence: 0.7
                };
            } else {
                throw new Error('Invalid response shape');
            }
        } else {
            throw new Error('Invalid response shape');
        }

    } catch (err) {
        console.error('Error parsing GPT response:', err);
        console.error('Raw response:', content);
        throw new Error('Failed to parse GPT response: ' + content);
    }
}

export async function categorizeTransaction(req: any, res: any, next: any) {
    try {
        const { text } = req.body;
        console.log('🎤 Processing text:', text);
        const result = await safeGptCategorize(text);
        console.log('✅ Returning result:', JSON.stringify(result, null, 2));
        res.json(result);
    } catch (err) {
        next(err);
    }
}

async function safeGptCategorize(
  text: string,
  retries = 5,
): Promise<CategorizeResult> {
  for (let i = 0; i < retries; i++) {
    try {
      return await gptCategorize(text);
    } catch (err: any) {
      if (err?.response?.status === 429 && i < retries - 1) {
        const waitTime = Math.min(1000 * Math.pow(2, i), 30000); // Exponential backoff, max 30s
        console.log(`OpenAI rate limit hit in categorization, waiting ${waitTime}ms before retry ${i + 1}/${retries}`);
        await new Promise((res) => setTimeout(res, waitTime));
        continue;
      }
      throw err;
    }
  }
  throw new Error('Demasiadas solicitudes a la API de OpenAI. Intenta más tarde.');
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
    console.log('=== GET USER FINANCIAL DATA ===');
    console.log('User ID:', userId);

    // Get data from different periods for better analysis - extended to capture more historical data
    const now = new Date();
    const last180Days = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000); // 6 months
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    console.log('Date ranges:');
    console.log('- Now:', now.toISOString());
    console.log('- Last 180 days from:', last180Days.toISOString());
    console.log('- Last 30 days from:', last30Days.toISOString());
    console.log('- Last 7 days from:', last7Days.toISOString());

    // Get transactions from extended period
    const allTransactions = await prisma.transaction.findMany({
        where: { userId, date: { gte: last180Days } },
        include: { category: true },
        orderBy: { date: 'desc' }
    });

    // Filter for specific periods
    const transactions30Days = allTransactions.filter(t => new Date(t.date) >= last30Days);
    const transactions7Days = allTransactions.filter(t => new Date(t.date) >= last7Days);

    console.log('Transactions found:');
    console.log('- Total (180 days):', allTransactions.length);
    console.log('- 30 days:', transactions30Days.length);
    console.log('- 7 days:', transactions7Days.length);

    // Log first few transactions for debugging
    if (allTransactions.length > 0) {
        console.log('Sample transactions (recent):');
        allTransactions.slice(0, 5).forEach(t => {
            console.log(`  - ${t.date}: ${t.category?.type} ${t.amount} (${t.category?.name})`);
        });
    }

    // Calculate income and expenses for both periods
    const calculateFinancials = (transactions: any[]) => {
        const income = transactions
            .filter(t => t.category.type === 'INCOME')
            .reduce((sum, t) => sum + toNumber(t.amount), 0);

        const expenses = transactions
            .filter(t => t.category.type === 'EXPENSE')
            .reduce((sum, t) => sum + toNumber(t.amount), 0);

        return { income, expenses, net: income - expenses };
    };

    const financialsAllTime = calculateFinancials(allTransactions);
    const financials30Days = calculateFinancials(transactions30Days);
    const financials7Days = calculateFinancials(transactions7Days);

    // Detailed expense breakdown - using all-time data for complete picture
    const expensesByCategory = allTransactions
        .filter(t => t.category.type === 'EXPENSE')
        .reduce<Record<string, number>>((acc, t) => {
            const category = t.category.name;
            acc[category] = (acc[category] || 0) + toNumber(t.amount);
            return acc;
        }, {});

    // Income sources - using all-time data for complete picture
    const incomeByCategory = allTransactions
        .filter(t => t.category.type === 'INCOME')
        .reduce<Record<string, number>>((acc, t) => {
            const category = t.category.name;
            acc[category] = (acc[category] || 0) + toNumber(t.amount);
            return acc;
        }, {});

    console.log('Category breakdowns:');
    console.log('- All transactions:', allTransactions.length);
    console.log('- Expenses by category:', expensesByCategory);
    console.log('- Income by category:', incomeByCategory);
    console.log('- Financials All Time:', financialsAllTime);

    // Transaction patterns - using all-time data
    const avgTransactionSize = allTransactions.length > 0
        ? financialsAllTime.expenses / allTransactions.length
        : 0;

    // Get user's savings goals and recurring payments
    const savingsGoals = await prisma.savingsGoal.findMany({
        where: { userId, status: 'ACTIVE' }
    });

    const recurringPayments = await prisma.recurringPayment.findMany({
        where: { userId, isActive: true }
    });

    const totalSavingsGoals = savingsGoals.reduce((sum, goal) => sum + toNumber(goal.targetAmount), 0);
    const currentSavingsProgress = savingsGoals.reduce((sum, goal) => sum + toNumber(goal.currentAmount), 0);
    const monthlyRecurringPayments = recurringPayments.reduce((sum, payment) => {
        const amount = toNumber(payment.amount);
        switch (payment.frequency) {
            case 'DAILY': return sum + (amount * 30);
            case 'WEEKLY': return sum + (amount * 4.33);
            case 'MONTHLY': return sum + amount;
            case 'YEARLY': return sum + (amount / 12);
            default: return sum;
        }
    }, 0);

    // Financial health indicators - using all-time data for accuracy
    const savingsRate = financialsAllTime.income > 0
        ? (financialsAllTime.net / financialsAllTime.income) * 100
        : 0;

    const expenseRatio = financialsAllTime.income > 0
        ? (financialsAllTime.expenses / financialsAllTime.income) * 100
        : 0;

    // Large transactions (potential areas to review) - using all-time data
    const largeTransactions = allTransactions
        .filter(t => t.category.type === 'EXPENSE' && toNumber(t.amount) > (avgTransactionSize * 2))
        .sort((a, b) => toNumber(b.amount) - toNumber(a.amount))
        .slice(0, 5);

    return {
        period: '30 días',
        periodShort: '7 días',
        periodAllTime: 'histórico completo',

        // Core financials
        incomeAllTime: financialsAllTime.income,
        expensesAllTime: financialsAllTime.expenses,
        netAllTime: financialsAllTime.net,
        income30Days: financials30Days.income,
        expenses30Days: financials30Days.expenses,
        net30Days: financials30Days.net,
        income7Days: financials7Days.income,
        expenses7Days: financials7Days.expenses,
        net7Days: financials7Days.net,

        // Breakdowns
        expensesByCategory,
        incomeByCategory,

        // Patterns and indicators
        transactionCount: transactions30Days.length,
        avgTransactionSize,
        savingsRate: Math.round(savingsRate * 10) / 10,
        expenseRatio: Math.round(expenseRatio * 10) / 10,

        // Goals and commitments
        savingsGoals: savingsGoals.map(g => ({
            name: g.name,
            target: toNumber(g.targetAmount),
            current: toNumber(g.currentAmount),
            progress: Math.round((toNumber(g.currentAmount) / toNumber(g.targetAmount)) * 100)
        })),
        totalSavingsGoals,
        currentSavingsProgress,
        monthlyRecurringPayments,

        // Anomaly detection
        largeTransactions: largeTransactions.map(t => ({
            description: t.description,
            amount: toNumber(t.amount),
            category: t.category.name,
            date: t.date
        }))
    };
}

function createFinancialPrompt(data: any) {
    return `
Eres un asesor financiero experto certificado que analiza datos completos de un cliente y proporciona recomendaciones personalizadas y accionables. Analiza los siguientes datos financieros y genera exactamente 3 recomendaciones estratégicas.

=== ANÁLISIS FINANCIERO COMPLETO ===

📊 RESUMEN GENERAL (${data.periodAllTime}):
• Ingresos totales: Bs ${data.incomeAllTime.toLocaleString()}
• Gastos totales: Bs ${data.expensesAllTime.toLocaleString()}
• Balance neto TOTAL: Bs ${data.netAllTime.toLocaleString()}
• Tasa de ahorro: ${data.savingsRate}%
• Ratio de gastos: ${data.expenseRatio}%

📊 ACTIVIDAD RECIENTE (últimos 30 días):
• Ingresos recientes: Bs ${data.income30Days.toLocaleString()}
• Gastos recientes: Bs ${data.expenses30Days.toLocaleString()}
• Balance reciente: Bs ${data.net30Days.toLocaleString()}

📈 TENDENCIAS RECIENTES (últimos 7 días):
• Ingresos: Bs ${data.income7Days.toLocaleString()}
• Gastos: Bs ${data.expenses7Days.toLocaleString()}
• Balance: Bs ${data.net7Days.toLocaleString()}

💰 FUENTES DE INGRESO:
${Object.entries(data.incomeByCategory || {})
  .map(([category, amount]) => `• ${category}: Bs ${Number(amount).toLocaleString()}`)
  .join('\n') || '• Sin ingresos registrados'}

💸 DESGLOSE DE GASTOS:
${Object.entries(data.expensesByCategory || {})
  .sort(([,a], [,b]) => Number(b) - Number(a))
  .map(([category, amount]) => `• ${category}: Bs ${Number(amount).toLocaleString()} (${(Number(amount) / data.expenses30Days * 100).toFixed(1)}%)`)
  .join('\n') || '• Sin gastos registrados'}

🎯 METAS DE AHORRO:
${data.savingsGoals.length > 0
  ? data.savingsGoals.map((goal: any) =>
      `• ${goal.name}: Bs ${goal.current.toLocaleString()} / Bs ${goal.target.toLocaleString()} (${goal.progress}% completado)`
    ).join('\n')
  : '• Sin metas de ahorro activas'}

💳 COMPROMISOS MENSUALES:
• Pagos recurrentes: Bs ${data.monthlyRecurringPayments.toLocaleString()}

⚡ DETECCIÓN DE ANOMALÍAS:
${data.largeTransactions.length > 0
  ? data.largeTransactions.map((t: any) =>
      `• ${t.description}: Bs ${t.amount.toLocaleString()} (${t.category} - ${new Date(t.date).toLocaleDateString()})`
    ).join('\n')
  : '• No se detectaron transacciones inusualmente grandes'}

📊 PATRONES DE COMPORTAMIENTO:
• Total transacciones: ${data.transactionCount}
• Tamaño promedio de transacción: Bs ${data.avgTransactionSize.toFixed(2)}

=== CRITERIOS DE EVALUACIÓN FINANCIERA ===

Reglas de salud financiera a considerar:
1. Tasa de ahorro ideal: 20%+ (excelente), 10-20% (bueno), <10% (necesita mejorar)
2. Ratio de gastos ideal: <80% (excelente), 80-90% (bueno), >90% (riesgoso)
3. Diversificación de ingresos: 3+ fuentes ideal
4. Tamaño máximo de gasto individual: <5% de ingresos totales
5. Fondo de emergencia: 3-6 meses de gastos fijos

=== INSTRUCCIONES ESPECÍFICAS ===

1. **ANALISIS HOLÍSTICO**: Da prioridad al BALANCE NETO TOTAL (${data.netAllTime.toLocaleString()}) sobre el balance reciente
2. Identifica el 1 problema más crítico o la 1 oportunidad más importante basado en la situación financiera completa
3. Considera las metas de ahorro del usuario y su progreso
4. Evalúa la sostenibilidad financiera a largo plazo usando datos históricos
5. Detecta patrones de comportamiento que puedan ser mejorados
6. **IMPORTANTE**: No bases las recomendaciones solo en la actividad reciente (30 días); considera el historial completo
7. Proporciona recomendaciones específicas, medibles y accionables basadas en la realidad financiera total

CLASIFICACIÓN DE RECOMENDACIONES:
• "warning": Problemas críticos que requieren atención inmediata (riesgo financiero)
• "success": Oportunidades para optimizar lo que ya funciona bien
• "info": Sugerencias para mejorar hábitos financieros generales

FORMATO DE RESPUESTA REQUERIDO (JSON):
{
  "recommendations": [
    {
      "title": "Título específico y accionable",
      "description": "Descripción detallada que incluye: 1) El problema específico identificado, 2) El impacto financiero cuantificado, 3) La acción recomendada con métricas específicas, 4) El beneficio esperado",
      "type": "warning|success|info"
    }
  ]
}

Ejemplos de recomendaciones de alta calidad:
- "Reduce gastos en la categoría más alta mediante presupuestos específicos"
- "Incrementa tu tasa de ahorro hacia el objetivo ideal del 20%"
- "Diversifica tus fuentes de ingreso para reducir dependencia"
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

async function safeCreateCompletion(messages: { role: 'system'|'user'|'assistant'; content: string }[], retries = 5) {
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
                const waitTime = Math.min(1000 * Math.pow(2, i), 30000); // Exponential backoff, max 30s
                console.log(`OpenAI rate limit hit, waiting ${waitTime}ms before retry ${i + 1}/${retries}`);
                await new Promise(res => setTimeout(res, waitTime));
                continue;
            }
            throw err;
        }
    }
    throw new Error('Demasiadas solicitudes a la API de OpenAI. Intenta más tarde.');
}

export async function generateRecommendations(req: any, res: any) {
    console.log('=== AI RECOMMENDATIONS REQUEST ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('User from auth:', req.user);

    try {
        const authUserId = req.user?.id as number | undefined;
        const bodyUserId = req.body?.userId as number | undefined;
        const forceRefresh = req.body?.forceRefresh === true;
        const userId = authUserId || bodyUserId;

        console.log('Parsed values - authUserId:', authUserId, 'bodyUserId:', bodyUserId, 'forceRefresh:', forceRefresh, 'finalUserId:', userId);

        if (!userId) {
            console.log('ERROR: userId required');
            return res.status(400).json({ error: 'userId requerido' });
        }

        // Cache 24h, but bypass if forceRefresh is true
        const cached = recommendationsCache.get(userId);
        const now = Date.now();

        if (forceRefresh) {
            console.log(`Force refresh requested for user ${userId}, bypassing cache`);
        } else if (cached && now - cached.createdAt < ONE_DAY_MS) {
            console.log(`Returning cached recommendations for user ${userId}`);
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

        console.log(`Generated fresh recommendations for user ${userId}, cached for 24h`);
        res.json(payload);
    } catch (error) {
        console.error('Error generating recommendations:', error);
        res.status(500).json({ error: 'Error generating recommendations' });
    }
}

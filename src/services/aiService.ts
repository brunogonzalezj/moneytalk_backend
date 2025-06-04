import OpenAI from "openai";

const openai = new OpenAI({apiKey: process.env.OPENAI_API_KEY});

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1';

const CATEGORIES = ['Food', 'Transport', 'Salary', 'Entertainment', 'Others'];

interface CategorizeResult {
    categoryName: string;
    amountExtracted: number;
    descriptionExtracted: string;
    transactionTypeExtracted: 'income' | 'expense';
}

function isAudio(textOrAudio: any): boolean {
    if (typeof textOrAudio !== 'string') return false;
    return textOrAudio.trim().startsWith('data:audio') || textOrAudio.endsWith('.mp3') || textOrAudio.endsWith('.wav');
}

async function transcribeWithWhisper(audio: string): Promise<string> {
    // Placeholder: implement actual Whisper API call if needed
    throw new Error('Whisper transcription not implemented. Provide text or implement audio support.');
}

async function gptCategorize(text: string): Promise<CategorizeResult> {
    const prompt = `
Given the following transaction description, extract:
- category: one of ${CATEGORIES.join(', ')}
- amount: as a number (if present)
- description: a short summary
- transactionType: 'income' or 'expense' based on the context
Return a JSON object with keys: category, amount, description, trasactionType.

Description: "${text}"
`;

    const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: 'You are a helpful assistant for transaction categorization. I need all responses in spanish.'
                },
                {role: 'user', content: prompt}
            ],
            temperature: 0.2,
            max_completion_tokens: 500
        }
    );

    const content = response.choices?.[0]?.message?.content;
    if (!content) throw new Error('No response from GPT');

    try {
        const clean = content.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(clean);
        if (
            typeof parsed.category !== 'string' ||
            typeof parsed.amount !== 'number' ||
            typeof parsed.description !== 'string' ||
            typeof parsed.transactionType !== 'string' ||
            !CATEGORIES.includes(parsed.category)
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

async function safeGptCategorize(text: string, retries = 3): Promise<CategorizeResult> {
    for (let i = 0; i < retries; i++) {
        try {
            return await gptCategorize(text);
        } catch (err: any) {
            if (err.response?.status === 429 && i < retries - 1) {
                await new Promise(res => setTimeout(res, 1000 * (i + 1)));
                continue;
            }
            throw err;
        }
    }
    throw new Error('Demasiadas solicitudes a la API de OpenAI.');
}

//export async function getRecomendations(req: any, res: any, next: any) {
//    try {
//        const userId = req.user.id;
//        const transactions = await prisma.transaction.findMany({
//            where: { userId }
//        });
//
//        if (!transactions.length) {
//            return res.json({ recommendations: ['No se encontraron transacciones para analizar.'] });
//        }
//
//        // Prepara un resumen simple de las transacciones
//        const resumen = transactions.map(tx =>
//            `Fecha: ${tx.date}, Monto: ${tx.amount}, Tipo: ${tx.type}, Categoría: ${tx.category}, Descripción: ${tx.description}`
//        ).join('\n');
//
//        const prompt = `
//Eres un asesor financiero. Analiza el siguiente resumen de transacciones y da 3 recomendaciones personalizadas para mejorar la salud financiera del usuario. Responde en español, en viñetas.
//
//Transacciones:
//${resumen}
//`;
//
//        const response = await openai.chat.completions.create({
//            model: 'gpt-4o-mini',
//            messages: [
//                { role: 'system', content: 'Eres un asesor financiero útil.' },
//                { role: 'user', content: prompt }
//            ],
//            temperature: 0.3,
//            max_completion_tokens: 2000
//        });
//
//        const content = response.choices?.[0]?.message?.content;
//        if (!content) throw new Error('No se obtuvo respuesta de GPT');
//
//        res.json({ recommendations: content.split('\n').filter(line => line.trim()) });
//    } catch (err) {
//        next(err);
//    }
//}

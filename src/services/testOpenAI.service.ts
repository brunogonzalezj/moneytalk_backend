import OpenAI from "openai";

const openai = new OpenAI({apiKey: process.env.OPENAI_API_KEY});

export async function testOpenAIConnection(req: any, res: any) {
    try {
        console.log('Testing OpenAI connection...');
        console.log('API Key present:', !!process.env.OPENAI_API_KEY);
        console.log('API Key length:', process.env.OPENAI_API_KEY?.length);

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'user',
                    content: 'Responde "Hola" en una sola palabra'
                }
            ],
            max_tokens: 10
        });

        const content = response.choices?.[0]?.message?.content;
        console.log('OpenAI Response:', content);

        res.json({
            success: true,
            response: content,
            usage: response.usage
        });

    } catch (error: any) {
        console.error('OpenAI Test Error:', error);

        res.status(500).json({
            success: false,
            error: error.message,
            status: error.status,
            type: error.type
        });
    }
}
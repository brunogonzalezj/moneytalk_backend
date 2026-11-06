const OpenAI = require('openai');

const openai = new OpenAI({apiKey: process.env.OPENAI_API_KEY});

async function testCategorization() {
    const text = "compre 500 bolivianos de tornillos";

    const prompt = `
Eres un experto financiero que analiza transacciones. Tu tarea es determinar si el siguiente texto describe una transacción financiera válida y categorizarla.

TEXTO A ANALIZAR: "${text}"

=== REGLAS DE VALIDACIÓN ===
1. El texto DEBE describir una transacción financiera (gasto o ingreso)
2. Se rechazan textos que: hablen del clima, deportes sin contexto financiero, noticias generales, chistes, conversaciones casuales SIN CONTEXTO ECONÓMICO
3. El texto debe contener o implicar un monto monetario explícito (ej: "$500", "500 dolares", "Bs 200")
4. Debe ser una transacción personal o de negocio

=== ANÁLISIS FINANCIERO ===
Responde las siguientes preguntas:
- ¿Es claramente una transacción financiera? (gasto/ingreso)
- ¿Hay un monto monetario explícito presente?
- ¿El contexto es personal/negocio/económico?

EJEMPLOS VÁLIDOS DE INGRESOS:
- "llegaron 500$ de un trabajo"
- "recibí Bs 1000 por mi sueldo"
- "me pagaron 200 dolares por el proyecto"
- "entraron 50 por una venta"
- "gané 300 en el freelancing"

EJEMPLOS VÁLIDOS DE GASTOS:
- "gasté 50 en comida"
- "compré algo por 100 pesos"
- "pagué 25 en el transporte"

CATEGORÍAS DISPONIBLES:
- INGRESOS: Salario, Freelance, Ventas, Inversiones
- GASTOS: Alimentación, Transporte, Vivienda, Entretenimiento, Ropa, Salud, Educación, Herramientas, Mantenimiento

=== FORMATO DE RESPUESTA ===
Devuelve ÚNICAMENTE JSON con esta estructura:
{
  "isValidFinancialTransaction": boolean,
  "confidence": number (0.0-1.0),
  "transactionType": "INCOME"|"EXPENSE"|null,
  "amount": number|null,
  "description": string|null,
  "category": string|null,
  "suggestedCategory": string|null,
  "rejectionReason": string|null
}

CRITERIOS IMPORTANTES:
- isValidFinancialTransaction: true solo si es claramente una transacción financiera
- confidence: qué tan seguro estás del análisis (0.0-1.0)
- description: solo incluye descripción si isValidFinancialTransaction=true Y hay una categoría existente válida. De lo contrario, null.
- suggestedCategory: si no hay categoría exacta pero entiendes el contexto, sugiere una adecuada y ESPECÍFICA. Evita sugerir "GASTOS" o "INGRESOS" como categorías.
- rejectionReason: explica por qué se rechaza si no es válida

REGLAS PARA SUGERENCIAS DE CATEGORÍAS:
- Para herramientas/materiales: "Herramientas", "Mantenimiento", "Repuestos", "Construcción"
- Para ropa/ropa: "Ropa", "Vestimenta", "Calzado"
- Para comida: "Alimentación", "Restaurantes", "Supermercado"
- Para transporte: "Transporte", "Combustible", "Mantenimiento vehicular"
- Para electrónica: "Electrónica", "Tecnología", "Dispositivos"
- Para hogar: "Hogar", "Muebles", "Decoración"
- Para salud: "Salud", "Medicamentos", "Cuidado personal"

REGLA CLAVE: Si no es una transacción válida O si necesitas sugerir una categoría nueva, el campo "description" debe ser null.`;

    try {
        console.log('Enviando solicitud a OpenAI...');
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
        console.log('Respuesta cruda de OpenAI:');
        console.log(content);

        if (!content) throw new Error('No response from GPT');

        const clean = content.replace(/```json|```/g, '').trim();
        console.log('\nJSON limpio:');
        console.log(clean);

        const parsed = JSON.parse(clean);
        console.log('\nJSON parseado:');
        console.log(JSON.stringify(parsed, null, 2));

    } catch (error) {
        console.error('Error:', error);
    }
}

testCategorization();
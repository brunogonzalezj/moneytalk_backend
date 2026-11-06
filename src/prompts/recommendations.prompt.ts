import { z } from 'zod';

export const recommendationsResponseSchema = z.object({
  recommendations: z
    .array(
      z.object({
        title: z.string().min(3).max(90),
        description: z.string().min(10).max(600),
        type: z.enum(['warning', 'success', 'info']).catch('info'),
      })
    )
    .min(1),
});

export interface PeriodTotals {
  income: number;
  expense: number;
  balance: number;
  count: number;
}

export interface FinancialSnapshot {
  last7: PeriodTotals;
  last30: PeriodTotals;
  last180: PeriodTotals;
  monthsWithData: number; // months covered by the 180-day window that have any transaction
  expenseByCategory30: { name: string; total: number; share: number }[];
  incomeByCategory180: { name: string; total: number }[];
  largestExpenses30: { description: string; amount: number; category: string; date: string }[];
  savingsGoals: { name: string; current: number; target: number; progress: number }[];
  monthlyRecurringCommitments: number;
}

const bs = (value: number) =>
  `Bs ${value.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const pct = (value: number) => `${value.toFixed(1)}%`;

const rate = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);

export const RECOMMENDATIONS_SYSTEM_PROMPT = `
Eres un asesor financiero personal que escribe en español neutro para usuarios de MoneyTalk en Bolivia (moneda: bolivianos, Bs).
Analizas un resumen numérico ya calculado y das exactamente 3 recomendaciones concretas.

Reglas:
- Usa solo las cifras del resumen; no inventes datos ni porcentajes nuevos.
- Cada recomendación debe incluir: el hallazgo con su cifra, una acción medible y el beneficio esperado.
- Prioriza: 1) riesgos (gastos mayores a ingresos, poca capacidad de ahorro), 2) la categoría de gasto más pesada, 3) progreso de metas o hábitos.
- Tipos: "warning" para riesgos que requieren atención, "success" para algo que va bien y conviene mantener, "info" para mejoras de hábitos.
- Referencias útiles: ahorrar al menos 10-20% de los ingresos; gastos fijos recurrentes idealmente por debajo del 50% de los ingresos; fondo de emergencia de 3 a 6 meses de gastos.
- Títulos de máximo 8 palabras. Descripciones de 2 o 3 oraciones.

Responde solo con JSON: {"recommendations": [{"title": string, "description": string, "type": "warning"|"success"|"info"}]}
`.trim();

export const buildRecommendationsUserPrompt = (data: FinancialSnapshot): string => {
  const monthlyIncome = data.monthsWithData > 0 ? data.last180.income / data.monthsWithData : 0;
  const monthlyExpense = data.monthsWithData > 0 ? data.last180.expense / data.monthsWithData : 0;

  const lines = [
    'RESUMEN FINANCIERO DEL USUARIO',
    '',
    'Últimos 30 días:',
    `- Ingresos: ${bs(data.last30.income)} | Gastos: ${bs(data.last30.expense)} | Balance: ${bs(data.last30.balance)}`,
    `- Tasa de ahorro: ${pct(rate(data.last30.balance, data.last30.income))} | Transacciones: ${data.last30.count}`,
    '',
    'Últimos 7 días:',
    `- Ingresos: ${bs(data.last7.income)} | Gastos: ${bs(data.last7.expense)} | Balance: ${bs(data.last7.balance)}`,
    '',
    `Promedio mensual de los últimos 6 meses (${data.monthsWithData} ${data.monthsWithData === 1 ? 'mes' : 'meses'} con datos):`,
    `- Ingresos: ${bs(monthlyIncome)} | Gastos: ${bs(monthlyExpense)} | Tasa de ahorro: ${pct(rate(data.last180.balance, data.last180.income))}`,
    '',
    'Gastos por categoría en los últimos 30 días (porcentaje del gasto de esos 30 días):',
    ...(data.expenseByCategory30.length
      ? data.expenseByCategory30.map((c) => `- ${c.name}: ${bs(c.total)} (${pct(c.share)})`)
      : ['- Sin gastos registrados']),
    '',
    'Fuentes de ingreso en los últimos 6 meses:',
    ...(data.incomeByCategory180.length
      ? data.incomeByCategory180.map((c) => `- ${c.name}: ${bs(c.total)}`)
      : ['- Sin ingresos registrados']),
    '',
    'Gastos más grandes de los últimos 30 días:',
    ...(data.largestExpenses30.length
      ? data.largestExpenses30.map((t) => `- ${t.description} (${t.category}, ${t.date}): ${bs(t.amount)}`)
      : ['- Ninguno destacado']),
    '',
    'Metas de ahorro activas:',
    ...(data.savingsGoals.length
      ? data.savingsGoals.map((g) => `- ${g.name}: ${bs(g.current)} de ${bs(g.target)} (${g.progress}%)`)
      : ['- Sin metas activas']),
    '',
    `Pagos recurrentes activos (equivalente mensual): ${bs(data.monthlyRecurringCommitments)}` +
      (monthlyIncome > 0 ? ` (${pct(rate(data.monthlyRecurringCommitments, monthlyIncome))} del ingreso mensual promedio)` : ''),
  ];

  return lines.join('\n');
};

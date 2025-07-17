import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function processEmailWithOpenAI(emailText, fromEmail) {
  const prompt = `
Ты опытный менеджер, который умеет извлекать только важную коммерческую информацию из email-сообщений и готовить данные для Google Sheets.

Вот структура таблицы, в которую нужно вставить данные (одна строка на одно письмо):

Site | email | General $ | Casino $ | Betting | Crypto | Content Requirements | Our Email | Full Message

Используй только те данные, которые действительно присутствуют в письме, и вставляй их по соответствующим колонкам. Если что-то отсутствует — оставь пустую строку. Данные должны быть в следующем порядке:

1. Site (или сайт из письма, если указан)
2. Email (если есть)
3. Цена за обычный пост (в евро или долларах)
4. Цена для казино/беттинг/гэмблинг
5. Уточнение про беттинг (если отдельно указано)
6. Уточнение про крипту (если отдельно указано)
7. Требования к контенту (например, длина статьи, наличие изображения и т.п.)
8. Почта, с которой мы отправили: ${fromEmail}
9. Полный текст письма как есть (для архивации)

Ответ должен быть в виде массива **ровно из 9 элементов** — [A, B, C, D, E, F, G, H, I]

--- Текст письма ниже ---
${emailText}
`;

  const chat = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.4
  });

  const response = chat.choices[0].message.content.trim();

  // Попробуем привести его к массиву (если это строка с JSON-массивом)
  try {
    const parsed = JSON.parse(response);
    if (Array.isArray(parsed) && parsed.length === 9) {
      return parsed;
    }
  } catch (e) {
    // Если не JSON — попробуем разобрать вручную (например, если перечисление через переносы)
    return response
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .slice(0, 9); // на всякий случай
  }

  return null;
}
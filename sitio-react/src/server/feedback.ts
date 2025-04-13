import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const FeedbackRequest = z.object({
  feedback: z.string(),
  replayUrl: z.string().optional(),
  discount: z.any().optional(),
  config: z.object({
    savedPaymentMethods: z.array(z.string()),
    savedConditions: z.object({
      jubilados: z.boolean(),
      anses: z.boolean(),
    }),
    filteringByPaymentMethods: z.boolean(),
  }),
});

export const sendFeedback = createServerFn({
  method: "POST",
})
  .validator((data: unknown) => {
    return FeedbackRequest.parse(data);
  })
  .handler(async (req) => {
    try {
      const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
      const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

      if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        throw new Error(
          "TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID deben estar configurados en las variables de entorno."
        );
      }

      const { feedback, replayUrl, config, discount } = req.data;

      const message = `
<b>Nuevo feedback recibido</b>
<b>Feedback:</b> ${feedback}
${replayUrl ? `<b>Replay:</b> <a href="${replayUrl}">${replayUrl}</a>` : ""}
<b>Configuración:</b> ${JSON.stringify(config, null, 2)}
${discount ? `<b>Descuento:</b> ${JSON.stringify(discount, null, 2)}` : ""}
`;

      const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

      const tgRes = await fetch(telegramUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      });

      if (!tgRes.ok) {
        const errorText = await tgRes.text();
        throw new Error(errorText);
      }

      return { success: true };
    } catch (err) {
      console.error(err);
      throw new Error(
        "Hubo un error al enviar el feedback :/ mandanos un mail a hola@nulo.lol"
      );
    }
  });

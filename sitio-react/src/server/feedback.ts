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
      const LINEAR_API_KEY = process.env.LINEAR_API_KEY;
      const LINEAR_TEAM_ID = process.env.LINEAR_TEAM_ID;

      if (!LINEAR_API_KEY || !LINEAR_TEAM_ID) {
        throw new Error(
          "LINEAR_API_KEY y LINEAR_TEAM_ID deben estar configurados en las variables de entorno."
        );
      }

      const { feedback, replayUrl, config, discount } = req.data;

      // Build issue description with structured data
      let description = `## Feedback del usuario\n\n${feedback}\n\n`;
      
      if (replayUrl) {
        description += `## PostHog Session Replay\n[Ver sesión](${replayUrl})\n\n`;
      }
      
      description += `## Configuración del usuario\n\`\`\`json\n${JSON.stringify(config, null, 2)}\n\`\`\`\n\n`;
      
      if (discount) {
        description += `## Descuento relacionado\n\`\`\`json\n${JSON.stringify(discount, null, 2)}\n\`\`\`\n\n`;
      }

      const mutation = `
        mutation IssueCreate($input: IssueCreateInput!) {
          issueCreate(input: $input) {
            success
            issue {
              id
              identifier
              title
            }
          }
        }
      `;

      const variables = {
        input: {
          teamId: LINEAR_TEAM_ID,
          title: `Feedback: ${feedback.substring(0, 60)}${feedback.length > 60 ? '...' : ''}`,
          description: description,
          priority: 3, // Medium priority
          labelIds: ["b88de206-309c-47f1-98af-f202ed33428f"], // "feedback" label
        }
      };

      const linearRes = await fetch('https://api.linear.app/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': LINEAR_API_KEY,
        },
        body: JSON.stringify({
          query: mutation,
          variables: variables,
        }),
      });

      if (!linearRes.ok) {
        const errorText = await linearRes.text();
        throw new Error(`Linear API error: ${errorText}`);
      }

      const linearData = await linearRes.json();
      
      if (linearData.errors) {
        throw new Error(`Linear GraphQL errors: ${JSON.stringify(linearData.errors)}`);
      }

      if (!linearData.data?.issueCreate?.success) {
        throw new Error('Failed to create Linear issue');
      }

      return { 
        success: true, 
        issueId: linearData.data.issueCreate.issue.identifier 
      };
    } catch (err) {
      console.error(err);
      throw new Error(
        "Hubo un error al enviar el feedback :/ mandanos un mail a hola@nulo.lol"
      );
    }
  });

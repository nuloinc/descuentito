import { Button } from "./ui/button";

import { useState } from "react";
import { usePostHog } from "posthog-js/react";
import { sendFeedback } from "@/server/feedback";
import { useMutation } from "@tanstack/react-query";
import { usePaymentMethodsStore } from "@/lib/state";
import { Discount } from "promos-db/schema";
import { Textarea } from "./ui/textarea";

export const FeedbackForm: React.FC<{ discount?: Discount }> = ({
  discount,
}) => {
  const [feedback, setFeedback] = useState("");
  const posthog = usePostHog();

  const { savedPaymentMethods, savedConditions, filteringByPaymentMethods } =
    usePaymentMethodsStore();

  const feedbackMutation = useMutation({
    mutationFn: async () => {
      let replayUrl: string | undefined = undefined;
      try {
        replayUrl = posthog.get_session_replay_url();
      } catch {}

      return sendFeedback({
        data: {
          feedback,
          replayUrl,
          discount,
          config: {
            savedPaymentMethods: Array.from(savedPaymentMethods),
            savedConditions,
            filteringByPaymentMethods,
          },
        },
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    feedbackMutation.mutate();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <Textarea
        placeholder="Describí el error o problema..."
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        required
        disabled={feedbackMutation.isPending}
      />
      <Button
        type="submit"
        disabled={feedbackMutation.isPending || !feedback.trim()}
      >
        {feedbackMutation.isPending ? "Enviando..." : "Enviar reporte"}
      </Button>
      {feedbackMutation.isSuccess && (
        <div className="text-green-600 text-xs mt-1">
          ¡Gracias! El reporte fue enviado.
        </div>
      )}
      {feedbackMutation.isError && (
        <div className="text-red-600 text-xs mt-1">
          {feedbackMutation.error?.message || "Error al enviar el reporte"}
        </div>
      )}
    </form>
  );
};

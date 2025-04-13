import { Button } from "./ui/button";

import { useState } from "react";
import { usePostHog } from "posthog-js/react";
import { sendFeedback } from "@/server/feedback";
import { useMutation } from "@tanstack/react-query";
import { usePaymentMethodsStore } from "@/lib/state";
export const FeedbackForm: React.FC<{}> = ({}) => {
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
      <textarea
        className="border rounded p-2 min-h-[80px] text-sm"
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
        {feedbackMutation.isPending ? "Enviando..." : "Enviar feedback"}
      </Button>
      {feedbackMutation.isSuccess && (
        <div className="text-green-600 text-xs mt-1">
          ¡Gracias! El feedback fue enviado.
        </div>
      )}
      {feedbackMutation.isError && (
        <div className="text-red-600 text-xs mt-1">
          {feedbackMutation.error?.message || "Error al enviar el feedback"}
        </div>
      )}
    </form>
  );
};

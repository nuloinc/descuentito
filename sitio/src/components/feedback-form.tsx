import { Button } from "./ui/button";
import { useState, useEffect } from "react";
import { usePostHog } from "posthog-js/react";
import { sendFeedback, addEmailToFeedback } from "@/server/feedback";
import { useMutation } from "@tanstack/react-query";
import { usePaymentMethodsStore } from "@/lib/state";
import { Discount } from "promos-db/schema";
import { Textarea } from "./ui/textarea";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { CheckCircle, MessageCircleWarning } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";

export const FeedbackForm: React.FC<{
  discount?: Discount;
  trigger?: React.ReactNode;
  title?: string;
  description?: string;
}> = ({ discount, trigger, title, description }) => {
  const [feedback, setFeedback] = useState("");
  const [email, setEmail] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [linearIssueId, setLinearIssueId] = useState<string | null>(null);
  const posthog = usePostHog();

  const { savedPaymentMethods, savedConditions, filteringByPaymentMethods } =
    usePaymentMethodsStore();

  // Load saved email from localStorage on mount
  useEffect(() => {
    const savedEmail = localStorage.getItem("feedback-email");
    if (savedEmail) {
      setEmail(savedEmail);
    }
  }, []);

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
    onSuccess: (data) => {
      setLinearIssueId(data.linearIssueId);
      setShowSuccess(true);
      setFeedback("");
    },
  });

  const emailMutation = useMutation({
    mutationFn: async () => {
      if (!linearIssueId) {
        throw new Error("No issue ID available");
      }
      return addEmailToFeedback({
        data: {
          issueId: linearIssueId,
          email: email.trim(),
        },
      });
    },
    onSuccess: () => {
      // Save email to localStorage
      if (email.trim()) {
        localStorage.setItem("feedback-email", email.trim());
      }
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    feedbackMutation.mutate();
  };

  const handleEmailSubmit = async () => {
    emailMutation.mutate();
  };

  const handleNewFeedback = () => {
    setShowSuccess(false);
    setFeedback("");
    setEmail("");
    setLinearIssueId(null);
    feedbackMutation.reset();
    emailMutation.reset();
  };

  const defaultTrigger = discount ? (
    <div className="flex justify-center">
      <Button variant="outline" className="mx-auto my-2">
        <MessageCircleWarning className="size-5" />
        Reportar un problema
      </Button>
    </div>
  ) : (
    <Button variant="outline" className="text-lg py-6 rounded-full" size="lg">
      <MessageCircleWarning className="size-5" />
      Reportar un problema
    </Button>
  );

  const dialogTitle =
    title ||
    (discount
      ? "Reportar un problema en este descuento"
      : "Reportar un problema");

  const dialogDescription =
    description ||
    (discount
      ? "¿Encontraste un error o algo incorrecto en este descuento? Por favor, contanos qué viste."
      : "¿Encontraste un error o algo incorrecto en la página? Por favor, contanos qué viste.");

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger || defaultTrigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        {showSuccess ? (
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col items-center gap-2 text-center">
              <CheckCircle className="h-12 w-12 text-green-600" />
              <h3 className="text-lg font-semibold text-green-800 dark:text-green-400">
                ¡Reporte enviado!
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Gracias por tu feedback.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  Email para seguimiento (opcional)
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={emailMutation.isPending}
                />
                <p className="text-xs text-gray-500">
                  Te contactaremos para resolver el problema.
                </p>
              </div>

              {emailMutation.isSuccess && (
                <div className="text-green-600 text-xs">
                  ¡Email agregado! Te contactaremos pronto.
                </div>
              )}
              {emailMutation.isError && (
                <div className="text-red-600 text-xs">
                  {emailMutation.error?.message || "Error al agregar el email"}
                </div>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="feedback" className="text-sm font-medium">
                Describí el problema
              </Label>
              <Textarea
                id="feedback"
                placeholder="Describí el error o problema..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                required
                disabled={feedbackMutation.isPending}
                rows={4}
                autoFocus
              />
            </div>

            {feedbackMutation.isError && (
              <div className="text-red-600 text-xs mt-1">
                {feedbackMutation.error?.message ||
                  "Error al enviar el reporte"}
              </div>
            )}
          </form>
        )}

        <DialogFooter>
          {showSuccess ? (
            <div className="flex gap-2 w-full">
              <Button
                disabled={emailMutation.isPending || !email.trim()}
                onClick={handleEmailSubmit}
                className="flex-1"
              >
                {emailMutation.isPending ? "Agregando..." : "Agregar email"}
              </Button>
              <Button
                variant="outline"
                onClick={handleNewFeedback}
                className="flex-1"
              >
                Otro reporte
              </Button>
            </div>
          ) : (
            <div className="flex gap-2 w-full">
              <Button
                type="submit"
                disabled={feedbackMutation.isPending || !feedback.trim()}
                onClick={handleSubmit}
                className="flex-1"
              >
                {feedbackMutation.isPending ? "Enviando..." : "Enviar reporte"}
              </Button>
              <DialogClose asChild>
                <Button variant="outline" className="flex-1">
                  Cancelar
                </Button>
              </DialogClose>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

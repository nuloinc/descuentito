import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PaymentMethod } from "promos-db/schema";
import { PAYMENT_METHODS, JOIN_GROUPS } from "promos-db/schema";
import { WALLET_ICONS } from "@/lib/logos";
import {
  ChevronRight,
  CreditCard,
  Sparkles,
  Check,
  AlertCircle,
} from "lucide-react";

type WizardStep =
  | "welcome"
  | "disclaimer"
  | "banks"
  | "creditCards"
  | "digitalWallets"
  | "conditions"
  | "complete";

export function PaymentMethodWizard({
  onComplete,
  onSelectPaymentMethod,
  selectedMethods,
  onSelectCondition,
  selectedConditions,
}: {
  onComplete: () => void;
  onSelectPaymentMethod: (method: PaymentMethod, selected: boolean) => void;
  selectedMethods: Set<PaymentMethod>;
  onSelectCondition: (
    condition: "jubilados" | "anses",
    selected: boolean
  ) => void;
  selectedConditions: { jubilados: boolean; anses: boolean };
}) {
  const [step, setStep] = useState<WizardStep>("welcome");
  const [direction, setDirection] = useState<"right" | "left">("right");
  const [visibleMessageCount, setVisibleMessageCount] = useState(0);

  // Group payment methods by category
  const bankMethods = PAYMENT_METHODS.filter((method) =>
    method.startsWith("Banco")
  );

  const creditCardMethods = PAYMENT_METHODS.filter(
    (method) => method.startsWith("Tarjeta") || method === "NaranjaX"
  );

  const digitalWalletMethods = PAYMENT_METHODS.filter(
    (method) =>
      method === "Mercado Pago" ||
      method === "Uala" ||
      method === "Cuenta DNI" ||
      method === "Personal Pay" ||
      method === ".Reba" ||
      method === "Prex"
  );

  // Messages for the chat interface
  const chatMessages = {
    welcome: [
      {
        text: "¡Hola! Soy Descuentin, tu asistente para encontrar los mejores descuentos en supermercados 🛒",
        isUser: false,
      },
      {
        text: "Te voy a ayudar a configurar tus medios de pago para mostrarte solo los descuentos que te sirven",
        isUser: false,
      },
    ],
    disclaimer: [
      {
        text: "¡Importante! Siempre verifica los detalles del descuento en la página oficial del supermercado.",
        isUser: false,
      },
      {
        text: "Las promociones pueden cambiar y a veces tienen requisitos específicos que podrían no estar actualizados aquí.",
        isUser: false,
      },
      {
        text: "¿Entendido?",
        isUser: false,
      },
    ],
    banks: [
      {
        text: "¿Con qué bancos trabajás? Selecciona todos los que usas.",
        isUser: false,
      },
    ],
    creditCards: [
      {
        text: "¿Qué tarjetas de crédito tenés? Selecciona todas las que usas.",
        isUser: false,
      },
    ],
    digitalWallets: [
      {
        text: "¿Usás alguna de estas billeteras digitales? Selecciona todas las que usas.",
        isUser: false,
      },
    ],
    conditions: [
      {
        text: "Última pregunta, ¿aplicas para alguna de estas condiciones especiales?",
        isUser: false,
      },
    ],
    complete: [
      {
        text: "¡Genial! Ya configuré tus preferencias.",
        isUser: false,
      },
      {
        text: "Ahora vas a ver descuentos personalizados según tus medios de pago.",
        isUser: false,
      },
    ],
  };

  // Reset visible message count when step changes
  useEffect(() => {
    setVisibleMessageCount(0);
    const messages = chatMessages[step] || [];

    // Gradually reveal messages
    messages.forEach((_, index) => {
      setTimeout(
        () => {
          setVisibleMessageCount((prev) => Math.min(prev + 1, messages.length));
        },
        400 * (index + 1)
      );
    });
  }, [step]);

  const renderMethodsList = (methods: PaymentMethod[]) => {
    return (
      <motion.div
        className="grid grid-cols-1 gap-2 mt-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        {methods.map((method, index) => (
          <motion.div
            key={method}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 * index }}
          >
            <Button
              variant={selectedMethods.has(method) ? "default" : "outline"}
              className={cn(
                "flex items-center justify-start gap-2 p-3 h-auto w-full",
                selectedMethods.has(method)
                  ? "bg-primary text-primary-foreground"
                  : ""
              )}
              onClick={() =>
                onSelectPaymentMethod(method, !selectedMethods.has(method))
              }
            >
              {method in WALLET_ICONS ? (
                <img
                  src={WALLET_ICONS[method]}
                  alt={method}
                  className="h-6 w-auto rounded-sm"
                />
              ) : (
                <CreditCard className="h-5 w-5" />
              )}
              <span className="flex-grow text-left">{method}</span>
              {selectedMethods.has(method) && <Check className="h-5 w-5" />}
            </Button>
          </motion.div>
        ))}
      </motion.div>
    );
  };

  const renderCurrentStep = () => {
    switch (step) {
      case "welcome":
      case "disclaimer":
        return null;
      case "banks":
        return renderMethodsList(bankMethods);
      case "creditCards":
        return renderMethodsList(creditCardMethods);
      case "digitalWallets":
        return renderMethodsList(digitalWalletMethods);
      case "conditions":
        return (
          <motion.div
            className="grid grid-cols-1 gap-2 mt-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
            >
              <Button
                variant={selectedConditions.jubilados ? "default" : "outline"}
                className="flex items-center justify-start gap-2 p-3 h-auto w-full"
                onClick={() =>
                  onSelectCondition("jubilados", !selectedConditions.jubilados)
                }
              >
                <span className="flex-grow text-left">Soy jubilado/a</span>
                {selectedConditions.jubilados && <Check className="h-5 w-5" />}
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <Button
                variant={selectedConditions.anses ? "default" : "outline"}
                className="flex items-center justify-start gap-2 p-3 h-auto w-full"
                onClick={() =>
                  onSelectCondition("anses", !selectedConditions.anses)
                }
              >
                <span className="flex-grow text-left">
                  Recibo beneficios de ANSES
                </span>
                {selectedConditions.anses && <Check className="h-5 w-5" />}
              </Button>
            </motion.div>
          </motion.div>
        );
      default:
        return null;
    }
  };

  const renderChatMessages = () => {
    const messages = chatMessages[step] || [];

    return (
      <div className="flex flex-col gap-2 mb-4">
        <AnimatePresence>
          {messages.slice(0, visibleMessageCount).map((message, index) => (
            <motion.div
              key={`${step}-${index}`}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className={cn(
                "flex items-start gap-2",
                message.isUser ? "justify-end" : "justify-start"
              )}
            >
              {!message.isUser && (
                <div className="flex-shrink-0 h-8 w-8 overflow-hidden rounded-full bg-primary/10">
                  <img
                    src="/descuentin.svg"
                    alt="Descuentin"
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              <div
                className={cn(
                  "rounded-lg px-3 py-2 max-w-[85%]",
                  message.isUser
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                {message.text}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    );
  };

  const handleNextStep = () => {
    const stepOrder: WizardStep[] = [
      "welcome",
      "disclaimer",
      "banks",
      "creditCards",
      "digitalWallets",
      "conditions",
      "complete",
    ];

    const currentIndex = stepOrder.indexOf(step);
    setDirection("right");

    switch (step) {
      case "welcome":
        setStep("disclaimer");
        break;
      case "disclaimer":
        setStep("banks");
        break;
      case "banks":
        setStep("creditCards");
        break;
      case "creditCards":
        setStep("digitalWallets");
        break;
      case "digitalWallets":
        setStep("conditions");
        break;
      case "conditions":
        setStep("complete");
        break;
      case "complete":
        onComplete();
        break;
    }
  };

  const pageVariants = {
    initial: (direction: string) => ({
      x: direction === "right" ? 300 : -300,
      opacity: 0,
    }),
    animate: {
      x: 0,
      opacity: 1,
      transition: {
        x: { type: "spring", stiffness: 300, damping: 30 },
        opacity: { duration: 0.2 },
      },
    },
    exit: (direction: string) => ({
      x: direction === "right" ? -300 : 300,
      opacity: 0,
      transition: {
        x: { type: "spring", stiffness: 300, damping: 30 },
        opacity: { duration: 0.2 },
      },
    }),
  };

  return (
    <motion.div
      className="flex flex-col mx-auto max-w-md w-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={step}
          custom={direction}
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          <Card className="p-4 mb-4 shadow-lg">
            {renderChatMessages()}

            {step === "disclaimer" && (
              <motion.div
                className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 dark:bg-amber-950/30 dark:border-amber-800"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.3 }}
              >
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    Las promociones pueden variar según la sucursal, fecha y
                    otras condiciones. ¡Siempre verificá en la web oficial!
                  </p>
                </div>
              </motion.div>
            )}

            {renderCurrentStep()}

            <motion.div
              className="flex justify-end mt-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.3 }}
            >
              <Button
                onClick={handleNextStep}
                className={cn(
                  "transition-all",
                  step === "complete" ? "bg-green-600 hover:bg-green-700" : ""
                )}
              >
                {step === "complete" ? (
                  <>
                    Comenzar <Sparkles className="ml-2 h-4 w-4" />
                  </>
                ) : (
                  <>
                    Siguiente <ChevronRight className="ml-1 h-4 w-4" />
                  </>
                )}
              </Button>
            </motion.div>
          </Card>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

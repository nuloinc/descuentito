import {
  createFileRoute,
  Link,
  useNavigate,
  createLink,
} from "@tanstack/react-router";
import { useState, useEffect, forwardRef, HTMLAttributes } from "react";
import { motion, AnimatePresence, MotionProps, m } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PaymentMethod } from "promos-db/schema";
import { PAYMENT_METHODS, JOIN_GROUPS } from "promos-db/schema";
import { WALLET_ICONS } from "@/lib/logos";
import { usePaymentMethodsStore } from "@/lib/state";
import {
  ChevronRight,
  CreditCard,
  Sparkles,
  Check,
  AlertCircle,
  ArrowLeft,
  Home,
  Loader2,
  Wallet,
} from "lucide-react";
import { useIsClient } from "@/lib/utils";
import { usePostHog } from "posthog-js/react";
import { ALL_MEMBERSHIPS } from "@/lib/memberships";

type WizardStepId =
  | "welcome"
  | "disclaimer"
  | "banks"
  | "cards"
  | "digitalWallets"
  | "conditions"
  | "memberships"
  | "complete";

const WIZARD_STEP_ORDER: WizardStepId[] = [
  "welcome",
  "disclaimer",
  "banks",
  "cards",
  "digitalWallets",
  "conditions",
  "memberships",
  "complete",
];

const MotionLinkForwardRef = forwardRef<
  HTMLAnchorElement,
  MotionProps & HTMLAttributes<HTMLAnchorElement>
>((props, ref) => <m.a {...props} ref={ref} />);
MotionLinkForwardRef.displayName = "MotionLinkForwardRef";
const MotionLink = createLink(MotionLinkForwardRef);

const GROUP_MAP = new Map<PaymentMethod, PaymentMethod[]>();
const CHILD_TO_PARENT = new Map<PaymentMethod, PaymentMethod>();
JOIN_GROUPS.forEach(([parent, ...children]) => {
  if (!parent) return;
  GROUP_MAP.set(parent, children);
  children.forEach((child) => CHILD_TO_PARENT.set(child, parent));
});

type HierarchicalMethod = {
  method: PaymentMethod;
  isParent: boolean;
  children?: PaymentMethod[];
};

function buildHierarchy(methods: PaymentMethod[]): HierarchicalMethod[] {
  const result: HierarchicalMethod[] = [];
  const seen = new Set<PaymentMethod>();

  for (const m of methods) {
    if (seen.has(m)) continue;
    const parent = CHILD_TO_PARENT.get(m);
    if (parent && !seen.has(parent)) {
      const children = GROUP_MAP.get(parent) || [];
      result.push({ method: parent, isParent: true, children });
      children.forEach((c) => seen.add(c));
      seen.add(parent);
    } else if (GROUP_MAP.has(m)) {
      const children = GROUP_MAP.get(m) || [];
      result.push({ method: m, isParent: true, children });
      children.forEach((c) => seen.add(c));
      seen.add(m);
    } else {
      result.push({ method: m, isParent: false });
      seen.add(m);
    }
  }
  return result;
}

const CATEGORY_FILTERS = {
  banks: (m: PaymentMethod) =>
    m.startsWith("Banco") ||
    m === "Sidecreer" ||
    m === "BanCo (Banco de Corrientes)",
  cards: (m: PaymentMethod) =>
    m.startsWith("Tarjeta") || ["MODO", "Tarjeta American Express"].includes(m),
  digitalWallets: (m: PaymentMethod) =>
    [
      "Mercado Pago",
      "Uala",
      "Cuenta DNI",
      "Personal Pay",
      "Personal Pay - Nivel 1",
      "Personal Pay - Nivel 2",
      "Personal Pay - Nivel 3",
      ".Reba",
      ".Reba - Black",
      "Prex",
      "Yoy",
      "Cencopay",
      "Uilo",
      "NaranjaX",
    ].includes(m),
} as const;

const HIERARCHY = Object.fromEntries(
  (["banks", "cards", "digitalWallets"] as const).map((step) => [
    step,
    buildHierarchy(PAYMENT_METHODS.filter(CATEGORY_FILTERS[step])),
  ]),
) as Record<"banks" | "cards" | "digitalWallets", HierarchicalMethod[]>;

const chatMessages: Record<
  WizardStepId,
  Array<{ text: string; isUser: boolean }>
> = {
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
      text: "¡Importante! Siempre verificá los detalles del descuento en la página oficial del supermercado.",
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
  cards: [
    {
      text: "¿Qué medios de pago tenés? Selecciona todas las que usas.",
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
      text: "¿Aplicas para alguna de estas condiciones especiales?",
      isUser: false,
    },
  ],
  memberships: [
    {
      text: "¿Tenés alguna de estas membresías o programas de descuentos?",
      isUser: false,
    },
    {
      text: "Esto me permite mostrarte descuentos exclusivos para miembros.",
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

const getAdjacentStep = (
  currentStep: WizardStepId,
  direction: "next" | "prev",
): WizardStepId | null => {
  const currentIndex = WIZARD_STEP_ORDER.indexOf(currentStep);
  if (currentIndex === -1) return null;

  const nextIndex = direction === "next" ? currentIndex + 1 : currentIndex - 1;

  if (nextIndex >= 0 && nextIndex < WIZARD_STEP_ORDER.length) {
    return WIZARD_STEP_ORDER[nextIndex];
  }
  return null;
};

export const Route = createFileRoute("/configuracion/medios/wizard/$step")({
  component: WizardStepComponent,
});

function WizardStepComponent() {
  const posthog = usePostHog();
  const params = Route.useParams();
  const navigate = useNavigate({ from: Route.fullPath });
  const isClient = useIsClient();

  const {
    savedPaymentMethods,
    addPaymentMethod,
    removePaymentMethod,
    savedConditions,
    setSavedCondition,
    savedMemberships,
    addMembership,
    removeMembership,
    setMembershipSetupCompleted,
  } = usePaymentMethodsStore();

  const [direction, setDirection] = useState<"right" | "left">("right");
  const hierarchicalMethodsMap = HIERARCHY;

  const step: WizardStepId = WIZARD_STEP_ORDER.includes(
    params.step as WizardStepId,
  )
    ? (params.step as WizardStepId)
    : "welcome";

  useEffect(() => {
    posthog.capture("wizard_step", { step });
    if (params.step !== step) {
      navigate({
        to: "/configuracion/medios/wizard/$step",
        params: { step: "welcome" },
        replace: true,
      });
    }
    // Mark membership setup as completed when reaching the complete step
    if (step === "complete") {
      setMembershipSetupCompleted(true);
    }
  }, [params.step, step, navigate, setMembershipSetupCompleted]);

  const renderMethodsList = (hierarchicalMethods: HierarchicalMethod[]) => (
    <motion.div
      className="flex flex-col gap-2 mt-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {hierarchicalMethods.map(({ method, isParent, children = [] }, index) => {
        const isSelected = savedPaymentMethods.has(method);
        const isExpanded = isParent && isSelected;
        const hasSelectedChildren =
          isParent && children.some((child) => savedPaymentMethods.has(child));
        const buttonVariant = isSelected
          ? "default"
          : hasSelectedChildren
            ? "secondary"
            : "outline";

        return (
          <motion.div
            key={method}
            className="flex flex-col"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 * index }}
          >
            <Button
              variant={buttonVariant}
              className={cn(
                "flex items-center justify-start gap-2 p-3 h-auto w-full border whitespace-normal",
                isParent && "font-medium",
              )}
              onClick={() => {
                if (isParent) {
                  if (isSelected) {
                    removePaymentMethod(method);
                    children.forEach((child) => removePaymentMethod(child));
                  } else {
                    addPaymentMethod(method);
                  }
                } else {
                  isSelected
                    ? removePaymentMethod(method)
                    : addPaymentMethod(method);
                }
              }}
            >
              {method in WALLET_ICONS ? (
                <img
                  src={WALLET_ICONS[method as keyof typeof WALLET_ICONS]}
                  alt={method}
                  className="h-6 w-auto rounded-sm mr-1"
                />
              ) : method.startsWith("Tarjeta") ? (
                <CreditCard className="size-6 mr-1 p-0.5 bg-primary text-primary-foreground rounded-sm" />
              ) : (
                <Wallet className="size-6 mr-1 p-0.5 bg-primary text-primary-foreground rounded-sm" />
              )}
              <span className="flex-grow text-left">{method}</span>
              {!isParent && savedPaymentMethods.has(method) && (
                <Check className="h-5 w-5 text-primary-foreground" />
              )}
              {isParent && savedPaymentMethods.has(method) && (
                <Check className="h-5 w-5" />
              )}
              {!savedPaymentMethods.has(method) && (
                // placeholder
                <span className="size-4 block flex-shrink-0"></span>
              )}
              {isParent && (
                <ChevronRight
                  className={cn(
                    "h-5 w-5 transition-transform duration-200",
                    isExpanded && "rotate-90",
                  )}
                />
              )}
            </Button>

            <AnimatePresence>
              {isParent && isExpanded && (
                <motion.div
                  className="flex flex-col gap-1.5 pl-6 pt-1.5"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {children.map((childMethod) => (
                    <Button
                      key={childMethod}
                      variant={
                        savedPaymentMethods.has(childMethod)
                          ? "default"
                          : "outline"
                      }
                      className="flex items-center justify-start gap-2 p-2.5 h-auto w-full border text-sm"
                      onClick={() =>
                        savedPaymentMethods.has(childMethod)
                          ? removePaymentMethod(childMethod)
                          : addPaymentMethod(childMethod)
                      }
                    >
                      {childMethod in WALLET_ICONS ? (
                        <img
                          src={
                            WALLET_ICONS[
                              childMethod as keyof typeof WALLET_ICONS
                            ]
                          }
                          alt={childMethod}
                          className="h-5 w-auto rounded-sm mr-1"
                        />
                      ) : (
                        <CreditCard className="h-4 w-4 mr-1" />
                      )}
                      <span className="flex-grow text-left">
                        {childMethod.replace(method + " - ", "")}
                      </span>
                      {savedPaymentMethods.has(childMethod) && (
                        <Check className="h-5 w-5" />
                      )}
                    </Button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </motion.div>
  );

  const renderCurrentStepContent = () => {
    switch (step) {
      case "welcome":
      case "disclaimer":
        return null;
      case "banks":
      case "cards":
      case "digitalWallets":
        return renderMethodsList(hierarchicalMethodsMap[step]);
      case "conditions":
        return (
          <motion.div
            className="grid grid-cols-1 gap-2 mt-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            {[
              { key: "jubilados", label: "Soy jubilado/a" },
              { key: "anses", label: "Recibo beneficios de ANSES" },
            ].map(({ key, label }, i) => (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.05 * (i + 1) }}
              >
                <Button
                  variant={
                    savedConditions[key as keyof typeof savedConditions]
                      ? "default"
                      : "outline"
                  }
                  className="flex items-center justify-start gap-2 p-3 h-auto w-full"
                  onClick={() =>
                    setSavedCondition(
                      key as keyof typeof savedConditions,
                      !savedConditions[key as keyof typeof savedConditions],
                    )
                  }
                >
                  <span className="flex-grow text-left">{label}</span>
                  {savedConditions[key as keyof typeof savedConditions] && (
                    <Check className="h-5 w-5" />
                  )}
                </Button>
              </motion.div>
            ))}
          </motion.div>
        );
      case "memberships":
        return (
          <motion.div
            className="grid grid-cols-1 gap-2 mt-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            {ALL_MEMBERSHIPS.map((membership, i) => (
              <motion.div
                key={membership}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.05 * (i + 1) }}
              >
                <Button
                  variant={
                    savedMemberships.has(membership) ? "default" : "outline"
                  }
                  className="flex items-center justify-start gap-2 p-3 h-auto w-full"
                  onClick={() =>
                    savedMemberships.has(membership)
                      ? removeMembership(membership)
                      : addMembership(membership)
                  }
                >
                  <Wallet className="h-5 w-5 flex-shrink-0" />
                  <span className="flex-grow text-left">{membership}</span>
                  {savedMemberships.has(membership) && (
                    <Check className="h-5 w-5" />
                  )}
                </Button>
              </motion.div>
            ))}
          </motion.div>
        );
      case "complete":
        return (
          <motion.div
            className="grid grid-cols-6 gap-4 mt-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            {Array.from(savedPaymentMethods)
              .filter((method) => method in WALLET_ICONS)
              .map(
                (method) => WALLET_ICONS[method as keyof typeof WALLET_ICONS],
              )
              .filter((logo, index, array) => array.indexOf(logo) === index)
              .map((logo, i) => (
                <motion.div
                  key={logo}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: 0.1 * i + 0.3 }}
                  className="flex items-center justify-center"
                >
                  <img
                    src={logo}
                    alt={logo}
                    className="w-12 h-auto rounded-lg"
                  />
                </motion.div>
              ))}
          </motion.div>
        );
      default:
        return null;
    }
  };

  const renderChatMessages = () => (
    <div className="flex flex-col gap-2 mb-4">
      <AnimatePresence>
        {chatMessages[step].map((message, index) => (
          <motion.div
            key={`${step}-${index}`}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3, delay: 0.2 * index }}
            className={cn(
              "flex items-start gap-2",
              message.isUser ? "justify-end" : "justify-start",
            )}
          >
            {!message.isUser && (
              <div className="flex-shrink-0">
                <img
                  src="/descuentin.svg"
                  alt="Descuentin"
                  className="object-cover w-10"
                />
              </div>
            )}
            <div
              className={cn(
                "rounded-lg px-3 py-2 max-w-[85%] relative",
                message.isUser
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted before:content-[''] before:absolute before:left-[-8px] before:top-0 before:w-4 before:h-4 before:bg-muted before:rounded-bl-lg before:[clip-path:polygon(0_0,100%_100%,100%_0)]",
              )}
            >
              {message.text}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );

  const pageVariants = {
    initial: (direction: string) => ({
      x: direction === "right" ? 300 : -300,
      opacity: 0,
    }),
    animate: {
      x: 0,
      opacity: 1,
      transition: {
        x: { type: "spring", stiffness: 500, damping: 40 },
        opacity: { duration: 0.2 },
      },
    },
    exit: (direction: string) => ({
      x: direction === "right" ? -300 : 300,
      opacity: 0,
      transition: {
        x: { type: "spring", stiffness: 500, damping: 40 },
        opacity: { duration: 0.2 },
      },
    }),
  };

  if (!isClient)
    return (
      <div className="min-h-screen bg-background">
        <div className="flex items-center justify-center h-full p-8">
          <Loader2 className="h-10 w-10 animate-spin" />
        </div>
      </div>
    );

  const nextStep = getAdjacentStep(step, "next");
  const prevStep = getAdjacentStep(step, "prev");

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-10 flex items-center gap-2 border-b p-2 bg-sidebar">
        <div className="flex items-center gap-2 max-w-md w-full mx-auto">
          {prevStep ? (
            <Link
              to={`/configuracion/medios/wizard/$step`}
              params={{ step: prevStep }}
              onClick={() => {
                setDirection("left");
                setTimeout(() => {
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }, 100);
              }}
              className="p-1"
            >
              <ArrowLeft className="h-6 w-6" />
            </Link>
          ) : (
            <Link to="/" className="p-1">
              <Home className="h-6 w-6" />
            </Link>
          )}
          <span className="flex-grow text-center font-medium">
            Configuración Inicial
          </span>
          <div className="w-8 h-8" />
        </div>
      </nav>

      <div className="container mx-auto p-4 pt-6 max-w-md">
        <motion.div
          className="flex flex-col mx-auto w-full"
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
              {renderChatMessages()}

              {step === "disclaimer" && (
                <motion.div
                  className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 dark:bg-amber-950/30 dark:border-amber-800"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.3 }}
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

              {renderCurrentStepContent()}

              <motion.div
                className="flex justify-end mt-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.3 }}
              >
                {step === "complete" ? (
                  <Button
                    onClick={() => {
                      localStorage.setItem("descuentito_wizard_seen", "true");
                      posthog.capture("wizard_complete");
                      navigate({ to: "/", search: { supermarket: undefined } });
                    }}
                    className="bg-green-600 hover:bg-green-700 transition-all"
                  >
                    Comenzar <Sparkles className="ml-2 h-4 w-4" />
                  </Button>
                ) : nextStep ? (
                  <Button
                    asChild
                    className="transition-all"
                    onClick={() => {
                      setDirection("right");
                      setTimeout(() => {
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }, 100);
                    }}
                  >
                    <Link
                      to={`/configuracion/medios/wizard/$step`}
                      params={{ step: nextStep }}
                      resetScroll
                    >
                      Siguiente <ChevronRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                ) : null}
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { usePaymentMethodsStore } from "src/lib/state";
import { PAYMENT_METHODS, JOIN_GROUPS } from "promos-db/schema";
import type { PaymentMethod } from "promos-db/schema";
import { WALLET_ICONS } from "src/lib/logos";
import { Button } from "src/components/ui/button";
import { Checkbox } from "src/components/ui/checkbox";
import { Label } from "src/components/ui/label";
import { cn, useIsClient } from "src/lib/utils";
import { Switch } from "@/components/ui/switch";

type SubOptionDisplay = {
  id: PaymentMethod;
  question: string; // Generated question
};

type BankOptionDisplay = {
  id: PaymentMethod;
  name: string; // Display name
  subOptions?: SubOptionDisplay[];
};

function buildDisplayOptions(
  allMethods: readonly PaymentMethod[],
  groups: ReadonlyArray<readonly PaymentMethod[]>
): BankOptionDisplay[] {
  const optionsMap = new Map<PaymentMethod, BankOptionDisplay>();
  const allGroupChildren = new Set<PaymentMethod>();

  for (const method of allMethods) {
    optionsMap.set(method, { id: method, name: method, subOptions: [] });
  }

  for (const group of groups) {
    if (group.length > 1) {
      const parentId = group[0];
      const parentOption = optionsMap.get(parentId);
      if (!parentOption) continue; // Skip if parent doesn't exist

      for (let i = 1; i < group.length; i++) {
        const childId = group[i];
        allGroupChildren.add(childId); // Mark as child
        const childOption = optionsMap.get(childId);
        if (!childOption) continue; // Skip if child doesn't exist

        let question = `¿Especificación: ${childId.replace(parentId, "").trim()}?`;
        if (childId.includes("Eminent")) question = "¿Sos cliente Eminent?";
        if (childId.includes("PLATINUM")) question = "¿Tenés tarjeta Platinum?";
        if (childId.includes("Selecta")) question = "¿Tenés tarjeta Selecta?";
        if (childId.includes("Plan Sueldo")) question = "¿Tenés Plan Sueldo?";
        if (childId.includes("Jubilados")) question = "¿Sos Jubilado/a?";
        if (childId.includes("Women")) question = "¿Tarjeta Women?";
        if (childId.includes("Cliente Payroll"))
          question = "¿Sos Cliente Payroll?";
        if (childId.includes("Identité")) question = "¿Sos cliente Identité?";
        if (childId.includes("Búho")) question = "¿Tenés cuenta Búho?";
        if (childId.includes("Black")) question = "¿Tarjeta Black?";
        if (childId.includes("Nativa")) question = "¿Tarjeta Nativa?";

        parentOption.subOptions?.push({ id: childId, question });
      }
      // Clean up empty subOptions array if no children were actually added
      if (parentOption.subOptions?.length === 0) {
        parentOption.subOptions = undefined;
      }
    }
  }

  // Filter out children that are already included as sub-options
  const finalOptions = Array.from(optionsMap.values()).filter(
    (opt) => !allGroupChildren.has(opt.id)
  );

  return finalOptions;
}

export const Route = createFileRoute("/configuracion/medios/")({
  component: PaymentMethodsConfig,
});

function PaymentMethodsConfig() {
  const {
    savedPaymentMethods,
    addPaymentMethod,
    removePaymentMethod,
    savedConditions,
    setSavedCondition,
    showingPaymentMethodsInDiscountCard,
    setShowingPaymentMethodsInDiscountCard,
  } = usePaymentMethodsStore();

  const isClient = useIsClient();

  useEffect(() => {
    if (!isClient) return; // Only run on client
    if (window.location.pathname === "/configuracion/medios/wizard/welcome")
      return;

    const hasSeenWizard = localStorage.getItem("descuentito_wizard_seen");
    if (!hasSeenWizard) {
      window.location.replace("/configuracion/medios/wizard/welcome");
    }
  }, [isClient]);

  // Process payment method options
  const displayOptions = buildDisplayOptions(PAYMENT_METHODS, JOIN_GROUPS);

  // Update the store when checkboxes are toggled
  const updateStore = (method: PaymentMethod, isChecked: boolean) => {
    if (isChecked) {
      addPaymentMethod(method);
    } else {
      removePaymentMethod(method);
      // Remove any child options when parent is unchecked
      const bank = displayOptions.find((opt) => opt.id === method);
      if (bank?.subOptions) {
        bank.subOptions.forEach((subOption) => {
          if (savedPaymentMethods.has(subOption.id)) {
            removePaymentMethod(subOption.id);
          }
        });
      }
    }
  };

  if (!isClient) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex items-center justify-center h-screen p-8">
          <Loader2 className="h-10 w-10 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-10 flex items-center gap-2 border-b p-2 bg-sidebar">
        <div className="flex items-center gap-2 max-w-md w-full mx-auto">
          <Link to="/">
            <ArrowLeft className="h-7 w-7" />
          </Link>
          <span className="flex-grow text-left font-medium">
            Medios de pago
          </span>
        </div>
      </nav>

      <div className="container mx-auto max-w-md p-4">
        <div className="mb-6 space-y-4">
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <Checkbox
                id="jubilados"
                checked={savedConditions.jubilados}
                onCheckedChange={(checked) =>
                  setSavedCondition("jubilados", checked === true)
                }
              />
              <Label htmlFor="jubilados" className="font-medium">
                Soy jubilado/a
              </Label>
            </div>
            <div className="flex items-center space-x-3">
              <Checkbox
                id="anses"
                checked={savedConditions.anses}
                onCheckedChange={(checked) =>
                  setSavedCondition("anses", checked === true)
                }
              />
              <Label htmlFor="anses" className="font-medium">
                Recibo beneficios de ANSES
              </Label>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {displayOptions.map((bank) => {
            const bankId = `bank-${bank.id}`;
            const isBankChecked = savedPaymentMethods.has(bank.id);

            return (
              <div key={bank.id} className="flex items-stretch space-x-3">
                <Checkbox
                  id={bankId}
                  checked={isBankChecked}
                  onCheckedChange={(checked) =>
                    updateStore(bank.id, checked === true)
                  }
                  className="mt-1"
                />
                <div className="grid flex-grow gap-1.5">
                  <Label
                    htmlFor={bankId}
                    className="flex items-center gap-2 font-medium"
                  >
                    {bank.id in WALLET_ICONS && (
                      <img
                        src={WALLET_ICONS[bank.id as keyof typeof WALLET_ICONS]}
                        alt={bank.name}
                        className="h-6 w-auto rounded-sm"
                      />
                    )}
                    <span className="flex-grow leading-relaxed">
                      {bank.name}
                    </span>
                  </Label>
                  {isBankChecked &&
                    bank.subOptions &&
                    bank.subOptions.length > 0 && (
                      <div className="mt-2 space-y-3 pl-6">
                        {bank.subOptions.map((subOption) => {
                          const subOptionId = `sub-${subOption.id}`;
                          const isSubChecked = savedPaymentMethods.has(
                            subOption.id
                          );
                          return (
                            <div
                              key={subOption.id}
                              className="flex items-center space-x-3"
                            >
                              <Checkbox
                                id={subOptionId}
                                checked={isSubChecked}
                                onCheckedChange={(checked) =>
                                  updateStore(subOption.id, checked === true)
                                }
                              />
                              <Label
                                htmlFor={subOptionId}
                                className="text-sm font-normal"
                              >
                                {subOption.question}
                              </Label>
                            </div>
                          );
                        })}
                      </div>
                    )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center space-x-3 mt-8 mb-6">
          <Switch
            id="mostrar-en-descuentos"
            checked={showingPaymentMethodsInDiscountCard}
            onCheckedChange={(checked) =>
              setShowingPaymentMethodsInDiscountCard(checked === true)
            }
          />
          <Label htmlFor="mostrar-en-descuentos" className="">
            Mostrar medios de pago en descuentos
          </Label>
        </div>
      </div>
      <div className="mt-2 flex justify-end sticky bottom-0 border-t p-4 bg-background">
        <Button variant="default" asChild>
          <Link
            to="/"
            replace
            preload="intent"
            className="w-full max-w-sm mx-auto"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a descuentos
          </Link>
        </Button>
      </div>
    </div>
  );
}

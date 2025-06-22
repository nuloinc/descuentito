import React from "react";
import { Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Wallet, X, ArrowRight } from "lucide-react";
import { usePaymentMethodsStore } from "@/lib/state";

interface MembershipSetupPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MembershipSetupPopup: React.FC<MembershipSetupPopupProps> = ({
  isOpen,
  onClose,
}) => {
  const { setMembershipSetupCompleted } = usePaymentMethodsStore();

  const handleSkip = () => {
    setMembershipSetupCompleted(true);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50"
            onClick={onClose}
          />
          
          {/* Popup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", duration: 0.3 }}
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-md mx-auto"
          >
            <div className="bg-background border rounded-lg shadow-lg p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Wallet className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">¡Configurá tus membresías!</h3>
                    <p className="text-sm text-muted-foreground">
                      Aprovechá descuentos exclusivos
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={onClose}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-3 mb-6">
                <p className="text-sm text-muted-foreground">
                  Configuraste tus medios de pago, pero falta algo importante:
                </p>
                
                <div className="flex flex-wrap gap-1">
                  {["Club La Nación", "Clarín 365", "Mi Carrefour"].map((membership) => (
                    <Badge key={membership} variant="secondary" className="text-xs">
                      {membership}
                    </Badge>
                  ))}
                  <Badge variant="outline" className="text-xs">
                    +3 más
                  </Badge>
                </div>

                <p className="text-sm">
                  <strong>¿Tenés alguna membresía?</strong> Te mostramos descuentos exclusivos que podrías estar perdiendo.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Button asChild className="w-full">
                  <Link
                    to="/configuracion/medios/wizard/$step"
                    params={{ step: "memberships" }}
                    onClick={onClose}
                  >
                    Configurar membresías
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
                
                <Button variant="ghost" className="w-full" onClick={handleSkip}>
                  No tengo ninguna membresía
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
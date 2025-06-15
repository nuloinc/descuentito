import * as React from "react";
import { motion } from "framer-motion";
import { Dialog, DialogContent } from "./ui/dialog";
import { Button } from "./ui/button";

export function DisclaimerPopup() {
  const [isOpen, setIsOpen] = React.useState(false);

  React.useEffect(() => {
    const hasSeenDisclaimer = localStorage.getItem(
      "descuentito-disclaimer-seen",
    );
    if (!hasSeenDisclaimer) {
      setIsOpen(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem("descuentito-disclaimer-seen", "true");
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="flex items-start gap-3 p-4"
        >
          <div className="flex-shrink-0 w-12 h-12">
            <img
              src="/descuentin.svg"
              alt="Descuentín"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="bg-muted rounded-lg px-4 py-3 relative before:content-[''] before:absolute before:left-[-8px] before:top-3 before:w-4 before:h-4 before:bg-muted before:rounded-bl-lg before:[clip-path:polygon(0_0,100%_100%,100%_0)]">
            <p className="mb-3">
              ¡Hola! Soy Descuentín 🛒 Te ayudo a encontrar descuentos, pero mis
              datos son automáticos...
            </p>
            <p className="mb-3">
              Por favor siempre verificá en la web oficial:
            </p>
            <p className="mb-3">
              ✓ Vigencia del descuento
              <br />
              ✓ Términos y condiciones
              <br />✓ Tu medio de pago aplica
            </p>
            <p>¡Verificar nunca está de más! 😊</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.3 }}
          className="flex justify-end p-2 pt-0"
        >
          <Button onClick={handleAccept}>
            ¡Entendido! Verificaré los descuentos 👍
          </Button>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}

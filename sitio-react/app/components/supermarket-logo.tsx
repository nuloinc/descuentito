import React from "react";
import { cn } from "app/lib/utils";
import {
  BRAND_LOGOS,
  BRAND_LOGOS_SMALL,
  BRAND_LOGOS_NEED_LIGHT_BACKGROUND,
} from "app/lib/logos";

interface SupermarketLogoProps {
  source: string;
  small?: boolean;
  className?: string;
  containerClassName?: string;
}

/**
 * SupermarketLogo component for displaying supermarket logos consistently across the app.
 * A simplified version of BrandLogo focused on supermarket sources without type variants.
 */
const SupermarketLogo: React.FC<SupermarketLogoProps> = ({
  source,
  small = false,
  className,
  containerClassName,
}) => {
  // For filter buttons we want the main logo, not Online or other variants
  let logoKey = source;

  // Special case handling for specific supermarkets
  if (source === "carrefour") {
    logoKey = "Carrefour";
  } else if (source === "coto") {
    logoKey = "Coto";
  } else if (source === "dia") {
    logoKey = "Dia";
  } else if (source === "jumbo") {
    logoKey = "Jumbo";
  } else if (source === "changomas") {
    logoKey = "ChangoMas";
  } else if (source === "makro") {
    logoKey = "Makro";
  }

  // Select appropriate logo set (small or regular)
  const logoSet =
    small && BRAND_LOGOS_SMALL[source]
      ? BRAND_LOGOS_SMALL[source]
      : BRAND_LOGOS[source];

  // Get logo URL for the selected key
  const logoSrc = logoSet?.[logoKey];

  // Check if logo needs a light background
  const needsLightBg =
    BRAND_LOGOS_NEED_LIGHT_BACKGROUND[source]?.includes(logoKey);

  if (!logoSrc) {
    // Fallback if no logo found
    return (
      <div
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded bg-gray-300",
          containerClassName
        )}
      >
        <span className="text-xs font-bold">
          {source.substring(0, 1).toUpperCase()}
        </span>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center justify-center", containerClassName)}>
      <img
        src={logoSrc}
        alt={`Logo de ${source}`}
        className={cn(
          "h-5 object-contain",
          needsLightBg && "rounded-sm bg-white p-0.5",
          className
        )}
      />
    </div>
  );
};

export default SupermarketLogo;

import { clsx, type ClassValue } from "clsx";
import { useState } from "react";
import { useEffect } from "react";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function useIsClient() {
  // https://react.dev/reference/react-dom/client/hydrateRoot#handling-different-client-and-server-content
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);
  return isClient;
}

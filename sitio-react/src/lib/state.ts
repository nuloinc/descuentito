import { PaymentMethod } from "promos-db/schema";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface PaymentMethodsState {
  savedPaymentMethods: Set<PaymentMethod>;
  filteringByPaymentMethods: boolean;
  savedConditions: {
    jubilados: boolean;
    anses: boolean;
  };
  addPaymentMethod: (method: PaymentMethod) => void;
  removePaymentMethod: (method: PaymentMethod) => void;
  setFilteringByPaymentMethods: (filtering: boolean) => void;
  setSavedCondition: (key: "jubilados" | "anses", value: boolean) => void;
}

// Helper to convert Set to/from JSON for storage
const setToArray = <T>(set: Set<T>): T[] => Array.from(set);
const arrayToSet = <T>(array: T[]): Set<T> => new Set(array);

export const usePaymentMethodsStore = create<PaymentMethodsState>()(
  persist(
    (set) => ({
      savedPaymentMethods: new Set<PaymentMethod>(),
      filteringByPaymentMethods: true,
      savedConditions: {
        jubilados: false,
        anses: false,
      },
      addPaymentMethod: (method) =>
        set((state) => {
          const updatedMethods = new Set(state.savedPaymentMethods);
          updatedMethods.add(method);
          return { savedPaymentMethods: updatedMethods };
        }),
      removePaymentMethod: (method) =>
        set((state) => {
          const updatedMethods = new Set(state.savedPaymentMethods);
          updatedMethods.delete(method);
          return { savedPaymentMethods: updatedMethods };
        }),
      setFilteringByPaymentMethods: (filtering) =>
        set({ filteringByPaymentMethods: filtering }),
      setSavedCondition: (key, value) =>
        set((state) => ({
          savedConditions: {
            ...state.savedConditions,
            [key]: value,
          },
        })),
    }),
    {
      name: "payment-methods-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        savedPaymentMethods: setToArray(state.savedPaymentMethods),
        filteringByPaymentMethods: state.filteringByPaymentMethods,
        savedConditions: state.savedConditions,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Convert the array back to a Set after rehydration
          state.savedPaymentMethods = arrayToSet(
            state.savedPaymentMethods as unknown as PaymentMethod[]
          );
        }
      },
    }
  )
);

// Derived state selector (similar to Svelte's derived stores)
export const useShouldFilterByPaymentMethods = () => {
  const { filteringByPaymentMethods, savedPaymentMethods } =
    usePaymentMethodsStore();
  return filteringByPaymentMethods && savedPaymentMethods.size > 0;
};

// Export SOURCES and SUPERMARKET_NAMES to avoid duplication
export const SOURCES = [
  "carrefour",
  "coto",
  "dia",
  "jumbo",
  "changomas",
  "makro",
] as const;

export const SUPERMARKET_NAMES: Record<string, string> = {
  carrefour: "Carrefour",
  coto: "Coto",
  dia: "Dia",
  jumbo: "Jumbo",
  changomas: "ChangoMas",
  makro: "Makro",
};

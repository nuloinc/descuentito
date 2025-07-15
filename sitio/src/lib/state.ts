import { PaymentMethod } from "promos-db/schema";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface PaymentMethodsState {
  savedPaymentMethods: Set<PaymentMethod>;
  filteringByPaymentMethods: boolean;
  showingPaymentMethodsInDiscountCard: boolean;
  savedConditions: {
    jubilados: boolean;
    anses: boolean;
  };
  savedMemberships: Set<string>;
  membershipSetupCompleted: boolean;
  addPaymentMethod: (method: PaymentMethod) => void;
  removePaymentMethod: (method: PaymentMethod) => void;
  setFilteringByPaymentMethods: (filtering: boolean) => void;
  setShowingPaymentMethodsInDiscountCard: (showing: boolean) => void;
  setSavedCondition: (key: "jubilados" | "anses", value: boolean) => void;
  addMembership: (membership: string) => void;
  removeMembership: (membership: string) => void;
  setMembershipSetupCompleted: (completed: boolean) => void;
}

// Helper to convert Set to/from JSON for storage
const setToArray = <T>(set: Set<T>): T[] => Array.from(set);
const arrayToSet = <T>(array: T[]): Set<T> => new Set(array);

export const usePaymentMethodsStore = create<PaymentMethodsState>()(
  persist(
    (set) => ({
      savedPaymentMethods: new Set<PaymentMethod>(),
      filteringByPaymentMethods: true,
      showingPaymentMethodsInDiscountCard: false,
      savedConditions: {
        jubilados: false,
        anses: false,
      },
      savedMemberships: new Set<string>(),
      membershipSetupCompleted: false,
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
      setShowingPaymentMethodsInDiscountCard: (showing: boolean) =>
        set({ showingPaymentMethodsInDiscountCard: showing }),
      setSavedCondition: (key, value) =>
        set((state) => ({
          savedConditions: {
            ...state.savedConditions,
            [key]: value,
          },
        })),
      addMembership: (membership) =>
        set((state) => {
          const updatedMemberships = new Set(state.savedMemberships);
          updatedMemberships.add(membership);
          return { savedMemberships: updatedMemberships };
        }),
      removeMembership: (membership) =>
        set((state) => {
          const updatedMemberships = new Set(state.savedMemberships);
          updatedMemberships.delete(membership);
          return { savedMemberships: updatedMemberships };
        }),
      setMembershipSetupCompleted: (completed) =>
        set({ membershipSetupCompleted: completed }),
    }),
    {
      name: "payment-methods-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        savedPaymentMethods: setToArray(state.savedPaymentMethods),
        filteringByPaymentMethods: state.filteringByPaymentMethods,
        showingPaymentMethodsInDiscountCard:
          state.showingPaymentMethodsInDiscountCard,
        savedConditions: state.savedConditions,
        savedMemberships: setToArray(state.savedMemberships),
        membershipSetupCompleted: state.membershipSetupCompleted,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Convert the array back to a Set after rehydration
          state.savedPaymentMethods = arrayToSet(
            state.savedPaymentMethods as unknown as PaymentMethod[],
          );
          state.savedMemberships = arrayToSet(
            state.savedMemberships as unknown as string[],
          );
        }
      },
    },
  ),
);

export const useShouldFilterByPaymentMethods = () => {
  const { filteringByPaymentMethods, savedPaymentMethods } =
    usePaymentMethodsStore();
  return filteringByPaymentMethods && savedPaymentMethods.size > 0;
};

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

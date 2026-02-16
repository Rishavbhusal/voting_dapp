import { createContext, useContext, ReactNode } from "react";
import { PublicKey } from "@solana/web3.js";

interface AdminContextType {
  adminAddress: PublicKey;
  isAdmin: (address: PublicKey | null) => boolean;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

interface AdminProviderProps {
  children: ReactNode;
}

export const AdminProvider = ({ children }: AdminProviderProps) => {
  const adminAddress = new PublicKey("Bundt9yGXifxnNMWJMnEQj2EwNPtyJiq7XeqE9Eb98Mg");

  const isAdmin = (address: PublicKey | null): boolean => {
    if (!address) return false;
    return address.equals(adminAddress);
  };

  return (
    <AdminContext.Provider value={{ adminAddress, isAdmin }}>
      {children}
    </AdminContext.Provider>
  );
};

export const useAdmin = (): AdminContextType => {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error("useAdmin must be used within an AdminProvider");
  }
  return context;
};

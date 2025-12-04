import { createContext, useContext, useState, type ReactNode } from "react";

interface SignupContextType {
  isNewSignup: boolean;
  setIsNewSignup: (value: boolean) => void;
}

const SignupContext = createContext<SignupContextType | undefined>(undefined);

export function useSignupContext() {
  const context = useContext(SignupContext);
  if (!context) {
    throw new Error("useSignupContext must be used within SignupProvider");
  }
  return context;
}

interface SignupProviderProps {
  children: ReactNode;
}

export function SignupProvider({ children }: SignupProviderProps) {
  const [isNewSignup, setIsNewSignup] = useState(false);

  return (
    <SignupContext.Provider value={{ isNewSignup, setIsNewSignup }}>
      {children}
    </SignupContext.Provider>
  );
}


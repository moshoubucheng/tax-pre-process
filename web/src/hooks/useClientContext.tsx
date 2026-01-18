import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface SelectedClient {
  id: string;
  name: string;
  pending_count: number;
  confirmed_count: number;
}

interface ClientContextType {
  selectedClient: SelectedClient | null;
  setSelectedClient: (client: SelectedClient | null) => void;
  clearSelectedClient: () => void;
}

const ClientContext = createContext<ClientContextType | undefined>(undefined);

export function ClientProvider({ children }: { children: ReactNode }) {
  const [selectedClient, setSelectedClientState] = useState<SelectedClient | null>(() => {
    // Restore from sessionStorage on mount
    const stored = sessionStorage.getItem('selectedClient');
    return stored ? JSON.parse(stored) : null;
  });

  // Persist to sessionStorage
  useEffect(() => {
    if (selectedClient) {
      sessionStorage.setItem('selectedClient', JSON.stringify(selectedClient));
    } else {
      sessionStorage.removeItem('selectedClient');
    }
  }, [selectedClient]);

  function setSelectedClient(client: SelectedClient | null) {
    setSelectedClientState(client);
  }

  function clearSelectedClient() {
    setSelectedClientState(null);
  }

  return (
    <ClientContext.Provider value={{ selectedClient, setSelectedClient, clearSelectedClient }}>
      {children}
    </ClientContext.Provider>
  );
}

export function useClientContext() {
  const context = useContext(ClientContext);
  if (context === undefined) {
    throw new Error('useClientContext must be used within a ClientProvider');
  }
  return context;
}

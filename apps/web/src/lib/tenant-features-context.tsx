'use client';

import { createContext, useContext } from 'react';

export type TenantFeaturesMap = Record<string, boolean>;

const TenantFeaturesContext = createContext<TenantFeaturesMap>({});

export function TenantFeaturesProvider({
  value,
  children,
}: {
  value: TenantFeaturesMap;
  children: React.ReactNode;
}) {
  return (
    <TenantFeaturesContext.Provider value={value}>
      {children}
    </TenantFeaturesContext.Provider>
  );
}

export function useTenantFeatures(): TenantFeaturesMap {
  return useContext(TenantFeaturesContext);
}

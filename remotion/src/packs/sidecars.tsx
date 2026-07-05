import { createContext, useContext } from "react";
import type { StatCard, TitleMeta } from "../../../src/facts/types";

export const StatCardsContext = createContext<StatCard[]>([]);
export const useStatCards = (): StatCard[] => useContext(StatCardsContext);

export const TitleMetaContext = createContext<TitleMeta>({});
export const useTitleMeta = (): TitleMeta => useContext(TitleMetaContext);

export const CompressionContext = createContext<string | null>(null);
export const useCompression = (): string | null => useContext(CompressionContext);

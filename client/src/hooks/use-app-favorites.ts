import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY_FAVORITES = "provocations-app-favorites";
const STORAGE_KEY_RATINGS = "provocations-app-ratings";

export interface AppPreferences {
  favorites: Set<string>;
  ratings: Record<string, number>; // templateId → 1-5
}

function loadFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_FAVORITES);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch {
    // corrupt data — start fresh
  }
  return new Set<string>();
}

function loadRatings(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_RATINGS);
    if (raw) return JSON.parse(raw) as Record<string, number>;
  } catch {
    // corrupt data — start fresh
  }
  return {};
}

function saveFavorites(favorites: Set<string>) {
  localStorage.setItem(STORAGE_KEY_FAVORITES, JSON.stringify(Array.from(favorites)));
}

function saveRatings(ratings: Record<string, number>) {
  localStorage.setItem(STORAGE_KEY_RATINGS, JSON.stringify(ratings));
}

export function useAppFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(loadFavorites);
  const [ratings, setRatings] = useState<Record<string, number>>(loadRatings);

  // Persist on change
  useEffect(() => { saveFavorites(favorites); }, [favorites]);
  useEffect(() => { saveRatings(ratings); }, [ratings]);

  const toggleFavorite = useCallback((templateId: string) => {
    setFavorites((prev) => {
      const next = new Set(Array.from(prev));
      if (next.has(templateId)) {
        next.delete(templateId);
      } else {
        next.add(templateId);
      }
      return next;
    });
  }, []);

  const setRating = useCallback((templateId: string, value: number) => {
    const clamped = Math.max(1, Math.min(5, Math.round(value)));
    setRatings((prev) => ({ ...prev, [templateId]: clamped }));
  }, []);

  const isFavorite = useCallback(
    (templateId: string) => favorites.has(templateId),
    [favorites],
  );

  const getRating = useCallback(
    (templateId: string) => ratings[templateId] ?? 0,
    [ratings],
  );

  return { favorites, ratings, toggleFavorite, setRating, isFavorite, getRating };
}

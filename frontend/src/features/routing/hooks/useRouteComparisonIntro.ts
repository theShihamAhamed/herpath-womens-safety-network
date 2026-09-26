import { useCallback, useEffect, useState } from 'react';
import { routeComparisonIntroStorage, RouteComparisonIntroStorage } from '../route-comparison-intro-storage';

interface UseRouteComparisonIntroOptions {
  storage?: RouteComparisonIntroStorage;
  autoShow?: boolean;
}

export interface UseRouteComparisonIntroResult {
  hasSeenIntro: boolean | null;
  introVisible: boolean;
  completeIntro: () => Promise<void>;
  skipIntro: () => Promise<void>;
  showIntro: () => void;
  hideIntro: () => void;
}

export function useRouteComparisonIntro({
  storage = routeComparisonIntroStorage,
  autoShow = true,
}: UseRouteComparisonIntroOptions = {}): UseRouteComparisonIntroResult {
  const [hasSeenIntro, setHasSeenIntro] = useState<boolean | null>(null);
  const [introVisible, setIntroVisible] = useState(false);

  useEffect(() => {
    let isMounted = true;

    storage.isIntroSeen().then((seen) => {
      if (!isMounted) return;
      setHasSeenIntro(seen);
      if (!seen && autoShow) {
        setIntroVisible(true);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [autoShow, storage]);

  const completeIntro = useCallback(async () => {
    setIntroVisible(false);
    setHasSeenIntro(true);
    await storage.setIntroSeen(true);
  }, [storage]);

  const skipIntro = useCallback(async () => {
    setIntroVisible(false);
    setHasSeenIntro(true);
    await storage.setIntroSeen(true);
  }, [storage]);

  const showIntro = useCallback(() => {
    setIntroVisible(true);
  }, []);

  const hideIntro = useCallback(() => {
    setIntroVisible(false);
  }, []);

  return {
    hasSeenIntro,
    introVisible,
    completeIntro,
    skipIntro,
    showIntro,
    hideIntro,
  };
}

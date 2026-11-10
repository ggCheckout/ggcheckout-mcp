import { useEffect, useState } from 'react';

/** Copies a value and says so for 1.5 s. Asks for the clipboard and stays quiet when the host denies it. */
export function useCopy(): [boolean, (value: string) => void] {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);
  return [copied, (value) => { navigator.clipboard?.writeText(value).then(() => setCopied(true), () => {}); }];
}

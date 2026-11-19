import { ChevronLeft } from 'lucide-react';

export function BackButton({ onBack, label = 'Voltar' }: { onBack: () => void; label?: string }) {
  return <button type="button" className="back" onClick={onBack}><ChevronLeft size={15} aria-hidden />{label}</button>;
}

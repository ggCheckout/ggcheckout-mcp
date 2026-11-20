import { RefreshCw } from 'lucide-react';
import { pauseText, type PollPause } from './model';

/**
 * Says when the automatic reads stopped, with "Atualizar" to resume. The status region stays mounted
 * and only its text changes, so a screen reader announces the pause when it happens.
 */
export function PollNote({ pause, onResume }: { pause: PollPause | null; onResume: () => void }) {
  return (
    <div className="ix-poll status-region" role="status">
      {pause && (
        <>
          <span>{pauseText(pause)}</span>
          <button type="button" className="ix-ghost" onClick={onResume}><RefreshCw size={14} aria-hidden />Atualizar</button>
        </>
      )}
    </div>
  );
}

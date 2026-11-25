// Settings → "Test the microphone": shows live words, the final result or the exact problem.
import { useState } from 'react';
import { listenOnce, stopListening, sttAvailable } from '../services/stt';
import { Icon } from './ui';

export function MicTest() {
  const [state, setState] = useState<'idle' | 'listening' | 'done' | 'error'>('idle');
  const [text, setText] = useState('');
  const run = async () => {
    if (state === 'listening') { await stopListening(); return; }
    setText(''); setState('listening');
    try {
      if (!(await sttAvailable())) throw new Error('No speech recognition on this phone. Install or update the Google app, then try again.');
      const r = await listenOnce(t => setText(t), 12000);
      setText(r[0] ?? ''); setState('done');
    } catch (e) { setText((e as Error).message); setState('error'); }
  };
  return (
    <div className="card flat col gap-s" style={{ marginTop: 8 }}>
      <div className="row between">
        <span style={{ fontWeight: 500 }}>Microphone test</span>
        <button className={`btn sm ${state === 'listening' ? 'danger' : 'ghost'}`} onClick={() => void run()}><Icon n="mic" s={16} />{state === 'listening' ? 'Done' : 'Test the microphone'}</button>
      </div>
      {state === 'listening' && <p className="small row" lang="ja" style={{ margin: 0, gap: 8 }}><Icon n="mic" s={14} />Say 「こんにちは」 {text}</p>}
      {state === 'done' && <p className="small" style={{ margin: 0 }}>{text ? <>Heard <b lang="ja" style={{ fontWeight: 500 }}>{text}</b></> : 'Heard nothing. Speak a little louder, closer to the phone.'}</p>}
      {state === 'error' && <p className="small" style={{ margin: 0, color: 'var(--bad)' }}>{text}</p>}
      <p className="tiny muted" style={{ margin: 0 }}>Calls and speaking lessons use this. It needs the Google app's speech service with Japanese (日本語) added.</p>
    </div>
  );
}

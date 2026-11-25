// First run: name, starting point, a short placement check, reminder choice.
import { useMemo, useState } from 'react';
import { saveSettings, type Settings } from '../lib/settings';
import { seedKnown } from '../lib/db';
import { KANA_LESSONS, JLPT_LESSONS, kanaRomaji, lessonItemIds, kanaId, HIRA, KATA } from '../content';
import { shuffle } from '../lib/exercises';
import { setReminder } from '../services/notify';
import { Mascot, Icon, Switch, Bar } from '../components/ui';
import { PictureDownload } from '../components/PictureGate';

const LEVELS: { id: Settings['level']; title: string; sub: string }[] = [
  { id: 'zero', title: 'Complete beginner', sub: 'I cannot read Japanese yet.' },
  { id: 'kana', title: 'I know some kana', sub: 'Some hiragana, little katakana or kanji.' },
  { id: 'n5', title: 'I know the basics', sub: 'I read kana and know simple sentences.' },
  { id: 'n4', title: 'Around N5 already', sub: 'I want to consolidate and move toward N4.' },
];

interface Q { prompt: string; jp: string; options: string[]; a: number; seeds: () => { id: string; kind: string }[] }

function buildCheck(level: Settings['level']): Q[] {
  const qs: Q[] = [];
  // Two characters from each kana group; a group counts as known only if both are right.
  for (const l of KANA_LESSONS) {
    for (const ch of shuffle(l.kana!).slice(0, 2)) {
      const table = HIRA[ch] ? HIRA : KATA;
      const opts = shuffle([kanaRomaji(ch), ...shuffle(Object.values(table).filter(r => r !== kanaRomaji(ch))).slice(0, 3)]);
      qs.push({ prompt: 'How is this read?', jp: ch, options: opts, a: opts.indexOf(kanaRomaji(ch)), seeds: () => l.kana!.map(c => ({ id: kanaId(c), kind: 'kana' })) });
    }
  }
  if (level === 'n5' || level === 'n4') {
    const g: [string, string, string[], number, number][] = [
      ['Choose the particle', '私＿学生です。', ['は', 'を', 'に', 'で'], 0, 0],
      ['Choose the particle', '水＿飲みます。', ['が', 'を', 'に', 'へ'], 1, 3],
      ['Choose the particle', '学校＿行きます。', ['を', 'が', 'に', 'と'], 2, 4],
      ['Choose the particle', 'レストラン＿食べます。', ['に', 'を', 'が', 'で'], 3, 5],
      ['Which means "did not study"?', '勉強＿', ['します', 'しません', 'しました', 'しませんでした'], 3, 8],
    ];
    for (const [prompt, jp, options, a, li] of g) {
      const l = JLPT_LESSONS[li];
      qs.push({ prompt, jp, options, a, seeds: () => lessonItemIds(l).map(id => ({ id, kind: id.startsWith('vocab') ? 'vocab' : 'sentence' })) });
    }
  }
  return qs;
}

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [level, setLevel] = useState<Settings['level']>('kana');
  const [reminder, setRem] = useState(true);
  const [time, setTime] = useState('19:30');
  const qs = useMemo(() => (step === 2 ? buildCheck(level) : []), [step, level]);
  const [qi, setQi] = useState(0);
  const [right, setRight] = useState<boolean[]>([]);

  const answer = (ok: boolean) => {
    const r = [...right, ok]; setRight(r);
    if (qi + 1 >= qs.length) void finishCheck(r); else setQi(qi + 1);
  };
  const finishCheck = async (r: boolean[]) => {
    // Kana questions come in pairs per group; grammar questions stand alone.
    const seeds: { id: string; kind: string }[] = [];
    const kanaCount = KANA_LESSONS.length * 2;
    for (let i = 0; i < qs.length; i++) {
      if (i < kanaCount) { if (i % 2 === 0 && r[i] && r[i + 1]) seeds.push(...qs[i].seeds()); }
      else if (r[i]) seeds.push(...qs[i].seeds());
    }
    if (seeds.length) await seedKnown(seeds);
    setStep(3);
  };
  const finish = async () => {
    await saveSettings({ onboarded: true, name: name.trim(), level, reminder, reminderTime: time });
    if (reminder) await setReminder(true, time).catch(() => undefined);
  };

  return (
    <main className="screen no-tabs" style={{ justifyContent: 'space-between' }}>
      <Bar pct={((step + 1) / 5) * 100} />
      {step === 0 && (
        <>
          <div className="col center" style={{ alignItems: 'center', marginTop: 20 }}>
            <Mascot size={120} mood="cheer" />
            <h1>Japanese for living in Japan</h1>
            <p className="muted" lang="ja">日本語を学びましょう</p>
            <p className="muted" style={{ maxWidth: 320 }}>A personal course at your own pace: kana to JLPT N1, everyday situations, and a notebook to write in.</p>
          </div>
          <div className="col">
            <label className="label" htmlFor="nm">What should I call you? (optional)</label>
            <input id="nm" className="field" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" autoComplete="off" />
            <div className="card sage col gap-s small">
              <div className="row gap-s"><Icon n="check" s={18} />No hearts, lives, locks or waiting.</div>
              <div className="row gap-s"><Icon n="check" s={18} />Missing a day never costs you progress.</div>
              <div className="row gap-s"><Icon n="check" s={18} />Every mistake is explained, with unlimited retries.</div>
            </div>
          </div>
          <button className="btn" onClick={() => setStep(1)}>Get started<Icon n="next" s={18} /></button>
        </>
      )}
      {step === 1 && (
        <>
          <div className="col"><h1>Where are you starting from?</h1><p className="muted small">Choose the closest. A short check comes next, and the app keeps adapting to what you actually remember.</p></div>
          <div className="col gap-s">
            {LEVELS.map(l => (
              <button key={l.id} className="opt" style={level === l.id ? { borderColor: 'var(--forest)', background: 'var(--sage-soft)' } : undefined} onClick={() => setLevel(l.id)} aria-pressed={level === l.id}>
                <div><div>{l.title}</div><div className="small muted" style={{ fontWeight: 500 }}>{l.sub}</div></div>
              </button>
            ))}
          </div>
          <button className="btn" onClick={() => { setQi(0); setRight([]); setStep(level === 'zero' ? 3 : 2); }}>Continue<Icon n="next" s={18} /></button>
        </>
      )}
      {step === 2 && qs[qi] && (
        <>
          <div className="col gap-s"><h1>Quick placement check</h1><p className="muted small">Question {qi + 1} of {qs.length}. If you do not know, say so — guessing only hides what to teach you.</p></div>
          <div className="col gap-l">
            <div className="card flat col center" style={{ alignItems: 'center' }}><span className="label">{qs[qi].prompt}</span><span className={qs[qi].jp.length <= 2 ? 'kana-big' : 'jp-xl jp'} lang="ja">{qs[qi].jp}</span></div>
            <div className="opts-grid">{qs[qi].options.map((o, i) => <button key={qi + o} className="opt jp" onClick={() => answer(i === qs[qi].a)}>{o}</button>)}</div>
          </div>
          <div className="col gap-s">
            <button className="btn ghost" onClick={() => answer(false)}>I don't know this yet</button>
            <button className="btn line" onClick={() => finishCheck(right)}>Skip the rest</button>
          </div>
        </>
      )}
      {step === 3 && (
        <>
          <div className="col"><h1>A gentle daily rhythm</h1><p className="muted small">About 25 minutes a day works well: review, one small lesson, sentence practice and a real-life task. It is a guide, never a timer — stop early or keep going whenever you like.</p></div>
          <div className="col">
            {right.length > 0 && <div className="card sage small">Placement check: {right.filter(Boolean).length} of {right.length} correct. What you already know has been marked, and will be re-checked in a few days to confirm it.</div>}
            <div className="card flat col">
              <div className="row between"><div><h3>Streak reminders</h3><p className="small muted">Your teachers message you in the evening if today's 25 minutes aren't done yet.</p></div><Switch on={reminder} onChange={setRem} label="Daily reminder" /></div>
              {reminder && <input type="time" className="field" value={time} onChange={e => setTime(e.target.value)} aria-label="Reminder time" />}
            </div>
          </div>
          <button className="btn" onClick={() => setStep(4)}>Continue<Icon n="next" s={18} /></button>
        </>
      )}
      {step === 4 && <PictureDownload onDone={finish} />}
    </main>
  );
}

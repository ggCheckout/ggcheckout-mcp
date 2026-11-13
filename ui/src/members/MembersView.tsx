import { ChevronDown, CirclePlay, FileText, FileType, GalleryHorizontal, Layers, ListChecks, Lock, Paperclip } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import '../styles/dashboard.css';
import './members.css';
import type { Host, HostSnapshot } from '../host';
import { formatInt, plural } from '../lib/format';
import {
  formatDuration, summarizeArea, summarizeCarousels, summarizeLessons, summarizeModules, typeLabel,
  type Area, type Carousel, type Lesson, type LessonType, type Module,
} from './model';

const LESSON_ICONS: Record<LessonType, typeof FileText> = { video: CirclePlay, text: FileText, file: Paperclip, pdf: FileType, quiz: ListChecks };

/** A list read on demand through the host: undefined while loading, null when it failed. */
function useList<T>(host: Host, open: boolean, load: () => Promise<T[] | null>, first?: T[]) {
  const [items, setItems] = useState<T[] | null | undefined>(first);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!open || items !== undefined) return;
    let live = true;
    load().then((list) => live && setItems(list)).catch(() => live && setItems(null));
    return () => { live = false; };
    // `load` is rebuilt on every render; the list is read once per open (or retry).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host, open, items, attempt]);
  const retry = () => { setItems(undefined); setAttempt((n) => n + 1); };
  return [items, retry] as const;
}

function Status({ locked, label }: { locked: boolean; label: string }) {
  return (
    <span className="mb-status" data-locked={locked || undefined}>
      {locked && <Lock size={11} aria-hidden />}
      {label}
    </span>
  );
}

function Loading() {
  return <div className="mb-loading skeleton" aria-busy="true" />;
}

function Failed({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <p className="mb-failed" role="alert">
      {`Erro ao carregar ${what}.`}
      <button type="button" onClick={onRetry}>Tentar novamente</button>
    </p>
  );
}

/** One row of the tree: icon, title, the secondary line and the release, with an optional toggle. */
function Row({ level, icon, title, secondary, status, meta, open, onToggle, toggleLabel }: {
  level: 'carousel' | 'module' | 'lesson'; icon: ReactNode; title: string; secondary: string;
  status: ReactNode; meta?: string | null; open?: boolean; onToggle?: () => void; toggleLabel?: string;
}) {
  const body = (
    <>
      <span className="mb-icon" aria-hidden>{icon}</span>
      <span className="mb-main">
        <span className="mb-title">{title}</span>
        <span className="mb-secondary">{secondary}</span>
      </span>
      <span className="mb-side">
        {status}
        {meta && <span className="mb-meta num">{meta}</span>}
      </span>
      {onToggle && <ChevronDown size={16} className="mb-chevron" data-open={open || undefined} aria-hidden />}
    </>
  );
  return onToggle
    ? <button type="button" className="mb-row" data-level={level} aria-expanded={open} aria-label={toggleLabel} onClick={onToggle}>{body}</button>
    : <div className="mb-row" data-level={level}>{body}</div>;
}

function LessonRow({ lesson }: { lesson: Lesson }) {
  const Icon = lesson.type ? LESSON_ICONS[lesson.type] : FileText;
  return (
    <li>
      <Row
        level="lesson"
        icon={<Icon size={15} />}
        title={lesson.title}
        secondary={typeLabel(lesson.type)}
        status={<Status locked={lesson.locked} label={lesson.locked ? 'Bloqueado' : 'Liberado'} />}
        meta={formatDuration(lesson.duration)}
      />
    </li>
  );
}

function Lessons({ lessons }: { lessons: Lesson[] }) {
  if (!lessons.length) return <p className="mb-empty">Nenhuma aula neste módulo ainda.</p>;
  return <ol className="mb-list">{lessons.map((l) => <LessonRow key={l.id} lesson={l} />)}</ol>;
}

/** A module (API section): its lessons, read when it opens. */
function ModuleNode({ host, areaId, carouselId, module, index, startOpen, canCallTools }: {
  host: Host; areaId: string; carouselId: string; module: Module; index: number; startOpen: boolean; canCallTools: boolean;
}) {
  const canOpen = canCallTools && module.lessons > 0;
  const [open, setOpen] = useState(startOpen && canOpen);
  const [lessons, retry] = useList(host, open, async () =>
    summarizeLessons(await host.callTool('list_lessons', { areaId, moduleId: carouselId, sectionId: module.id })));
  return (
    <li className="mb-node">
      <Row
        level="module"
        icon={<Layers size={15} />}
        title={module.title}
        secondary={`Módulo ${index + 1} · ${plural(module.lessons, 'aula', 'aulas')}`}
        status={<Status locked={module.locked} label={module.release} />}
        open={open}
        onToggle={canOpen ? () => setOpen((o) => !o) : undefined}
        toggleLabel={`${open ? 'Recolher' : 'Mostrar'} aulas de ${module.title}`}
      />
      {open && (
        <div className="mb-sub">
          {lessons === undefined ? <Loading /> : lessons === null ? <Failed what="aulas" onRetry={retry} /> : <Lessons lessons={lessons} />}
        </div>
      )}
    </li>
  );
}

function Modules({ host, areaId, carouselId, modules, canCallTools }: {
  host: Host; areaId: string; carouselId: string; modules: Module[]; canCallTools: boolean;
}) {
  if (!modules.length) return <p className="mb-empty">Nenhum módulo neste carrossel ainda.</p>;
  return (
    <ol className="mb-list">
      {modules.map((m, i) => (
        <ModuleNode key={m.id} host={host} areaId={areaId} carouselId={carouselId} module={m} index={i}
          startOpen={modules.length === 1} canCallTools={canCallTools} />
      ))}
    </ol>
  );
}

/** A carousel (API module): its modules, read when it opens. */
function CarouselNode({ host, areaId, carousel, index, startOpen, canCallTools }: {
  host: Host; areaId: string; carousel: Carousel; index: number; startOpen: boolean; canCallTools: boolean;
}) {
  const canOpen = canCallTools && carousel.modules > 0;
  const [open, setOpen] = useState(startOpen && canOpen);
  const [modules, retry] = useList(host, open, async () =>
    summarizeModules(await host.callTool('list_sections', { areaId, moduleId: carousel.id })));
  return (
    <li className="mb-node mb-carousel">
      <Row
        level="carousel"
        icon={<GalleryHorizontal size={16} />}
        title={carousel.title}
        secondary={`Carrossel ${index + 1} · ${plural(carousel.modules, 'módulo', 'módulos')} · ${plural(carousel.lessons, 'aula', 'aulas')}`}
        status={<Status locked={carousel.locked} label={carousel.release} />}
        open={open}
        onToggle={canOpen ? () => setOpen((o) => !o) : undefined}
        toggleLabel={`${open ? 'Recolher' : 'Mostrar'} módulos de ${carousel.title}`}
      />
      {open && (
        <div className="mb-sub">
          {modules === undefined ? <Loading />
            : modules === null ? <Failed what="módulos" onRetry={retry} />
              : <Modules host={host} areaId={areaId} carouselId={carousel.id} modules={modules} canCallTools={canCallTools} />}
        </div>
      )}
    </li>
  );
}

function Carousels({ host, areaId, carousels, canCallTools }: {
  host: Host; areaId: string; carousels: Carousel[]; canCallTools: boolean;
}) {
  if (!carousels.length) {
    return (
      <div className="mb-empty-block">
        <p className="mb-empty-title">Nenhum módulo ainda</p>
        <p className="mb-empty">Crie o primeiro carrossel e adicione o módulo de abertura.</p>
      </div>
    );
  }
  return (
    <ol className="mb-list mb-tree">
      {carousels.map((c, i) => (
        <CarouselNode key={c.id} host={host} areaId={areaId} carousel={c} index={i} startOpen={i === 0} canCallTools={canCallTools} />
      ))}
    </ol>
  );
}

function Head({ title, sub }: { title: string; sub: string }) {
  return (
    <header className="mb-head">
      <h2 className="card-title">{title}</h2>
      <p className="card-sub">{sub}</p>
    </header>
  );
}

function AreaStats({ area }: { area: Area }) {
  const stats: [string, string][] = [
    ['Alunos', formatInt(area.students)],
    ['Ativos', formatInt(area.activeStudents)],
    ['Conclusão média', `${Math.round(area.avgCompletion)}%`],
  ];
  return (
    <header className="mb-area">
      <span className="mb-area-icon" aria-hidden><GalleryHorizontal size={20} /></span>
      <div className="mb-area-main">
        <div className="mb-area-name">
          <h2>{area.name}</h2>
          <span className="mb-status" data-locked={!area.enabled || undefined}>{area.enabled ? 'Ativa' : 'Desativada'}</span>
        </div>
        <p className="card-sub">
          {`${plural(area.carousels, 'carrossel', 'carrosséis')} · ${plural(area.modules, 'módulo', 'módulos')} · ${plural(area.lessons, 'aula', 'aulas')}`}
        </p>
      </div>
      <dl className="mb-stats">
        {stats.map(([label, value]) => <div key={label}><dt>{label}</dt><dd className="num">{value}</dd></div>)}
      </dl>
    </header>
  );
}

/** get_members_area: the area's numbers, then its carousels read through the host. */
function AreaTree({ host, area, canCallTools }: { host: Host; area: Area; canCallTools: boolean }) {
  const [carousels, retry] = useList(host, canCallTools, async () =>
    summarizeCarousels(await host.callTool('list_modules', { areaId: area.id })));
  return (
    <>
      <AreaStats area={area} />
      {canCallTools && (
        <section className="mb-content">
          <Head title="Módulos e aulas" sub="Organize o que o aluno vê, na ordem em que ele aprende." />
          {carousels === undefined ? <Loading />
            : carousels === null ? <Failed what="módulos" onRetry={retry} />
              : <Carousels host={host} areaId={area.id} carousels={carousels} canCallTools={canCallTools} />}
        </section>
      )}
    </>
  );
}

/** Members view: the content tree of a members area, at whatever level the tool answered. */
export function MembersView({ host, state }: { host: Host; state: HostSnapshot }) {
  const parts = useMemo(() => ({
    area: summarizeArea(state.payload),
    carousels: summarizeCarousels(state.payload),
    modules: summarizeModules(state.payload),
    lessons: summarizeLessons(state.payload),
  }), [state.payload]);
  const arg = (key: string) => (typeof state.args[key] === 'string' ? (state.args[key] as string) : '');
  const areaId = parts.area?.id || arg('areaId');
  const { canCallTools } = state;

  useEffect(() => {
    if (parts.area) host.tellModel(`Área de membros ${parts.area.name} aberta na tela do chat, com os carrosséis, módulos e aulas.`);
    else if (parts.carousels) host.tellModel('Carrosséis da área de membros abertos na tela do chat.');
    else if (parts.modules) host.tellModel('Módulos do carrossel abertos na tela do chat.');
    else if (parts.lessons) host.tellModel('Aulas do módulo abertas na tela do chat.');
  }, [host, parts]);

  let body: ReactNode;
  if (parts.area) body = <AreaTree host={host} area={parts.area} canCallTools={canCallTools} />;
  else if (parts.carousels) {
    body = (
      <section className="mb-content">
        <Head title="Módulos e aulas" sub="Organize o que o aluno vê, na ordem em que ele aprende." />
        <Carousels host={host} areaId={areaId} carousels={parts.carousels} canCallTools={canCallTools && Boolean(areaId)} />
      </section>
    );
  } else if (parts.modules) {
    body = (
      <section className="mb-content">
        <Head title="Módulos" sub="Os módulos organizam as aulas dentro deste carrossel." />
        <Modules host={host} areaId={areaId} carouselId={arg('moduleId')} modules={parts.modules}
          canCallTools={canCallTools && Boolean(areaId && arg('moduleId'))} />
      </section>
    );
  } else if (parts.lessons) {
    body = (
      <section className="mb-content">
        <Head title="Aulas" sub="As aulas são o conteúdo que o aluno acessa dentro deste módulo." />
        <Lessons lessons={parts.lessons} />
      </section>
    );
  } else {
    return <p className="state" data-tone="error">A resposta não trouxe a área de membros.</p>;
  }
  return <div className="dashboard members"><div className="surface mb-card">{body}</div></div>;
}

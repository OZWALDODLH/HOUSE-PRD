// The interactive tutorial: lessons made of steps that point at a part of the
// screen (by its data-tour name), explain it, and often wait until the
// person does the thing before moving on.
import { create } from 'zustand';

export interface TourStep {
  /** `data-tour` of what to point at; none = a bubble in the middle. */
  target?: string;
  title: string;
  /** Paragraphs, separated by a blank line. */
  body: string;
  /** Something to do: the step waits until this is true, then moves on. */
  done?: () => boolean;
  /** What the person has to do, shown while the step waits. */
  hazlo?: string;
  /** Runs when the step shows: switch view, select a track, open a menu. */
  enter?: () => void;
}

export interface Lesson {
  id: string;
  title: string;
  /** One sentence: what you will be able to do after. */
  summary: string;
  minutes: number;
  /** Opens the practice project of the lesson (the person's own stays saved). */
  setup?: () => void;
  steps: TourStep[];
}

interface TourState {
  /** The lesson picker is open. */
  picker: boolean;
  lesson: Lesson | null;
  step: number;
  /** Lessons finished at least once. */
  finished: string[];
}

const KEY = 'house.v1.tutorial';

const loadFinished = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
};

export const useTour = create<TourState>(() => ({ picker: false, lesson: null, step: 0, finished: loadFinished() }));

/** Opens the list of lessons. */
export function startTutorial(): void {
  useTour.setState({ picker: true, lesson: null, step: 0 });
}

export function startLesson(l: Lesson): void {
  l.setup?.();
  useTour.setState({ picker: false, lesson: l, step: 0 });
  // Let the studio render before the first step looks for its target.
  requestAnimationFrame(() => l.steps[0]?.enter?.());
}

export function goStep(i: number): void {
  const { lesson } = useTour.getState();
  if (!lesson) return;
  if (i >= lesson.steps.length) {
    finishLesson();
    return;
  }
  const step = Math.max(0, i);
  useTour.setState({ step });
  lesson.steps[step]?.enter?.();
}

export function finishLesson(): void {
  const { lesson, finished } = useTour.getState();
  if (!lesson) return;
  const next = finished.includes(lesson.id) ? finished : [...finished, lesson.id];
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Progress then lasts only for this session.
  }
  useTour.setState({ lesson: null, step: 0, finished: next, picker: true });
}

export function endTour(): void {
  useTour.setState({ lesson: null, step: 0, picker: false });
}

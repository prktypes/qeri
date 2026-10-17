import type { Explanation } from '@qeri/shared';
import type { ReactNode } from 'react';
import { Lightbulb, Quote } from 'lucide-react';

/** Card framing + heading used by every explanation section (visual rhythm helper). */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-qeri-600 uppercase dark:text-qeri-400">
        {title}
      </h3>
      {children}
    </section>
  );
}

export function ExplanationView({ explanation }: { explanation: Explanation }) {
  const { request, summary, whyItMatters, keyTerms, example, caveats, followUps, meta } =
    explanation;

  return (
    <div className="flex min-h-full flex-col gap-3">
      {/* Source post preview — a quote card first, so context precedes analysis */}
      <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-2 flex items-center gap-2 text-xs text-neutral-500">
          <Quote className="h-3.5 w-3.5" />
          <span className="truncate">
            {request.authorHandle ? `${request.authorHandle} · ` : ''}original post
          </span>
          <span className="ml-auto rounded-full bg-qeri-100 px-2 py-0.5 text-[10px] font-medium text-qeri-700 dark:bg-qeri-700/30 dark:text-qeri-200">
            demo mode
          </span>
        </div>
        <p className="line-clamp-6 text-sm whitespace-pre-line text-neutral-700 dark:text-neutral-300">
          {request.text}
        </p>
      </div>

      <Section title="In simple terms">
        <p className="text-sm leading-relaxed text-neutral-800 dark:text-neutral-200">
          {summary}
        </p>
      </Section>

      <Section title="Why it matters">
        <p className="text-sm leading-relaxed text-neutral-800 dark:text-neutral-200">
          {whyItMatters}
        </p>
      </Section>

      {keyTerms.length > 0 && (
        <Section title="Key terms">
          <dl className="flex flex-col gap-2">
            {keyTerms.map((entry) => (
              <div key={entry.term} className="text-sm">
                <dt className="font-semibold text-neutral-900 dark:text-neutral-100">
                  {entry.term}
                </dt>
                <dd className="text-neutral-600 dark:text-neutral-400">{entry.definition}</dd>
              </div>
            ))}
          </dl>
        </Section>
      )}

      <Section title="Example">
        <p className="text-sm leading-relaxed text-neutral-800 dark:text-neutral-200">
          {example}
        </p>
      </Section>

      {caveats.length > 0 && (
        <Section title="Caveats">
          <ul className="flex list-disc flex-col gap-1 pl-4 text-sm text-neutral-600 dark:text-neutral-400">
            {caveats.map((caveat) => (
              <li key={caveat}>{caveat}</li>
            ))}
          </ul>
        </Section>
      )}

      {followUps.length > 0 && (
        <Section title="Follow-ups">
          <div className="flex flex-wrap gap-2">
            {followUps.map((prompt) => (
              <span
                key={prompt}
                className="rounded-full border border-qeri-200 bg-qeri-50 px-3 py-1.5 text-xs font-medium text-qeri-700 opacity-70 dark:border-qeri-700/50 dark:bg-qeri-700/20 dark:text-qeri-200"
                title="Interactive follow-ups arrive with the AI integration in Phase 3"
              >
                <Lightbulb className="mr-1 inline h-3 w-3" />
                {prompt}
              </span>
            ))}
          </div>
        </Section>
      )}

      <footer className="mt-auto pt-2 text-center text-[11px] text-neutral-400">
        {meta.generator === 'mock' ? 'Demo content · ' : ''}
        {meta.generationMs} ms · schema v{meta.schemaVersion}
      </footer>
    </div>
  );
}

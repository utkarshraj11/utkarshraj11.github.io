import { forwardRef, type MouseEvent } from 'react';
import { FACTS, LINKS, PORTRAIT_URL, PROJECTS, STACK, WORK } from '../content';
import { TopBar } from './TopBar';

export const About = forwardRef<HTMLDivElement, { onHome: (e: MouseEvent) => void }>(function About({ onHome }, ref) {
  return (
    <div ref={ref} id="about" className="about" data-screen-label="About">
      <TopBar onHome={onHome} label="About" />

      <div className="about-spacer-top" />

      <div className="about-outer">
        <main className="about-main">
          <section className="intro">
            {PORTRAIT_URL ? (
              <img className="portrait" src={PORTRAIT_URL} alt="Utkarsh Raj" width={88} height={88} />
            ) : (
              <div className="portrait portrait-placeholder" aria-hidden="true">Photo</div>
            )}
            <p className="lede">I build full-stack applications, high-throughput backend services, and the Kubernetes platform they run on.</p>
            <p className="intro-body">I spent four and a half years at Hewlett Packard Enterprise doing exactly that, and I'm now an M.S. Computer Science student at UC Riverside. I'm looking for Summer 2027 software engineering internships.</p>
            <dl className="facts">
              {FACTS.map(([k, v]) => (
                <div className="fact" key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="list-section" aria-labelledby="h-work">
            <h2 id="h-work" className="section-label">work</h2>
            {WORK.map(w => (
              <article className="work" key={w.org}>
                <h3 className="item-title">{w.org}</h3>
                <div className="work-dates">{w.dates}</div>
                <div className="work-role">{w.role}</div>
                <p className="work-body">{w.body}</p>
              </article>
            ))}
          </section>

          <section className="list-section" aria-labelledby="h-projects">
            <h2 id="h-projects" className="section-label">projects</h2>
            {PROJECTS.map(p => (
              <article className="project" key={p.title}>
                <h3 className="item-title">{p.url ? <a href={p.url} target="_blank" rel="noopener">{p.title}</a> : p.title}</h3>
                <p className="project-body">{p.body}</p>
                <div className="mono-meta">{p.tags}</div>
              </article>
            ))}
          </section>

          <section className="list-section" aria-labelledby="h-stack">
            <h2 id="h-stack" className="section-label">stack</h2>
            {STACK.map(([cat, list], i) => (
              <div className="stack-row" key={cat}>
                <div className="stack-idx" aria-hidden="true">{String(i + 1).padStart(2, '0')}</div>
                <div className="stack-cat">{cat}</div>
                <div className="stack-list">{list}</div>
              </div>
            ))}
          </section>

          <footer className="about-footer">
            <p>Say hello at <a className="ul-link" href={`mailto:${LINKS.email}`}>{LINKS.email}</a></p>
            <a className="ul-link back-link" href="./" onClick={onHome}>↑ back up to the sky</a>
          </footer>
        </main>
      </div>

      <div className="about-spacer-bottom" />
    </div>
  );
});

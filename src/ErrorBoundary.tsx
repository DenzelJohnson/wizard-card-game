import { Component, type ReactNode } from 'react';

interface AppErrorBoundaryProps {
  readonly children: ReactNode;
}

interface AppErrorBoundaryState {
  readonly hasError: boolean;
}

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  override state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  override render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <main className="home-screen">
        <section
          className="home-screen__panel"
          role="alert"
          aria-labelledby="recovery-title"
        >
          <header className="home-hero">
            <p className="home-hero__eyebrow">A wayward enchantment</p>
            <h1 id="recovery-title" className="wizard-wordmark">
              The spell fizzled
            </h1>
          </header>
          <p>
            The table could not be displayed. If a valid match was saved, it is still safe.
          </p>
          <p>Return home and choose Continue Game to resume it.</p>
          <a className="button button--primary recovery-screen__action" href={import.meta.env.BASE_URL}>
            Return Home
          </a>
        </section>
      </main>
    );
  }
}

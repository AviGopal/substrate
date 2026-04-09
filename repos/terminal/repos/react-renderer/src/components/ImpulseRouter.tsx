import React from 'react';
import { TerminalRenderer } from '../renderers/TerminalRenderer';

interface Impulse {
  id: string;
  metadata: {
    shape: string;
    [key: string]: any;
  };
  content: any;
  pointer?: any;
}

interface ImpulseRouterProps {
  impulse: Impulse;
  interactive?: boolean;
  onUpdate?: (updatedImpulse: Impulse) => void;
  onInput?: (input: string) => void;
}

/**
 * Routes impulses to appropriate renderer based on shape
 */
export function ImpulseRouter({
  impulse,
  interactive = false,
  onUpdate,
  onInput
}: ImpulseRouterProps) {
  const shape = impulse.metadata.shape;

  switch (shape) {
    case 'terminalState':
      return (
        <TerminalRenderer
          impulse={impulse as any}
          interactive={interactive}
          onInput={onInput}
        />
      );

    case 'file':
      return (
        <div className="file-impulse">
          <h4>{impulse.id}</h4>
          <pre><code>{impulse.content}</code></pre>
        </div>
      );

    case 'test_result':
      return (
        <div className="test-result-impulse">
          <h4>{impulse.id}</h4>
          <pre>{JSON.stringify(impulse.content, null, 2)}</pre>
        </div>
      );

    case 'error':
      return (
        <div className="error-impulse">
          <h4>Error: {impulse.id}</h4>
          <pre className="error-message">{impulse.content}</pre>
        </div>
      );

    case 'git_diff':
      return (
        <div className="git-diff-impulse">
          <h4>Diff: {impulse.id}</h4>
          <pre className="diff">{impulse.content}</pre>
        </div>
      );

    default:
      // Fallback: JSON representation
      return (
        <div className="unknown-impulse">
          <h4>{impulse.id} ({shape})</h4>
          <details>
            <summary>View content</summary>
            <pre>{JSON.stringify(impulse, null, 2)}</pre>
          </details>
        </div>
      );
  }
}

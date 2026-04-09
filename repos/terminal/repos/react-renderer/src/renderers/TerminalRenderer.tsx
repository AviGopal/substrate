import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

interface TerminalImpulse {
  id: string;
  shape: 'terminalState';
  content: {
    state: {
      buffer: string;
      cursor: { row: number; col: number };
      shellHistory: string[];
      exitCode: number | null;
      running: boolean;
      pid: number;
      cwd: string;
    };
  };
  pointer?: {
    terminalId: string;
    persistenceKey?: string;
  };
}

interface TerminalRendererProps {
  impulse: TerminalImpulse;
  interactive?: boolean;
  onInput?: (input: string) => void;
  className?: string;
}

export function TerminalRenderer({
  impulse,
  interactive = false,
  onInput,
  className = ''
}: TerminalRendererProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Create xterm.js instance
    const terminal = new Terminal({
      rows: 24,
      cols: 80,
      cursorBlink: interactive,
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: interactive ? '#d4d4d4' : 'transparent'
      },
      fontFamily: '"Cascadia Code", "Fira Code", Menlo, Monaco, "Courier New", monospace',
      fontSize: 14,
      lineHeight: 1.2
    });

    // Add fit addon
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    // Add web links addon (clickable URLs)
    const webLinksAddon = new WebLinksAddon();
    terminal.loadAddon(webLinksAddon);

    // Open terminal
    terminal.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = terminal;

    // Render buffer content
    terminal.write(impulse.content.state.buffer);

    // Set cursor position if interactive
    if (interactive) {
      const { row, col } = impulse.content.state.cursor;
      terminal.write(`\x1b[${row};${col}H`);
    }

    // Handle input if interactive
    if (interactive && onInput) {
      terminal.onData((data) => {
        terminal.write(data); // Echo locally
        onInput(data);
      });
    }

    // Handle resize
    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      terminal.dispose();
    };
  }, [impulse.content.state.buffer, interactive]);

  const exitCodeClass =
    impulse.content.state.exitCode === null
      ? 'running'
      : impulse.content.state.exitCode === 0
      ? 'success'
      : 'error';

  return (
    <div className={`terminal-impulse ${className}`}>
      {/* Header */}
      <div className="terminal-header">
        <div className="terminal-info">
          <span className="terminal-id">{impulse.id}</span>
          <span className="terminal-pid">PID: {impulse.content.state.pid}</span>
          <span className="terminal-cwd">{impulse.content.state.cwd}</span>
        </div>
        <div className="terminal-status">
          {impulse.content.state.running ? (
            <span className="status-badge running">Running</span>
          ) : (
            <span className={`status-badge exit-code ${exitCodeClass}`}>
              Exit: {impulse.content.state.exitCode}
            </span>
          )}
        </div>
      </div>

      {/* Terminal display */}
      <div ref={terminalRef} className="terminal-content" />

      {/* Footer */}
      <div className="terminal-footer">
        <div className="shell-history">
          <strong>Last command:</strong>
          <code>
            {impulse.content.state.shellHistory.slice(-1)[0] || '(none)'}
          </code>
        </div>
        {interactive && (
          <div className="interactive-hint">
            Interactive mode: Type to send input
          </div>
        )}
      </div>
    </div>
  );
}

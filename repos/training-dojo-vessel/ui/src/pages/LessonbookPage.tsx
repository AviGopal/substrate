/**
 * LESSONBOOK — the shelf. Route `/lessonbook`.
 *
 * A book is a topic broken into an ordered curriculum: simple prompts first,
 * complex ones last. This page only lists books and creates new ones; a
 * book's own steps and its "Run all" live on `LessonbookDetailPage`.
 */
import { Link } from "@tanstack/react-router";
import { useState, type FormEvent, type ReactNode } from "react";
import { useBooks, useCreateBook } from "../api/queries";

function NewBookForm(): ReactNode {
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [description, setDescription] = useState("");
  const create = useCreateBook();

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    const t = title.trim();
    if (t.length === 0) return;
    create.mutate(
      { title: t, topic: topic.trim(), description: description.trim() },
      {
        onSuccess: () => {
          setTitle("");
          setTopic("");
          setDescription("");
        },
      },
    );
  };

  return (
    <form className="sf-region" onSubmit={submit}>
      <div className="sf-region-head">
        <h2 className="sf-region-title">New book</h2>
      </div>
      <div className="sf-region-body" style={{ display: "flex", flexDirection: "column", gap: "var(--sf-space-3)" }}>
        <div>
          <label className="sf-label" htmlFor="sf-book-title">
            Title
          </label>
          <input
            id="sf-book-title"
            className="sf-input"
            placeholder="Architecting a Database"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div>
          <label className="sf-label" htmlFor="sf-book-topic">
            Topic
          </label>
          <input
            id="sf-book-topic"
            className="sf-input"
            placeholder="database architecture"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
        </div>
        <div>
          <label className="sf-label" htmlFor="sf-book-description">
            What this book is for (optional)
          </label>
          <textarea
            id="sf-book-description"
            className="sf-textarea"
            style={{ minHeight: "3.5rem" }}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <button
          type="submit"
          className="sf-button sf-button-primary"
          style={{ alignSelf: "flex-start" }}
          disabled={create.isPending || title.trim().length === 0}
        >
          {create.isPending ? "Creating…" : "Create book"}
        </button>
        {create.isError ? (
          <p className="sf-error">Not created: {(create.error as Error).message}.</p>
        ) : null}
      </div>
    </form>
  );
}

export function LessonbookPage(): ReactNode {
  const books = useBooks();

  return (
    <>
      <Link to="/" className="sf-back-link">
        ← back to lessons
      </Link>

      <section className="sf-region" aria-labelledby="sf-lessonbook-title">
        <div className="sf-region-head">
          <h2 className="sf-region-title" id="sf-lessonbook-title">
            Lessonbook
          </h2>
        </div>
        <div className="sf-region-body">
          <p className="sf-note sf-muted">
            A book is a topic taught as an ordered curriculum — simple prompts first, harder ones
            built on top. Open one and press "Start reading" to run it step by step, each prompt
            sent only once the one before it reached.
          </p>

          {books.isError ? (
            <p className="sf-error">The shelf could not be read: {(books.error as Error).message}.</p>
          ) : null}
          {books.isLoading ? <p className="sf-empty">Reading the shelf…</p> : null}
          {!books.isLoading && !books.isError && (books.data?.length ?? 0) === 0 ? (
            <p className="sf-empty">
              <strong>No books yet.</strong> Create one below — a title and a topic is all it takes.
            </p>
          ) : null}

          {books.data && books.data.length > 0 ? (
            <ul className="sf-book-shelf">
              {books.data.map((b) => (
                <li key={b.id}>
                  <Link to="/lessonbook/$bookId" params={{ bookId: b.id }} className="sf-book-card">
                    <div className="sf-book-card-head">
                      <span className="sf-book-card-title">{b.title}</span>
                      {b.topic ? <span className="sf-shape-badge">{b.topic}</span> : null}
                    </div>
                    {b.description ? <p className="sf-note sf-muted">{b.description}</p> : null}
                    <div className="sf-book-progress-track">
                      <div
                        className="sf-book-progress-fill"
                        style={{ width: `${b.stepCount === 0 ? 0 : Math.round((b.reachedCount / b.stepCount) * 100)}%` }}
                      />
                    </div>
                    <span className="sf-note sf-mono">
                      {b.reachedCount} / {b.stepCount} reached
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>

      <NewBookForm />
    </>
  );
}

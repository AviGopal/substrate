// P2 VIOLATION: picking a starter fires the goal instead of filling the input.
// Two spellings, because respelling the parameters must not be an escape:
// a plainly-named handler, and one whose params are destructured — the first
// brace after that declaration is the destructure, not the body.
export function StarterRow({ text }: { text: string }) {
  const handleStarterPick = (value: string) => {
    dispatchGoal(value);
  };
  return <button onClick={() => handleStarterPick(text)}>{text}</button>;
}

export function SuggestionChip({ label }: { label: string }) {
  const onSuggestionPick = ({ value }: { value: string }) => {
    submitGoal(value);
  };
  return <button onClick={() => onSuggestionPick({ value: label })}>{label}</button>;
}

export function StarterRow({ text, setInput }: { text: string; setInput: (v: string) => void }) {
  const handleStarterPick = (value: string) => {
    setInput(value);
  };
  return <button onClick={() => handleStarterPick(text)}>{text}</button>;
}

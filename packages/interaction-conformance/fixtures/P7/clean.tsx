import { VERDICT_OPTIONS } from './verdict-options';

export function Feedback({ onPick }: any) {
  return <VerdictPicker options={VERDICT_OPTIONS} onPick={onPick} />;
}

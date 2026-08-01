// Instrument Serif sets the wordmark's n–d pair too loose, so the "da" gets
// a hand-tuned tuck. Every "Kynda" set in the display face renders through
// this component so the kerning lives in one place.
export default function Wordmark() {
  return (
    <>Kyn<span style={{ marginLeft: "-0.045em" }}>da</span></>
  );
}

// Joins class names without merging. For client components on jobseeker routes whose classes
// never override each other: `cn` pulls in the ~28 KB class merger, which the 200 KB budget
// for those routes (TRD §8) can't afford. Use `cn` whenever a class may override another.
export const cx = (...classes: (string | false | null | undefined)[]) =>
  classes.filter(Boolean).join(" ");

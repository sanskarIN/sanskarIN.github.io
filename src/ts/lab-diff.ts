// Local line-by-line comparison. Bounded dynamic programming avoids UI stalls.
(() => {
  const root = document.querySelector<HTMLElement>("[data-diff-tool]");
  if (!root) return;
  const before = root.querySelector<HTMLTextAreaElement>("[data-diff-before]");
  const after = root.querySelector<HTMLTextAreaElement>("[data-diff-after]");
  const compare = root.querySelector<HTMLButtonElement>("[data-diff-compare]");
  const example = root.querySelector<HTMLButtonElement>("[data-diff-example]");
  const clear = root.querySelector<HTMLButtonElement>("[data-diff-clear]");
  const copy = root.querySelector<HTMLButtonElement>("[data-diff-copy]");
  const status = root.querySelector<HTMLElement>("[data-diff-status]");
  const output = root.querySelector<HTMLOListElement>("[data-diff-output]");
  if (!before || !after || !compare || !example || !clear || !copy || !status || !output) return;

  type DiffLine = { kind: "same" | "added" | "removed"; text: string };
  let copiedText = "";
  const say = (message: string, state: "info" | "success" | "error"): void => {
    status.textContent = message;
    status.dataset.state = state;
  };
  const reset = (): void => {
    output.replaceChildren();
    copy.disabled = true;
    copiedText = "";
  };
  const lines = (value: string): string[] => value === "" ? [] : value.replace(/\r\n?/g, "\n").split("\n");
  const diff = (a: string[], b: string[]): DiffLine[] => {
    const columns = b.length + 1;
    const matrix = new Uint16Array((a.length + 1) * columns);
    for (let i = a.length - 1; i >= 0; i--) {
      for (let j = b.length - 1; j >= 0; j--) {
        const at = i * columns + j;
        matrix[at] = a[i] === b[j] ? 1 + matrix[(i + 1) * columns + j + 1]
          : Math.max(matrix[(i + 1) * columns + j], matrix[i * columns + j + 1]);
      }
    }
    const change: DiffLine[] = [];
    let i = 0;
    let j = 0;
    while (i < a.length || j < b.length) {
      if (i < a.length && j < b.length && a[i] === b[j]) {
        change.push({ kind: "same", text: a[i++] });
        j++;
      } else if (i < a.length && (j === b.length ||
        matrix[(i + 1) * columns + j] >= matrix[i * columns + j + 1])) {
        change.push({ kind: "removed", text: a[i++] });
      } else {
        change.push({ kind: "added", text: b[j++] });
      }
    }
    return change;
  };
  const execute = (): void => {
    reset();
    if (before.value.length > 32000 || after.value.length > 32000) {
      return say("Each text is limited to 32,000 characters.", "error");
    }
    const a = lines(before.value);
    const b = lines(after.value);
    if (a.length > 300 || b.length > 300) {
      return say("Each text is limited to 300 lines.", "error");
    }
    if (a.length === 0 && b.length === 0) return say("Enter text on either side.", "info");
    const changed = diff(a, b);
    let added = 0;
    let removed = 0;
    for (const entry of changed) {
      if (entry.kind === "added") added++;
      if (entry.kind === "removed") removed++;
      const item = document.createElement("li");
      item.className = `lab-diff-line lab-diff-line--${entry.kind}`;
      const marker = entry.kind === "same" ? " " : entry.kind === "added" ? "+" : "−";
      item.textContent = marker + " " + entry.text;
      output.append(item);
    }
    copiedText = changed.map((entry) => (entry.kind === "same" ? " " : entry.kind === "added" ? "+" : "-") + " " + entry.text).join("\n");
    copy.disabled = false;
    say(added === 0 && removed === 0 ? "Texts are identical." : `${added} added · ${removed} removed · ${changed.length - added - removed} unchanged lines.`, "success");
  };
  compare.addEventListener("click", execute);
  for (const element of [before, after]) {
    element.addEventListener("input", () => { reset(); say("Text changed. Select Compare.", "info"); });
  }
  example.addEventListener("click", () => {
    reset();
    before.value = "# Release notes\n- Fix login\n- Improve editor";
    after.value = "# Release notes\n- Fix login\n- Improve search\n- Improve editor";
    say("Example loaded. Select Compare.", "info");
  });
  clear.addEventListener("click", () => {
    reset();
    before.value = "";
    after.value = "";
    say("Cleared.", "info");
    before.focus();
  });
  copy.addEventListener("click", () => {
    if (copy.disabled) return;
    if (!navigator.clipboard?.writeText) return say("Clipboard unavailable. Select the comparison manually.", "error");
    void navigator.clipboard.writeText(copiedText)
      .then(() => say("Comparison copied.", "success"))
      .catch(() => say("Clipboard permission denied. Select the comparison manually.", "error"));
  });
})();

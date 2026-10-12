/** `1536` → "2 KB", `5242880` → "5.0 MB": file sizes as the file fields show them. */
export const formatSize = (bytes: number): string => {
  if (bytes < 1024) {
    return `${String(bytes)} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** Whether a picked file fits `<input accept>` syntax (`"image/*,.pdf"`); no accept → any. */
export const matchesAccept = (file: File, accept: string | undefined): boolean => {
  if (!accept) {
    return true;
  }
  const extension = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
  return accept
    .split(",")
    .map((rule) => rule.trim().toLowerCase())
    .some((rule) => {
      if (rule.startsWith(".")) {
        return rule === extension;
      }
      if (rule.endsWith("/*")) {
        return file.type.toLowerCase().startsWith(rule.slice(0, -1));
      }
      return file.type.toLowerCase() === rule;
    });
};

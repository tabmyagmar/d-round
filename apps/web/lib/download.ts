/**
 * Hands the browser a file to save: text the API returned (a CSV import's error CSV) as a Blob
 * link clicked once, or a signed read URL (a CSV download's workbook), whose
 * `Content-Disposition` names the file. No new window, so no popup blocker after an await.
 */
const click = (url: string, fileName?: string) => {
  const link = document.createElement("a");
  link.href = url;
  if (fileName !== undefined) {
    link.download = fileName;
  }
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
};

export const saveTextFile = (text: string, fileName: string, type = "text/csv;charset=utf-8") => {
  const url = URL.createObjectURL(new Blob([text], { type }));
  click(url, fileName);
  // Revoked once the save has surely started: Firefox and Safari read the URL after the click
  // returns (FileSaver.js waits 40 s as well).
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 40_000);
};

export const downloadFromUrl = (url: string) => {
  click(url);
};

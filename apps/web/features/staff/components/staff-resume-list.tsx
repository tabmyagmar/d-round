import { FileTextIcon } from "lucide-react";

export type StaffResumeFile = { id: string; name: string; url?: string | undefined };

const ROW = "flex items-center gap-3 rounded-lg bg-muted/50 p-4 text-sm font-medium";

/**
 * The 履歴書 files as the legacy listed them (`StaffResume`, `StaffFormConfirm`): one row per PDF,
 * opened in a new tab when it has a read URL, 未アップロード without any.
 */
export const StaffResumeList = ({ files }: { files: readonly StaffResumeFile[] }) =>
  files.length > 0 ? (
    <ul className="flex flex-col gap-2">
      {files.map((file) => (
        <li key={file.id}>
          {file.url ? (
            <a
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`${ROW} transition-colors hover:bg-muted`}
            >
              <FileTextIcon className="size-5 shrink-0 text-destructive" />
              <span className="min-w-0 truncate">{file.name}</span>
            </a>
          ) : (
            <div className={ROW}>
              <FileTextIcon className="size-5 shrink-0 text-destructive" />
              <span className="min-w-0 truncate">{file.name}</span>
            </div>
          )}
        </li>
      ))}
    </ul>
  ) : (
    <p className="py-4 text-center text-sm text-muted-foreground">未アップロード</p>
  );

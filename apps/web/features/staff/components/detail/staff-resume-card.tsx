import { ContentCard } from "@repo/ui/components/composed/content-card";

import { StaffResumeList } from "@/features/staff/components/staff-resume-list";
import type { StaffDetail } from "@/features/staff/types";

/** 履歴書をアップロード, the legacy StaffResume card: the stored PDFs, each opening in a new tab. */
export const StaffResumeCard = ({ resumes }: { resumes: StaffDetail["resumes"] }) => (
  <ContentCard title="履歴書をアップロード">
    <StaffResumeList
      files={resumes.map((resume) => ({ id: resume.id, name: resume.fileName, url: resume.url }))}
    />
  </ContentCard>
);

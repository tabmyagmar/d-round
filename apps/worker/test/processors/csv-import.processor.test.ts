import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createAppAuth } from "@repo/api/jobs";
import type { JobDeps } from "@repo/api/jobs";
import {
  createAttachmentDeleteQueue,
  createCsvImportQueue,
  createEmailQueue,
  csvCheckJobId,
  enqueueCsvCheckJob,
} from "@repo/queue";
import type { AttachmentDeleteQueue, CsvImportQueue, EmailQueue } from "@repo/queue";
import { createMemoryStorage } from "@repo/storage";
import type { MemoryStorage } from "@repo/storage";

import { createCsvImportWorker } from "../../src/processors/csv-import.processor";
import type { WorkerHarness } from "../support";
import {
  createCsvImportRow,
  createWorkerHarness,
  isolatedCsvImportQueue,
  waitForJobDone,
} from "../support";

let h: WorkerHarness;
let emailQueue: EmailQueue;
let attachmentDeleteQueue: AttachmentDeleteQueue;
let csvImportQueue: CsvImportQueue;

beforeAll(async () => {
  h = await createWorkerHarness();
  emailQueue = createEmailQueue(h.connection);
  attachmentDeleteQueue = createAttachmentDeleteQueue(h.connection);
  csvImportQueue = createCsvImportQueue(h.connection);
});

afterAll(async () => {
  await emailQueue.close();
  await attachmentDeleteQueue.close();
  await csvImportQueue.close();
  await h.stop();
});

/** What the worker's composition root hands the CSV processor. */
const jobDeps = (storage: MemoryStorage): JobDeps => ({
  db: h.db,
  logger: h.logger,
  redis: h.connection,
  auth: createAppAuth({
    db: h.db,
    emailQueue,
    logger: h.logger,
    secret: "test-secret-test-secret-test-secret-1234",
    apiUrl: "http://localhost:4000",
    webOrigin: "http://localhost:3000",
  }),
  webOrigin: "http://localhost:3000",
  storage,
  attachmentDeleteQueue,
  csvImportQueue,
});

/** Runs the check job of `csvImportId` through a real worker on an isolated queue. */
const runCheck = async (csvImportId: string, storage: MemoryStorage): Promise<string> => {
  const { name, queue } = isolatedCsvImportQueue(h.connection);
  const worker = createCsvImportWorker({
    ...jobDeps(storage),
    connection: h.connection,
    queueName: name,
  });
  try {
    await enqueueCsvCheckJob(queue, csvImportId);
    return await waitForJobDone(queue, csvCheckJobId(csvImportId));
  } finally {
    await worker.close();
    await queue.obliterate({ force: true });
    await queue.close();
  }
};

const statusOf = (id: string) => h.db.csvImport.findUniqueOrThrow({ where: { id } });

describe("csv import processor", () => {
  it("runs the check of an uploaded file through the API's runner", async () => {
    const storage = createMemoryStorage();
    const csvImport = await createCsvImportRow(h.db);
    const body = new TextEncoder().encode("社員番号,姓\r\n1,山田\r\n");
    storage.put(csvImport.objectKey, { size: body.length, contentType: "text/csv", body });

    expect(await runCheck(csvImport.id, storage)).toBe("completed");

    expect(await statusOf(csvImport.id)).toMatchObject({
      status: "CHECKED",
      fileError: expect.stringMatching(/^必要な列がありません/) as unknown,
    });
  });

  it("tries a failed check again: only the last attempt may fail the import", async () => {
    const storage = createMemoryStorage();
    const csvImport = await createCsvImportRow(h.db);
    const body = new TextEncoder().encode("社員番号,姓\r\n1,山田\r\n");
    storage.put(csvImport.objectKey, { size: body.length, contentType: "text/csv", body });
    let downloads = 0;
    const flaky = {
      ...storage,
      download: (key: string) => {
        downloads += 1;
        return downloads === 1 ? Promise.reject(new Error("bucket down")) : storage.download(key);
      },
    };

    expect(await runCheck(csvImport.id, flaky as MemoryStorage)).toBe("completed");

    expect(downloads).toBe(2);
    expect((await statusOf(csvImport.id)).status).toBe("CHECKED");
  });

  it("tells the runner about the last attempt, so a check that keeps failing fails the import", async () => {
    const storage = createMemoryStorage();
    const failing = { ...storage, download: () => Promise.reject(new Error("bucket down")) };
    const csvImport = await createCsvImportRow(h.db);

    expect(await runCheck(csvImport.id, failing as MemoryStorage)).toBe("completed");

    expect(await statusOf(csvImport.id)).toMatchObject({
      status: "FAILED",
      lastError: expect.stringMatching(/^確認中にエラーが発生しました/) as unknown,
    });
  });

  it("drops the job of an import that does not exist, without retrying it", async () => {
    expect(await runCheck(crypto.randomUUID(), createMemoryStorage())).toBe("failed");
  });
});

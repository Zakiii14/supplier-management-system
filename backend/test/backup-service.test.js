const assert = require("node:assert/strict");
const fs = require("node:fs");
const fsPromises = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const {
  createBackupBundle,
  pruneBackupBundles,
  restoreBackupBundle,
  verifyBackupBundle,
} = require("../src/backup/backupService");

const createFixture = async () => {
  const root = await fsPromises.mkdtemp(path.join(os.tmpdir(), "supplyflow-backup-test-"));
  const storageRoot = path.join(root, "storage");
  const backupRoot = path.join(root, "backups");
  const storageTargets = [
    { namespace: "payment-proofs", directory: path.join(storageRoot, "payment-proofs") },
    { namespace: "user-avatars", directory: path.join(storageRoot, "user-avatars") },
    { namespace: "supplier-invoices", directory: path.join(storageRoot, "supplier-invoices") },
  ];

  for (const target of storageTargets) await fsPromises.mkdir(target.directory, { recursive: true });
  await fsPromises.writeFile(path.join(storageTargets[0].directory, "proof.pdf"), "proof-v1");
  await fsPromises.writeFile(path.join(storageTargets[1].directory, "avatar.png"), "avatar-v1");
  await fsPromises.writeFile(path.join(storageTargets[2].directory, "invoice.pdf"), "invoice-v1");

  return { root, backupRoot, storageTargets };
};

const fakeDump = async (destination) => {
  await fsPromises.writeFile(destination, Buffer.from("PGDMP-supplyflow-test"));
};

test("backup bundle snapshots PostgreSQL dump and private storage with checksums", async () => {
  const fixture = await createFixture();
  try {
    const result = await createBackupBundle({
      backupRoot: fixture.backupRoot,
      storageTargets: fixture.storageTargets,
      dumpDatabase: fakeDump,
      consistencyMode: "maintenance",
      now: () => new Date("2026-09-16T00:00:00.000Z"),
      backupId: "abcdef12",
    });

    assert.match(path.basename(result.backupDirectory), /^supplyflow-20260916T000000Z-abcdef12$/);
    const verified = await verifyBackupBundle(result.backupDirectory);
    assert.equal(verified.manifest.consistency_mode, "maintenance");
    assert.equal(verified.manifest.storage.length, 3);
    assert.equal(verified.storageFileCount, 3);
    assert.equal(
      await fsPromises.readFile(
        path.join(result.backupDirectory, "files", "payment-proofs", "proof.pdf"),
        "utf8",
      ),
      "proof-v1",
    );
  } finally {
    await fsPromises.rm(fixture.root, { recursive: true, force: true });
  }
});

test("backup verification rejects tampered database or storage files", async () => {
  const fixture = await createFixture();
  try {
    const result = await createBackupBundle({
      backupRoot: fixture.backupRoot,
      storageTargets: fixture.storageTargets,
      dumpDatabase: fakeDump,
      now: () => new Date("2026-09-16T00:00:00.000Z"),
      backupId: "feedbeef",
    });

    const proofPath = path.join(
      result.backupDirectory,
      "files",
      "payment-proofs",
      "proof.pdf",
    );
    await fsPromises.writeFile(proofPath, "tampered");
    await assert.rejects(
      verifyBackupBundle(result.backupDirectory),
      /Storage backup checksum verification failed/,
    );
  } finally {
    await fsPromises.rm(fixture.root, { recursive: true, force: true });
  }
});

test("backup verification rejects files that are not tracked by the manifest", async () => {
  const fixture = await createFixture();
  try {
    const result = await createBackupBundle({
      backupRoot: fixture.backupRoot,
      storageTargets: fixture.storageTargets,
      dumpDatabase: fakeDump,
      backupId: "facefeed",
    });

    await fsPromises.writeFile(
      path.join(result.backupDirectory, "files", "payment-proofs", "untracked.pdf"),
      "not-in-manifest",
    );

    await assert.rejects(
      verifyBackupBundle(result.backupDirectory),
      /Storage backup manifest does not match files|untracked file/,
    );
  } finally {
    await fsPromises.rm(fixture.root, { recursive: true, force: true });
  }
});

test("restore requires confirmation and replaces storage from a verified bundle", async () => {
  const fixture = await createFixture();
  try {
    const result = await createBackupBundle({
      backupRoot: fixture.backupRoot,
      storageTargets: fixture.storageTargets,
      dumpDatabase: fakeDump,
      backupId: "1234abcd",
    });

    await fsPromises.writeFile(path.join(fixture.storageTargets[0].directory, "proof.pdf"), "live-v2");
    await fsPromises.writeFile(path.join(fixture.storageTargets[0].directory, "extra.pdf"), "extra");

    await assert.rejects(
      restoreBackupBundle({
        backupDirectory: result.backupDirectory,
        storageTargets: fixture.storageTargets,
        restoreDatabase: async () => {},
      }),
      /explicit confirmation/,
    );

    let restoredDump = null;
    await restoreBackupBundle({
      backupDirectory: result.backupDirectory,
      storageTargets: fixture.storageTargets,
      restoreDatabase: async (source) => {
        restoredDump = source;
      },
      confirmRestore: true,
    });

    assert.equal(path.basename(restoredDump), "database.dump");
    assert.equal(
      await fsPromises.readFile(path.join(fixture.storageTargets[0].directory, "proof.pdf"), "utf8"),
      "proof-v1",
    );
    assert.equal(fs.existsSync(path.join(fixture.storageTargets[0].directory, "extra.pdf")), false);
  } finally {
    await fsPromises.rm(fixture.root, { recursive: true, force: true });
  }
});

test("failed database restore rolls live storage back to its pre-restore state", async () => {
  const fixture = await createFixture();
  try {
    const result = await createBackupBundle({
      backupRoot: fixture.backupRoot,
      storageTargets: fixture.storageTargets,
      dumpDatabase: fakeDump,
      backupId: "deadbeef",
    });

    const liveProof = path.join(fixture.storageTargets[0].directory, "proof.pdf");
    await fsPromises.writeFile(liveProof, "live-before-restore");

    await assert.rejects(
      restoreBackupBundle({
        backupDirectory: result.backupDirectory,
        storageTargets: fixture.storageTargets,
        restoreDatabase: async () => {
          throw new Error("pg_restore failed");
        },
        confirmRestore: true,
      }),
      /pg_restore failed/,
    );

    assert.equal(await fsPromises.readFile(liveProof, "utf8"), "live-before-restore");
  } finally {
    await fsPromises.rm(fixture.root, { recursive: true, force: true });
  }
});

test("retention cleanup removes only valid backup bundles older than the cutoff", async () => {
  const fixture = await createFixture();
  try {
    const oldBackup = await createBackupBundle({
      backupRoot: fixture.backupRoot,
      storageTargets: fixture.storageTargets,
      dumpDatabase: fakeDump,
      now: () => new Date("2026-08-01T00:00:00.000Z"),
      backupId: "aaaabbbb",
    });
    const recentBackup = await createBackupBundle({
      backupRoot: fixture.backupRoot,
      storageTargets: fixture.storageTargets,
      dumpDatabase: fakeDump,
      now: () => new Date("2026-09-10T00:00:00.000Z"),
      backupId: "ccccdddd",
    });

    const removed = await pruneBackupBundles({
      backupRoot: fixture.backupRoot,
      retentionDays: 14,
      now: () => new Date("2026-09-16T00:00:00.000Z"),
    });

    assert.deepEqual(removed, [oldBackup.backupDirectory]);
    assert.equal(fs.existsSync(oldBackup.backupDirectory), false);
    assert.equal(fs.existsSync(recentBackup.backupDirectory), true);
  } finally {
    await fsPromises.rm(fixture.root, { recursive: true, force: true });
  }
});

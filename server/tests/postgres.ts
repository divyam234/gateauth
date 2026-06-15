import { chmod, chown, mkdtemp, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

export interface TestPostgres {
  databaseURL: string;
  stop(): Promise<void>;
}

async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") return reject(new Error("Unable to allocate PostgreSQL port"));
      const port = address.port;
      server.close(() => resolve(port));
    });
  });
}

function command(binary: string, args: string[], options: { uid?: number; gid?: number; env?: NodeJS.ProcessEnv } = {}) {
  const result = spawnSync(binary, args, {
    encoding: "utf8",
    env: { ...process.env, ...options.env },
    uid: options.uid,
    gid: options.gid,
  });
  if (result.status !== 0) {
    throw new Error(`${binary} ${args.join(" ")} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  }
  return result.stdout;
}

function findPostgresOnPath(): string | null {
  for (const directory of (process.env.PATH ?? "").split(path.delimiter)) {
    if (!directory) continue;
    const initdb = path.join(directory, "initdb");
    if (existsSync(initdb)) return path.dirname(directory);
  }
  return null;
}

async function resolvePostgresHome(workDir: string): Promise<string> {
  const configured = process.env.POSTGRES_HOME;
  if (configured) {
    if (existsSync(path.join(configured, "bin", "initdb"))) return configured;
    throw new Error(`POSTGRES_HOME does not contain bin/initdb: ${configured}`);
  }

  const archive = process.env.POSTGRES_ARCHIVE;
  if (archive) {
    if (!existsSync(archive)) {
      throw new Error(`POSTGRES_ARCHIVE does not exist: ${archive}`);
    }
    const home = path.join(workDir, "postgres");
    await mkdir(home, { recursive: true });
    command("tar", ["-xzf", archive, "-C", home, "--strip-components=1"]);
    return home;
  }

  const postgresHome = findPostgresOnPath();
  if (postgresHome) return postgresHome;

  throw new Error(
    "PostgreSQL binaries not found. Set POSTGRES_HOME, POSTGRES_ARCHIVE, or add initdb to PATH.",
  );
}

export async function startTestPostgres(): Promise<TestPostgres> {
  if (process.env.TEST_DATABASE_URL) {
    return { databaseURL: process.env.TEST_DATABASE_URL, stop: async () => undefined };
  }

  const workDir = await mkdtemp(path.join(os.tmpdir(), "gatehouse-pg-"));
  const postgresHome = await resolvePostgresHome(workDir);
  const dataDir = path.join(workDir, "data");
  const logFile = path.join(workDir, "postgres.log");
  await mkdir(dataDir, { recursive: true });
  await chmod(workDir, 0o755);
  await chmod(dataDir, 0o700);

  const runningAsRoot = typeof process.getuid === "function" && process.getuid() === 0;
  const uid = runningAsRoot ? Number(process.env.TEST_POSTGRES_UID || 1000) : undefined;
  const gid = runningAsRoot ? Number(process.env.TEST_POSTGRES_GID || 1000) : undefined;
  if (runningAsRoot && uid != null && gid != null) {
    await chown(workDir, uid, gid);
    await chown(dataDir, uid, gid);
  }

  const bin = (name: string) => path.join(postgresHome, "bin", name);
  command(bin("initdb"), ["-D", dataDir, "-A", "trust", "-U", "postgres", "--no-locale", "--encoding=UTF8"], { uid, gid });
  const port = await findFreePort();
  command(bin("pg_ctl"), ["-D", dataDir, "-o", `-p ${port} -h 127.0.0.1`, "-l", logFile, "start", "-w"], { uid, gid });
  command(bin("createdb"), ["-h", "127.0.0.1", "-p", String(port), "-U", "postgres", "gatehouse_test"], { uid, gid });

  return {
    databaseURL: `postgresql://postgres@127.0.0.1:${port}/gatehouse_test`,
    async stop() {
      try {
        command(bin("pg_ctl"), ["-D", dataDir, "stop", "-m", "fast", "-w"], { uid, gid });
      } finally {
        await rm(workDir, { recursive: true, force: true });
      }
    },
  };
}

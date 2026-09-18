export interface TestPostgres {
  databaseURL: string;
  stop(): Promise<void>;
}

type CommandOptions = {
  uid?: number;
  gid?: number;
  env?: Record<string, string | undefined>;
};

function parent(path: string): string {
  const normalized = path.replace(/\/+$/, "");
  const index = normalized.lastIndexOf("/");
  return index > 0 ? normalized.slice(0, index) : "/";
}

function command(binary: string, args: string[], options: CommandOptions = {}): string {
  let cmd = [binary, ...args];

  if (options.uid != null || options.gid != null) {
    const setpriv = Bun.which("setpriv");
    if (!setpriv || options.uid == null || options.gid == null) {
      throw new Error(
        "Running local PostgreSQL integration tests as root requires setpriv, or set TEST_DATABASE_URL.",
      );
    }
    cmd = [
      setpriv,
      `--reuid=${options.uid}`,
      `--regid=${options.gid}`,
      "--clear-groups",
      "--",
      binary,
      ...args,
    ];
  }

  const result = Bun.spawnSync(cmd, {
    env: { ...process.env, ...options.env },
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = result.stdout?.toString() ?? "";
  const stderr = result.stderr?.toString() ?? "";

  if (!result.success) {
    throw new Error(`${cmd.join(" ")} failed\nstdout:\n${stdout}\nstderr:\n${stderr}`);
  }
  return stdout;
}

async function findFreePort(): Promise<number> {
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: () => new Response(null, { status: 204 }),
  });
  const port = server.port;
  await server.stop(true);
  if (port == null) throw new Error("Unable to allocate PostgreSQL port");
  return port;
}

async function resolvePostgresHome(workDir: string): Promise<string> {
  const configured = process.env.POSTGRES_HOME;
  if (configured) {
    if (await Bun.file(`${configured}/bin/initdb`).exists()) return configured;
    throw new Error(`POSTGRES_HOME does not contain bin/initdb: ${configured}`);
  }

  const archive = process.env.POSTGRES_ARCHIVE;
  if (archive) {
    if (!(await Bun.file(archive).exists())) {
      throw new Error(`POSTGRES_ARCHIVE does not exist: ${archive}`);
    }
    const home = `${workDir}/postgres`;
    command("mkdir", ["-p", home]);
    command("tar", ["-xzf", archive, "-C", home, "--strip-components=1"]);
    return home;
  }

  const initdb = Bun.which("initdb");
  if (initdb) {
    const resolved = command("realpath", [initdb]).trim() || initdb;
    return parent(parent(resolved));
  }

  throw new Error(
    "PostgreSQL binaries not found. Set POSTGRES_HOME, POSTGRES_ARCHIVE, TEST_DATABASE_URL, or add initdb to PATH.",
  );
}

export async function startTestPostgres(): Promise<TestPostgres> {
  if (process.env.TEST_DATABASE_URL) {
    return { databaseURL: process.env.TEST_DATABASE_URL, stop: async () => undefined };
  }

  const tempRoot = process.env.TMPDIR || "/tmp";
  const workDir = command("mktemp", ["-d", `${tempRoot.replace(/\/$/, "")}/gateauth-pg-XXXXXX`]).trim();
  const postgresHome = await resolvePostgresHome(workDir);
  const dataDir = `${workDir}/data`;
  const logFile = `${workDir}/postgres.log`;
  command("mkdir", ["-p", dataDir]);
  command("chmod", ["755", workDir]);
  command("chmod", ["700", dataDir]);

  const runningAsRoot = typeof process.getuid === "function" && process.getuid() === 0;
  const uid = runningAsRoot ? Number(process.env.TEST_POSTGRES_UID || 1000) : undefined;
  const gid = runningAsRoot ? Number(process.env.TEST_POSTGRES_GID || 1000) : undefined;
  if (runningAsRoot && uid != null && gid != null) {
    command("chown", [`${uid}:${gid}`, workDir]);
    command("chown", [`${uid}:${gid}`, dataDir]);
  }

  const bin = (name: string) => `${postgresHome}/bin/${name}`;
  command(
    bin("initdb"),
    ["-D", dataDir, "-A", "trust", "-U", "postgres", "--no-locale", "--encoding=UTF8"],
    { uid, gid },
  );
  const port = await findFreePort();
  command(
    bin("pg_ctl"),
    ["-D", dataDir, "-o", `-p ${port} -h 127.0.0.1 -k ${workDir}`, "-l", logFile, "start", "-w"],
    { uid, gid },
  );
  command(
    bin("createdb"),
    ["-h", "127.0.0.1", "-p", String(port), "-U", "postgres", "gateauth_test"],
    { uid, gid },
  );

  return {
    databaseURL: `postgresql://postgres@127.0.0.1:${port}/gateauth_test`,
    async stop() {
      try {
        command(bin("pg_ctl"), ["-D", dataDir, "stop", "-m", "fast", "-w"], { uid, gid });
      } finally {
        command("rm", ["-rf", workDir]);
      }
    },
  };
}

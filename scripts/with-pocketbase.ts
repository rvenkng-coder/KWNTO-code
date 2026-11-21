import { spawnSync } from 'node:child_process'

const COMPOSE_FILE = 'compose.test.yaml'
// KWNTO_TEST_PB_PORT moves the test PocketBase so two worktrees can run at once.
const PB_URL = process.env.KWNTO_PB_URL ?? `http://127.0.0.1:${process.env.KWNTO_TEST_PB_PORT ?? '8091'}`

const command = process.argv.slice(2)
if (command.length === 0) {
  console.error('Usage: node scripts/with-pocketbase.ts <command...>')
  process.exit(1)
}

function runDockerCompose(...args: string[]) {
  return spawnSync('docker', ['compose', '-f', COMPOSE_FILE, ...args], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
}

// Clears a stale container from a crashed run
runDockerCompose('down', '-v', '--remove-orphans')

// Start the test container and wait until healthy
const up = runDockerCompose('up', '-d', '--build', '--wait')
if (up.status !== 0) {
  process.exit(up.status ?? 1)
}

let exitCode: number
try {
  const [cmd, ...args] = command
  const child = spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      KWNTO_PB_URL: PB_URL,
    },
  })
  exitCode = child.status ?? 1
} finally {
  runDockerCompose('down', '-v')
}

process.exit(exitCode)

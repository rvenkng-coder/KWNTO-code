import net from 'node:net'

// A throwaway SMTP server for tests that must see whether PocketBase sent a mail. It
// accepts every message, keeps the text of each, and never relays anything. The test
// backend runs in Docker, so it reaches this server through host.docker.internal
// (compose.test.yaml maps it to the host), which is why it listens on all interfaces.

export const SMTP_HOST_FOR_BACKEND = 'host.docker.internal'

export type FakeSmtp = { port: number; messages: string[]; close: () => Promise<void> }

function serve(socket: net.Socket, messages: string[]): void {
  let inData = false
  let current: string[] = []
  let pending = ''
  socket.write('220 fake-smtp\r\n')
  socket.on('error', () => socket.destroy())
  socket.on('data', (chunk) => {
    pending += chunk.toString()
    const lines = pending.split('\r\n')
    pending = lines.pop() ?? ''
    for (const line of lines) {
      if (inData) {
        if (line === '.') {
          inData = false
          messages.push(current.join('\n'))
          current = []
          socket.write('250 queued\r\n')
        } else {
          current.push(line)
        }
        continue
      }
      const command = line.toUpperCase()
      if (command.startsWith('DATA')) {
        inData = true
        socket.write('354 go ahead\r\n')
      } else if (command.startsWith('QUIT')) {
        socket.end('221 bye\r\n')
      } else if (command.startsWith('EHLO')) {
        socket.write('250 fake-smtp\r\n')
      } else {
        socket.write('250 ok\r\n')
      }
    }
  })
}

export async function startFakeSmtp(): Promise<FakeSmtp> {
  const messages: string[] = []
  const server = net.createServer((socket) => serve(socket, messages))
  await new Promise<void>((resolve) => server.listen(0, '0.0.0.0', resolve))
  const { port } = server.address() as net.AddressInfo
  return {
    port,
    messages,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  }
}


import { Client } from 'ssh2';

const conn = new Client();

const config = {
  host: '85.31.62.181',
  port: 22,
  username: 'root',
  password: 'Mlez1HO;4xNsbuxF4u5@',
};

conn.on('ready', () => {
  console.log('Client :: ready');
  
  const commands = [
    'export TERM=xterm',
    'cd uptime-monitor',
    'echo "Git Fetch..."',
    'git fetch origin',
    'echo "Git Reset Hard (Forcing sync with remote)..."',
    'git reset --hard origin/master',
    'echo "Docker Compose Down..."',
    'docker compose down',
    'echo "Docker Compose Build (Backend)..."',
    'docker compose build --no-cache backend',
    'echo "Docker Compose Up..."',
    'docker compose up -d',
    'echo "Verificando logs..."',
    'sleep 5',
    'docker compose logs backend --tail=50'
  ];

  const command = commands.join(' && ');

  conn.exec(command, (err, stream) => {
    if (err) {
        console.error('Erro ao executar comando:', err);
        conn.end();
        return;
    }
    
    stream.on('close', (code, signal) => {
      console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
      conn.end();
    }).on('data', (data) => {
      process.stdout.write(data);
    }).stderr.on('data', (data) => {
      process.stderr.write(data);
    });
  });
}).on('error', (err) => {
    console.error('Erro na conexão SSH:', err);
}).connect(config);

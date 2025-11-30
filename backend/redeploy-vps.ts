import { Client } from 'ssh2';
import * as fs from 'fs';
import * as path from 'path';

const config = {
  host: '85.31.62.181',
  port: 22,
  username: 'root',
  password: 'Mlez1HO;4xNsbuxF4u5@',
};

const conn = new Client();

conn.on('ready', () => {
  console.log('Client :: ready');
  conn.exec('cd /root/uptime-monitor && git fetch --all && git reset --hard origin/master && docker compose down && docker compose build --no-cache backend && docker compose up -d', (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
      conn.end();
    }).on('data', (data) => {
      console.log('STDOUT: ' + data);
    }).stderr.on('data', (data) => {
      console.log('STDERR: ' + data);
    });
  });
}).connect(config);

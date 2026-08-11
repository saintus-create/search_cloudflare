import fs from 'fs';

const text = fs.readFileSync('extracted.txt', 'utf8').replace(/'/g, "''").replace(/\n/g, " ");

const url = 'pdf://the-pleadings-game';
const title = 'Thomas F. Gordon, The Pleadings Game – An Artificial Intelligence Model of Procedural Justice';

const sql = `INSERT INTO documents (url, title, content, metadata) VALUES ('${url}', '${title}', '${text}', '{}');`;
fs.writeFileSync('insert.sql', sql);

const kvObj = {
  url: url,
  title: title,
  content: text,
  timestamp: new Date().toISOString()
};
fs.writeFileSync('kv.json', JSON.stringify(kvObj));

console.log("SQL and KV payload created.");

const fs = require('fs');
const pdf = require('pdf-parse');

const filePath = '/home/user/uploads/Thomas F. Gordon, The Pleadings Game – An Artificial Intelligence Model of Procedural Justice (Arno R. Lodder) (z-library.sk, 1lib.sk, z-lib.sk).pdf';
const dataBuffer = fs.readFileSync(filePath);

pdf(dataBuffer).then(function(data) {
    const text = data.text.replace(/'/g, "''"); // Escape quotes for SQL
    
    // Create SQL insert
    const url = 'pdf://the-pleadings-game';
    const title = 'The Pleadings Game – An Artificial Intelligence Model of Procedural Justice';
    
    const sql = `INSERT INTO documents (url, title, content, metadata) VALUES ('${url}', '${title}', '${text}', '{}');`;
    fs.writeFileSync('insert.sql', sql);
    
    // Create KV payload
    const kvObj = {
      url: url,
      title: title,
      content: data.text,
      timestamp: new Date().toISOString()
    };
    fs.writeFileSync('kv_payload.json', JSON.stringify(kvObj));
    
    console.log("Extraction complete. Text length:", data.text.length);
});

const fs = require('fs');
const https = require('https');

const url = 'https://www.carrefour.ke/mafken/en/mayonnaise/kaputei-mayonnaise-700g/p/243985';

console.log(`Fetching ${url}...`);

https.get(url, {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
}, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        console.log('Response received. Length:', data.length);

        // Extract all script tags content
        const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
        let match;
        let scripts = [];
        while ((match = scriptRegex.exec(data)) !== null) {
            if (match[1].trim()) {
                scripts.push(match[1].trim());
            }
        }

        fs.writeFileSync('debug_scripts_dump.js', scripts.join('\n\n// ==========================================\n\n'));
        console.log(`Dumped ${scripts.length} scripts to debug_scripts_dump.js`);
    });
}).on('error', (err) => {
    console.error('Error:', err.message);
});

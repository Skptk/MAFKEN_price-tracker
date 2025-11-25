const cheerio = require('cheerio');

async function scrape() {
    const url = "https://www.carrefour.ke/mafken/en/gas-electric-cookers/armco-cooker-3g-1e-gc-f5831px-bk-/p/226012?offer=offer_carrefour_&sid=DEFAULT";
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });
    const html = await response.text();
    const $ = cheerio.load(html);

    console.log('--- Price Extraction Check ---');
    const bodyText = $('body').text();

    // Current regex (what we're using now)
    console.log('\n=== Current Regex (without commas) ===');
    const currentMatches = [...bodyText.matchAll(/(.{0,30})KES\s*(\d+(?:\.\d{2})?)/g)];
    currentMatches.slice(0, 5).forEach(m => console.log(`Context: "${m[1]}" -> KES ${m[2]}`));

    // Better regex (with comma support)
    console.log('\n=== Better Regex (with commas) ===');
    const betterMatches = [...bodyText.matchAll(/(.{0,30})KES\s*([\d,]+(?:\.\d{2})?)/g)];
    betterMatches.slice(0, 5).forEach(m => console.log(`Context: "${m[1]}" -> KES ${m[2]}`));

    console.log('\n=== Parsed Prices (removing commas) ===');
    const potentialPrices = [];
    for (const match of betterMatches) {
        const context = match[1].toLowerCase();
        const priceStr = match[2].replace(/,/g, ''); // Remove commas
        const val = parseFloat(priceStr);

        if (context.includes('save')) continue;

        potentialPrices.push(val);
        if (potentialPrices.length <= 5) {
            console.log(`Parsed: ${val} (from "${match[2]}")`);
        }
    }

    console.log('\n=== Final Result ===');
    if (potentialPrices.length > 0) {
        const price = potentialPrices[0];
        const maxPrice = Math.max(...potentialPrices);
        const originalPrice = maxPrice > price ? maxPrice : null;
        console.log('Current Price:', price);
        console.log('Original Price:', originalPrice);
    }
}

scrape();

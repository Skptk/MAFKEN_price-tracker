const cheerio = require('cheerio');

// Mock HTML with Data Layer
const mockHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Buy Kaputei Mayonnaise 700G Online | Carrefour Kenya</title>
  <script>
    dataLayer = [];
    dataLayer.push({
      "event": "view_item",
      "ecommerce": {
        "items": [{
          "item_name": "Kaputei Mayonnaise 700G",
          "price": 2450,
          "item_brand": "Kaputei",
          "item_category": "Mayonnaise"
        }]
      }
    });
    // Another pattern often seen
    dataLayer.push({
      "pageType": "product",
      "language": "en",
      "currency": "KES",
      "price": "2,450.00",
      "original_price": "2,800.00",
      "item_name": "Kaputei Mayonnaise 700G"
    });
  </script>
</head>
<body>
  <div class="product-price">
    <span>KES 2,450</span>
  </div>
</body>
</html>
`;

async function testScraper() {
    console.log('Testing Scraper Logic with Mock HTML...');
    const $ = cheerio.load(mockHtml);

    let price = null;
    let originalPrice = null;
    let name = null;
    let imageUrl = null;

    // 1. Try Data Layer (Logic copied from route.ts)
    const scripts = $('script').map((_, el) => $(el).html()).get();

    for (const script of scripts) {
        if (!script) continue;

        const pushMatches = script.matchAll(/dataLayer\.push\s*\(\s*({[\s\S]*?})\s*\)/g);
        for (const match of pushMatches) {
            try {
                const content = match[1];

                // Extract price
                const priceMatch = content.match(/['"]?price['"]?\s*:\s*['"]?([\d,.]+)['"]?/);
                if (priceMatch) {
                    const p = parseFloat(priceMatch[1].replace(/,/g, ''));
                    if (!isNaN(p)) price = p;
                }

                // Extract original price
                const originalPriceMatch = content.match(/['"]?(?:original_price|old_price|retail_price)['"]?\s*:\s*['"]?([\d,.]+)['"]?/);
                if (originalPriceMatch) {
                    const p = parseFloat(originalPriceMatch[1].replace(/,/g, ''));
                    if (!isNaN(p)) originalPrice = p;
                }

                // Extract name
                const nameMatch = content.match(/['"]?item_name['"]?\s*:\s*['"]([^'"]+)['"]/);
                if (nameMatch) name = nameMatch[1];

            } catch (e) {
                console.error('Error parsing script match:', e);
            }
        }
    }

    console.log('--- Results ---');
    console.log('Price:', price);
    console.log('Original Price:', originalPrice);
    console.log('Name:', name);

    if (price === 2450 && originalPrice === 2800 && name === 'Kaputei Mayonnaise 700G') {
        console.log('✅ TEST PASSED: Successfully extracted data from Data Layer');
    } else {
        console.log('❌ TEST FAILED: Data mismatch');
    }
}

testScraper();

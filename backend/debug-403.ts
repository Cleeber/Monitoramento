
import axios from 'axios';

const url = 'https://pontagrossaemdestaque.com.br/';

async function testRequest(headers: any, description: string) {
    console.log(`\n--- Test: ${description} ---`);
    try {
        const response = await axios.get(url, {
            headers: headers,
            validateStatus: () => true, // Accept all status codes
            timeout: 10000
        });
        console.log(`Status: ${response.status} ${response.statusText}`);
        console.log(`Content-Length: ${response.headers['content-length'] || response.data.length}`);
        if (response.status === 403) {
             console.log('Body snippet:', response.data.toString().substring(0, 200));
        }
    } catch (error: any) {
        console.log(`Error: ${error.message}`);
    }
}

async function run() {
    // 1. Current Default Headers
    await testRequest({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'sec-ch-ua': '"Chromium";v="122", "Not=A?Brand";v="24", "Google Chrome";v="122"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1'
    }, 'Current Headers');

    // 2. Minimal Headers
    await testRequest({
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
    }, 'Googlebot User-Agent');
    
    // 3. Postman Headers
    await testRequest({
        'User-Agent': 'PostmanRuntime/7.26.8',
        'Accept': '*/*',
        'Connection': 'keep-alive'
    }, 'Postman');

     // 4. No Headers
     await testRequest({}, 'No Headers');
}

run();

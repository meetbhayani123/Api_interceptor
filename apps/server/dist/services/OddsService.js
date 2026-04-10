export class OddsService {
    scraperApiKey = process.env.SCRAPER_API_KEY;
    // Rotate through multiple user agents
    userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) AppleWebKit/537.36 (KHTML, like Gecko) Firefox/123.0',
    ];
    // Real residential IP ranges (not reserved test ranges!)
    residentialIps = [
        '73.45.112.156', // Comcast/ISP
        '97.88.230.45', // Frontier/ISP
        '67.169.45.78', // Verizon/ISP
        '180.245.89.123', // International ISP
        '210.54.89.112', // Asian ISP
        '115.132.67.45', // South Asian
        '58.147.45.67', // Southeast Asian
    ];
    // Master set of realistic browser headers to bypass strict CDNs and WAFs
    get defaultHeaders() {
        const randomUserAgent = this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
        const randomIp = this.residentialIps[Math.floor(Math.random() * this.residentialIps.length)];
        return {
            'accept': 'application/json, text/plain, */*',
            'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
            'accept-encoding': 'gzip, deflate, br',
            'origin': 'https://11xplay.pink',
            'referer': 'https://11xplay.pink/',
            'priority': 'u=1, i',
            'sec-ch-ua': '"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Linux"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-site',
            'user-agent': randomUserAgent,
            'cache-control': 'no-cache',
            'pragma': 'no-cache',
            'connection': 'keep-alive',
            'upgrade-insecure-requests': '1',
            'dnt': '1',
        };
    }
    /**
     * Fetch with retry logic and optional proxy bypass
     */
    async fetchWithRetry(url, options, maxRetries = 3) {
        let lastError = null;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                // Direct fetch with fresh headers each attempt
                const freshOptions = {
                    ...options,
                    headers: { ...this.defaultHeaders, ...(options.headers || {}) }
                };
                console.log(`[OddsService] Attempt ${attempt + 1}/3: Direct request to ${url}`);
                const response = await fetch(url, freshOptions);
                // If we get a successful response, return immediately
                if (response.ok) {
                    return response;
                }
                // Check if response is blocked (403/429)
                if (response.status === 403 || response.status === 429) {
                    const contentType = response.headers.get('content-type');
                    const isHtml = contentType?.includes('text/html');
                    if (isHtml) {
                        lastError = new Error(`Cloudflare WAF blocked (${response.status}). ${attempt < maxRetries - 1 ? 'Retrying...' : 'Need proxy.'}`);
                        console.warn(`[OddsService] ${lastError.message}`);
                        if (attempt < maxRetries - 1) {
                            const delayMs = 1000 * Math.pow(2, attempt);
                            console.log(`[OddsService] Waiting ${delayMs}ms before retry...`);
                            await this.delay(delayMs);
                            continue; // Try next attempt
                        }
                    }
                }
                return response;
            }
            catch (error) {
                lastError = error;
                console.error(`[OddsService] Attempt ${attempt + 1}/3 error:`, lastError.message);
                if (attempt < maxRetries - 1) {
                    const delayMs = 1000 * Math.pow(2, attempt);
                    await this.delay(delayMs);
                }
            }
        }
        throw lastError || new Error('All retry attempts failed. Please configure SCRAPER_API_KEY for proxy support.');
    }
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    async readJsonResponse(response, context) {
        const text = await response.text();
        try {
            return JSON.parse(text);
        }
        catch {
            const contentType = response.headers.get('content-type') || 'unknown';
            console.error(`[OddsService] ${context} returned non-JSON response`, {
                status: response.status,
                statusText: response.statusText,
                contentType,
                body: text,
            });
            throw new Error(`${context} returned non-JSON response (${response.status} ${response.statusText}, ${contentType}): ${text}`);
        }
    }
    /**
     * getEventDetails(eventId) -> Returns Teams and Market ID.
     */
    async getEventDetails(eventId) {
        if (!/^\d+$/.test(eventId)) {
            throw new Error('Security Alert: Invalid eventId. Must contain only numeric values.');
        }
        const url = `https://api.11xplay.pink/api/guest/event/${eventId}`;
        try {
            const response = await this.fetchWithRetry(url, {
                method: 'POST',
                headers: {
                    'content-type': 'application/x-www-form-urlencoded',
                    'authorization': ''
                },
                body: ''
            });
            const data = await this.readJsonResponse(response, `getEventDetails(${eventId})`);
            const runners = data.data?.event?.match_odds?.runners || data.match_odds?.runners || [];
            let team1 = runners.length > 0 ? runners[0].name : 'Unknown Team A';
            let team2 = runners.length > 1 ? runners[1].name : 'Unknown Team B';
            if (team1 === 'Unknown Team A' && team2 === 'Unknown Team B') {
                const matchName = data.data?.event?.event?.name || data.name || data.event?.name || '';
                if (matchName.includes(' v ')) {
                    const parts = matchName.split(' v ');
                    team1 = parts[0]?.trim();
                    team2 = parts[1]?.trim();
                }
                else if (matchName.includes(' vs ')) {
                    const parts = matchName.split(' vs ');
                    team1 = parts[0]?.trim();
                    team2 = parts[1]?.trim();
                }
                else if (matchName) {
                    team1 = matchName;
                }
            }
            const marketId = data.data?.event?.match_odds?.market_id || data.match_odds?.market_id;
            if (!marketId) {
                throw new Error('market_id not explicitly found in match_odds object');
            }
            return {
                team1,
                team2,
                marketId
            };
        }
        catch (error) {
            console.error('OddsService: Error fetching event details:', error);
            throw error;
        }
    }
    /**
     * getMarketOdds(marketId) -> Uses the ID from Function A to get the actual prices.
     */
    async getMarketOdds(marketId) {
        if (!/^[a-zA-Z0-9.\-]+$/.test(marketId)) {
            throw new Error('Security Alert: Invalid marketId.');
        }
        const url = `https://api.11xplay.pink/api/guest/market/${marketId}`;
        try {
            const response = await this.fetchWithRetry(url, {
                method: 'POST',
                headers: {
                    'content-type': 'application/x-www-form-urlencoded',
                    'authorization': ''
                },
                body: ''
            });
            return await this.readJsonResponse(response, `getMarketOdds(${marketId})`);
        }
        catch (error) {
            console.error('OddsService: Error fetching market odds:', error);
            throw error;
        }
    }
    /**
     * getSnapshotData(marketId) -> Uses the /ws/getMarketDataNew endpoint to get odds & prices
     */
    async getSnapshotData(marketId) {
        if (!/^[a-zA-Z0-9.\-]+$/.test(marketId)) {
            throw new Error('Security Alert: Invalid marketId.');
        }
        const url = 'https://odds.o11xplay.com/ws/getMarketDataNew';
        try {
            const response = await this.fetchWithRetry(url, {
                method: 'POST',
                headers: {
                    'content-type': 'application/x-www-form-urlencoded',
                    'origin': 'https://11xplay.pink',
                    'referer': 'https://11xplay.pink/'
                },
                body: new URLSearchParams({ 'market_ids[]': marketId }).toString()
            });
            const data = await this.readJsonResponse(response, `getSnapshotData(${marketId})`);
            if (!Array.isArray(data) || data.length === 0) {
                throw new Error('No data found for marketId snapshot');
            }
            const rawString = data[0];
            const parts = rawString.split('|');
            let active1 = -1;
            let active2 = -1;
            for (let i = 0; i < parts.length; i++) {
                if (parts[i] === 'ACTIVE') {
                    if (active1 === -1) {
                        active1 = i;
                    }
                    else if (active2 === -1) {
                        active2 = i;
                        break;
                    }
                }
            }
            if (active1 === -1 || active2 === -1) {
                throw new Error('Could not find ACTIVE markers for both teams in response');
            }
            const teamA = {
                odds: [parseFloat(parts[active1 + 1]), parseFloat(parts[active1 + 7])],
                pricing: [parseFloat(parts[active1 + 2]), parseFloat(parts[active1 + 8])]
            };
            const teamB = {
                odds: [parseFloat(parts[active2 + 1]), parseFloat(parts[active2 + 7])],
                pricing: [parseFloat(parts[active2 + 2]), parseFloat(parts[active2 + 8])]
            };
            return { teamA, teamB };
        }
        catch (error) {
            console.error('OddsService: Error fetching snapshot data:', error);
            throw error;
        }
    }
}

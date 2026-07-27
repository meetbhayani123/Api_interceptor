export class OddsService {
    scraperApiKey = process.env.SCRAPER_API_KEY;
    // Rotate through multiple user agents — keep versions current to avoid fingerprint mismatch
    userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:138.0) Gecko/20100101 Firefox/138.0',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36 Edg/147.0.0.0',
    ];
    // Residential IPs for X-Forwarded-For spoofing
    residentialIps = [
        '103.152.220.44',
        '182.69.11.23',
        '49.36.128.91',
        '223.238.45.67',
        '117.217.89.134',
        '59.89.176.42',
        '106.210.34.78',
        '157.47.112.56',
    ];
    /**
     * Build fresh browser-like headers for each request.
     * Cloudflare checks several header fingerprint signals — we must match a real browser closely.
     */
    buildFreshHeaders() {
        const randomUserAgent = this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
        const randomIp = this.residentialIps[Math.floor(Math.random() * this.residentialIps.length)];
        const isFirefox = randomUserAgent.includes('Firefox');
        const headers = {
            'accept': 'application/json, text/plain, */*',
            'accept-language': 'en-US,en;q=0.9,hi;q=0.8',
            'origin': 'https://11xplay.pink',
            'referer': 'https://11xplay.pink/',
            'user-agent': randomUserAgent,
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-site',
            'connection': 'keep-alive',
            'dnt': '1',
            // Spoof forwarded IP so the CDN/WAF edge sees a residential address
            'x-forwarded-for': randomIp,
            'x-real-ip': randomIp,
        };
        // Chromium-based browsers send these; Firefox does not
        if (!isFirefox) {
            headers['sec-ch-ua'] = '"Chromium";v="148", "Google Chrome";v="148", "Not/A)Brand";v="99"';
            headers['sec-ch-ua-mobile'] = '?0';
            headers['sec-ch-ua-platform'] = '"Linux"';
            headers['priority'] = 'u=1, i';
        }
        return headers;
    }
    /**
     * Fetch with retry logic + optional ScraperAPI proxy fallback.
     *
     * Strategy:
     *   Attempt 1-2: Direct request with rotating browser headers
     *   Attempt 3  : If SCRAPER_API_KEY is set, route through ScraperAPI residential proxy
     *                Otherwise, try direct one more time with a longer delay
     */
    async fetchWithRetry(url, options, maxRetries = 3) {
        let lastError = null;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const isLastAttempt = attempt === maxRetries - 1;
                const useProxy = isLastAttempt && !!this.scraperApiKey;
                let fetchUrl = url;
                let fetchOptions;
                if (useProxy) {
                    // ScraperAPI residential proxy — bypasses Cloudflare reliably
                    fetchUrl = `https://api.scraperapi.com?api_key=${this.scraperApiKey}&url=${encodeURIComponent(url)}&render=false&country_code=in`;
                    fetchOptions = {
                        method: options.method || 'POST',
                        headers: {
                            'content-type': options.headers?.['content-type'] || 'application/x-www-form-urlencoded',
                        },
                        body: options.body,
                    };
                    console.log(`[OddsService] Attempt ${attempt + 1}/${maxRetries}: Using ScraperAPI proxy for ${url}`);
                }
                else {
                    fetchOptions = {
                        ...options,
                        headers: { ...this.buildFreshHeaders(), ...(options.headers || {}) },
                    };
                    console.log(`[OddsService] Attempt ${attempt + 1}/${maxRetries}: Direct request to ${url}`);
                }
                const response = await fetch(fetchUrl, fetchOptions);
                // Successful response — return immediately
                if (response.ok) {
                    console.log(`[OddsService] ✅ Success on attempt ${attempt + 1} for ${url}`);
                    return response;
                }
                // Blocked by WAF (403/429 with HTML body)
                if (response.status === 403 || response.status === 429) {
                    const contentType = response.headers.get('content-type') || '';
                    if (contentType.includes('text/html')) {
                        const body = await response.text();
                        const isCloudflare = body.includes('cloudflare') || body.includes('Cloudflare');
                        lastError = new Error(`WAF blocked (${response.status}${isCloudflare ? ', Cloudflare' : ''}). ` +
                            `${!isLastAttempt ? 'Retrying...' : useProxy ? 'Proxy also blocked.' : 'Configure SCRAPER_API_KEY for proxy fallback.'}`);
                        console.warn(`[OddsService] ${lastError.message}`);
                        if (!isLastAttempt) {
                            const delayMs = 1500 * Math.pow(2, attempt); // 1.5s, 3s
                            console.log(`[OddsService] Waiting ${delayMs}ms before retry...`);
                            await this.delay(delayMs);
                            continue;
                        }
                        // On last attempt, throw with helpful context
                        throw lastError;
                    }
                }
                // Non-WAF error — return as-is for caller to handle
                return response;
            }
            catch (error) {
                lastError = error;
                console.error(`[OddsService] Attempt ${attempt + 1}/${maxRetries} error:`, lastError.message);
                if (attempt < maxRetries - 1) {
                    const delayMs = 1500 * Math.pow(2, attempt);
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

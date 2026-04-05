export class OddsService {
  private scraperApiKey = process.env.SCRAPER_API_KEY;
  
  // Rotate through multiple user agents
  private userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) AppleWebKit/537.36 (KHTML, like Gecko) Firefox/123.0',
  ];

  // Rotate through realistic residential IPs
  private residentialIps = [
    '203.0.113.45',
    '198.51.100.78',
    '192.0.2.112',
    '14.139.60.10',
    '203.112.45.89',
  ];

  // Master set of realistic browser headers to bypass strict CDNs and WAFs
  private get defaultHeaders() {
    const randomUserAgent = this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
    const randomIp = this.residentialIps[Math.floor(Math.random() * this.residentialIps.length)];
    
    return {
      'accept': 'application/json, text/plain, */*',
      'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
      'accept-encoding': 'gzip, deflate, br',
      'origin': 'https://www.11xplay.pink',
      'referer': 'https://www.11xplay.pink/',
      'priority': 'u=1, i',
      'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-site',
      'user-agent': randomUserAgent,
      'x-forwarded-for': randomIp,
      'client-ip': randomIp,
      'true-client-ip': randomIp,
      'x-real-ip': randomIp,
      'cache-control': 'no-cache',
      'pragma': 'no-cache',
      'connection': 'keep-alive',
      'upgrade-insecure-requests': '1',
    };
  }

  /**
   * Fetch with retry logic and optional proxy bypass
   */
  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    maxRetries: number = 3
  ): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // If ScraperAPI key is available and this is an attempt retry, use proxy
        if (attempt > 0 && this.scraperApiKey) {
          const proxyUrl = `http://api.scraperapi.com?api_key=${this.scraperApiKey}&url=${encodeURIComponent(url)}`;
          console.log(`[OddsService] Attempt ${attempt + 1}: Using proxy for ${url}`);
          
          const response = await fetch(proxyUrl, {
            method: 'GET', // ScraperAPI prefers GET
            headers: {
              'Accept': 'application/json',
              'User-Agent': this.userAgents[Math.floor(Math.random() * this.userAgents.length)],
            },
          });
          return response;
        }

        // Direct fetch with fresh headers each attempt
        const freshOptions = {
          ...options,
          headers: { ...this.defaultHeaders, ...(options.headers || {}) }
        };

        console.log(`[OddsService] Attempt ${attempt + 1}: Direct request to ${url}`);
        const response = await fetch(url, freshOptions);

        // If we get a successful JSON response, return immediately
        if (response.ok || response.status === 200) {
          return response;
        }

        // If we get 403/429 (blocked), retry
        if (response.status === 403 || response.status === 429) {
          lastError = new Error(`WAF blocked (${response.status}). Retrying...`);
          console.warn(lastError.message);
          // Wait before retry (exponential backoff)
          await this.delay(1000 * Math.pow(2, attempt));
          continue;
        }

        return response;
      } catch (error) {
        lastError = error as Error;
        console.error(`[OddsService] Attempt ${attempt + 1} failed:`, lastError.message);
        
        if (attempt < maxRetries - 1) {
          await this.delay(1000 * Math.pow(2, attempt));
        }
      }
    }

    throw lastError || new Error('All retry attempts failed');
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * getEventDetails(eventId) -> Returns Teams and Market ID.
   */
  public async getEventDetails(eventId: string) {
    if (!/^\d+$/.test(eventId)) {
      throw new Error('Security Alert: Invalid eventId. Must contain only numeric values.');
    }

    const url = `https://api.11xplay.pink/api/guest/event/${eventId}`;

    try {
      const response = await this.fetchWithRetry(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}'
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (err) {
        throw new Error('Invalid JSON response from server: ' + text.substring(0, 100));
      }

      const runners = data.data?.event?.match_odds?.runners || data.match_odds?.runners || [];

      let team1 = runners.length > 0 ? runners[0].name : 'Unknown Team A';
      let team2 = runners.length > 1 ? runners[1].name : 'Unknown Team B';

      if (team1 === 'Unknown Team A' && team2 === 'Unknown Team B') {
        const matchName = data.data?.event?.event?.name || data.name || data.event?.name || '';
        if (matchName.includes(' v ')) {
          const parts = matchName.split(' v ');
          team1 = parts[0]?.trim();
          team2 = parts[1]?.trim();
        } else if (matchName.includes(' vs ')) {
          const parts = matchName.split(' vs ');
          team1 = parts[0]?.trim();
          team2 = parts[1]?.trim();
        } else if (matchName) {
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
    } catch (error) {
      console.error('OddsService: Error fetching event details:', error);
      throw error;
    }
  }

  /**
   * getMarketOdds(marketId) -> Uses the ID from Function A to get the actual prices.
   */
  public async getMarketOdds(marketId: string) {
    if (!/^[a-zA-Z0-9.\-]+$/.test(marketId)) {
      throw new Error('Security Alert: Invalid marketId.');
    }

    const url = `https://api.11xplay.pink/api/guest/market/${marketId}`;

    try {
      const response = await this.fetchWithRetry(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}'
      });

      const text = await response.text();
      try {
        return JSON.parse(text);
      } catch (err) {
        throw new Error('Invalid JSON response from server: ' + text.substring(0, 100));
      }
    } catch (error) {
      console.error('OddsService: Error fetching market odds:', error);
      throw error;
    }
  }

  /**
   * getSnapshotData(marketId) -> Uses the /ws/getMarketDataNew endpoint to get odds & prices
   */
  public async getSnapshotData(marketId: string) {
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

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (err) {
        throw new Error('Invalid JSON snapshot: ' + text.substring(0, 100));
      }

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
          } else if (active2 === -1) {
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
    } catch (error) {
      console.error('OddsService: Error fetching snapshot data:', error);
      throw error;
    }
  }
}

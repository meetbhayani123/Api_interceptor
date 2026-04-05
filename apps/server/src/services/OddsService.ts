export class OddsService {
  // Master set of realistic browser headers to bypass strict CDNs and WAFs
  private get defaultHeaders() {
    return {
      'accept': 'application/json, text/plain, */*',
      'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
      'origin': 'https://www.11xplay.pink',
      'referer': 'https://www.11xplay.pink/',
      'priority': 'u=1, i',
      'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-site',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      // Spoof residential IP addresses to bypass Cloudflare/WAF block on Render datacenter IPs
      'x-forwarded-for': `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
      'client-ip': '14.139.60.10',
      'true-client-ip': '14.139.60.10',
      'x-real-ip': '14.139.60.10',
      'cache-control': 'no-cache',
      'pragma': 'no-cache'
    };
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
      const response = await fetch(url, {
        method: 'POST',
        headers: { ...this.defaultHeaders, 'content-type': 'application/json' },
        body: '{}'
      });

      console.log("response=====================================", response)

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
      const response = await fetch(url, {
        method: 'POST',
        headers: { ...this.defaultHeaders, 'content-type': 'application/json' },
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
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...this.defaultHeaders,
          'content-type': 'application/x-www-form-urlencoded',
          // Override origins specifically for the odds socket endpoint
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

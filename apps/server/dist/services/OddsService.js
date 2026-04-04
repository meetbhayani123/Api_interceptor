import { exec } from 'child_process';
import { promisify } from 'util';
const execPromise = promisify(exec);
export class OddsService {
    /**
     * getEventDetails(eventId) -> Returns Teams and Market ID.
     *
     * Takes an eventId, sanitizes it to prevent shell injection, and runs a curl
     * request against 11xplay system simulating a generic browser request.
     */
    async getEventDetails(eventId) {
        // 1. Handling Shell Injection: Strict regex check ensuring only numeric values are passed
        if (!/^\d+$/.test(eventId)) {
            throw new Error('Security Alert: Invalid eventId. Must contain only numeric values.');
        }
        const url = `https://api.11xplay.pink/api/guest/event/${eventId}`;
        // 2. Fetch using system curl with explicit browser headers
        const command = `curl -s -X POST "${url}" \\
      -H "Origin: https://www.11xplay.pink" \\
      -H "Referer: https://www.11xplay.pink/" \\
      -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36" \\
      -H "Content-Type: application/json" -d '{}'`;
        try {
            const { stdout } = await execPromise(command);
            let response;
            try {
                response = JSON.parse(stdout);
            }
            catch (err) {
                throw new Error('Invalid JSON response from server: ' + stdout.substring(0, 100));
            }
            // 3. Data Extraction
            // A. Extract Team Names natively from runners if possible
            const runners = response.data?.event?.match_odds?.runners || response.match_odds?.runners || [];
            let team1 = runners.length > 0 ? runners[0].name : 'Unknown Team A';
            let team2 = runners.length > 1 ? runners[1].name : 'Unknown Team B';
            // Fallback parsing if runners array is unexpectedly missing
            if (team1 === 'Unknown Team A' && team2 === 'Unknown Team B') {
                const matchName = response.data?.event?.event?.name || response.name || response.event?.name || '';
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
                    team1 = matchName; // fallback if splitting fails
                }
            }
            // B. Extract market_id from the match_odds object
            const marketId = response.data?.event?.match_odds?.market_id || response.match_odds?.market_id;
            if (!marketId) {
                throw new Error('market_id not explicitly found in match_odds object');
            }
            // Return clean JSON object
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
        // Sanitize marketId (allowing dots, dashes, and alphanumerics) to prevent injection
        if (!/^[a-zA-Z0-9.\-]+$/.test(marketId)) {
            throw new Error('Security Alert: Invalid marketId.');
        }
        const url = `https://api.11xplay.pink/api/guest/market/${marketId}`;
        const command = `curl -s -X POST "${url}" \\
      -H "Origin: https://www.11xplay.pink" \\
      -H "Referer: https://www.11xplay.pink/" \\
      -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" \\
      -H "Content-Type: application/json" -d '{}'`;
        try {
            const { stdout } = await execPromise(command);
            try {
                return JSON.parse(stdout); // Returning raw prices object
            }
            catch (err) {
                throw new Error('Invalid JSON response from server: ' + stdout.substring(0, 100));
            }
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
        const command = `curl -s --location 'https://odds.o11xplay.com/ws/getMarketDataNew' \\
      --header 'accept: application/json, text/plain, */*' \\
      --header 'content-type: application/x-www-form-urlencoded' \\
      --header 'origin: https://11xplay.pink' \\
      --header 'referer: https://11xplay.pink/' \\
      --header 'user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' \\
      --data-urlencode 'market_ids[]=${marketId}'`;
        try {
            const { stdout } = await execPromise(command);
            let data;
            try {
                data = JSON.parse(stdout);
            }
            catch (err) {
                throw new Error('Invalid JSON snapshot: ' + stdout.substring(0, 100));
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

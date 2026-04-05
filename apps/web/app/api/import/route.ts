import mongoose, { Schema } from 'mongoose';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

function readMongoUriFromEnvFiles(): string | null {
  const candidatePaths = [
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../server/.env'),
    path.resolve(process.cwd(), '../../apps/server/.env'),
  ];

  for (const envPath of candidatePaths) {
    try {
      if (!fs.existsSync(envPath)) continue;
      const content = fs.readFileSync(envPath, 'utf-8');
      const match = content.match(/^MONGO_URI=(.*)$/m) || content.match(/^MONGODB_URI=(.*)$/m);
      if (match?.[1]) {
        return match[1].trim();
      }
    } catch {
      // Ignore path read errors and continue checking fallbacks.
    }
  }

  return null;
}

function getMongoUri(): string | null {
  return (
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    process.env.DATABASE_URL ||
    process.env.NEXT_PUBLIC_MONGO_URI ||
    readMongoUriFromEnvFiles()
  );
}

const MatchSchema = new Schema(
  {
    eventId: { type: String, required: false, index: true },
    marketId: { type: String, required: false },
    name: { type: String, required: true },
    teamA: { type: String, required: false },
    teamB: { type: String, required: false },
    startTime: { type: Date, required: true },
    status: {
      type: String,
      enum: ['upcoming', 'running', 'completed'],
      default: 'upcoming',
    },
    oddsHistory: { type: Array, default: [] },
  },
  { timestamps: true }
);

const MatchModel = mongoose.models.Match || mongoose.model('Match', MatchSchema);

let mongoConnectionPromise: Promise<typeof mongoose> | null = null;

async function connectToMongo() {
  const mongoUri = getMongoUri();

  if (!mongoUri) {
    throw new Error(
      'Mongo connection is not configured. Set one of: MONGO_URI, MONGODB_URI, or DATABASE_URL, or provide it in an env file.'
    );
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  if (!mongoConnectionPromise) {
    mongoConnectionPromise = mongoose.connect(mongoUri as string);
  }

  return mongoConnectionPromise;
}

function buildBrowserHeaders() {
  return {
    accept: 'application/json, text/plain, */*',
    'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
    'content-type': 'application/x-www-form-urlencoded',
    origin: 'https://11xplay.pink',
    referer: 'https://11xplay.pink/',
    priority: 'u=1, i',
    'sec-ch-ua': '"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Linux"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-site',
    'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
  };
}

async function readJsonResponse(response: Response, context: string) {
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${context} returned non-JSON response (${response.status} ${response.statusText}): ${text}`);
  }
}

function extractTeams(payload: any) {
  const runners = payload.data?.event?.match_odds?.runners || payload.match_odds?.runners || [];
  let team1 = runners.length > 0 ? runners[0].name : 'Unknown Team A';
  let team2 = runners.length > 1 ? runners[1].name : 'Unknown Team B';

  if (team1 === 'Unknown Team A' && team2 === 'Unknown Team B') {
    const matchName = payload.data?.event?.event?.name || payload.name || payload.event?.name || '';
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

  const marketId = payload.data?.event?.match_odds?.market_id || payload.match_odds?.market_id;
  const name = payload.data?.event?.event?.name || payload.name || `${team1} vs ${team2}`;

  return { team1, team2, marketId, name };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawIds = body.eventIds ?? body.eventId;

    if (!rawIds) {
      return NextResponse.json({ error: 'eventIds is required' }, { status: 400 });
    }

    const ids = Array.isArray(rawIds)
      ? rawIds
      : String(rawIds).split(/[\s,]+/).filter(Boolean);

    if (ids.length === 0) {
      return NextResponse.json({ error: 'No valid event IDs found' }, { status: 400 });
    }

    const imported: any[] = [];
    const errors: Array<{ id: string; message: string }> = [];

    for (const eventId of ids) {
      try {
        const eventResponse = await fetch(`https://api.11xplay.pink/api/guest/event/${eventId}`, {
          method: 'POST',
          headers: buildBrowserHeaders(),
          body: '',
        });

        const text = await eventResponse.text();
        let payload: any;

        try {
          payload = JSON.parse(text);
        } catch {
          throw new Error(
            `getEventDetails(${eventId}) returned non-JSON response (${eventResponse.status} ${eventResponse.statusText}, ${eventResponse.headers.get('content-type') || 'unknown'}): ${text}`
          );
        }

        const { team1, team2, marketId, name } = extractTeams(payload);

        if (!marketId) {
          throw new Error(`market_id not found for event ${eventId}`);
        }

        await connectToMongo();

        const match = await MatchModel.findOneAndUpdate(
          { eventId },
          {
            $set: {
              marketId,
              name,
              teamA: team1,
              teamB: team2,
            },
            $setOnInsert: {
              startTime: new Date(),
              status: 'upcoming',
              oddsHistory: [],
            },
          },
          { new: true, upsert: true }
        );

        imported.push(match);
      } catch (error: any) {
        errors.push({ id: String(eventId), message: error.message || 'Failed to import' });
      }
    }

    return NextResponse.json({
      message: `Finished importing. Success: ${imported.length}, Failed: ${errors.length}`,
      matches: imported,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal error handling import' },
      { status: 500 }
    );
  }
}